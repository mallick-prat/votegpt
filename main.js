import * as THREE from "three";
import { Line2 } from "three/addons/lines/Line2.js";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";
import { LineGeometry } from "three/addons/lines/LineGeometry.js";

// -----------------------------------------------------------------------------
// Countdown to the 2026 General Election (Tue Nov 3, 2026)
// -----------------------------------------------------------------------------
const ELECTION_DATE = new Date("2026-11-03T05:00:00Z"); // ~ midnight ET

function pad(n) {
  return String(n).padStart(2, "0");
}

function updateCountdown() {
  const el = document.getElementById("election-countdown");
  if (!el) return;
  const diff = ELECTION_DATE - new Date();
  if (diff <= 0) {
    el.textContent = "TODAY";
    return;
  }
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);
  el.textContent = `${days}D ${pad(hours)}H ${pad(minutes)}M ${pad(seconds)}S`;
}
updateCountdown();
setInterval(updateCountdown, 1000);

// -----------------------------------------------------------------------------
// Contact mailto with preformatted intake body
// -----------------------------------------------------------------------------
const contactLink = document.getElementById("contact-link");
if (contactLink) {
  const subject = "New Inquiry — Hillclimb Strategies";
  const body = [
    "Name:",
    "Organization:",
    "Role:",
    "Election cycle / mandate:",
    "How can we help?:",
    "",
    "— Sent via hillclimb-strategies.vercel.app",
  ].join("\n");
  contactLink.href = `mailto:strategy@hillclimbstrategies.com?subject=${encodeURIComponent(
    subject
  )}&body=${encodeURIComponent(body)}`;
}

// -----------------------------------------------------------------------------
// Scene setup
// -----------------------------------------------------------------------------
const canvas = document.getElementById("scene");
const IS_PHONE = window.innerWidth < 480;
const IS_NARROW = window.innerWidth < 760;
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: true,
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, IS_PHONE ? 1.5 : 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = null; // CSS background bleeds through

const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
camera.position.set(7.5, 5.5, 8.5);
camera.lookAt(0, 1.6, 0);

// Group everything so we can spin it gently as a unit
const plot = new THREE.Group();
scene.add(plot);

// -----------------------------------------------------------------------------
// Surface (three Gaussian peaks: red / light blue / dark blue)
// -----------------------------------------------------------------------------
const DOMAIN = 4;        // surface spans [-4, 4] in x and z
const SEGMENTS = 140;    // mesh resolution
const Y_MAX = 4;         // top of the floating axis box

const peaks = [
  { x: -2.55, z:  0.55, sigma: 0.70, h: 2.2, color: new THREE.Color("#ff2d2d") }, // red, left
  { x:  0.00, z: -0.45, sigma: 0.85, h: 3.2, color: new THREE.Color("#4ec3ff") }, // light blue, middle (tallest)
  { x:  2.65, z:  0.70, sigma: 0.78, h: 2.6, color: new THREE.Color("#1a1ad6") }, // dark blue, right
];

function heightAt(x, z) {
  let h = 0;
  for (const p of peaks) {
    const dx = x - p.x;
    const dz = z - p.z;
    h += p.h * Math.exp(-(dx * dx + dz * dz) / (2 * p.sigma * p.sigma));
  }
  return h;
}

function colorAt(x, z, y) {
  // Weight each peak by its Gaussian contribution at (x,z); blend their colors.
  const weights = peaks.map((p) => {
    const dx = x - p.x;
    const dz = z - p.z;
    return Math.exp(-(dx * dx + dz * dz) / (2 * p.sigma * p.sigma));
  });
  const sum = weights.reduce((a, b) => a + b, 0) + 1e-6;
  const peakColor = new THREE.Color(0, 0, 0);
  for (let i = 0; i < peaks.length; i++) {
    const w = weights[i] / sum;
    peakColor.r += peaks[i].color.r * w;
    peakColor.g += peaks[i].color.g * w;
    peakColor.b += peaks[i].color.b * w;
  }
  // Lerp from a deep navy "floor" tone up to the peak color by relative height.
  const base = new THREE.Color("#0c1430");
  const t = Math.min(1, Math.max(0, y / 3.0));
  const smooth = t * t * (3 - 2 * t); // smoothstep
  return base.lerp(peakColor, smooth);
}

