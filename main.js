import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";

// ---------- 2026 election countdown ----------
// US 2026 general election: Tuesday, November 3, 2026.
const ELECTION_DATE = new Date(2026, 10, 3, 0, 0, 0); // local time

const labelEl = document.getElementById("election-label");
const countdownEl = document.getElementById("election-countdown");
const pad = (n) => String(n).padStart(2, "0");

function updateCountdown() {
  const now = new Date();
  const diff = ELECTION_DATE - now;
  if (diff <= 0) {
    labelEl.textContent = "ELECTION DAY";
    countdownEl.textContent = "POLLS OPEN";
    return;
  }
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);
  countdownEl.textContent = `${days}D ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}
updateCountdown();
setInterval(updateCountdown, 1000);

// ---------- Contact button → preformatted mailto ----------
const mailto = (() => {
  const to = "strategy@hillclimbstrategies.com";
  const subject = "2026 Cycle Engagement Inquiry";
  const body = [
    "Hi Hillclimb team,",
    "",
    "We're interested in exploring a 2026 engagement. A few details to help you scope:",
    "",
    "Name:",
    "Title:",
    "Organization / Campaign / Committee:",
    "Race or program:",
    "Election / cycle date:",
    "",
    "Areas of interest (check all that apply):",
    "  [ ] AI Enablement (back office)",
    "  [ ] Digital Media & Distribution",
    "  [ ] Messaging & Narrative Strategy",
    "  [ ] Paid Media & Growth",
    "  [ ] Data, Targeting & Analytics",
    "",
    "Approximate budget range:",
    "Desired start date:",
    "",
    "Brief description of the problem you want to solve:",
    "",
    "",
    "Thanks —",
  ].join("\n");
  return `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
})();
document.getElementById("contact-link").setAttribute("href", mailto);

// ---------- Renderer / scene ----------
const canvas = document.getElementById("scene");
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: false,
  powerPreference: "high-performance",
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setClearColor(0x000000, 1);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
camera.position.set(0, 0.6, 8);
camera.lookAt(0, 0.4, 0);

// ---------- Procedural mountain geometry ----------
// A cone with non-uniform radial displacement so contour lines (constant Y)
// trace organic, ridge-bunched curves rather than perfect circles.
function makeMountainGeometry({ radius, height, seed = 0 }) {
  const geo = new THREE.ConeGeometry(radius, height, 96, 64, true);
  const pos = geo.attributes.position;

  // Translate so the apex sits at +height/2 already (default), but we want
  // Y=0 to be the rough mid-line of the mountain band — leave as-is and
  // position the mesh later.

  // Pseudo-noise from sums of sines — stable, no deps. Higher amplitude so
  // contour lines wrap around clearly visible ridges and spurs.
  const ridge = (a, y) => {
    return (
      0.30 * Math.sin(a * 3.0 + seed * 1.3) * (0.55 + 0.45 * Math.cos(y * 1.2)) +
      0.16 * Math.sin(a * 5.0 + seed * 2.1 + 0.7) +
      0.10 * Math.sin(a * 8.0 + y * 0.9 + seed * 0.5) +
      0.05 * Math.sin(a * 13.0 + seed * 3.7)
    );
  };

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const r = Math.sqrt(x * x + z * z);
    if (r > 1e-4) {
      const angle = Math.atan2(z, x);
      // Taper noise to zero at the apex so the peak stays sharp.
      const apexFalloff = Math.min(1, (height / 2 - y + 0.001) / (height * 0.85));
      const n = ridge(angle, y) * Math.max(0, apexFalloff);
      const newR = r * (1 + n);
      pos.setX(i, Math.cos(angle) * newR);
      pos.setZ(i, Math.sin(angle) * newR);
    }
  }
  geo.computeVertexNormals();
  return geo;
}

