import * as THREE from 'three';
import { STORY, START_NODE, prepareVisit } from './story.js';

// ---------- Settings: tweak while testing ----------
const CONFIG = {
  typeSpeed: 38,         // characters per second (fallback when there's no voice)
  hintAfterSec: 8,       // show the hint if the visitor doesn't react
  voiceOn: false,        // voice is opt-in so the installation does not talk constantly
  voiceRate: 1.0,
  voicePitch: 0.95,
  absentWhisperSec: 10,  // NPC notices the visitor left
  absentResetSec: 60,    // go back to the idle screen
  endHoldSec: 20,        // how long the ending stays on screen
  dialogueSentences: 3,  // maximum complete sentences shown in the dialogue box
  useCamera: false,      // set to true once the Python YOLO script runs
  cameraUrl: 'ws://localhost:8765',
};

// ---------- DOM ----------
const $ = (id) => document.getElementById(id);
const el = {
  text: $('npc-text'), hint: $('hint'), whisper: $('whisper'), idle: $('idle'),
  pathBox: $('path-box'), pathLine: $('path-line'), hud: $('hud'),
  sound: $('sound-btn'),
};

// ---------- 3D scene ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
$('stage').appendChild(renderer.domElement);

const scene = new THREE.Scene();
// Bright Caribbean daytime sky: a soft vertical gradient on a big backdrop dome
const skyTex = canvasTexture(16, 512, (ctx) => {
  const g = ctx.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0.0, '#3f9fe0');
  g.addColorStop(0.45, '#8fd4f4');
  g.addColorStop(0.72, '#d9efff');
  g.addColorStop(1.0, '#fff2cf');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 16, 512);
});
const sky = new THREE.Mesh(new THREE.SphereGeometry(130, 32, 20),
  new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false }));
scene.add(sky);
scene.fog = new THREE.Fog(0xdcefff, 45, 130);

const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 150);
camera.position.set(0, 1.6, 3.4);

scene.add(new THREE.HemisphereLight(0xd6f0ff, 0xffcf9a, 1.7));
const sunLight = new THREE.DirectionalLight(0xfff2d6, 2.4);
sunLight.position.set(-7, 14, -3);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(2048, 2048);
sunLight.shadow.camera.near = 1;
sunLight.shadow.camera.far = 70;
const sd = 18;
sunLight.shadow.camera.left = -sd; sunLight.shadow.camera.right = sd;
sunLight.shadow.camera.top = sd; sunLight.shadow.camera.bottom = -sd;
scene.add(sunLight);
const lamp = new THREE.PointLight(0xffe6b0, 7, 0, 2);
lamp.position.set(0, 3, 0.5);
scene.add(lamp);

// ---------- Small helpers for the Venezuelan decor ----------
function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  return new THREE.CanvasTexture(c);
}
const TRI = { yellow: '#f2b632', blue: '#1d4ea3', red: '#c4302b' };
function star(ctx, x, y, r) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const ang = -Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 === 0 ? r : r * 0.45;
    if (i === 0) ctx.moveTo(x + Math.cos(ang) * rad, y + Math.sin(ang) * rad);
    else ctx.lineTo(x + Math.cos(ang) * rad, y + Math.sin(ang) * rad);
  }
  ctx.closePath();
  ctx.fill();
}
// Venezuelan flag texture (canvas so it looks right from any angle)
const flagTex = canvasTexture(240, 160, (ctx) => {
  ctx.fillStyle = TRI.yellow; ctx.fillRect(0, 0, 240, 53.3);
  ctx.fillStyle = TRI.blue; ctx.fillRect(0, 53.3, 240, 53.3);
  ctx.fillStyle = TRI.red; ctx.fillRect(0, 106.6, 240, 53.3);
  ctx.fillStyle = '#ffffff'; star(ctx, 120, 80, 15);
});

// Ground: a colorful tiled promenade, like the painted Caribbean walkways
const mat = (color, rough = 0.9) => new THREE.MeshStandardMaterial({ color, roughness: rough });
const plaza = new THREE.Mesh(new THREE.CircleGeometry(11, 48),
  new THREE.MeshStandardMaterial({ color: 0xf4ead6, roughness: 0.85 }));
plaza.rotation.x = -Math.PI / 2;
plaza.position.set(0, 0, -4);
plaza.receiveShadow = true;
scene.add(plaza);
// A bright tiled "ribbon" down the middle of the promenade (the reference walkway)
const TILE = ['#e74a3a', '#2b8fd6', '#f2c53a', '#40b56b', '#ef7fae', '#8a63d8'];
for (let i = 0; i < 14; i++) {
  const tile = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1.0),
    mat(TILE[i % TILE.length], 0.75));
  tile.rotation.x = -Math.PI / 2;
  tile.position.set(0, 0.011, 2 - i * 1.05);
  scene.add(tile);
}

// The Caribbean, bright turquoise, stretching to the horizon
const sea = new THREE.Mesh(new THREE.CircleGeometry(120, 48),
  new THREE.MeshStandardMaterial({ color: 0x2bb6c4, roughness: 0.2, metalness: 0.15 }));
sea.rotation.x = -Math.PI / 2;
sea.position.set(0, -0.02, -55);
scene.add(sea);
// soft white highlight where the sun skims the water
const shimmer = new THREE.Mesh(new THREE.CircleGeometry(120, 48),
  new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.1 }));
shimmer.rotation.x = -Math.PI / 2;
shimmer.position.set(0, -0.01, -55);
scene.add(shimmer);

// Low white seawall at the edge of the plaza
const wall = new THREE.Mesh(new THREE.BoxGeometry(16, 0.45, 0.35), mat(0xece6d8, 0.8));
wall.position.set(0, 0.22, -9.4);
wall.castShadow = true;
scene.add(wall);

// A bright, colorful Caribbean street (Curaçao / Peten feel): low houses
// painted in vivid colors, lined up behind the promenade
const city = new THREE.Group();
const collapsibleBuildings = [];
const BUILD_COLORS = [0xef5f8a, 0x2b8fd6, 0x3fb0d6, 0x59b85c, 0xf2c53a,
  0xf28f3a, 0xc453c4, 0x6aa8e0, 0xe8b54a, 0xd65f8a];
