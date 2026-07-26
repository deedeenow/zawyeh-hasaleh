/**
 * Traces a 1-bit bitmap into SVG outlines.
 *
 * Shared by scripts/make-wordmark.mjs and scripts/make-favicon.mjs, both of which
 * turn a brush drawing from `hasaleh media/` into a path that can take its colour
 * from CSS. Extracted when the favicon became a drawn mark too — it was the same
 * two hundred lines twice, and the second copy would have drifted.
 *
 * The trace is exact rather than curve-fitted. Every boundary between an inked pixel
 * and a blank one becomes a directed unit edge with the ink on its left; the edges
 * link head-to-tail into closed loops. That gives correct winding for free — outer
 * contours one way, counters the other — so holes stay holes under either fill rule,
 * which is what lets a traced glyph be punched out of a disc with `evenodd`.
 *
 * Simplification is Douglas-Peucker, with the tolerance given in *output* units and
 * converted to source pixels here. Stating it in output units is the whole point: a
 * wordmark rendered 200px wide and a favicon rendered 16px wide want wildly
 * different source tolerances but the same visual one.
 */

import sharp from 'sharp';

/**
 * Reads the bitmap and returns its ink outlines in source-pixel coordinates.
 *
 * @param {string} file
 * @param {{ inkThreshold?: number, minLoopArea?: number }} [options]
 *   `minLoopArea` drops loops enclosing fewer source pixels than this — a hand-drawn
 *   scan carries stray specks and pinholes that are invisible as shapes at display
 *   size but still cost path data.
 * @returns {Promise<{ loops: number[][][], bbox: { minX: number, minY: number, maxX: number, maxY: number }, width: number, height: number, tracedPoints: number }>}
 */
export async function traceBitmap(file, { inkThreshold = 128, minLoopArea = 24 } = {}) {
  // Flattened onto white first: an indexed or alpha PNG would otherwise threshold
  // its transparent background as ink.
  const { data, info } = await sharp(file)
    .flatten({ background: '#ffffff' })
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;

  const ink = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i++) {
    ink[i] = data[i * channels] < inkThreshold ? 1 : 0;
  }

  const filled = (x, y) => (x < 0 || y < 0 || x >= width || y >= height ? 0 : ink[y * width + x]);

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!ink[y * width + x]) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) throw new Error(`no ink found in ${file}`);

  /**
   * Every edge where ink meets blank, directed so the ink is on the left. Walking a
   * filled pixel's four sides in this order is clockwise in screen coordinates, and
   * emitting only the sides whose neighbour is blank leaves exactly the outline.
   */
  const outgoing = new Map();
  const key = (x, y) => x * 100000 + y;

  const edge = (ax, ay, bx, by) => {
    const k = key(ax, ay);
    const list = outgoing.get(k);
    if (list) list.push({ ax, ay, bx, by, used: false });
    else outgoing.set(k, [{ ax, ay, bx, by, used: false }]);
  };

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      if (!filled(x, y)) continue;
      if (!filled(x, y - 1)) edge(x, y, x + 1, y);
      if (!filled(x + 1, y)) edge(x + 1, y, x + 1, y + 1);
      if (!filled(x, y + 1)) edge(x + 1, y + 1, x, y + 1);
      if (!filled(x - 1, y)) edge(x, y + 1, x, y);
    }
  }

  /**
   * Where four pixels meet diagonally a point has two ways out. Carrying straight on
   * first, then turning, keeps the two strokes separate instead of welding them into
   * one loop through the corner.
   */
  const nextEdge = (from, dx, dy) => {
    const list = outgoing.get(key(from.bx, from.by));
    if (!list) return null;
    const unused = list.filter((candidate) => !candidate.used);
    if (unused.length === 0) return null;
    if (unused.length === 1) return unused[0];

    const straight = unused.find((c) => c.bx - c.ax === dx && c.by - c.ay === dy);
    if (straight) return straight;
    // Clockwise turn, in screen coordinates.
    return unused.find((c) => c.bx - c.ax === -dy && c.by - c.ay === dx) ?? unused[0];
  };

  const traced = [];
  for (const list of outgoing.values()) {
    for (const start of list) {
      if (start.used) continue;

      const points = [];
      let current = start;
      while (current && !current.used) {
        current.used = true;
        points.push([current.ax, current.ay]);
        current = nextEdge(current, current.bx - current.ax, current.by - current.ay);
      }
      if (points.length >= 4) traced.push(points);
    }
  }

  const loops = traced.filter((loop) => Math.abs(signedArea(loop)) >= minLoopArea);

  return {
    loops,
    bbox: { minX, minY, maxX, maxY },
    width,
    height,
    tracedPoints: traced.reduce((n, loop) => n + loop.length, 0),
  };
}

