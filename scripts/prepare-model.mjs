/**
 * Turns the raw Hasaleh scan into the compact mesh the site loads.
 *
 *   node scripts/prepare-model.mjs
 *
 * The scan is 21 MB of ASCII OBJ with 265k faces. The page renders it through a
 * 3px dither, so most of that detail cannot survive to the screen — this script
 * welds it down to a fraction of the triangles and writes a small binary blob.
 *
 * Source of truth stays the OBJ in `hasaleh media/`. Re-run this after a rescan.
 *
 * Output format (public/hasaleh.mesh), little-endian:
 *   0  char[4]    "HSLH"
 *   4  uint32     format version (2)
 *   8  uint32     vertex count
 *  12  uint32     index count
 *  16  float32[3] bounds min (after transform)
 *  28  float32[3] bounds max (after transform)
 *  40  uint32     bytes per index — 2 when the mesh fits in Uint16, else 4
 *  44  ...        zero padding to 64
 *  64  float32[]  positions, 3 per vertex
 *   +  float32[]  normals, 3 per vertex (unit length)
 *   +  uint16[]/uint32[]  triangle indices
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const SOURCE = path.resolve(ROOT, '../hasaleh media/hasaleh scan.obj');
const OUTPUT = path.join(ROOT, 'public', 'hasaleh.mesh');

/**
 * Grid cells across the bounding-box diagonal. Higher keeps more detail.
 * 110 lands around 30k triangles — comfortably more than a 3px dither can
 * resolve, while keeping the scan's surface irregularity, which the dither
 * turns into texture rather than noise.
 */
const CLUSTER_RESOLUTION = 110;
/** Final height in world units, so the camera framing stays put. */
const TARGET_HEIGHT = 2.1;

function readObj(file) {
  const text = fs.readFileSync(file, 'utf8');
  const positions = [];
  const faces = [];

  for (const rawLine of text.split('\n')) {
    if (rawLine.length < 2) continue;
    const kind = rawLine[0];

    if (kind === 'v' && rawLine[1] === ' ') {
      const p = rawLine.split(/\s+/);
      positions.push(+p[1], +p[2], +p[3]);
    } else if (kind === 'f' && rawLine[1] === ' ') {
      const parts = rawLine.trim().split(/\s+/).slice(1);
      // "f v/vt/vn" — only the position index matters here.
      const corners = parts.map((token) => {
        const slash = token.indexOf('/');
        const raw = Number.parseInt(slash === -1 ? token : token.slice(0, slash), 10);
        // OBJ indices are 1-based, and negative means "counting back from the end".
        return raw > 0 ? raw - 1 : positions.length / 3 + raw;
      });
      // Fan-triangulate anything with more than three corners.
      for (let i = 1; i + 1 < corners.length; i++) {
        faces.push(corners[0], corners[i], corners[i + 1]);
      }
    }
  }

  return { positions: Float64Array.from(positions), faces: Uint32Array.from(faces) };
}

function bounds(positions) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < positions.length; i += 3) {
    for (let a = 0; a < 3; a++) {
      const v = positions[i + a];
      if (v < min[a]) min[a] = v;
      if (v > max[a]) max[a] = v;
    }
  }
  return { min, max, size: max.map((m, i) => m - min[i]) };
}

/**
 * Measures how far the axis of revolution leans off +Y, by comparing the
 * centroid of a low slice against a high slice. A scan is rarely perfectly
 * upright and a lean is very visible once the model is spinning.
 */
function measureTilt(positions, box) {
  const yMin = box.min[1];
  const height = box.size[1];
  const low = { x: 0, z: 0, n: 0 };
  const high = { x: 0, z: 0, n: 0 };

  for (let i = 0; i < positions.length; i += 3) {
    const t = (positions[i + 1] - yMin) / height;
    // Sample the sphere's body, avoiding the pedestal flare and the apex nub.
    if (t > 0.3 && t < 0.45) {
      low.x += positions[i];
      low.z += positions[i + 2];
      low.n++;
    } else if (t > 0.7 && t < 0.85) {
      high.x += positions[i];
      high.z += positions[i + 2];
      high.n++;
    }
  }
  if (!low.n || !high.n) return { degrees: 0, axis: [0, 1, 0] };

  const dx = high.x / high.n - low.x / low.n;
  const dz = high.z / high.n - low.z / low.n;
  const dy = height * 0.375;
  const lean = Math.hypot(dx, dz);
  return { degrees: (Math.atan2(lean, dy) * 180) / Math.PI, dx, dz, dy };
}

/**
 * Vertex-cluster decimation: snap every vertex into a uniform grid cell, replace
 * each occupied cell with the average of the vertices that fell in it, then drop
 * faces that collapsed. Cheap, robust on messy scan topology, and the error it
 * introduces is far below one dither block.
 */