const winMat = new THREE.MeshBasicMaterial({ color: 0xeaf6ff });
for (let i = 0; i < 20; i++) {
  const w = 2.2 + Math.random() * 2.0;
  const h = 2.2 + Math.random() * 3.6;
  const d = 1.6 + Math.random() * 1.4;
  const x = (i - 9.5) * 2.7 + Math.random() * 0.8;
  const z = -14 - Math.random() * 5;
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d),
    mat(BUILD_COLORS[i % BUILD_COLORS.length], 0.7));
  body.position.set(x, h / 2, z);
  body.castShadow = true;
  city.add(body);
  const building = { body, roof: null, home: body.position.clone(), velocity: 0, falling: false };
  collapsibleBuildings.push(building);
  // a little roof band in a complementary tone
  const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 0.1, 0.25, d + 0.1),
    mat(0xf6f1e6, 0.7));
  roof.position.set(x, h + 0.12, z);
  city.add(roof);
  building.roof = roof;
  // white-framed windows
  const wins = 2 + Math.floor(Math.random() * 4);
  for (let j = 0; j < wins; j++) {
    const win = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.36), winMat);
    win.position.set(x + (Math.random() - 0.5) * w * 0.7,
      0.9 + Math.random() * Math.max(0.4, h - 1.4), z + d / 2 + 0.02);
    city.add(win);
  }
}
// a church with a tower, like the ones on the coastal squares
const church = new THREE.Group();
const churchBody = new THREE.Mesh(new THREE.BoxGeometry(3, 4.5, 2.4), mat(0xf2ede0, 0.7));
churchBody.position.y = 2.25;
churchBody.castShadow = true;
const churchTower = new THREE.Mesh(new THREE.BoxGeometry(1.1, 7, 1.1), mat(0xf2ede0, 0.7));
churchTower.position.set(1.6, 3.5, 0);
churchTower.castShadow = true;
const churchSpire = new THREE.Mesh(new THREE.ConeGeometry(0.7, 1.4, 4), mat(0x2b8fd6, 0.6));
churchSpire.position.set(1.6, 7.7, 0);
const churchDoor = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 1.4),
  new THREE.MeshBasicMaterial({ color: 0x2b4a8a }));
churchDoor.position.set(0, 0.7, 1.21);
church.add(churchBody, churchTower, churchSpire, churchDoor);
church.position.set(-15, 0, -17);
city.add(church);
scene.add(city);

// Soft distant green-blue hills behind the sea
function hill(x, z, w, h, color) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2),
    mat(color, 1));
  m.scale.set(w, h, 10);
  m.position.set(x, -0.5, z);
  scene.add(m);
}
hill(-45, -70, 40, 15, 0x9fd0c8);
hill(40, -74, 46, 13, 0xb3dccf);
hill(0, -80, 60, 10, 0xbfe0d6);

// Flag on a pole at the plaza edge
const flagPole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 4.2, 8), mat(0xcfcfcf, 0.4));
flagPole.position.set(-3.6, 2.1, -8.6);
flagPole.castShadow = true;
scene.add(flagPole);
const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1),
  new THREE.MeshStandardMaterial({ map: flagTex, roughness: 0.9, side: THREE.DoubleSide }));
flag.position.set(-2.85, 3.6, -8.6);
scene.add(flag);
const flagBall = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 10), mat(0xf2b632, 0.4));
flagBall.position.set(-3.6, 4.25, -8.6);
scene.add(flagBall);

// A small arepa stand next to the NPC
const arepaStand = new THREE.Group();
const standBody = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1, 0.7), mat(0x4a3526, 0.9));
standBody.position.y = 0.5;
const standTop = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.06, 0.85), mat(0x9a5230, 0.7));
standTop.position.y = 1.03;
const standAva = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.55, 0.12, 12, 1, true), mat(0xc4302b, 0.85));
standAva.position.y = 1.6;
standAva.rotation.x = 0.18;
const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.4),
  new THREE.MeshStandardMaterial({ map: canvasTexture(240, 80, (ctx) => {
    ctx.fillStyle = '#efe6d2'; ctx.fillRect(0, 0, 240, 80);
    ctx.fillStyle = '#4a3526'; ctx.font = 'bold 42px Georgia'; ctx.textAlign = 'center';
    ctx.fillText('AREPAS', 120, 52);
  }), roughness: 0.9 }));
sign.position.y = 1.6;
const standArepa1 = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.09, 0.2), mat(0xd9a34a, 0.8));
standArepa1.position.set(-0.3, 1.1, 0);
const standArepa2 = standArepa1.clone(); standArepa2.position.set(0.3, 1.1, 0.1); standArepa2.rotation.y = 0.5;
arepaStand.add(standBody, standTop, standAva, sign, standArepa1, standArepa2);
arepaStand.traverse((o) => { if (o.isMesh) o.castShadow = true; });
arepaStand.position.set(2.6, 0, -2.4);
arepaStand.rotation.y = -0.5;
scene.add(arepaStand);

// Offer table: where a "given" object shows up and lights up when the camera detects it
const offerTable = new THREE.Group();
const oTableTop = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.05, 20), mat(0x5d4229, 0.6));
oTableTop.position.y = 1;
const oTableLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 1, 10), mat(0x4a3526));
oTableLeg.position.y = 0.5;
const oTableBase = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.34, 0.05, 12), mat(0x4a3526));
oTableBase.position.y = 0.03;
offerTable.add(oTableTop, oTableLeg, oTableBase);
offerTable.position.set(-2.2, 0, -2.2);
offerTable.traverse((o) => { if (o.isMesh) o.castShadow = true; });
scene.add(offerTable);

const offerMat = new THREE.MeshStandardMaterial({ color: 0xb98a4a, roughness: 0.5,
  emissive: 0xf2b632, emissiveIntensity: 0 });