/** Shoelace area. The sign carries the winding, so only the magnitude gates on size. */
export function signedArea(points) {
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % points.length];
    sum += x1 * y2 - x2 * y1;
  }
  return sum / 2;
}

/** Douglas-Peucker on an open run of points. */
function simplifyRun(points, tolerance) {
  if (points.length < 3) return points;

  const [ax, ay] = points[0];
  const [bx, by] = points[points.length - 1];
  const dx = bx - ax;
  const dy = by - ay;
  const length = Math.hypot(dx, dy);

  let worst = 0;
  let index = -1;
  for (let i = 1; i < points.length - 1; i++) {
    const [px, py] = points[i];
    const distance =
      length === 0
        ? Math.hypot(px - ax, py - ay)
        : Math.abs(dy * (px - ax) - dx * (py - ay)) / length;
    if (distance > worst) {
      worst = distance;
      index = i;
    }
  }

  if (worst <= tolerance) return [points[0], points[points.length - 1]];
  const left = simplifyRun(points.slice(0, index + 1), tolerance);
  const right = simplifyRun(points.slice(index), tolerance);
  return [...left.slice(0, -1), ...right];
}

/**
 * A closed loop has no endpoints to anchor the split on, so it is cut at the point
 * furthest from the first one — a genuine extreme of the shape — and simplified as
 * two runs. Cutting anywhere arbitrary can pin a vertex mid-curve and leave a kink.
 */
function simplifyLoop(points, tolerance) {
  if (points.length < 8) return points;

  const [ox, oy] = points[0];
  let far = 0;
  let farthest = 0;
  for (let i = 1; i < points.length; i++) {
    const d = (points[i][0] - ox) ** 2 + (points[i][1] - oy) ** 2;
    if (d > far) {
      far = d;
      farthest = i;
    }
  }

  const first = simplifyRun(points.slice(0, farthest + 1), tolerance);
  const second = simplifyRun([...points.slice(farthest), points[0]], tolerance);
  return [...first.slice(0, -1), ...second.slice(0, -1)];
}

/**
 * Scales traced loops into output coordinates and serialises them as one path.
 *
 * @param {number[][][]} loops
 * @param {{ minX: number, minY: number, maxX: number, maxY: number }} bbox
 * @param {object} options
 * @param {number} options.targetWidth  Width the ink bbox is scaled to, in output units.
 * @param {[number, number]} [options.centre]  Output point the ink bbox is centred on.
 *   Omit to place the bbox's top-left at the origin, which is what a viewBox fitted
 *   tightly to the drawing wants.
 * @param {number} [options.tolerance]  Douglas-Peucker tolerance in OUTPUT units.
 * @param {number} [options.precision]  Decimals kept in the output.
 * @returns {{ d: string, width: number, height: number, points: number }}
 */
export function loopsToPath(
  loops,
  bbox,
  { targetWidth, centre = null, tolerance = 0.1, precision = 1 },
) {
  const inkWidth = bbox.maxX - bbox.minX + 1;
  const inkHeight = bbox.maxY - bbox.minY + 1;
  const scale = targetWidth / inkWidth;
  const outputHeight = inkHeight * scale;

  const offsetX = centre ? centre[0] - targetWidth / 2 : 0;
  const offsetY = centre ? centre[1] - outputHeight / 2 : 0;

  const simplified = loops.map((loop) => simplifyLoop(loop, tolerance / scale));
  const round = (value) => Number(value.toFixed(precision));

  const d = simplified
    .map((loop) => {
      const coords = loop.map(
        ([x, y]) =>
          `${round((x - bbox.minX) * scale + offsetX)} ${round((y - bbox.minY) * scale + offsetY)}`,
      );
      return `M${coords.join('L')}Z`;
    })
    .join('');

  return {
    d,
    width: targetWidth,
    height: outputHeight,
    points: simplified.reduce((n, loop) => n + loop.length, 0),
  };
}