// ---------- Mountain shader: contour lines + alpha fade ----------
const mountainVertex = /* glsl */ `
  varying vec3 vWorldPos;
  varying vec3 vLocalPos;
  varying vec3 vNormal;
  varying vec3 vViewDir;

  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    vLocalPos = position;
    vNormal = normalize(mat3(modelMatrix) * normal);
    vViewDir = normalize(cameraPosition - wp.xyz);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const mountainFragment = /* glsl */ `
  precision highp float;

  varying vec3 vWorldPos;
  varying vec3 vLocalPos;
  varying vec3 vNormal;
  varying vec3 vViewDir;

  uniform vec3  uLineColor;
  uniform vec3  uFillColor;
  uniform float uLineSpacing;
  uniform float uLineWidth;
  uniform float uLineIntensity;
  uniform float uFadeStart;
  uniform float uFadeEnd;
  uniform float uMistAmount;
  uniform float uRimStrength;
  uniform float uContourSeed;

  void main() {
    float y = vWorldPos.y;

    // ----- organic Y-offset so contours curve & wrap, not look like graph paper -----
    // Use the local angle around the cone axis so the offset rotates with the mesh.
    float ang = atan(vLocalPos.z, vLocalPos.x);
    float warp =
      0.16 * sin(ang * 3.0 + uContourSeed * 1.7) +
      0.08 * sin(ang * 5.0 + uContourSeed * 2.3 + 0.7) +
      0.04 * sin(ang * 8.0 + y * 0.6 + uContourSeed) +
      0.10 * sin(y * 0.9 + ang * 2.0 + uContourSeed * 0.6);

    float bandsY = (y + warp) / uLineSpacing;
    float f = fract(bandsY);
    float d = min(f, 1.0 - f) * 2.0;            // 0 at line, 1 between lines
    float aa = fwidth(bandsY) * uLineWidth;     // AA + auto-bunch on steep slopes
    float line = 1.0 - smoothstep(0.0, aa, d);

    // ----- Lambertian shading gives the cones volume -----
    vec3 lightDir = normalize(vec3(0.45, 0.75, 0.55));
    float lambert = max(0.0, dot(normalize(vNormal), lightDir));
    float surfaceLight = 0.35 + 0.65 * lambert;

    // ----- subtle vertical surface gradient on the dark fill -----
    float h = clamp((y - uFadeEnd) / 3.0, 0.0, 1.0);
    vec3 base = mix(uFillColor * 0.20, uFillColor, h) * surfaceLight;

    // ----- silhouette rim so peaks read against background -----
    float rim = pow(1.0 - max(0.0, dot(normalize(vNormal), vViewDir)), 2.5);
    base += uLineColor * rim * uRimStrength;

    // Contour lines also pick up a touch of the surface light so they look
    // like physical etched lines on the terrain rather than overlay strokes.
    vec3 lineCol = uLineColor * (0.75 + 0.25 * surfaceLight);

    vec3 col = mix(base, lineCol, clamp(line * uLineIntensity, 0.0, 1.0));

    // ----- bottom fade into mist / negative space -----
    float fade = smoothstep(uFadeEnd, uFadeStart, y);

    // soft haze rising from the fade band so lines dissolve into it
    float mist = (1.0 - fade) * uMistAmount;
    col += vec3(0.10, 0.12, 0.16) * mist * 0.25;

    if (fade < 0.005) discard;
    gl_FragColor = vec4(col, fade);
  }