function makeOffer(obj) { // builds a simple object on the offer table
  obj.traverse((o) => { if (o.isMesh) { o.material = offerMat; o.castShadow = true; } });
  obj.position.set(-2.2, 1.06, -2.2);
  obj.visible = false;
  scene.add(obj);
  return obj;
}
// a cuatro (lute)
const cuatro = new THREE.Group();
const cBody = new THREE.Mesh(new THREE.CapsuleGeometry(0.14, 0.2, 4, 12), offerMat);
cBody.rotation.x = Math.PI / 2; cBody.position.y = 0.02;
const cNeck = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.3, 0.02), offerMat);
cNeck.position.set(0, 0.06, -0.2); cNeck.rotation.x = -0.3;
const cHead = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.02, 0.08), offerMat);
cHead.position.set(0, 0.1, -0.32);
cuatro.add(cBody, cNeck, cHead);
makeOffer(cuatro);
// maracas (pair)
const maracas = new THREE.Group();
[[-0.1, 0.25], [0.1, 0.22]].forEach(([x, h]) => {
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, h, 8), offerMat);
  stem.position.set(x, h / 2, 0);
  const headM = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 10), offerMat);
  headM.position.set(x, h + 0.07, 0);
  maracas.add(stem, headM);
});
makeOffer(maracas);
// an arepa
const arepa = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.08, 20), offerMat);
arepa.rotation.x = 0.5;
makeOffer(arepa);
// a book
const book = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.06, 0.3), offerMat);
makeOffer(book);
// only one is visible at a time; shown when the matching object is given
function showOffer(which) {
  [cuatro, maracas, arepa, book].forEach((o) => (o.visible = o === which));
}

// NPC — a cute, friendly capybara-style character (placeholder: swap for a
// real rigged model later). npcMat stays as the main fur material so the
// reaction glow below still works.
const npc = new THREE.Group();
const npcMat = new THREE.MeshStandardMaterial({ color: 0xc9a27e, roughness: 0.72 });
const muzzleMat = new THREE.MeshStandardMaterial({ color: 0xdcc9a8, roughness: 0.85 });
const darkMat = new THREE.MeshStandardMaterial({ color: 0x43332a, roughness: 0.85 });
const whiteMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
const pupilMat = new THREE.MeshBasicMaterial({ color: 0x231a15 });
const npcEyes = [];
const npcPupils = [];
const npcEars = [];
const npcArms = [];

const furPart = (geo, x, y, z, sx, sy, sz) => {
  const m = new THREE.Mesh(geo, npcMat);
  m.position.set(x, y, z);
  m.scale.set(sx, sy, sz);
  return m;
};

// Body: upright pear-shaped torso with the heavy rounded hindquarter of a capybara.
npc.add(furPart(new THREE.SphereGeometry(1, 24, 20), 0, 0.78, 0, 0.55, 0.7, 0.58));
npc.add(furPart(new THREE.SphereGeometry(1, 24, 20), 0, 0.78, -0.38, 0.48, 0.55, 0.5));
npc.add(furPart(new THREE.SphereGeometry(1, 20, 16), 0.28, 0.62, -0.36, 0.38, 0.45, 0.42));

// Head and sloping neck: broad at the cheeks, tapering into a long muzzle.
npc.add(furPart(new THREE.SphereGeometry(1, 28, 24), 0, 1.45, 0.14, 0.46, 0.48, 0.45));
npc.add(furPart(new THREE.SphereGeometry(1, 24, 18), 0, 1.2, 0.27, 0.4, 0.48, 0.42));

// Broad forward muzzle, with a dark rounded nose and cheek freckles.
const muzzle = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 18), muzzleMat);
muzzle.position.set(0, 1.19, 0.47);
muzzle.scale.set(0.31, 0.2, 0.3);
npc.add(muzzle);

// Nose: dark rounded cap on top of the muzzle
const nose = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 16), darkMat);
nose.position.set(0, 1.3, 0.73);
nose.scale.set(0.18, 0.11, 0.12);
npc.add(nose);
for (const nx of [-0.055, 0.055]) {
  const n = new THREE.Mesh(new THREE.SphereGeometry(0.017, 8, 8), darkMat);
  n.position.set(nx, 1.32, 0.8);
  npc.add(n);
}
const freckleMat = new THREE.MeshBasicMaterial({ color: 0x987452 });
for (let i = 0; i < 8; i++) {
  const freckle = new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 6), freckleMat);
  freckle.position.set(-0.18 + (i % 4) * 0.12, 1.15 + Math.floor(i / 4) * 0.07, 0.72);
  npc.add(freckle);
}

// Ears: two little rounded ears on top
for (const ex of [-0.19, 0.19]) {
  const ear = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 12), npcMat);
  ear.position.set(ex, 1.91, 0.02);
  ear.scale.set(0.1, 0.15, 0.07);
  npc.add(ear);
  npcEars.push(ear);
}

// Eyes: big, round and friendly, sitting above the muzzle (white + pupil + glint)
for (const ex of [-0.17, 0.17]) {
  const white = new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 16), whiteMat);
  white.position.set(ex, 1.55, 0.47);
  white.scale.set(1, 1.2, 0.5);
  const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 12), pupilMat);
  pupil.position.set(ex, 1.55, 0.54);
  const glint = new THREE.Mesh(new THREE.SphereGeometry(0.017, 8, 8), whiteMat);
  glint.position.set(ex - 0.02, 1.6, 0.58);
  npc.add(white, pupil, glint);
  npcEyes.push(white);
  npcPupils.push(pupil);
}

// Smile: a gentle downward arc below the nose
const smile = new THREE.Mesh(
  new THREE.TorusGeometry(0.12, 0.015, 8, 20, Math.PI),
  darkMat,
);
smile.position.set(0, 1.02, 0.76);
smile.rotation.z = Math.PI;
npc.add(smile);

// Front legs: characteristic short upright legs with dark little claws.
for (const ax of [-0.42, 0.42]) {
  const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.42, 6, 12), npcMat);
  leg.position.set(ax, 0.47, 0.28);
  leg.rotation.z = ax < 0 ? 0.12 : -0.12;
  npc.add(leg);
  npcArms.push(leg);
  for (let claw = -1; claw <= 1; claw++) {
    const toe = new THREE.Mesh(new THREE.CapsuleGeometry(0.018, 0.1, 4, 6), darkMat);
    toe.position.set(ax + claw * 0.045, 0.2, 0.39);
    toe.rotation.x = Math.PI / 2;
    npc.add(toe);
  }
}