function decimate(positions, faces, box) {
  const diagonal = Math.hypot(box.size[0], box.size[1], box.size[2]);
  const cell = diagonal / CLUSTER_RESOLUTION;

  const cellOf = new Map();
  const remap = new Uint32Array(positions.length / 3);
  const sums = [];

  for (let v = 0; v < positions.length / 3; v++) {
    const i = v * 3;
    const cx = Math.floor(positions[i] / cell);
    const cy = Math.floor(positions[i + 1] / cell);
    const cz = Math.floor(positions[i + 2] / cell);
    const key = `${cx},${cy},${cz}`;

    let index = cellOf.get(key);
    if (index === undefined) {
      index = sums.length / 4;
      cellOf.set(key, index);
      sums.push(0, 0, 0, 0);
    }
    remap[v] = index;
    const s = index * 4;
    sums[s] += positions[i];
    sums[s + 1] += positions[i + 1];
    sums[s + 2] += positions[i + 2];
    sums[s + 3]++;
  }

  const vertexCount = sums.length / 4;
  const out = new Float32Array(vertexCount * 3);
  for (let v = 0; v < vertexCount; v++) {
    const s = v * 4;
    const n = sums[s + 3];
    out[v * 3] = sums[s] / n;
    out[v * 3 + 1] = sums[s + 1] / n;
    out[v * 3 + 2] = sums[s + 2] / n;
  }

  // Rebuild faces, dropping collapsed ones and any exact duplicates.
  const indices = [];
  const seen = new Set();
  for (let f = 0; f < faces.length; f += 3) {
    const a = remap[faces[f]];
    const b = remap[faces[f + 1]];
    const c = remap[faces[f + 2]];
    if (a === b || b === c || a === c) continue;
    const key = [a, b, c].sort((p, q) => p - q).join(',');
    if (seen.has(key)) continue;
    seen.add(key);
    indices.push(a, b, c);
  }

  return { positions: out, indices: Uint32Array.from(indices) };
}

/** Area-weighted smooth normals — the cross product length is twice the area. */
function computeNormals(positions, indices) {
  const normals = new Float32Array(positions.length);

  for (let i = 0; i < indices.length; i += 3) {
    const a = indices[i] * 3;
    const b = indices[i + 1] * 3;
    const c = indices[i + 2] * 3;

    const e1x = positions[b] - positions[a];
    const e1y = positions[b + 1] - positions[a + 1];
    const e1z = positions[b + 2] - positions[a + 2];
    const e2x = positions[c] - positions[a];
    const e2y = positions[c + 1] - positions[a + 1];
    const e2z = positions[c + 2] - positions[a + 2];

    const nx = e1y * e2z - e1z * e2y;
    const ny = e1z * e2x - e1x * e2z;
    const nz = e1x * e2y - e1y * e2x;

    for (const v of [a, b, c]) {
      normals[v] += nx;
      normals[v + 1] += ny;
      normals[v + 2] += nz;
    }
  }

  for (let i = 0; i < normals.length; i += 3) {
    const len = Math.hypot(normals[i], normals[i + 1], normals[i + 2]);
    if (len > 0) {
      normals[i] /= len;
      normals[i + 1] /= len;
      normals[i + 2] /= len;
    } else {
      normals[i + 1] = 1;
    }
  }

  return normals;
}

/**
 * Rotates the measured axis of revolution onto +Y. On a model that spins
 * continuously, even a two-degree lean reads as a wobble.
 */
function uprightify(positions, tilt) {
  const length = Math.hypot(tilt.dx, tilt.dy, tilt.dz);
  if (!length) return 0;

  // from = the scan's actual axis, to = +Y. Rotate about their cross product.
  const from = [tilt.dx / length, tilt.dy / length, tilt.dz / length];
  let axis = [from[2], 0, -from[0]]; // cross(from, [0,1,0])
  const axisLength = Math.hypot(axis[0], axis[1], axis[2]);
  if (axisLength < 1e-9) return 0;
  axis = axis.map((c) => c / axisLength);

  const angle = Math.acos(Math.min(1, Math.max(-1, from[1])));
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const [kx, ky, kz] = axis;

  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i];
    const y = positions[i + 1];
    const z = positions[i + 2];
    // Rodrigues: v cosθ + (k × v) sinθ + k (k·v)(1 − cosθ)
    const cross = [ky * z - kz * y, kz * x - kx * z, kx * y - ky * x];
    const dot = kx * x + ky * y + kz * z;
    positions[i] = x * cos + cross[0] * sin + kx * dot * (1 - cos);
    positions[i + 1] = y * cos + cross[1] * sin + ky * dot * (1 - cos);
    positions[i + 2] = z * cos + cross[2] * sin + kz * dot * (1 - cos);
  }

  return (angle * 180) / Math.PI;
}