const surfaceGeo = new THREE.PlaneGeometry(
  DOMAIN * 2,
  DOMAIN * 2,
  SEGMENTS,
  SEGMENTS
);
surfaceGeo.rotateX(-Math.PI / 2); // lay flat in XZ; Y is height

const pos = surfaceGeo.attributes.position;
const colors = new Float32Array(pos.count * 3);
for (let i = 0; i < pos.count; i++) {
  const x = pos.getX(i);
  const z = pos.getZ(i);
  const y = heightAt(x, z);
  pos.setY(i, y);
  const c = colorAt(x, z, y);
  colors[i * 3 + 0] = c.r;
  colors[i * 3 + 1] = c.g;
  colors[i * 3 + 2] = c.b;
}
pos.needsUpdate = true;
surfaceGeo.computeVertexNormals();
surfaceGeo.setAttribute("color", new THREE.BufferAttribute(colors, 3));

const surfaceMat = new THREE.MeshStandardMaterial({
  vertexColors: true,
  flatShading: false,
  metalness: 0.0,
  roughness: 0.78,
  side: THREE.DoubleSide,
});
const surface = new THREE.Mesh(surfaceGeo, surfaceMat);
plot.add(surface);

// Wireframe overlay — denser mesh draped over the mountains in a single subtle
// colour. Uses wireframe:true so the diagonals add visual density on slopes.
const WIRE_SEGMENTS = 48;
const wirePlane = new THREE.PlaneGeometry(
  DOMAIN * 2,
  DOMAIN * 2,
  WIRE_SEGMENTS,
  WIRE_SEGMENTS
);
wirePlane.rotateX(-Math.PI / 2);
const wp = wirePlane.attributes.position;
for (let i = 0; i < wp.count; i++) {
  wp.setY(i, heightAt(wp.getX(i), wp.getZ(i)) + 0.008); // small lift to avoid z-fight
}
wp.needsUpdate = true;
wirePlane.computeVertexNormals();

const wireMat = new THREE.MeshBasicMaterial({
  color: 0x636872,
  wireframe: true,
  transparent: true,
  opacity: 0.28,
  depthWrite: false,
});
plot.add(new THREE.Mesh(wirePlane, wireMat));

// -----------------------------------------------------------------------------
// Floating axis box: dotted grids on the floor + two back walls
// -----------------------------------------------------------------------------
const GRID_DIVS_XZ = 8;         // 8 divisions across the floor (one every 1.0)
const GRID_DIVS_Y = 6;          // y axis: 0..6 stepping by 1
const gridColor = 0x6e7a8a;
const gridOpacity = 0.55;

function gridLines(verts, color = gridColor, opacity = gridOpacity) {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
  const m = new THREE.LineDashedMaterial({
    color,
    dashSize: 0.06,
    gapSize: 0.09,
    transparent: true,
    opacity,
    depthWrite: false,
  });
  const ls = new THREE.LineSegments(g, m);
  ls.computeLineDistances();
  return ls;
}

// Floor (y = 0): grid in X and Z
{
  const verts = [];
  const step = (DOMAIN * 2) / GRID_DIVS_XZ;
  for (let i = 0; i <= GRID_DIVS_XZ; i++) {
    const v = -DOMAIN + i * step;
    verts.push(-DOMAIN, 0, v, DOMAIN, 0, v); // lines along X
    verts.push(v, 0, -DOMAIN, v, 0, DOMAIN); // lines along Z
  }
  plot.add(gridLines(verts));
}

// Solid floor frame (just the four edges of the floor square)
{
  const edgeMat = new THREE.LineBasicMaterial({
    color: 0xa8b2c2,
    transparent: true,
    opacity: 0.42,
  });
  const edges = [
    [-DOMAIN, 0, -DOMAIN, DOMAIN, 0, -DOMAIN],
    [DOMAIN, 0, -DOMAIN, DOMAIN, 0, DOMAIN],
    [DOMAIN, 0, DOMAIN, -DOMAIN, 0, DOMAIN],
    [-DOMAIN, 0, DOMAIN, -DOMAIN, 0, -DOMAIN],
  ];
  const verts = edges.flat();
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
  plot.add(new THREE.LineSegments(g, edgeMat));
}