// Hind feet sit under the large rear haunch.
for (const fx of [-0.18, 0.18]) {
  const foot = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 12), darkMat);
  foot.position.set(fx + 0.25, 0.16, -0.08);
  foot.scale.set(0.16, 0.1, 0.23);
  npc.add(foot);
}

npc.position.set(0, 0, -0.8);
const npcTail = new THREE.Mesh(
  new THREE.CapsuleGeometry(0.06, 0.3, 5, 10),
  npcMat,
);
npcTail.position.set(0.2, 0.58, -0.82);
npcTail.rotation.x = Math.PI / 2;
npc.add(npcTail);
npc.traverse((o) => { if (o.isMesh) o.castShadow = true; });
scene.add(npc);

// ---------- Venezuelan decor ----------
// Palm trees around the plaza
function palm(x, z, s = 1) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.06 * s, 0.1 * s, 2.6 * s, 8), mat(0x6b4f3a, 0.9));
  trunk.position.y = 1.3 * s;
  trunk.rotation.z = (Math.random() - 0.5) * 0.12;
  g.add(trunk);
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x3e7c33, roughness: 0.9, side: THREE.DoubleSide });
  for (let i = 0; i < 6; i++) {
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.28 * s, 1.5 * s, 4), leafMat);
    const holder = new THREE.Group();
    leaf.position.y = 0.75 * s;
    leaf.rotation.x = Math.PI / 2.4;
    holder.add(leaf);
    holder.rotation.y = (i * Math.PI) / 3;
    holder.position.y = 2.55 * s;
    g.add(holder);
  }
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  g.position.set(x, 0, z);
  scene.add(g);
  return g;
}
const palms = [palm(-4.5, -8.8, 1.1), palm(4.8, -8.4, 1.0), palm(-5.4, -3.2, 0.9), palm(5.2, -4.2, 0.95)];

// Big round-canopy street trees, the layered green of a shaded promenade
function shadeTree(x, z, s = 1) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.1 * s, 0.16 * s, 2.4 * s, 10), mat(0x6b4f3a, 0.9));
  trunk.position.y = 1.2 * s;
  g.add(trunk);
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x2f9e44, roughness: 0.9 });
  const leafMat2 = new THREE.MeshStandardMaterial({ color: 0x3fb05a, roughness: 0.9 });
  const blobs = [
    [0, 2.6, 0, 1.0, leafMat], [0.7, 2.3, 0.2, 0.7, leafMat2],
    [-0.7, 2.4, -0.1, 0.72, leafMat2], [0.1, 2.4, 0.6, 0.62, leafMat],
  ];
  blobs.forEach(([bx, by, bz, bs, bm]) => {
    const blob = new THREE.Mesh(new THREE.SphereGeometry(0.65 * s * bs, 14, 12), bm);
    blob.position.set(bx * s, by * s, bz * s);
    g.add(blob);
  });
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  g.position.set(x, 0, z);
  scene.add(g);
  return g;
}
shadeTree(-6.6, -12, 1.1); shadeTree(6.8, -12.5, 1.05);
shadeTree(-7.4, -6.5, 0.95); shadeTree(7.5, -7, 0.9);

// Lush street bushes: bright bougainvillea pinks and fiery croton reds,
// the two signatures of colorful Caribbean sidewalks
function bush(x, z, s = 1, kind = 'pink') {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.IcosahedronGeometry(0.52 * s, 1),
    mat(kind === 'green' ? 0x2f7d3a : 0x33602c, 0.95));
  base.position.y = 0.4 * s;
  const bloomColor = kind === 'red' ? 0xd63b2c : kind === 'green' ? 0x2f9e44 : 0xc43a7a;
  const bloomMat = new THREE.MeshStandardMaterial({ color: bloomColor, roughness: 0.9 });
  for (let i = 0; i < 3; i++) {
    const bloom = new THREE.Mesh(new THREE.IcosahedronGeometry(0.32 * s, 1), bloomMat);
    bloom.position.set((Math.random() - 0.5) * 0.5 * s, (0.55 + Math.random() * 0.35) * s, (Math.random() - 0.5) * 0.5 * s);
    g.add(bloom);
  }
  g.add(base);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  g.position.set(x, 0, z);
  scene.add(g);
}
// bushes line both sides of the promenade
[[-7.5, -2, 1.1, 'red'], [7.6, -2, 1.0, 'pink'],
 [-8.2, -5, 1.0, 'pink'], [8.2, -5.4, 0.95, 'red'],
 [-7.0, -8.5, 1.15, 'green'], [7.3, -8.6, 1.05, 'red']].forEach(([x, z, s, k]) => bush(x, z, s, k));

// Green lampposts with white globes, lining the street like the reference
function lamppost(x, z) {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 3.2, 8), mat(0x245a3a, 0.5));
  pole.position.y = 1.6;
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.12, 10), mat(0x1e4a30, 0.5));
  collar.position.y = 3.15;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 14, 14),
    new THREE.MeshStandardMaterial({ color: 0xfff4e0, roughness: 0.4,
      emissive: 0xfff2d0, emissiveIntensity: 0.35 }));
  head.position.y = 3.35;
  g.add(pole, collar, head);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  g.position.set(x, 0, z);
  scene.add(g);
}
// two pairs down the promenade
lamppost(-2.2, -6.5); lamppost(2.2, -6.5);
lamppost(-2.2, -9.5); lamppost(2.2, -9.5);

// Birds over the water (simple V shapes that drift slowly)
const birds = [];
for (let i = 0; i < 4; i++) {
  const b = new THREE.Group();
  const wingMat = new THREE.MeshBasicMaterial({ color: 0x2a1a24, side: THREE.DoubleSide });
  const wl = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.12), wingMat);
  const wr = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.12), wingMat);
  wl.position.x = -0.25; wr.position.x = 0.25;
  b.add(wl, wr);
  b.position.set(-14 + i * 9, 8 + i * 1.5, -30 - i * 4);
  birds.push({ g: b, wl, wr, phase: i * 1.7 });
  scene.add(b);
}

