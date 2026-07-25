'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

/** Block size of the raster, in CSS pixels. Must match --px in globals.css. */
const DITHER_PIXEL = 3;

/** Built by scripts/prepare-model.mjs from the scan in `hasaleh media/`. */
const MESH_URL = '/hasaleh.mesh';

/** The box barely changes size with the balance — it reads, it doesn't shout. */
const BASE_SCALE_MIN = 0.92;
const BASE_SCALE_SPAN = 0.16;

/** A single transaction nudges it by this much, then springs back. */
const PULSE_MAGNITUDE = 0.1;
const PULSE_STIFFNESS = 90;
const PULSE_DAMPING = 9;
/** Stacked pulses must never inflate the box past this. */
const PULSE_CEILING = 0.16;

const DEVELOP_SECONDS = 1.15;

/**
 * At fov 30 this puts the box at about 76% of the frame height. Below
 * NARROW_ASPECT the camera pulls back instead, so a tall viewport never crops it.
 */
const BASE_CAMERA_DISTANCE = 5.6;
const NARROW_ASPECT = 1.1;

/**
 * The Hasaleh is a body of revolution, so spinning it about its own axis of
 * symmetry would be almost invisible. Tipping it forward first puts the coin
 * slot and the apex nub in view, and those orbit visibly as it turns.
 */
const FORWARD_TILT = 0.22;
const SPIN_SPEED = 0.3;

/**
 * Initial velocity that makes an underdamped spring peak at exactly
 * PULSE_MAGNITUDE, solved rather than guessed so the constant above means what
 * it says. The fixed-step integrator in the loop lands ~13% under the
 * continuous-time peak, which is invisible at this amplitude.
 */
const PULSE_IMPULSE = (() => {
  const omega = Math.sqrt(PULSE_STIFFNESS);
  const zeta = PULSE_DAMPING / (2 * omega);
  const damped = omega * Math.sqrt(1 - zeta * zeta);
  const peakTime = Math.atan(damped / (zeta * omega)) / damped;
  const unitPeak = (Math.exp(-zeta * omega * peakTime) * Math.sin(damped * peakTime)) / damped;
  return PULSE_MAGNITUDE / unitPeak;
})();

interface MoneyBoxProps {
  /** 0–1, balance against the all-time peak. */
  fill: number;
  /** Changes whenever a new transaction lands. */
  pulseKey: string;
  /** +1 for money in, −1 for money out. */
  pulseDirection: number;
}

const VERTEX_SHADER = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vView;

  void main() {
    vNormal = normalize(normalMatrix * normal);
    vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
    vView = normalize(-viewPosition.xyz);
    gl_Position = projectionMatrix * viewPosition;
  }
`;

/**
 * Hand-written lambert. Using our own ramp instead of three's lights keeps the
 * luminance distribution identical across three versions and lighting-unit
 * conventions — and the dither is only ever as good as the gradient it samples.
 */
const SHELL_SHADER = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vView;

  void main() {
    vec3 n = normalize(vNormal);
    vec3 view = normalize(vView);
    // Scan topology has inconsistent winding in places. Facing the normal back
    // toward the camera makes the shading independent of it.
    if (dot(n, view) < 0.0) n = -n;

    vec3 keyLight = normalize(vec3(-0.5, 0.78, 0.62));
    vec3 fillLight = normalize(vec3(0.85, -0.1, -0.45));
    // Bounce off an implied floor, so the underside never falls to pure black
    // and detach the pedestal from the body.
    vec3 bounceLight = normalize(vec3(0.2, -0.92, 0.34));

    float key = max(dot(n, keyLight), 0.0);
    float fill = max(dot(n, fillLight), 0.0);
    float bounce = max(dot(n, bounceLight), 0.0);
    float rim = pow(1.0 - max(dot(n, view), 0.0), 4.0);

    // The rim is kept low deliberately: higher and it lights the whole
    // silhouette, flattening the box into a disc.
    // The weights are tuned to keep most of the surface in the midtones, where
    // the dither actually has tonal steps to work with — pushing key toward 1.0
    // clips the whole lit side to solid white and throws that away.
    float lum = 0.06 + key * 0.86 + fill * 0.16 + bounce * 0.2 + rim * 0.1;
    // A tight specular leaves one small blown highlight, like glazed plastic.
    lum += pow(key, 32.0) * 0.38;

    gl_FragColor = vec4(vec3(clamp(lum, 0.0, 1.0)), 1.0);
  }
`;