/** Centres the mesh on the origin and scales it to TARGET_HEIGHT. */
function normalise(positions) {
  const box = bounds(positions);
  const scale = TARGET_HEIGHT / box.size[1];
  const centre = [
    (box.min[0] + box.max[0]) / 2,
    (box.min[1] + box.max[1]) / 2,
    (box.min[2] + box.max[2]) / 2,
  ];

  for (let i = 0; i < positions.length; i += 3) {
    positions[i] = (positions[i] - centre[0]) * scale;
    positions[i + 1] = (positions[i + 1] - centre[1]) * scale;
    positions[i + 2] = (positions[i + 2] - centre[2]) * scale;
  }
  return scale;
}

function write(file, positions, normals, indices) {
  const box = bounds(positions);
  const HEADER = 64;
  const vertexCount = positions.length / 3;

  // Indices are the single biggest part of the file. Narrowing them to 16 bits
  // when the vertex count allows it is exactly lossless and halves that half.
  const narrow = vertexCount <= 0xffff;
  const packed = narrow ? Uint16Array.from(indices) : indices;

  const buffer = Buffer.alloc(
    HEADER + positions.byteLength + normals.byteLength + packed.byteLength,
  );

  buffer.write('HSLH', 0, 'ascii');
  buffer.writeUInt32LE(2, 4);
  buffer.writeUInt32LE(vertexCount, 8);
  buffer.writeUInt32LE(packed.length, 12);
  for (let a = 0; a < 3; a++) {
    buffer.writeFloatLE(box.min[a], 16 + a * 4);
    buffer.writeFloatLE(box.max[a], 28 + a * 4);
  }
  buffer.writeUInt32LE(narrow ? 2 : 4, 40);

  let offset = HEADER;
  Buffer.from(positions.buffer, positions.byteOffset, positions.byteLength).copy(buffer, offset);
  offset += positions.byteLength;
  Buffer.from(normals.buffer, normals.byteOffset, normals.byteLength).copy(buffer, offset);
  offset += normals.byteLength;
  Buffer.from(packed.buffer, packed.byteOffset, packed.byteLength).copy(buffer, offset);

  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, buffer);
  return { buffer, box, indexBytes: narrow ? 2 : 4 };
}

// ---------------------------------------------------------------------------

if (!fs.existsSync(SOURCE)) {
  console.error(`Cannot find the scan at:\n  ${SOURCE}`);
  process.exit(1);
}

const sourceSize = fs.statSync(SOURCE).size;
console.log(`reading  ${path.basename(SOURCE)} (${(sourceSize / 1e6).toFixed(1)} MB)`);

const raw = readObj(SOURCE);
const rawBox = bounds(raw.positions);
console.log(`  ${raw.positions.length / 3} vertices, ${raw.faces.length / 3} triangles`);
console.log(`  size ${rawBox.size.map((n) => n.toFixed(3)).join(' x ')}`);

const tilt = measureTilt(raw.positions, rawBox);
console.log(`  axis of revolution leans ${tilt.degrees.toFixed(2)}° off +Y`);

const small = decimate(raw.positions, raw.faces, rawBox);
const ratio = (1 - small.indices.length / raw.faces.length) * 100;
console.log(`decimate at resolution ${CLUSTER_RESOLUTION}`);
console.log(
  `  ${small.positions.length / 3} vertices, ${small.indices.length / 3} triangles ` +
    `(${ratio.toFixed(1)}% fewer)`,
);

const corrected = uprightify(small.positions, tilt);
console.log(`upright  rotated ${corrected.toFixed(2)}° onto +Y`);
const residual = measureTilt(small.positions, bounds(small.positions));
console.log(`  residual lean ${residual.degrees.toFixed(3)}°`);

const scale = normalise(small.positions);
const normals = computeNormals(small.positions, small.indices);
console.log(`normalise  scale x${scale.toFixed(4)} to height ${TARGET_HEIGHT}`);

const { buffer, box, indexBytes } = write(OUTPUT, small.positions, normals, small.indices);
console.log(`wrote  public/${path.basename(OUTPUT)}  ${(buffer.length / 1e6).toFixed(2)} MB`);
console.log(`  ${indexBytes * 8}-bit indices`);
console.log(`  bounds ${box.min.map((n) => n.toFixed(3)).join(' ')} → ${box.max.map((n) => n.toFixed(3)).join(' ')}`);
console.log(`  ${(buffer.length / sourceSize * 100).toFixed(1)}% of the source size`);