// -----------------------------------------------------------------------------
// Tick number sprites along the axes
// -----------------------------------------------------------------------------
function makeTextSprite(text, opts = {}) {
  const fontSize = opts.fontSize || 64;
  const fontWeight = opts.fontWeight || 400;
  const padding = 10;
  const c = document.createElement("canvas");
  const ctx = c.getContext("2d");
  ctx.font = `${fontWeight} ${fontSize}px Inter, -apple-system, sans-serif`;
  const metrics = ctx.measureText(text);
  const w = Math.ceil(metrics.width) + padding * 2;
  const h = fontSize + padding * 2;
  c.width = w;
  c.height = h;
  ctx.font = `${fontWeight} ${fontSize}px Inter, -apple-system, sans-serif`;
  ctx.fillStyle = opts.color || "rgba(190, 200, 215, 0.92)";
  ctx.textBaseline = "top";
  ctx.fillText(text, padding, padding);
  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 4;
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({
    map: tex,
    transparent: true,
    depthTest: false,
  });
  const sp = new THREE.Sprite(mat);
  const scale = opts.scale || 0.0028;
  sp.scale.set(w * scale, h * scale, 1);
  sp.renderOrder = 10;
  return sp;
}

// (Axis tick labels removed — only the floor grid remains.)

// -----------------------------------------------------------------------------
// Lights
// -----------------------------------------------------------------------------
scene.add(new THREE.AmbientLight(0xffffff, 0.55));

const key = new THREE.DirectionalLight(0xffffff, 0.95);
key.position.set(5, 7, 4);
scene.add(key);

const fill = new THREE.DirectionalLight(0xaecfff, 0.35);
fill.position.set(-5, 3, -2);
scene.add(fill);

const rim = new THREE.DirectionalLight(0xffd9b8, 0.25);
rim.position.set(0, 4, -6);
scene.add(rim);

// -----------------------------------------------------------------------------
// Hill-climbing animation — a glowing line ascends the gradient toward a peak
// -----------------------------------------------------------------------------
const TRAIL_MAX = 360;
const trailPositions = new Float32Array(TRAIL_MAX * 3);
const trailColors = new Float32Array(TRAIL_MAX * 3);
const trailGeo = new LineGeometry();
const trailMat = new LineMaterial({
  vertexColors: true,
  transparent: true,
  linewidth: 4.5, // pixels — Line2 honours this regardless of WebGL caps
  worldUnits: false,
  dashed: false,
  depthTest: true,
});
trailMat.resolution.set(window.innerWidth, window.innerHeight);
const trail = new Line2(trailGeo, trailMat);
trail.frustumCulled = false;
trail.renderOrder = 5;
plot.add(trail);

const DOT_COLOR = 0x4ec3ff;

const head = new THREE.Mesh(
  new THREE.SphereGeometry(0.085, 20, 20),
  new THREE.MeshBasicMaterial({
    color: DOT_COLOR,
    transparent: true,
    opacity: 0.98,
  })
);
head.renderOrder = 6;
head.visible = false; // hide the moving "head" sphere — only the trail line shows
plot.add(head);

let climberX = 0;
let climberZ = 0;
let trailLen = 0;
let summitPause = 0;
let climbAccum = 0;
let tourIdx = 0;
// Where the climbing line is heading. Updated by focusOn() and the auto-cycle.
// Sticky: unfocus() does NOT reset this, so the orb stays put until another
// service is highlighted.
let climberTarget = null;

// -----------------------------------------------------------------------------
// Service orbs — click to reveal what we deliver. Scattered across the grid.
// -----------------------------------------------------------------------------
// Each service sits on the OUTWARD face of a mountain — the side that faces
// the edge of the box, not in between two peaks — so the camera can fly to a
// clean side-on view of every dot.
const allServices = [
  {
    label: "UGC",                      // outward (west) face of the red peak
    desc: "Creator-led content produced at volume and matched to specific audience segments, with creative, placement, and frequency optimized against measured persuasion lift in the target population.",
    x: -3.30, z:  0.85,
  },
  {
    label: "DATA SCIENCE",             // outward (back) face of the light-blue peak
    desc: "Predictive modeling, voter and consumer scoring, and microsegmentation built from first-party data, commercial data brokers, and behavioral signals, engineered to identify and rank every individual in a target universe.",
    x:  0.10, z: -1.55,
  },
  {
    label: "AI TRAINING",              // outward (east) face of the dark-blue peak
    desc: "Custom-built AI systems and agents deployed inside a campaign or organization, with hands-on training for staff to run them, covering call and canvass automation, generative content pipelines, opposition research agents, and donor and voter outreach at scale.",
    x:  3.50, z:  0.95,
  },
  {
    label: "POLLING",                  // lower outward face of the red peak (south-west)
    desc: "Large-sample survey research and message testing designed to isolate persuadable segments, quantify movement on specific arguments, and feed directly into the targeting model.",
    x: -3.20, z: -0.45,
  },
  {
    label: "CAMPAIGN STRATEGY",        // upper outward face of the dark-blue peak (north-east)
    desc: "End-to-end campaign architecture covering targeting, message, paid and earned media sequencing, field, and GOTV, built directly on top of the segmentation and polling so every dollar and every door is assigned to a scored individual.",
    x:  3.40, z:  1.85,
  },
];
// Always show every service — they should never disappear, even on mobile.
const services = allServices;