// NPC / object reactions: a short coloured pulse
const REACT_COLORS = {
  SURRENDER: new THREE.Color(0x1d4ea3),
  FIGHT: new THREE.Color(0xc4302b),
  GAVE_CUATRO: new THREE.Color(0xf2b632),
  GAVE_MARACAS: new THREE.Color(0xe86a2b),
  GAVE_AREPA: new THREE.Color(0xd9a34a),
  GAVE_BOOK: new THREE.Color(0x7c3b2b),
  RIOT_START: new THREE.Color(0xc4302b),
  BUILDING_COLLAPSE: new THREE.Color(0xf2b632),
  DOCKS_FIRE: new THREE.Color(0xff6b25),
};
const black = new THREE.Color(0x000000);
let reactColor = black, reactTimer = 0;
let avatarAction = 'idle';
let avatarActionTimer = 0;
function react(type) {
  reactColor = REACT_COLORS[type] ?? black;
  reactTimer = 1.2;
  avatarAction = type;
  avatarActionTimer = 1.8;
}

const riotLight = new THREE.PointLight(0xc4302b, 0, 18);
riotLight.position.set(0, 4, -8);
scene.add(riotLight);
let sceneEvent = '-';
let sceneEventTimer = 0;
let shakeTimer = 0;
let musicTimer = 0;
let musicMode = 'none';
let collapsedCount = 0;

function startMusic(mode) {
  musicMode = mode;
  musicTimer = 0;
}

function collapseBuildings(count) {
  const candidates = collapsibleBuildings.filter((building) => !building.falling);
  shuffleForScene(candidates).slice(0, count).forEach((building) => {
    building.falling = true;
    building.velocity = 0;
  });
}

function updateCollapsedBuildings(dt) {
  for (const building of collapsibleBuildings) {
    if (!building.falling) continue;
    building.velocity += 7 * dt;
    building.body.position.y = Math.max(0.2, building.body.position.y - building.velocity * dt);
    building.body.rotation.z += dt * 1.8;
    if (building.roof) {
      building.roof.position.y = Math.max(0.3, building.roof.position.y - building.velocity * dt);
      building.roof.rotation.z += dt * 1.8;
    }
  }
}

function updateMusic(dt) {
  if (musicMode === 'none') return;
  musicTimer -= dt;
  if (musicTimer > 0) return;
  const patterns = {
    riot: [110, 146, 174, 130],
    fight: [180, 220, 180, 260],
    fire: [90, 120, 90, 160],
    train: [220, 277, 330, 440],
  };
  const notes = patterns[musicMode] || patterns.fight;
  const step = Math.floor(Math.random() * notes.length);
  tone(notes[step], musicMode === 'riot' ? 0.18 : 0.28, musicMode === 'fire' ? 0.08 : 0.055);
  musicTimer = musicMode === 'riot' ? 0.28 : 0.48;
}