const DITHER_VERTEX_SHADER = /* glsl */ `
  void main() {
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

/**
 * Ordered 8×8 Bayer dither, built arithmetically. No const-array indexing, so
 * it compiles under GLSL ES 1.0 as well as 3.0.
 */
const DITHER_FRAGMENT_SHADER = /* glsl */ `
  precision highp float;

  uniform sampler2D uScene;
  uniform vec2 uRasterSize;
  uniform float uPixel;
  uniform float uDevelop;

  float bayer2(vec2 a) {
    a = floor(a);
    return fract(a.x / 2.0 + a.y * a.y * 0.75);
  }

  float bayer4(vec2 a) {
    return bayer2(0.5 * a) * 0.25 + bayer2(a);
  }

  float bayer8(vec2 a) {
    return bayer4(0.5 * a) * 0.25 + bayer2(a);
  }

  void main() {
    vec2 block = floor(gl_FragCoord.xy / uPixel);
    vec2 uv = (block + 0.5) / uRasterSize;
    float lum = clamp(texture2D(uScene, uv).r, 0.0, 1.0);

    // uDevelop 0 → threshold 1 → an all-black plate. Ramping it to 1 makes the
    // image resolve in, like a print coming up in the tray.
    float threshold = mix(1.0, bayer8(block), uDevelop);

    // Strictly greater, not step(): one cell of the Bayer matrix is exactly 0.0,
    // and step() would light it even where the scene is pure black — which
    // scatters a dot lattice across the empty background.
    gl_FragColor = vec4(vec3(lum > threshold ? 1.0 : 0.0), 1.0);
  }