`;

function makeMountainMaterial(opts) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: true,
    side: THREE.DoubleSide,
    vertexShader: mountainVertex,
    fragmentShader: mountainFragment,
    uniforms: {
      uLineColor: { value: new THREE.Color(opts.lineColor) },
      uFillColor: { value: new THREE.Color(opts.fillColor) },
      uLineSpacing: { value: opts.lineSpacing },
      uLineWidth: { value: opts.lineWidth },
      uLineIntensity: { value: opts.lineIntensity },
      uFadeStart: { value: opts.fadeStart },
      uFadeEnd: { value: opts.fadeEnd },
      uMistAmount: { value: opts.mistAmount },
      uRimStrength: { value: opts.rimStrength },
      uContourSeed: { value: opts.contourSeed ?? 1.0 },
    },
  });
}

// ---------- Build the three peaks ----------
function makeMountain(spec) {
  const geo = makeMountainGeometry({
    radius: spec.radius,
    height: spec.height,
    seed: spec.seed,
  });
  const mat = makeMountainMaterial(spec.material);
  const mesh = new THREE.Mesh(geo, mat);
  // ConeGeometry centers vertically around 0 — apex at +h/2, base at -h/2.
  // We want the apex at spec.peakY, so shift up by peakY - height/2.
  mesh.position.set(spec.x, spec.peakY - spec.height / 2, spec.z);
  mesh.rotation.y = spec.rotY ?? 0;
  mesh.renderOrder = spec.renderOrder;
  return mesh;
}

const fadeStart = -0.55;
const fadeEnd = -2.1;

// Right peak — dark blue, tallest, biggest of the three (matches the brand
// mark's largest peak on the right). Sits furthest back so it reads as the
// atmospheric background of the trio.
const bg = makeMountain({
  radius: 2.9,
  height: 6.4,
  seed: 1.7,
  x: 1.35,
  z: -1.6,
  peakY: 2.55,
  rotY: 0.6,
  renderOrder: 0,
  material: {
    // Background = dark blue (deep cobalt, the tallest peak in the brand mark)
    lineColor: 0x8a8aff,
    fillColor: 0x0e0e3c,
    lineSpacing: 0.30,
    lineWidth: 1.2,
    lineIntensity: 1.35,
    fadeStart,
    fadeEnd,
    mistAmount: 1.1,
    rimStrength: 0.30,
    contourSeed: 1.7,
  },
});

// Middle peak — light blue, smallest, nestled between the red and dark blue
// (matches the brand mark's small middle peak).
const mid = makeMountain({
  radius: 1.55,
  height: 4.0,
  seed: 0.8,
  x: 0.05,
  z: 0.2,
  peakY: 1.4,
  rotY: -0.4,
  renderOrder: 1,
  material: {
    // Middle = light blue (the small peak between in the brand mark)
    lineColor: 0xa8e4ff,
    fillColor: 0x082a40,
    lineSpacing: 0.20,
    lineWidth: 0.95,
    lineIntensity: 1.5,
    fadeStart,
    fadeEnd,
    mistAmount: 0.55,
    rimStrength: 0.40,
    contourSeed: 0.8,
  },
});

// Left peak — red, foreground, sharpest contour detail (matches the brand
// mark's left peak).
const fg = makeMountain({
  radius: 2.05,
  height: 4.6,
  seed: 2.4,
  x: -1.35,
  z: 1.5,
  peakY: 0.85,
  rotY: 0.3,
  renderOrder: 2,
  material: {
    // Foreground = red (the sharp, closest peak in the brand mark)
    lineColor: 0xff6868,
    fillColor: 0x320808,
    lineSpacing: 0.14,
    lineWidth: 0.78,
    lineIntensity: 1.75,
    fadeStart: fadeStart + 0.05,
    fadeEnd: fadeEnd + 0.1,
    mistAmount: 0.3,
    rimStrength: 0.55,
    contourSeed: 2.4,
  },
});

const stage = new THREE.Group();
stage.add(bg, mid, fg);
scene.add(stage);

// ---------- Tilt-shift post-process (two-pass blur) ----------
const TiltShiftShader = (axis) => ({
  uniforms: {
    tDiffuse: { value: null },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uFocusY: { value: 0.50 },     // NDC y of crisp band (0=bottom, 1=top)
    uFalloff: { value: 0.26 },    // distance over which blur ramps to max
    uMaxBlur: { value: 14.0 },    // pixels at extreme top/bottom
    uAxis: { value: new THREE.Vector2(axis[0], axis[1]) },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = vec4(position.xy, 0.0, 1.0);
    }
  `,
  fragmentShader: `
    precision highp float;
    uniform sampler2D tDiffuse;
    uniform vec2 uResolution;
    uniform vec2 uAxis;
    uniform float uFocusY;
    uniform float uFalloff;
    uniform float uMaxBlur;
    varying vec2 vUv;

    void main() {
      // distance-from-focal-band drives blur radius
      float dist = abs(vUv.y - uFocusY);
      float t = clamp(dist / uFalloff, 0.0, 1.0);
      float radius = pow(t, 1.6) * uMaxBlur;

      // 9-tap Gaussian (sigma~2)
      float w[9];
      w[0]=0.0093; w[1]=0.0287; w[2]=0.0648; w[3]=0.1209; w[4]=0.1747;
      w[5]=0.1209; w[6]=0.0648; w[7]=0.0287; w[8]=0.0093;
      // center re-weight so total = 1: add residual to center
      float total = 0.6221;
      w[4] += 1.0 - total;

      vec2 step = uAxis * radius / uResolution;
      vec4 sum = vec4(0.0);
      for (int i = 0; i < 9; i++) {
        float o = float(i - 4);
        sum += texture2D(tDiffuse, vUv + step * o) * w[i];
      }
      gl_FragColor = sum;
    }
  `,
});