function shuffleForScene(items) {
  const result = items.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function triggerSceneEvent(type) {
  sceneEvent = type;
  sceneEventTimer = type === 'RIOT_START' ? 12 : 3;
  react(type);
  if (type === 'RIOT_START') {
    startMusic('riot');
    shakeTimer = 2.5;
    riotLight.intensity = 8;
    collapseBuildings(1);
  } else if (type === 'BUILDING_COLLAPSE' || type === 'DOCKS_COLLAPSE') {
    shakeTimer = 1.8;
    collapseBuildings(type === 'DOCKS_COLLAPSE' ? 2 : 1);
    tone(70, 1.2, 0.25);
  } else if (type === 'DOCKS_FIRE' || type === 'DOCKS_EXPLOSION') {
    startMusic('fire');
    riotLight.color.set(0xff6b25);
    riotLight.intensity = 7;
    shakeTimer = type === 'DOCKS_EXPLOSION' ? 2 : 0.8;
    tone(110, 0.8, 0.2);
  } else if (type === 'FIGHT_START') {
    startMusic('fight');
    shakeTimer = 0.5;
    tone(140, 0.25, 0.18);
  } else if (type === 'FIGHT_WIN' || type === 'FIGHT_LOSS') {
    shakeTimer = 1.2;
    tone(type === 'FIGHT_WIN' ? 520 : 90, 0.45, 0.2);
  } else if (type === 'TRAIN_DEPART') {
    startMusic('train');
    tone(220, 1.5, 0.16);
  }
}

// ---------- Game state ----------
const state = {
  mode: 'idle',   // 'idle' | 'story'
  people: 0,      // how many people the camera sees
  nodeId: null,
  path: [],       // the visitor's rabbit hole
  typed: 0,
  nodeTime: 0,    // seconds since the NPC finished talking (only counts while someone is present)
  absentFor: 0,
  whispered: false,
  lastEvent: '-',
  voiceChar: -1,      // char index of the word the voice is on (from onboundary)
  voiceDone: false,   // the voice finished this line
  voiceNoBound: false,// the engine never sent boundary events; fall back to own clock
  voiceStartAt: 0,
  speakTok: 0,
  _finalChoice: null,
};

function nodeText(node) {
  return typeof node.text === 'function' ? node.text(state) : node.text;
}

function visibleDialogue(text, characterCount) {
  const typedText = text.slice(0, Math.floor(characterCount));
  const sentences = typedText.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [];
  const limit = Math.max(1, Math.min(3, CONFIG.dialogueSentences));
  return sentences.slice(0, limit).join('').trim();
}

function goTo(id) {
  const node = STORY[id];
  if (!node) return console.warn('Unknown node:', id);
  state.nodeId = id;
  state.typed = 0;
  state.nodeTime = 0;
  el.hint.classList.remove('show');
  el.hint.textContent = node.expects
    ? (id === 'cityMap'
      ? '(Move left, stay centered, or move right)'
      : '(Fist, raise a hand, or wave)')
    : (node.hint ?? '');
  if (node.sceneEvent) triggerSceneEvent(node.sceneEvent);
  if (node.tag) state.path.push(node.tag);
  if (node.end) {
    el.pathLine.textContent = state.path.join('  ') || '·';
    el.pathBox.classList.add('show');
    chime();
  }
  speak(nodeText(node));
}

function startStory() {
  state.mode = 'story';
  state.path = [];
  state.absentFor = 0;
  state.whispered = false;
  prepareVisit(state);
  state._finalChoice = null;
  el.idle.classList.add('hidden');
  goTo(START_NODE);
}

function resetGame() {
  stopSpeaking();
  state.mode = 'idle';
  state.nodeId = null;
  state.path = [];
  el.text.textContent = '';
  el.hint.classList.remove('show');
  el.pathBox.classList.remove('show');
  el.idle.classList.remove('hidden');
}

let whisperTimer;
function whisper(text) {
  speak(text);
  el.whisper.textContent = text;
  el.whisper.classList.add('show');
  clearTimeout(whisperTimer);
  whisperTimer = setTimeout(() => el.whisper.classList.remove('show'), 4000);
}

// ---------- Speech + sound ----------
// The NPC "talks" with the browser's built-in speech engine (no audio files needed),
// and the on-screen text types itself out in sync with the voice.

let voices = [];
function loadVoices() { voices = speechSynthesis.getVoices(); }
loadVoices();
if (speechSynthesis.onvoiceschanged !== undefined) speechSynthesis.onvoiceschanged = loadVoices;

function pickVoice() {
  if (!voices.length) voices = speechSynthesis.getVoices();
  if (!voices.length) return undefined;
  const en = voices.filter((v) => v.lang.toLowerCase().startsWith('en'));
  // prefer a calm, female-sounding voice so the "auntie in the room" reads right
  return en.find((v) => /female|zira|samantha|aria|jenny|libby|sonia|catherine/i.test(v.name))
      || en[0] || voices[0];
}

let speakToken = 0; // invalidates onboundary handlers from cancelled utterances
function speak(text) {
  if (!CONFIG.voiceOn || !('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = CONFIG.voiceRate;
  u.pitch = CONFIG.voicePitch;
  const v = pickVoice();
  if (v) u.voice = v;
  u.onboundary = (e) => {
    if (speakToken === state.speakTok && e.charIndex !== undefined) state.voiceChar = e.charIndex;
  };
  u.onend = () => {
    if (speakToken === state.speakTok) state.voiceDone = true;
  };
  state.speakTok = ++speakToken;
  state.voiceChar = -1;
  state.voiceDone = false;
  state.voiceNoBound = false;
  state.voiceStartAt = performance.now();
  speechSynthesis.speak(u);
}
function stopSpeaking() {
  speakToken++;
  if ('speechSynthesis' in window) speechSynthesis.cancel();
}

function setVoice(on) {
  CONFIG.voiceOn = on;
  if (el.sound) {
    el.sound.classList.toggle('off', !on);
    el.sound.innerHTML = on ? '&#128266; voice: on' : '&#128263; voice: off';
  }
  if (!on) stopSpeaking();
  else if (state.mode === 'story') speak(nodeText(STORY[state.nodeId])); // pick up where we left off
}
if (el.sound) el.sound.addEventListener('click', () => setVoice(!CONFIG.voiceOn));

let audioCtx = null;
function tone(freq, dur, gain, delay = 0) {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const t0 = audioCtx.currentTime + delay;
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(audioCtx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  } catch { /* no audio available */ }
}
function chime() { // soft two-note resolution for the ending
  tone(660, 0.5, 0.12, 0);
  tone(880, 0.9, 0.12, 0.22);
}

// ---------- Event system: the camera (or keyboard) talks to the game through this ----------
// Camera-facing events stay intentionally small: WAVE, HAND_UP, FIST, LEFT,
// CENTER, RIGHT, plus PERSON_PRESENT/PERSON_LEFT. Keyboard-only test events
// remain available below and are translated into the same gesture actions.
const OBJECT_EVENTS = ['GAVE_CUATRO', 'GAVE_MARACAS', 'GAVE_AREPA', 'GAVE_BOOK'];
const ACTIONS = [
  'SURRENDER', 'FIGHT', ...OBJECT_EVENTS,
  'GESTURE_FIST', 'GESTURE_HAND_UP', 'GESTURE_WAVE',
  'MOVE_LEFT', 'STAY_MIDDLE', 'MOVE_RIGHT',
  'GO_MARKET', 'GO_DOCKS', 'GO_BARRIO', 'GO_STATION',
  'CHASE', 'HELP', 'BREAK', 'CLIMB', 'RESCUE', 'CUT_LOOSE', 'STEAL',
  'SAVE', 'LETTERS', 'ORGANIZE', 'EXPOSE', 'RIOT', 'RETURN', 'KEEP',
  'OPEN', 'ENTER', 'KNOCK', 'LEAVE', 'BOARD', 'END_LOOP', 'STAY',
  'CUT_LOOSE', 'EXPOSE', 'RIOT',
];
const OFFER_BY_EVENT = { GAVE_CUATRO: cuatro, GAVE_MARACAS: maracas, GAVE_AREPA: arepa, GAVE_BOOK: book };

const GESTURE_EVENTS = ['GESTURE_FIST', 'GESTURE_HAND_UP', 'GESTURE_WAVE',
  'MOVE_LEFT', 'STAY_MIDDLE', 'MOVE_RIGHT'];
const CAMERA_EVENT_ALIASES = {
  FIST: 'GESTURE_FIST',
  HAND_UP: 'GESTURE_HAND_UP',
  WAVE: 'GESTURE_WAVE',
  LEFT: 'MOVE_LEFT',
  CENTER: 'STAY_MIDDLE',
  RIGHT: 'MOVE_RIGHT',
};

function gestureTarget(type) {
  const node = STORY[state.nodeId];
  if (!node?.expects) return null;
  const entries = Object.entries(node.expects);
  if (state.nodeId === 'cityMap') {
    const ordered = {
      MOVE_LEFT: 0,
      STAY_MIDDLE: 1,
      MOVE_RIGHT: 2,
    };
    const index = ordered[type];
    if (index === undefined) return null;
    const selectedDistrict = state._districtPlan[index];
    return node.expects[{
      market: 'GO_MARKET',
      docks: 'GO_DOCKS',
      barrio: 'GO_BARRIO',
      station: 'GO_STATION',
    }[selectedDistrict]];
  }

  const preference = {
    GESTURE_FIST: ['FIGHT', 'RIOT', 'BREAK', 'STEAL', 'CUT_LOOSE', 'OPEN'],
    GESTURE_HAND_UP: ['HELP', 'RESCUE', 'SAVE', 'ORGANIZE', 'KEEP', 'STAY'],
    GESTURE_WAVE: ['CHASE', 'EXPOSE', 'ENTER', 'KNOCK', 'LETTERS', 'LEAVE'],
  }[type];
  const preferred = preference?.find((event) => node.expects[event]);
  if (preferred) return node.expects[preferred];

  const directionalIndex = { MOVE_LEFT: 0, STAY_MIDDLE: 1, MOVE_RIGHT: 2 }[type];
  return directionalIndex === undefined ? null : entries[directionalIndex % entries.length]?.[1];
}

function handleEvent(type, data = {}) {
  const event = CAMERA_EVENT_ALIASES[type] ?? type;
  state.lastEvent = event;
  if (event === 'PERSON_PRESENT') setPeople(Math.max(1, state.people));
  else if (event === 'PERSON_LEFT') setPeople(0);
  else if (event === 'PEOPLE_COUNT') setPeople(data.count ?? 0);
  else if (ACTIONS.includes(event)) onAction(event);
}

function setPeople(n) {
  const before = state.people;
  state.people = n;
  if (n > 0 && before === 0) {
    if (state.mode === 'idle') startStory();
    else if (state.absentFor >= CONFIG.absentWhisperSec) whisper("You're back.");
    state.absentFor = 0;
    state.whispered = false;
  }
  if (n >= 2 && before < 2 && state.mode === 'story') whisper('You brought someone with you.');
}

let offerTimer = 0;
function onAction(type) {
  react(type);
  if (OBJECT_EVENTS.includes(type)) {
    const obj = OFFER_BY_EVENT[type];
    if (obj) { showOffer(obj); offerTimer = 1.6; } // the object shows up on the table and glows
  }
  if (state.mode !== 'story' || state.people === 0) return;
  if (state.nodeId === 'cityMap') {
    const districtByEvent = {
      GO_MARKET: 'market',
      GO_DOCKS: 'docks',
      GO_BARRIO: 'barrio',
      GO_STATION: 'station',
    };
    const district = districtByEvent[type];
    if (district && state._visited?.[district]) {
      whisper('You already changed that district. Another road is waiting.');
      return;
    }
  }
  if (state.nodeId === 'finale') {
    state._finalChoice = type === 'STAY' || type === 'STAY_MIDDLE' ? 'stay' : 'leave';
  }
  const target = GESTURE_EVENTS.includes(type)
    ? gestureTarget(type)
    : STORY[state.nodeId].expects?.[type];
  if (target) goTo(target);
}

// Keyboard simulation (so you can play without a camera)
addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  const choose = (...types) => {
    const expects = STORY[state.nodeId]?.expects ?? {};
    const type = types.find((candidate) => expects[candidate]);
    if (type) handleEvent(type);
  };
  if (k === 'p') handleEvent(state.people > 0 ? 'PERSON_LEFT' : 'PERSON_PRESENT');
  else if (k === '1') handleEvent('SURRENDER');
  else if (k === '2') handleEvent('FIGHT');
  else if (k === '3') handleEvent('GAVE_CUATRO');
  else if (k === '4') handleEvent('GAVE_MARACAS');
  else if (k === '5') handleEvent('GAVE_AREPA');
  else if (k === '6') handleEvent('GAVE_BOOK');
  else if (k === 'm') choose('GO_MARKET');
  else if (k === 'd') choose('GO_DOCKS');
  else if (k === 'b') choose('GO_BARRIO', 'BOARD');
  else if (k === 's') choose('GO_STATION', 'STAY', 'SAVE');
  else if (k === 'f') handleEvent('FIGHT');
  else if (k === 'c') choose('CHASE');
  else if (k === 'e') choose('HELP', 'RESCUE', 'ENTER', 'SAVE', 'STAY');
  else if (k === 'x') choose('BREAK', 'END_LOOP');
  else if (k === 'l') choose('CLIMB', 'LEAVE', 'LETTERS');
  else if (k === 'o') choose('OPEN', 'ORGANIZE');
  else if (k === 't') choose('STEAL');
  else if (k === 'k') choose('KEEP', 'KNOCK');
  else if (k === 'a') choose('RETURN');
  else if (k === 'q') handleEvent('GESTURE_FIST');
  else if (k === 'u') handleEvent('GESTURE_HAND_UP');
  else if (k === 'w') handleEvent('GESTURE_WAVE');
  else if (k === 'arrowleft') handleEvent('MOVE_LEFT');
  else if (k === 'arrowdown') handleEvent('STAY_MIDDLE');
  else if (k === 'arrowright') handleEvent('MOVE_RIGHT');
  else if (k === '7') handleEvent('PEOPLE_COUNT', { count: state.people >= 2 ? 1 : 2 });
  else if (k === 'r') resetGame();
  else if (k === 'v') setVoice(!CONFIG.voiceOn);
  else if (k === 'h') el.hud.classList.toggle('hidden');
});

// Optional: receive events from the Python/YOLO script as JSON, e.g. {"event":"SURRENDER"}
function connectCamera() {
  const ws = new WebSocket(CONFIG.cameraUrl);
  ws.onmessage = (m) => {
    try {
      const d = JSON.parse(m.data);
      handleEvent(typeof d.event === 'string' ? d.event.toUpperCase() : d.event, d);
    } catch { /* ignore */ }
  };
  ws.onclose = () => setTimeout(connectCamera, 2000);
}
if (CONFIG.useCamera) connectCamera();

// ---------- Per-frame update ----------
function voiceActive() {
  return CONFIG.voiceOn && 'speechSynthesis' in window
      && speechSynthesis.speaking && !speechSynthesis.speechPaused;
}

function updateStory(dt) {
  const node = STORY[state.nodeId];
  const text = nodeText(node);
  const len = text.length;

  // Typing follows the voice when there is one, our own clock otherwise.
  if (state.voiceDone) state.typed = len;
  else if (voiceActive()) {
    if (state.voiceChar >= 0) {
      state.typed = Math.max(state.typed, Math.min(len, state.voiceChar + 6));
    } else if (!state.voiceNoBound && performance.now() - state.voiceStartAt > 2000) {
      state.voiceNoBound = true; // this engine sends no boundary events; use the clock
    }
    if (state.voiceNoBound) state.typed += dt * CONFIG.typeSpeed;
  } else {
    state.typed += dt * CONFIG.typeSpeed;
  }
  state.typed = Math.min(state.typed, len);
  el.text.textContent = visibleDialogue(text, state.typed);
  if (state.typed < len) return;

  if (state.people > 0) state.nodeTime += dt;   // the story waits for a visitor who walked away

  if (node.hint && state.nodeTime >= CONFIG.hintAfterSec) el.hint.classList.add('show');
  if (node.end) {
    if (state.nodeTime >= CONFIG.endHoldSec) resetGame();
  } else if (node.timeout && state.nodeTime >= node.timeout.sec) {
    goTo(node.timeout.goto);
  } else if (node.next && !node.expects && state.nodeTime >= (node.delay ?? 3)) {
    goTo(typeof node.next === 'function' ? node.next(state) : node.next);
  }

  if (state.people === 0) {
    state.absentFor += dt;
    if (state.absentFor >= CONFIG.absentWhisperSec && !state.whispered) {
      whisper('Wait... where did you go?');
      state.whispered = true;
    }
    if (state.absentFor >= CONFIG.absentResetSec) resetGame();
  }
}

const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.1);
  const t = clock.elapsedTime;

  if (state.mode === 'story') updateStory(dt);
  updateCollapsedBuildings(dt);
  updateMusic(dt);
  sceneEventTimer = Math.max(0, sceneEventTimer - dt);
  shakeTimer = Math.max(0, shakeTimer - dt);
  riotLight.intensity = Math.max(0, riotLight.intensity - dt * 2.5);

  // NPC idle motion + reaction pulse
  reactTimer = Math.max(0, reactTimer - dt);
  avatarActionTimer = Math.max(0, avatarActionTimer - dt);
  const target = reactTimer > 0 ? reactColor : black;
  npcMat.emissive.lerp(target, 0.1);
  const actionAmount = Math.min(1, avatarActionTimer * 2);
  const breath = Math.sin(t * 2.1) * 0.018;
  const attention = avatarActionTimer > 0 ? actionAmount : 0;
  npc.position.y = Math.sin(t * 1.6) * 0.02 + breath;
  npc.rotation.y = Math.sin(t * 0.5) * 0.15;
  npc.rotation.z = Math.sin(t * 0.9) * 0.015
    + (avatarAction === 'GESTURE_WAVE' ? Math.sin(t * 4) * 0.025 * attention : 0);
  npc.scale.set(1 + reactTimer * 0.04, 1 + reactTimer * 0.04 + breath, 1 + reactTimer * 0.04);

  // Small, readable reactions make the character feel aware without stealing focus.
  const blinkCycle = t % 4.7;
  const blink = blinkCycle > 4.48 ? 0.18 : 1;
  const lookX = Math.sin(t * 0.7) * 0.018 + (state.people > 0 ? 0 : 0.035);
  npcEyes.forEach((eye) => { eye.scale.y = 1.2 * blink; });
  npcPupils.forEach((pupil, index) => {
    pupil.position.x = (index ? 0.17 : -0.17) + lookX;
    pupil.position.y = 1.55 + Math.sin(t * 0.8 + index) * 0.006;
  });
  npcEars.forEach((ear, index) => {
    ear.rotation.z = Math.sin(t * 1.4 + index * Math.PI) * 0.08
      + (avatarAction === 'GESTURE_WAVE' ? (index ? -0.25 : 0.25) * attention : 0);
  });
  npcArms.forEach((arm, index) => {
    const rest = index ? -0.35 : 0.35;
    const wave = avatarAction === 'GESTURE_WAVE' && index === 1 ? Math.sin(t * 10) * 0.35 * attention : 0;
    const greeting = avatarAction === 'GESTURE_HAND_UP' ? (index ? -0.9 : 0.9) * attention : 0;
    arm.rotation.z = rest + wave + greeting;
  });
  npcTail.rotation.z = Math.sin(t * 2.5) * 0.16 + (state.people > 0 ? Math.sin(t * 5) * 0.08 : 0);

  // the offered object glows, then fades
  offerTimer = Math.max(0, offerTimer - dt);
  const glow = offerTimer > 0 ? reactColor : black;
  offerMat.emissive.lerp(glow, 0.15);
  offerMat.emissiveIntensity = 0.5 + offerTimer * 0.6;

  // birds drift and flap
  for (const { g, wl, wr, phase } of birds) {
    g.position.x += dt * 0.5;
    if (g.position.x > 20) g.position.x = -20;
    const flap = Math.sin(t * 6 + phase) * 0.5;
    wl.rotation.z = flap; wr.rotation.z = -flap;
  }

  // slow camera sway
  const shake = shakeTimer > 0 ? shakeTimer * 0.08 : 0;
  camera.position.x = Math.sin(t * 0.3) * 0.15 + (Math.random() - 0.5) * shake;
  camera.position.y = 1.6 + (Math.random() - 0.5) * shake;
  camera.lookAt(0, 1.3, -3);

  el.hud.textContent =
    `mode: ${state.mode}   people: ${state.people}\n` +
    `node: ${state.nodeId ?? '-'}   last event: ${state.lastEvent}\n` +
    `scene: ${sceneEvent}   reputation: ${state._reputation ?? 0}\n` +
    `path: ${state.path.join(' ') || '-'}\n\n` +
    `Test gestures: Q fist   U raised hand   W wave\n` +
    `Position: Left / Down(center) / Right arrows\n` +
    `P presence   R reset   V voice   H hide\n` +
    `Legacy test shortcuts remain available\n` +
    ``;

  renderer.render(scene, camera);
}
animate();

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