// Tour visits every service orb in a natural counter-clockwise loop, so the
// climbing line walks through each "button" in turn.
const TOUR_ORDER = [
  "UGC",
  "POLLING",
  "DATA SCIENCE",
  "AI TRAINING",
  "CAMPAIGN STRATEGY",
];
const tour = TOUR_ORDER
  .map((label) => services.find((s) => s.label === label))
  .filter(Boolean)
  .map((svc) => ({ x: svc.x, z: svc.z, summit: true, service: svc }));

if (tour.length > 0) {
  climberX = tour[0].x;
  climberZ = tour[0].z;
  climberTarget = tour[0].service;
  head.position.set(climberX, heightAt(climberX, climberZ) + 0.05, climberZ);
}

const serviceDotGeo = new THREE.SphereGeometry(0.05, 16, 16);
const serviceDotMat = new THREE.MeshBasicMaterial({
  color: DOT_COLOR,
  transparent: true,
  opacity: 0.95,
});
const serviceGlowMat = new THREE.MeshBasicMaterial({
  color: DOT_COLOR,
  transparent: true,
  opacity: 0.20,
});
const serviceGlowGeo = new THREE.SphereGeometry(0.13, 14, 14);
// Invisible "hit zone" sphere — much larger than the dot so taps register easily.
// Bigger on phones for fat-finger forgiveness.
const serviceHitGeo = new THREE.SphereGeometry(IS_PHONE ? 0.65 : 0.42, 10, 10);
const serviceHitMat = new THREE.MeshBasicMaterial({ visible: false });

const serviceHitMeshes = [];

for (const svc of services) {
  const surfaceY = heightAt(svc.x, svc.z);

  const dot = new THREE.Mesh(serviceDotGeo, serviceDotMat);
  dot.position.set(svc.x, surfaceY + 0.07, svc.z);
  dot.renderOrder = 7;
  plot.add(dot);

  const glow = new THREE.Mesh(serviceGlowGeo, serviceGlowMat);
  glow.position.copy(dot.position);
  glow.renderOrder = 6;
  plot.add(glow);

  // Two label sprites — dim (default) and bright/bold (selected). Toggle .visible.
  // Mobile gets a noticeably larger label so the tap target is easier.
  const labelScale = IS_PHONE ? 0.0042 : 0.0028;
  const labelDim = makeTextSprite(svc.label, {
    fontSize: 48,
    fontWeight: 400,
    color: "rgba(150, 158, 172, 0.78)",
    scale: labelScale,
  });
  labelDim.position.set(svc.x, surfaceY + 0.5, svc.z);
  plot.add(labelDim);

  const labelBright = makeTextSprite(svc.label, {
    fontSize: 48,
    fontWeight: 700,
    color: "rgba(255, 255, 255, 1.0)",
    scale: labelScale,
  });
  labelBright.position.set(svc.x, surfaceY + 0.5, svc.z);
  labelBright.visible = false;
  plot.add(labelBright);

  svc.labelDim = labelDim;
  svc.labelBright = labelBright;

  const hit = new THREE.Mesh(serviceHitGeo, serviceHitMat);
  hit.position.copy(dot.position);
  hit.userData.service = svc;
  hit.userData.dot = dot;
  hit.userData.glow = glow;
  plot.add(hit);
  serviceHitMeshes.push(hit);
}