`;

/** Reads the binary written by scripts/prepare-model.mjs. */
function parseMesh(buffer: ArrayBuffer): THREE.BufferGeometry {
  const header = new DataView(buffer);
  const magic = String.fromCharCode(
    header.getUint8(0),
    header.getUint8(1),
    header.getUint8(2),
    header.getUint8(3),
  );
  if (magic !== 'HSLH') throw new Error('not a Hasaleh mesh');

  const version = header.getUint32(4, true);
  if (version !== 2) throw new Error(`unsupported mesh version ${version}`);

  const vertexCount = header.getUint32(8, true);
  const indexCount = header.getUint32(12, true);
  const indexBytes = header.getUint32(40, true);

  const HEADER_BYTES = 64;
  const positionBytes = vertexCount * 3 * 4;
  const positions = new Float32Array(buffer, HEADER_BYTES, vertexCount * 3);
  const normals = new Float32Array(buffer, HEADER_BYTES + positionBytes, vertexCount * 3);

  const indexOffset = HEADER_BYTES + positionBytes * 2;
  const indices =
    indexBytes === 2
      ? new Uint16Array(buffer, indexOffset, indexCount)
      : new Uint32Array(buffer, indexOffset, indexCount);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  return geometry;
}

export default function MoneyBox({ fill, pulseKey, pulseDirection }: MoneyBoxProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  const fillRef = useRef(fill);
  const pulseRef = useRef({ offset: 0, velocity: 0 });
  const lastPulseKey = useRef<string | null>(null);

  useEffect(() => {
    fillRef.current = fill;
  }, [fill]);

  useEffect(() => {
    // Skip the first run: the develop-in is the load moment, not a pulse.
    if (lastPulseKey.current === null) {
      lastPulseKey.current = pulseKey;
      return;
    }
    if (lastPulseKey.current === pulseKey) return;
    lastPulseKey.current = pulseKey;

    const direction = pulseDirection >= 0 ? 1 : -1;
    pulseRef.current.velocity += direction * PULSE_IMPULSE;
  }, [pulseKey, pulseDirection]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const reduceMotion =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: false,
        alpha: false,
        powerPreference: 'low-power',
      });
    } catch {
      setFailed(true);
      return;
    }

    // Pixel ratio is deliberately pinned to 1: the raster is measured in CSS
    // pixels, so a retina buffer would halve the dot size.
    renderer.setPixelRatio(1);
    renderer.setClearColor(0x000000, 1);
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
    camera.position.set(0, 0.34, BASE_CAMERA_DISTANCE);
    camera.lookAt(0, 0, 0);

    // Nested so the two rotations cannot interfere: the outer group holds the
    // forward tilt, the inner one spins about the box's own axis.
    const tiltGroup = new THREE.Group();
    tiltGroup.rotation.x = FORWARD_TILT;
    const spinGroup = new THREE.Group();
    tiltGroup.add(spinGroup);
    scene.add(tiltGroup);

    const shell = new THREE.ShaderMaterial({
      vertexShader: VERTEX_SHADER,
      fragmentShader: SHELL_SHADER,
      side: THREE.DoubleSide,
    });

    const renderTarget = new THREE.WebGLRenderTarget(2, 2, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      depthBuffer: true,
    });

    const ditherMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uScene: { value: renderTarget.texture },
        uRasterSize: { value: new THREE.Vector2(2, 2) },
        uPixel: { value: DITHER_PIXEL },
        uDevelop: { value: 0 },
      },
      vertexShader: DITHER_VERTEX_SHADER,
      fragmentShader: DITHER_FRAGMENT_SHADER,
      depthTest: false,
      depthWrite: false,
    });

    const screenScene = new THREE.Scene();
    const screenCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const screenGeometry = new THREE.PlaneGeometry(2, 2);
    screenScene.add(new THREE.Mesh(screenGeometry, ditherMaterial));

    const resize = () => {
      const width = Math.max(1, Math.floor(host.clientWidth));
      const height = Math.max(1, Math.floor(host.clientHeight));

      renderer.setSize(width, height, false);
      renderer.domElement.style.width = '100%';
      renderer.domElement.style.height = '100%';

      const rasterWidth = Math.max(1, Math.ceil(width / DITHER_PIXEL));
      const rasterHeight = Math.max(1, Math.ceil(height / DITHER_PIXEL));
      renderTarget.setSize(rasterWidth, rasterHeight);
      ditherMaterial.uniforms.uRasterSize.value.set(rasterWidth, rasterHeight);

      const aspect = width / height;
      camera.aspect = aspect;
      // Pull back on tall, narrow viewports so the box never gets cropped.
      camera.position.z =
        aspect < NARROW_ASPECT
          ? Math.min(14, BASE_CAMERA_DISTANCE * (NARROW_ASPECT / Math.max(aspect, 0.45)))
          : BASE_CAMERA_DISTANCE;
      camera.updateProjectionMatrix();
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(host);

    const clock = new THREE.Clock();
    let elapsed = 0;
    let developed = 0;
    let frame = 0;
    let running = true;
    let disposed = false;
    let geometry: THREE.BufferGeometry | null = null;

    /**
     * One frame's worth of work, split out from the rAF callback so a fixed
     * number of frames can be driven by hand. A hidden document never fires
     * requestAnimationFrame, which otherwise makes this impossible to inspect.
     */
    const renderFrame = (delta: number) => {
      elapsed += delta;

      // Only start developing once there is something to develop.
      if (geometry && developed < 1) {
        developed = reduceMotion ? 1 : Math.min(1, developed + delta / DEVELOP_SECONDS);
        // Ease out, so the last few tones arrive gently.
        ditherMaterial.uniforms.uDevelop.value = 1 - (1 - developed) ** 3;
      }

      const pulse = pulseRef.current;
      pulse.velocity += (-PULSE_STIFFNESS * pulse.offset - PULSE_DAMPING * pulse.velocity) * delta;
      pulse.offset = Math.max(
        -PULSE_CEILING,
        Math.min(PULSE_CEILING, pulse.offset + pulse.velocity * delta),
      );
      if (Math.abs(pulse.offset) < 0.0002 && Math.abs(pulse.velocity) < 0.0002) {
        pulse.offset = 0;
        pulse.velocity = 0;
      }

      const base = BASE_SCALE_MIN + BASE_SCALE_SPAN * fillRef.current;
      tiltGroup.scale.setScalar(base + pulse.offset);

      if (!reduceMotion) {
        spinGroup.rotation.y += delta * SPIN_SPEED;
        tiltGroup.position.y = Math.sin(elapsed * 0.75) * 0.045;
      } else {
        spinGroup.rotation.y = -0.5;
      }

      renderer.setRenderTarget(renderTarget);
      renderer.render(scene, camera);
      renderer.setRenderTarget(null);
      renderer.render(screenScene, screenCamera);

    };

    const tick = () => {
      frame = requestAnimationFrame(tick);
      if (!running) return;
      // Clamped so a backgrounded tab does not resume with one huge step.
      renderFrame(Math.min(clock.getDelta(), 0.05));
    };

    if (process.env.NODE_ENV !== 'production') {
      // Dev-only handle for driving frames without rAF, and for reading state.
      (window as unknown as Record<string, unknown>).__moneyBox = {
        step: (frames = 90, delta = 1 / 60) => {
          for (let i = 0; i < frames; i++) renderFrame(delta);
        },
        state: () => ({
          developed,
          uDevelop: ditherMaterial.uniforms.uDevelop.value,
          hasGeometry: geometry !== null,
          spinChildren: spinGroup.children.length,
          scale: Number(tiltGroup.scale.x.toFixed(3)),
          cameraZ: Number(camera.position.z.toFixed(2)),
          raster: [renderTarget.width, renderTarget.height],
          fill: fillRef.current,
        }),
      };
    }

    frame = requestAnimationFrame(tick);

    const controller = new AbortController();
    fetch(MESH_URL, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`mesh request failed: ${response.status}`);
        return response.arrayBuffer();
      })
      .then((buffer) => {
        if (disposed) return;
        geometry = parseMesh(buffer);
        spinGroup.add(new THREE.Mesh(geometry, shell));
      })
      .catch((error) => {
        if (disposed || (error as Error).name === 'AbortError') return;
        console.error('Hasaleh mesh could not be loaded', error);
        setFailed(true);
      });

    const onVisibility = () => {
      running = document.visibilityState === 'visible';
      if (running) clock.getDelta();
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      disposed = true;
      controller.abort();
      cancelAnimationFrame(frame);
      document.removeEventListener('visibilitychange', onVisibility);
      observer.disconnect();

      geometry?.dispose();
      shell.dispose();
      screenGeometry.dispose();
      ditherMaterial.dispose();
      renderTarget.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === host) host.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div className="canvas-wrap" ref={hostRef} aria-hidden="true">
      {failed ? (
        <div className="canvas-fallback">
          <p>This browser cannot draw the hasaleh. The ledger is complete without it.</p>
        </div>
      ) : null}
    </div>
  );
}