// Subtle film grain + vignette + mild tone shaping for atmosphere.
const FinalShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uVignette: { value: 0.0 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = vec4(position.xy, 0.0, 1.0);
    }
  `,
  fragmentShader: `
    precision highp float;
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uVignette;
    varying vec2 vUv;

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
    }

    void main() {
      vec4 src = texture2D(tDiffuse, vUv);
      vec3 col = src.rgb;

      // gentle vignette for tilt-shift miniature feel
      vec2 c = vUv - 0.5;
      float v = smoothstep(0.85, 0.2, length(c));
      col *= mix(1.0 - uVignette * 0.30, 1.0, v);

      // very subtle grain
      float g = hash(vUv * 2048.0 + uTime) - 0.5;
      col += g * 0.012;

      // slight cool atmospheric tint in shadows
      float lum = dot(col, vec3(0.3, 0.59, 0.11));
      col = mix(col, col * vec3(0.92, 0.97, 1.05), 1.0 - smoothstep(0.0, 0.3, lum));

      gl_FragColor = vec4(col, 1.0);
    }
  `,
};

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));

const tiltH = new ShaderPass(TiltShiftShader([1, 0]));
const tiltV = new ShaderPass(TiltShiftShader([0, 1]));
composer.addPass(tiltH);
composer.addPass(tiltV);

const finalPass = new ShaderPass(FinalShader);
finalPass.renderToScreen = true;
composer.addPass(finalPass);

// ---------- Resize ----------
function resize() {
  const parent = canvas.parentElement;
  const w = parent.clientWidth;
  const h = parent.clientHeight;
  renderer.setSize(w, h, false);
  composer.setSize(w, h);
  camera.aspect = w / h;
  // Pull back a touch on portrait viewports so peaks don't crop horizontally,
  // and stay closer on wide ones so the mark fills the frame.
  const aspect = w / h;
  camera.position.z = aspect > 1.6 ? 7.6 : aspect > 1.0 ? 8.4 : 9.6;
  camera.updateProjectionMatrix();

  const px = w * renderer.getPixelRatio();
  const py = h * renderer.getPixelRatio();
  tiltH.uniforms.uResolution.value.set(px, py);
  tiltV.uniforms.uResolution.value.set(px, py);
}
window.addEventListener("resize", resize);
resize();

// ---------- Animate ----------
// Each mountain spins on its own axis at a slightly different rate so the
// scene reads as alive without breaking the staggered foreground/middle/back
// composition.
const clock = new THREE.Clock();
function tick() {
  const t = clock.getElapsedTime();

  fg.rotation.y = 0.3 + t * 0.22;
  mid.rotation.y = -0.4 - t * 0.18;
  bg.rotation.y = 0.6 + t * 0.13;

  // Subtle group breathing — keeps the tilt-shift miniature feel.
  stage.position.y = Math.cos(t * 0.18) * 0.04;

  finalPass.uniforms.uTime.value = t;
  composer.render();
  requestAnimationFrame(tick);
}
tick();