// -----------------------------------------------------------------------------
// Click handling — raycast against the hit-zones, show panel with description.
// -----------------------------------------------------------------------------
const _raycaster = new THREE.Raycaster();
const _ndc = new THREE.Vector2();
const panel = document.getElementById("service-info");
const panelLabel = document.getElementById("service-label");
const panelDesc = document.getElementById("service-desc");
const panelClose = document.getElementById("service-close");

function showService(svc) {
  if (!panel) {
    console.warn("[hillclimb] service-info panel element missing in DOM");
    return;
  }
  panelLabel.textContent = svc.label;
  panelDesc.textContent = svc.desc;
  // Pinned to the centre of the viewport — no orb tracking.
  panel.style.left = "50%";
  panel.style.top = "50%";
  panel.style.transform = "translate(-50%, -50%)";
  panel.classList.remove("is-hidden");
}
function hideService() {
  if (!panel) return;
  panel.classList.add("is-hidden");
}
// Panel close button is wired below (in focusOn/unfocus block) so the camera
// returns to the default view as well.

function pickService(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  _ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  _ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  _raycaster.setFromCamera(_ndc, camera);
  const hits = _raycaster.intersectObjects(serviceHitMeshes, false);
  return hits.length > 0 ? hits[0].object.userData.service : null;
}

canvas.addEventListener("click", (e) => {
  // If the pointer-up came from a drag (touch or mouse), don't pick a service.
  if (touchOneDragged) {
    touchOneDragged = false;
    return;
  }
  if (mouseDragMoved) {
    mouseDragMoved = false;
    return;
  }
  const svc = pickService(e.clientX, e.clientY);
  // focusOn / unfocus are function declarations defined later — hoisted, safe to call.
  if (svc) focusOn(svc);
  else unfocus();
});

// Pointer cursor when hovering an orb (desktop only)
canvas.addEventListener("pointermove", (e) => {
  if (e.pointerType === "touch") return;
  const svc = pickService(e.clientX, e.clientY);
  canvas.style.cursor = svc ? "pointer" : "";
});

function pushTrail(x, y, z) {
  if (trailLen < TRAIL_MAX) {
    const i = trailLen;
    trailPositions[i * 3 + 0] = x;
    trailPositions[i * 3 + 1] = y;
    trailPositions[i * 3 + 2] = z;
    trailLen++;
  } else {
    // ring-buffer style: drop oldest sample
    trailPositions.copyWithin(0, 3, TRAIL_MAX * 3);
    const i = TRAIL_MAX - 1;
    trailPositions[i * 3 + 0] = x;
    trailPositions[i * 3 + 1] = y;
    trailPositions[i * 3 + 2] = z;
  }
  // Recolor: head is bright cream, tail fades but stays clearly visible.
  for (let i = 0; i < trailLen; i++) {
    const t = i / Math.max(1, trailLen - 1); // 0 = oldest, 1 = head
    const dim = 0.55 + 0.45 * t;
    trailColors[i * 3 + 0] = 1.0 * dim;
    trailColors[i * 3 + 1] = 0.96 * dim;
    trailColors[i * 3 + 2] = 0.62 * dim;
  }
  // Line2 needs at least 2 points to draw a segment.
  if (trailLen < 2) return;
  trailGeo.setPositions(trailPositions.subarray(0, trailLen * 3));
  trailGeo.setColors(trailColors.subarray(0, trailLen * 3));
}

const STEP_RATE = 70;     // simulation steps per second
const STEP_LEN = 0.045;   // domain units per step (path advance speed)
const SURFACE_LIFT = 0.05; // raise the trail just above the surface

function stepClimber(dt) {
  if (!climberTarget) return;
  climbAccum += dt;
  const stepDt = 1 / STEP_RATE;
  while (climbAccum > stepDt) {
    climbAccum -= stepDt;
    const dx = climberTarget.x - climberX;
    const dz = climberTarget.z - climberZ;
    const dist = Math.hypot(dx, dz);
    if (dist < STEP_LEN * 1.1) {
      // Arrived — snap exactly and stay until climberTarget changes.
      climberX = climberTarget.x;
      climberZ = climberTarget.z;
      const y = heightAt(climberX, climberZ) + SURFACE_LIFT;
      pushTrail(climberX, y, climberZ);
      head.position.set(climberX, y, climberZ);
      // The popup waits for the ball to land here. Show it now if focused.
      if (
        focusedSvc &&
        climberTarget === focusedSvc &&
        panel &&
        panel.classList.contains("is-hidden")
      ) {
        showService(focusedSvc);
      }
      return;
    }
    climberX += (dx / dist) * STEP_LEN;
    climberZ += (dz / dist) * STEP_LEN;
    const y = heightAt(climberX, climberZ) + SURFACE_LIFT;
    pushTrail(climberX, y, climberZ);
  }
  const y = heightAt(climberX, climberZ) + SURFACE_LIFT;
  head.position.set(climberX, y, climberZ);
}

// -----------------------------------------------------------------------------
// Animation: slow auto-rotate + gentle mouse parallax
// -----------------------------------------------------------------------------
let mouseX = 0;
let mouseY = 0;

// Desktop mouse drag-to-orbit. Mirrors the 1-finger touch behaviour above.
let mouseDragging = false;
let mouseDragMoved = false;
let mouseDragPrev = null;
const MOUSE_DRAG_THRESHOLD = 4;

canvas.addEventListener("pointerdown", (e) => {
  if (e.pointerType === "touch") return;
  mouseDragging = true;
  mouseDragMoved = false;
  mouseDragPrev = { x: e.clientX, y: e.clientY };
  canvas.setPointerCapture?.(e.pointerId);
});

window.addEventListener("pointerup", (e) => {
  if (e.pointerType === "touch") return;
  mouseDragging = false;
  mouseDragPrev = null;
});

window.addEventListener("pointermove", (e) => {
  // Don't let stray touches jerk the camera around — only mouse/pen drives parallax.
  if (e.pointerType === "touch") return;

  // While the mouse is held down, drag rotates the camera.
  if (mouseDragging && mouseDragPrev) {
    const dx = e.clientX - mouseDragPrev.x;
    const dy = e.clientY - mouseDragPrev.y;
    if (
      !mouseDragMoved &&
      Math.hypot(e.clientX - mouseDragPrev.x, e.clientY - mouseDragPrev.y) >=
        MOUSE_DRAG_THRESHOLD
    ) {
      mouseDragMoved = true;
    }
    if (mouseDragMoved) {
      azimT -= dx * 0.005;
      elev = Math.max(0.05, Math.min(1.25, elev + dy * 0.0035));
    }
    mouseDragPrev = { x: e.clientX, y: e.clientY };
    return;
  }

  // Otherwise: passive cursor parallax.
  mouseX = (e.clientX / window.innerWidth) * 2 - 1;
  mouseY = (e.clientY / window.innerHeight) * 2 - 1;
});

function resize() {
  const w = canvas.clientWidth || window.innerWidth;
  const h = canvas.clientHeight || window.innerHeight;
  if (canvas.width !== w || canvas.height !== h) {
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    // Line2 needs the framebuffer resolution to compute pixel-accurate widths.
    trailMat.resolution.set(w, h);
  }
}
window.addEventListener("resize", resize);
resize();

// -----------------------------------------------------------------------------
// Wheel / pinch zoom
// -----------------------------------------------------------------------------
const ZOOM_MIN = 2.5;
const ZOOM_MAX = 80;
// Default framing — closer on mobile so the scene reads better at small sizes.
const DEFAULT_ZOOM = IS_PHONE ? 22.0 : IS_NARROW ? 28.0 : 28.0;
// Pull in close enough to read the orb clearly without losing context.
const FOCUS_ZOOM = IS_PHONE ? 10.0 : 8.5;
let zoomTarget = DEFAULT_ZOOM;
let zoomCurrent = zoomTarget;

canvas.addEventListener(
  "wheel",
  (e) => {
    e.preventDefault();
    const factor = Math.exp(e.deltaY * 0.0016);
    zoomTarget = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoomTarget * factor));
  },
  { passive: false }
);

// Touch input: 1-finger drag → orbit (left/right rotates azimuth, up/down tilts
// elevation). 2-finger pinch → zoom. Below an 8-px threshold a touch is still
// treated as a tap so the click handler can fire normally.
let lastPinchDist = null;
let touchOneStart = null;
let touchOnePrev = null;
let touchOneDragged = false;
let touchOneActive = false;
const TOUCH_DRAG_THRESHOLD = 8;

canvas.addEventListener(
  "touchstart",
  (e) => {
    if (e.touches.length === 1) {
      const t = e.touches[0];
      touchOneStart = { x: t.clientX, y: t.clientY };
      touchOnePrev = { x: t.clientX, y: t.clientY };
      touchOneDragged = false;
      touchOneActive = true;
      lastPinchDist = null;
    } else if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      lastPinchDist = Math.hypot(dx, dy);
      touchOneActive = false;
      touchOneStart = null;
      touchOnePrev = null;
    } else {
      lastPinchDist = null;
      touchOneActive = false;
      touchOneStart = null;
    }
  },
  { passive: true }
);

canvas.addEventListener(
  "touchmove",
  (e) => {
    // Two-finger pinch
    if (e.touches.length === 2) {
      if (e.cancelable) e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      if (lastPinchDist && dist > 0) {
        const ratio = lastPinchDist / dist;
        zoomTarget = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoomTarget * ratio));
      }
      lastPinchDist = dist;
      return;
    }
    // One-finger drag → orbit
    if (e.touches.length === 1 && touchOneStart) {
      const t = e.touches[0];
      const totalDx = t.clientX - touchOneStart.x;
      const totalDy = t.clientY - touchOneStart.y;
      // Below the threshold, leave it alone so a tap still fires "click".
      if (
        !touchOneDragged &&
        Math.hypot(totalDx, totalDy) < TOUCH_DRAG_THRESHOLD
      ) {
        return;
      }
      touchOneDragged = true;
      if (e.cancelable) e.preventDefault();
      const dx = t.clientX - touchOnePrev.x;
      const dy = t.clientY - touchOnePrev.y;
      // Map screen pixels to camera angle deltas.
      azimT -= dx * 0.0065;
      elev = Math.max(0.05, Math.min(1.25, elev + dy * 0.0042));
      touchOnePrev = { x: t.clientX, y: t.clientY };
    }
  },
  { passive: false }
);

const endTouch = () => {
  lastPinchDist = null;
  touchOneActive = false;
  touchOneStart = null;
  touchOnePrev = null;
  // touchOneDragged is consumed by the click handler below.
};
canvas.addEventListener("touchend", endTouch);
canvas.addEventListener("touchcancel", endTouch);

let t0 = performance.now();
let azim = 0.6;
let elev = 0.62;
let azimT = 0.6;

// Camera orbits around lookCenter (which lerps toward lookTarget). Default look
// is the box centre; focusing on a service shifts the target onto that orb.
const lookCenter = new THREE.Vector3(0, 1.0, 0);
const lookTarget = new THREE.Vector3(0, 1.0, 0);
let focusedSvc = null;
let focusAzimTarget = null; // when focused, also tween azim to a flattering angle

function setLabelStates(selectedSvc) {
  for (const s of services) {
    if (s.labelDim) s.labelDim.visible = s !== selectedSvc;
    if (s.labelBright) s.labelBright.visible = s === selectedSvc;
  }
}

function focusOn(svc) {
  focusedSvc = svc;
  zoomTarget = FOCUS_ZOOM;
  // Outward camera angle (180° flip from the old default).
  focusAzimTarget = Math.atan2(svc.x, svc.z);
  // Redirect the climbing line — sticky until another service is highlighted.
  climberTarget = svc;
  climbAccum = 0;
  // Camera will follow the BALL (lookTarget is updated each frame in animate()),
  // so it glides with the climber rather than jumping straight to the orb.
  setLabelStates(svc);
  // Don't open the popup yet — it appears only when the ball arrives.
  hideService();
}

function unfocus() {
  focusedSvc = null;
  focusAzimTarget = null;
  lookTarget.set(0, 1.0, 0);
  zoomTarget = DEFAULT_ZOOM;
  // Freeze the ball where it is — don't keep wandering after the panel closes.
  climberTarget = null;
  setLabelStates(null);
  hideService();
}

// ----------------------------------------------------------------------------
// Position the description popup so it floats above the focused orb in screen
// space. Runs every frame while focused so the popup tracks the orb as the
// camera glides toward focus.
// ----------------------------------------------------------------------------
// The popup is pinned to the centre of the page — no per-frame projection
// updates needed. Kept as a no-op so the call site in animate() still works.
function updatePanelPosition() {
  /* intentionally empty: panel stays centred via CSS / showService() */
}

// ----------------------------------------------------------------------------
// Auto-cycle: when the user is idle, walk through every service in order,
// focusing each one and showing its popup, then move on.
// ----------------------------------------------------------------------------
let lastInteraction = performance.now();
let autoCycleActive = false;
let autoCycleIndex = 0;
let autoCyclePhase = "focus"; // "focus" (showing) | "gap" (between)
let autoCyclePhaseStart = performance.now();
const IDLE_BEFORE_AUTO = 2.0; // seconds of no input before auto-cycle starts
const FOCUS_HOLD = 15.0;      // 15s per dot
const GAP_BETWEEN = 0.0;      // no gap — camera glides directly to next service

function noteInteraction() {
  lastInteraction = performance.now();
  autoCycleActive = false;
}
["pointerdown", "wheel", "touchstart"].forEach((evt) =>
  window.addEventListener(evt, noteInteraction, { passive: true })
);

function updateAutoCycle() {
  const now = performance.now();
  const idleSec = (now - lastInteraction) / 1000;
  if (!autoCycleActive) {
    if (idleSec > IDLE_BEFORE_AUTO) {
      autoCycleActive = true;
      autoCyclePhaseStart = now;
      if (focusedSvc) {
        const idx = services.indexOf(focusedSvc);
        autoCycleIndex = idx >= 0 ? idx : 0;
        autoCyclePhase = "focus";
      } else {
        autoCycleIndex = 0;
        autoCyclePhase = "focus";
        focusOn(services[autoCycleIndex]);
      }
    }
    return;
  }
  const phaseElapsed = (now - autoCyclePhaseStart) / 1000;
  if (autoCyclePhase === "focus") {
    if (phaseElapsed >= FOCUS_HOLD) {
      autoCyclePhase = "gap";
      autoCyclePhaseStart = now;
      unfocus();
    }
  } else if (autoCyclePhase === "gap") {
    if (phaseElapsed >= GAP_BETWEEN) {
      autoCycleIndex = (autoCycleIndex + 1) % services.length;
      autoCyclePhase = "focus";
      autoCyclePhaseStart = now;
      focusOn(services[autoCycleIndex]);
    }
  }
}

// Wire panel close button → unfocus (also returns camera to default).
if (panelClose) {
  panelClose.addEventListener("click", unfocus);
}

function animate() {
  const now = performance.now();
  const dt = Math.min(0.05, (now - t0) / 1000);
  t0 = now;

  // (Auto-cycle disabled — the camera only moves when the user clicks.)

  // Auto-orbit slowly + offset by mouse — pause auto-spin while focused.
  if (!focusedSvc) {
    if (!touchOneActive) azimT += dt * 0.035;
  } else if (focusAzimTarget != null && !touchOneActive && !mouseDragging) {
    // Snap azimT toward the focus angle quickly when focused (fast transition).
    const delta = ((focusAzimTarget - azimT + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    azimT += delta * Math.min(1, dt * 2.5);
  }

  const mouseAzim = mouseX * 0.45;
  const mouseElev = -mouseY * 0.18;
  // Fast camera lerp when focused, gentle when free.
  const camLerp = focusedSvc ? 0.06 : 0.012;
  azim += (azimT + mouseAzim - azim) * camLerp;
  elev += (0.62 + mouseElev - elev) * camLerp;

  // Smoothly track the zoom target and the look-at center
  zoomCurrent += (zoomTarget - zoomCurrent) * camLerp;
  lookCenter.lerp(lookTarget, camLerp);

  const radius = zoomCurrent;
  camera.position.x = lookCenter.x + Math.sin(azim) * Math.cos(elev) * radius;
  camera.position.z = lookCenter.z + Math.cos(azim) * Math.cos(elev) * radius;
  camera.position.y = lookCenter.y + Math.sin(elev) * radius * 0.6;
  camera.lookAt(lookCenter);

  stepClimber(dt);

  // While focused, the camera follows the BALL's current position (not the
  // orb's), so it glides alongside the climber as it walks to the next orb.
  if (focusedSvc) {
    const cy = heightAt(climberX, climberZ);
    lookTarget.set(climberX, cy + 0.07, climberZ);
  }

  // Keep the description popup glued to the focused orb in screen space.
  if (focusedSvc) updatePanelPosition();

  resize();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
animate();
