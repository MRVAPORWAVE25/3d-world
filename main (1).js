import * as THREE from "three";
import nipplejs from "nipplejs";

const canvas = document.getElementById("c");
const fpsEl = document.getElementById("fps");
let width = innerWidth, height = innerHeight;

// Warning overlay gating: block input until the player accepts the epilepsy/photo-sensitivity warning.
const warningOverlay = document.getElementById('warning-overlay');
const warningAcceptBtn = document.getElementById('warning-accept');
const warningDeclineBtn = document.getElementById('warning-decline');
let warningAccepted = false;

// wire buttons
if (warningAcceptBtn) {
  warningAcceptBtn.addEventListener('click', () => {
    warningAccepted = true;
    if (warningOverlay) warningOverlay.style.display = 'none';
    // ensure canvas cursor state is correct after enabling input
    if (!paused && document.pointerLockElement !== canvas) canvas.style.cursor = 'grab';
    // Show achievement/notification when the player accepts the warning
    try { showAchievement('Achievement Unlocked', 'I can read!'); } catch (e) {}
  });
}
if (warningDeclineBtn) {
  warningDeclineBtn.addEventListener('click', () => {
    // If the player declines, keep overlay visible and navigate away to prevent accidental play.
    // Simple behavior: redirect to about:blank
    window.location.href = 'about:blank';
  });
}

 // Achievement/notification helper (bottom-right): shows a small window and auto-hides it
 const achievementEl = document.getElementById('achievement');
 function showAchievement(title = 'Achievement Unlocked', subtitle = '') {
   if (!achievementEl) return;
   const win = achievementEl.querySelector('.achievement-window');
   // update text if present
   const t = win.querySelector('.ach-title');
   const s = win.querySelector('.ach-sub');
   if (t) t.textContent = title;
   if (s) s.textContent = subtitle;
 
   // Ensure achievements state exists and keep a boolean map per-achievement
   try {
     if (!state.achievements) state.achievements = [];
     if (!state.achVars) state.achVars = {};
 
     // Try to find an existing achievement by id/title/subtitle
     let found = state.achievements.find(a =>
       (a.id && a.id === title) ||
       (a.title && a.title === title) ||
       (a.subtitle && a.subtitle === subtitle)
     );
 
     // If not found, create a new achievement entry so every unlocked achievement has its own state
     if (!found) {
       // create a stable id by slugifying title + subtitle fallback
       const slug = (title + ' ' + (subtitle || '')).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
       found = {
         id: slug || `ach-${Date.now()}`,
         title: title,
         subtitle: subtitle || '',
         desc: '',
         unlocked: true
       };
       state.achievements.push(found);
     } else {
       // mark existing found achievement unlocked (we'll animate reveal later)
       found.unlocked = true;
     }
 
     // Ensure the per-achievement boolean variable reflects unlocked state
     try {
       if (found && found.id) {
         state.achVars[found.id] = true;
         // also keep root-level dedicated boolean like ach_<id>
         state[`ach_${found.id}`] = true;
       }
       // persist that at least one achievement was unlocked this session (v95)
       try { sessionStorage.setItem('hadAnyUnlock', '1'); } catch (e) {}
     } catch (e) {}
   } catch (e) {}
 
   // Visual tweak: if this achievement is the "mesmerizing" one, add special class for glowing rainbow text
   try {
     const isMesmerize = (title && title.toLowerCase().includes('mesmerizing')) || (subtitle && subtitle.toLowerCase().includes('mesmerizing')) ||
                         (state.achievements && state.achievements.find(a => a.id === 'mesmerizing' && (a.title === title || a.subtitle === subtitle)));
     if (isMesmerize) {
       win.classList.add('mesmerize');
     } else {
       win.classList.remove('mesmerize');
     }
   } catch (e) {}
 
   // Ensure any previous timers/animation classes are cleared
   clearTimeout(showAchievement._hideTimer);
   achievementEl.classList.remove('slide-out');
   achievementEl.classList.remove('slide-in');
 
   // make visible and slide in from right
   achievementEl.setAttribute('aria-hidden', 'false');
   // force reflow so the class transition occurs reliably
   void achievementEl.offsetWidth;
   achievementEl.classList.add('slide-in');
 
   // After 2 seconds on-screen, slide back out and hide after the transition completes
   showAchievement._hideTimer = setTimeout(() => {
     // start slide-out
     achievementEl.classList.remove('slide-in');
     achievementEl.classList.add('slide-out');
 
     // after the CSS transition duration (match 300ms in CSS), hide the element
     clearTimeout(showAchievement._finalHide);
     showAchievement._finalHide = setTimeout(() => {
       achievementEl.classList.remove('slide-out');
       achievementEl.setAttribute('aria-hidden', 'true');
       // clean up mesmerize class after hide so subsequent non-mesmerize shows are unaffected
       try { win.classList.remove('mesmerize'); } catch (e) {}
     }, 320);
   }, 2000);
 
   // Additionally, if the achievements panel exists, refresh it and play the "locked then break to reveal unlocked" animation for this achievement.
   try {
     // refresh achievements DOM if present so the panel reflects current entries
     const achList = document.getElementById('ach-list');
     if (achList) {
       // repopulate using the existing helper so full HTML is rebuilt
       try { populateAchievements(); } catch (e) {}
       // also refresh Extras visibility so conditional buttons update when achievements change
       try { if (typeof populateExtras === 'function') populateExtras(); } catch (e) {}

       // locate the newly unlocked item by id (found above might exist in state.achievements array)
       const slug = (title + ' ' + (subtitle || '')).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
       const targetId = state.achievements.find(a => a.id === slug) ? slug : (state.achievements.find(a => a.title === title || a.subtitle === subtitle) || {}).id;
       if (targetId) {
         const item = achList.querySelector(`div[data-ach-id="${targetId}"]`);
         if (item) {
           const statusEl = item.querySelector('.ach-status');
           // Start by showing the locked appearance for a short moment, then play breaking animation and flip to unlocked state.
           if (statusEl) {
             // Force locked visual first
             statusEl.classList.remove('unlocked');
             statusEl.classList.add('locked');
             statusEl.textContent = 'Locked';
             // small delay so player sees the locked state, then play a creak phase before the break
             setTimeout(() => {
               // add creak (bend/warp) phase
               statusEl.classList.remove('locked');
               statusEl.classList.add('creak');
               // after creak completes, start the breaking animation
               setTimeout(() => {
                 statusEl.classList.remove('creak');
                 statusEl.classList.add('breaking');
                 // once the breaking animation finishes, reveal unlocked state and animate glow reveal
                 setTimeout(() => {
                   statusEl.classList.remove('breaking');
                   // switch to unlocked base state
                   statusEl.classList.remove('locked');
                   statusEl.classList.add('unlocked');
                   statusEl.textContent = 'Unlocked';
                   // ensure base unlocked styling (kept here for compatibility)
                   statusEl.style.background = 'rgba(77,182,172,0.06)';
                   statusEl.style.color = '#4df0d0';
                   // give a brief timeout then reveal glow to allow a "crack -> reveal" pacing
                   setTimeout(() => {
                     try {
                       // add the reveal glow class that smoothly pops + shows glow
                       statusEl.classList.add('revealed');
                       // if achievements changed, ensure extras visibility is updated again after animation
                       try { if (typeof populateExtras === 'function') populateExtras(); } catch (e) {}
                     } catch (e) {}
                   }, 120); // small pause before glow reveal
                 }, 900); // match CSS breaking duration
               }, 600); // creak duration (match ach-creak)
             }, 1000); // show locked for 1s before initiating creak
           }
         }
       }
     } else {
       // if no achList element exists still ensure extras visibility is correct
       try { if (typeof populateExtras === 'function') populateExtras(); } catch (e) {}
     }
   } catch (e) {}
 }

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(width, height);
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x071018);

// Create a world root so we can shake the entire world (player rig + objects) separately from the scene background.
const world = new THREE.Group();
scene.add(world);

// Camera rig: yaw object contains pitch object which contains camera
const camera = new THREE.PerspectiveCamera(70, width / height, 0.1, 1000);
const yaw = new THREE.Object3D();
const pitch = new THREE.Object3D();
yaw.add(pitch);
pitch.add(camera);
// add the player rig into the world group so it will be included in world shakes
world.add(yaw);

// Helper: camera.getPlayerDirection(target)
// behaves like getWorldDirection but flattens to horizontal (faces along player's horizontal forward)
// returns the target Vector3 (or a new Vector3 if none provided)
camera.getPlayerDirection = function(target = new THREE.Vector3()) {
  this.getWorldDirection(target);
  target.y = 0;
  return target.normalize();
};

// Place camera
camera.position.set(0, 1.6, 0);

// Simple world: ground and a few boxes
const grid = new THREE.GridHelper(200, 200, 0x2a3b3a, 0x101416);
grid.material.opacity = 0.6;
grid.material.transparent = true;
world.add(grid);

const groundMat = new THREE.MeshStandardMaterial({ color: 0x163233, roughness: 0.9, metalness: 0.1 });
const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), groundMat);
ground.rotation.x = -Math.PI / 2;
ground.position.y = 0;
world.add(ground);

const boxMat = new THREE.MeshStandardMaterial({ color: 0x8fbfbb });
const interactiveBoxes = [];
// keep a snapshot of each box's original transform to reset when out-of-bounds
const interactiveBoxesInitial = [];
// OUT-OF-BOUNDS HUD state
let oobState = { active: false, timeLeft: 0, duration: 900, startY: 0 };
for (let i = 0; i < 20; i++) {
  // randomize box dimensions on spawn
  const bw = 0.6 + Math.random() * 2.4; // width: 0.6..3.0
  const bh = 0.6 + Math.random() * 3.4; // height: 0.6..4.0
  const bd = 0.6 + Math.random() * 2.4; // depth: 0.6..3.0
  const geom = new THREE.BoxGeometry(bw, bh, bd);
  const b = new THREE.Mesh(geom, boxMat);
  // place so the bottom sits on or slightly above ground (y = half height plus a small random lift)
  b.position.set((Math.random() - 0.5) * 80, bh * 0.5 + Math.random() * 1.5, (Math.random() - 0.5) * 80);
  b.userData = { velocity: new THREE.Vector3(), dynamic: false, name: `Box #${i+1}` }; // track physics + name
  world.add(b);
  interactiveBoxes.push(b);
  // save original transform so we can restore if the box leaves the playable area
  interactiveBoxesInitial.push({
    pos: b.position.clone(),
    quat: b.quaternion.clone(),
    rot: b.rotation.clone(),
    dynamic: !!b.userData.dynamic,
    velocity: b.userData.velocity ? b.userData.velocity.clone() : new THREE.Vector3()
  });
}

// Lights
const hemi = new THREE.HemisphereLight(0xbfeee6, 0x20262a, 0.8);
world.add(hemi);
const dir = new THREE.DirectionalLight(0xffffff, 0.6);
dir.position.set(5, 10, 2);
world.add(dir);

  // Movement state
const state = {
  forward: 0, right: 0,
  moveSpeed: 5, // m/s
  sprintMultiplier: 2.4, // sprint speed multiplier when holding Shift
  yaw: 0, pitch: 0,
  pitchLimit: { min: -80, max: 80 }, // degrees

  // input sensitivities and inversion (configurable via Settings)
  mouseSensitivity: 1.0,
  touchSensitivity: 1.0,
  invertY: false,

  // General UI option: show asset-on-highlight panel
  showAssetOnHighlight: false,

  // vertical / jump
  vy: 0,             // vertical velocity (m/s)
  gravity: -9.81,    // m/s^2 downward
  jumpSpeed: 5,      // initial jump impulse (m/s)
  height: 1.6,       // camera eye height when standing (visual default)
  grounded: true,

  // double-jump / tap detection
  jumpCount: 0,             // how many jumps used since leaving ground
  lastJumpPress: 0,         // timestamp of last Space press (ms)
  doubleJumpWindow: 300,    // ms window to consider a quick second tap

  // pickup state
  held: null,        // reference to held mesh
  holdOffset: new THREE.Vector3(0, -0.2, -1.2), // relative to camera (local)
  reach: 3,          // max pickup distance
  pickupForward: null, // stored forward direction at moment of pickup (world space)

  // throw charging
  throwBase: 6,      // base throw speed
  throwMax: 32,      // max throw speed
  throwChargeTime: 1.2, // seconds to reach max from base
  _chargeStart: 0,   // internal: timestamp when charging started (0 = not charging)

  // crouch
  crouchKey: 'Control',    // key label
  crouchEye: 0.6,          // camera local Y when crouched
  crouchSpeedMult: 0.5,    // movement speed multiplier while crouched

  // chaos / rainbow shake mode
  chaosActive: false,
  chaosTimeLeft: 0,
  chaosDuration: 900, // ms (shorter burst)
  chaosIntensity: 0.35, // how violently scene shakes (world-space offset)
  chaosColorSpeed: 0.002, // speed of rainbow cycling
  chaosChance: 0.22, // 22% chance on qualifying collision
  chaosCooldown: 0 // timestamp (ms) until chaos can retrigger after a run
};

// Convert degrees to radians clamp
function clampPitch(rad) {
  const min = THREE.MathUtils.degToRad(state.pitchLimit.min);
  const max = THREE.MathUtils.degToRad(state.pitchLimit.max);
  return Math.max(min, Math.min(max, rad));
}

// Input: desktop mouse look + WASD
const keys = {};
window.addEventListener('keydown', (e) => {
  // block keyboard input until the warning is accepted
  if (!warningAccepted) return;
  // movement keys (wasd / arrows) - keep lowercase key map
  if (e.key && e.key.length === 1) keys[e.key.toLowerCase()] = true;
  if (e.key && e.key.toLowerCase().startsWith('arrow')) keys[e.key.toLowerCase()] = true;

  // Sprint (Shift)
  if (e.key === 'Shift') keys['shift'] = true;
  // Crouch (Ctrl) - hold to crouch
  if (e.key === 'Control') keys['ctrl'] = true;

  // Space to jump (use code to reliably detect)
  if (e.code === 'Space') {
    const now = performance.now();
    // If grounded, perform normal jump and start jump count
    if (state.grounded) {
      state.vy = state.jumpSpeed;
      state.grounded = false;
      state.jumpCount = 1;
      state.lastJumpPress = now;
    } else {
      // airborne: allow a quick double-tap jump if within window and second jump not used
      const since = now - (state.lastJumpPress || 0);
      if (state.jumpCount < 2 && since <= state.doubleJumpWindow) {
        // second quick press => perform double jump
        state.vy = state.jumpSpeed;
        state.jumpCount = 2;
      } else {
        // register this press time so a following quick press can trigger double-jump
        state.lastJumpPress = now;
      }
    }
    // prevent page scroll
    e.preventDefault();
  }

  // Pickup/Drop with 'e'
  if (e.key && e.key.toLowerCase() === 'e') {
    handlePickupToggle();
  }
});
window.addEventListener('keyup', (e) => {
  if (e.key && e.key.length === 1) keys[e.key.toLowerCase()] = false;
  if (e.key && e.key.toLowerCase().startsWith('arrow')) keys[e.key.toLowerCase()] = false;

  // Sprint release
  if (e.key === 'Shift') keys['shift'] = false;
  // Crouch release
  if (e.key === 'Control') keys['ctrl'] = false;
});

 // Pointer controls (desktop): mouse movement updates look (no click-drag needed)
 // we still track pointerdown/up only for cursor styling, but movement applies on mouse move
let lastX = 0, lastY = 0;
canvas.addEventListener('pointerdown', (e) => {
  // block pointer actions until the warning is accepted
  if (!warningAccepted) return;
  // For mouse: request pointer lock so the cursor is hidden and movement is confined to the canvas.
  if (e.pointerType === 'mouse') {
    if (canvas.requestPointerLock) {
      try { canvas.requestPointerLock(); } catch {}
    }
    canvas.style.cursor = 'grabbing';
  }
  try { canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId); } catch {}

  // Left mouse press begins charging if holding an object
  if (e.button === 0) {
    if (state.held) {
      state._chargeStart = performance.now();
    }
  }
});
canvas.addEventListener('pointerup', (e) => {
  // Only revert cursor if pointer lock is not active
  if (e.pointerType === 'mouse') {
    if (document.pointerLockElement !== canvas) {
      canvas.style.cursor = 'grab';
    }
  }
  try { canvas.releasePointerCapture && canvas.releasePointerCapture(e.pointerId); } catch {}

  // Left mouse release: if we were charging and holding an object, compute charge and throw
  if (e.button === 0) {
    if (state.held && state._chargeStart > 0) {
      const heldFor = (performance.now() - state._chargeStart) / 1000;
      state._chargeStart = 0;
      // map heldFor from 0..throwChargeTime to throwBase..throwMax (clamped)
      const t = Math.min(1, Math.max(0, heldFor / state.throwChargeTime));
      const strength = state.throwBase + t * (state.throwMax - state.throwBase);
      throwHeldObject(strength);
    }
  }
});

// Keep canvas cursor synced with pointer lock state
document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement === canvas) {
    // hide cursor while locked
    canvas.style.cursor = 'none';
  } else {
    // show grab cursor when unlocked (desktop)
    canvas.style.cursor = 'grab';
  }
});
canvas.addEventListener('pointermove', (e) => {
  // block mouse look until warning accepted
  if (!warningAccepted) return;
  // only respond to mouse movement here (touch is handled separately)
  if (e.pointerType !== 'mouse') return;
  // Use movementX/Y when available for instant deltas, fallback to client deltas
  const dx = (typeof e.movementX === 'number') ? e.movementX : (e.clientX - lastX);
  const dy = (typeof e.movementY === 'number') ? e.movementY : (e.clientY - lastY);
  lastX = e.clientX; lastY = e.clientY;
  // Sensitivity uses configurable multiplier; invert Y if requested
  const base = 0.002;
  state.yaw -= dx * base * state.mouseSensitivity;
  state.pitch -= dy * base * state.mouseSensitivity * (state.invertY ? -1 : 1);
  state.pitch = clampPitch(state.pitch);
});

// Mobile: nipple.js joystick for movement and touch drag area for look
const leftArea = document.getElementById('left-joystick');
const rightArea = document.getElementById('right-touch');

let joystick = null;
// separate buffer for joystick so keyboard can always be read
const joystickInput = { forward: 0, right: 0 };
try {
  joystick = nipplejs.create({ zone: leftArea, mode: 'static', position: { left: '70px', bottom: '70px' }, size: 120, color: '#9AD0C6' });
  joystick.on('move', (evt, data) => {
    const ang = data.angle ? THREE.MathUtils.degToRad(data.angle.degree) : 0;
    const force = data.force || 0;
    joystickInput.forward = Math.cos(ang) * force;
    joystickInput.right = Math.sin(ang) * force;
  });
  joystick.on('end', () => { joystickInput.forward = 0; joystickInput.right = 0; });
} catch (e) {
  // ignore if nipplejs not available
}

// Touch drag for look (mobile)
let touchId = null;
rightArea.addEventListener('touchstart', (e) => {
  if (!warningAccepted) return;
  const t = e.changedTouches[0];
  touchId = t.identifier;
  lastX = t.clientX; lastY = t.clientY;
});
rightArea.addEventListener('touchmove', (e) => {
  if (!warningAccepted) return;
  if (touchId === null) return;
  for (let t of e.changedTouches) {
    if (t.identifier !== touchId) continue;
    const dx = t.clientX - lastX;
    const dy = t.clientY - lastY;
    lastX = t.clientX; lastY = t.clientY;
    // Sensitivity for touch uses configurable multiplier; respect invertY
    const baseTouch = 0.003;
    state.yaw -= dx * baseTouch * state.touchSensitivity;
    state.pitch -= dy * baseTouch * state.touchSensitivity * (state.invertY ? -1 : 1);
    state.pitch = clampPitch(state.pitch);
  }
});
rightArea.addEventListener('touchend', (e) => {
  if (!warningAccepted) return;
  for (let t of e.changedTouches) {
    if (t.identifier === touchId) touchId = null;
  }
});

// Resize
window.addEventListener('resize', onResize);
function onResize() {
  width = innerWidth; height = innerHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
}
onResize();

// Pause UI + logic
const pauseBtn = document.getElementById('pause-btn');
const pauseMenu = document.getElementById('pause-menu');
const resumeBtn = document.getElementById('resume-btn');
const quitBtn = document.getElementById('quit-btn');
// out-of-bounds HUD element
const oobEl = document.getElementById('oob');
// settings elements
const settingsBtn = document.getElementById('settings-btn');
const settingsPanel = document.getElementById('settings-panel');
const settingsBack = document.getElementById('settings-back'); // original back (world pane)
const settingsBackGeneral = document.getElementById('settings-back-general'); // Back in General settings tab
const settingsBackEnv = document.getElementById('settings-back-env'); // Back in Environment -> Objects subtab
const settingsBackControls = document.getElementById('settings-back-controls'); // Back in Controls tab
const mouseSensEl = document.getElementById('mouse-sens');
const touchSensEl = document.getElementById('touch-sens');
const mouseSensVal = document.getElementById('mouse-sens-val');
const touchSensVal = document.getElementById('touch-sens-val');
const invertYEl = document.getElementById('invert-y');
const showAssetHighlightEl = document.getElementById('show-asset-highlight'); // new general setting checkbox
 // asset highlight element
 const assetHighlightEl = document.getElementById('asset-highlight');
 const assetNameEl = document.getElementById('asset-name');
 const assetInfoEl = document.getElementById('asset-info');

 // Ensure inactive UI windows are actually non-interactive / hidden.
 // Any element under #ui that sets aria-hidden="true" will be hidden and made inert.
 (function enforceInactiveHidden() {
   const uiRoot = document.getElementById('ui');
   if (!uiRoot) return;

   const hideWhenInactive = (el) => {
     if (!el || !el.getAttribute) return;
     const isHidden = el.getAttribute('aria-hidden') === 'true';
     if (isHidden) {
       el.style.display = 'none';
       el.style.pointerEvents = 'none';
       el.style.visibility = 'hidden';
       // lower z-index so it's not accidentally above the canvas
       el.style.zIndex = '0';
     } else {
       // restore to default visual/interactive state
       el.style.display = '';
       el.style.pointerEvents = '';
       el.style.visibility = '';
       el.style.zIndex = '';
     }
   };

   // Apply to a set of known panels immediately
   ['pause-menu', 'settings-panel', 'reset-confirm', 'achievement', 'asset-highlight'].forEach(id => {
     const el = document.getElementById(id);
     if (el) hideWhenInactive(el);
   });

   // Observe attribute changes (aria-hidden) in the UI subtree and enforce hiding when true.
   const mo = new MutationObserver((records) => {
     for (const r of records) {
       if (r.type === 'attributes' && r.attributeName === 'aria-hidden') {
         hideWhenInactive(r.target);
       }
     }
   });
   mo.observe(uiRoot, { subtree: true, attributes: true, attributeFilter: ['aria-hidden'] });
 })();

// initialize settings UI values
if (mouseSensEl) { mouseSensEl.value = state.mouseSensitivity; mouseSensVal.textContent = parseFloat(state.mouseSensitivity).toFixed(1); }
if (touchSensEl) { touchSensEl.value = state.touchSensitivity; touchSensVal.textContent = parseFloat(state.touchSensitivity).toFixed(1); }
if (invertYEl) invertYEl.checked = state.invertY;
if (showAssetHighlightEl) showAssetHighlightEl.checked = !!state.showAssetOnHighlight;

// settings helpers
function openSettings() {
  if (pauseMenu) {
    // hide main pause panel, show settings panel
    const main = document.getElementById('pause-main');
    if (main) main.style.display = 'none';
    if (settingsPanel) settingsPanel.setAttribute('aria-hidden', 'false');
  }
}
function closeSettings() {
  const main = document.getElementById('pause-main');
  if (main) main.style.display = '';
  if (settingsPanel) settingsPanel.setAttribute('aria-hidden', 'true');
}
function applySettings() {
  const m = parseFloat(mouseSensEl.value || state.mouseSensitivity);
  const t = parseFloat(touchSensEl.value || state.touchSensitivity);
  state.mouseSensitivity = m;
  state.touchSensitivity = t;
  state.invertY = !!invertYEl.checked;
  // new option: show asset highlight
  if (showAssetHighlightEl) state.showAssetOnHighlight = !!showAssetHighlightEl.checked;
  mouseSensVal.textContent = m.toFixed(1);
  touchSensVal.textContent = t.toFixed(1);
  // update display immediately
  if (assetHighlightEl) assetHighlightEl.style.display = state.showAssetOnHighlight ? '' : 'none';
}

// wire settings UI
if (settingsBtn) settingsBtn.addEventListener('click', () => openSettings());
 // Wire all Back buttons to the same apply+close behavior
const bindBack = (el) => { if (!el) return; el.addEventListener('click', () => { applySettings(); closeSettings(); }); };
bindBack(settingsBack);
bindBack(settingsBackGeneral);
bindBack(settingsBackEnv);
bindBack(settingsBackControls);

// live update when sliders change
if (mouseSensEl) mouseSensEl.addEventListener('input', () => { mouseSensVal.textContent = parseFloat(mouseSensEl.value).toFixed(1); });
if (touchSensEl) touchSensEl.addEventListener('input', () => { touchSensVal.textContent = parseFloat(touchSensEl.value).toFixed(1); });
if (mouseSensEl) mouseSensEl.addEventListener('change', applySettings);
if (touchSensEl) touchSensEl.addEventListener('change', applySettings);
if (invertYEl) invertYEl.addEventListener('change', applySettings);

// ---- Environment / Objects tab UI population & behavior ----
(function setupEnvironmentTab() {
  const tabButtons = document.querySelectorAll('.tab-btn');
  const subtabButtons = document.querySelectorAll('.subtab-btn');
  const tabGeneral = document.getElementById('settings-tab-general');
  const tabEnv = document.getElementById('settings-tab-env');
  const tabControls = document.getElementById('settings-tab-controls');
  const objectsControls = document.getElementById('objects-controls');
  const worldControls = document.getElementById('settings-tab-world');
  const bgColorEl = document.getElementById('bg-color');
  const bgGradientPresets = document.getElementById('bg-gradient-presets');
  const bgGradientCss = document.getElementById('bg-gradient-css');
  const applyGradientBtn = document.getElementById('apply-gradient');
  const bgImageUrl = document.getElementById('bg-image-url');
  const applyBgUrlBtn = document.getElementById('apply-bg-url');
  const bgImageFile = document.getElementById('bg-image-file');
  const bgResetBtn = document.getElementById('bg-reset');
  const controlsListEl = document.getElementById('controls-list');
  const controlsResetBtn = document.getElementById('controls-reset');

  // Controls binding state and defaults
  state.controls = state.controls || {
    forward: 'w',
    back: 's',
    left: 'a',
    right: 'd',
    jump: ' ',
    sprint: 'Shift',
    crouch: 'Control',
    pickup: 'e'
  };
  const defaultControls = Object.assign({}, state.controls);
  let awaitingRebind = null; // { action, el } while waiting for key

  function renderControlsList() {
    if (!controlsListEl) return;
    controlsListEl.innerHTML = '';
    const actions = Object.keys(state.controls);
    for (const act of actions) {
      const row = document.createElement('div');
      row.style.display = 'flex';
      row.style.justifyContent = 'space-between';
      row.style.alignItems = 'center';
      row.style.padding = '8px';
      row.style.borderRadius = '6px';
      row.style.marginBottom = '6px';
      row.style.background = 'rgba(255,255,255,0.02)';
      const label = document.createElement('div');
      label.textContent = act.charAt(0).toUpperCase() + act.slice(1).replace(/([A-Z])/g, ' $1');
      label.style.color = 'var(--ui)';
      label.style.fontWeight = '600';
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = String(state.controls[act] || '—');
      btn.style.pointerEvents = 'auto';
      btn.style.padding = '8px';
      btn.style.borderRadius = '6px';
      btn.style.border = '0';
      btn.style.background = 'rgba(255,255,255,0.06)';
      btn.dataset.action = act;
      btn.addEventListener('click', (e) => {
        // begin rebind
        if (awaitingRebind) {
          // cancel any previous
          awaitingRebind.el.textContent = String(state.controls[awaitingRebind.action] || '—');
          awaitingRebind = null;
        }
        awaitingRebind = { action: act, el: btn };
        btn.textContent = 'Press a key... (Esc to cancel)';
      });
      row.appendChild(label);
      row.appendChild(btn);
      controlsListEl.appendChild(row);
    }
  }

  // handle key capture for rebinding
  function onKeyForBind(e) {
    if (!awaitingRebind) return;
    e.preventDefault();
    const action = awaitingRebind.action;
    // Escape cancels
    if (e.key === 'Escape') {
      awaitingRebind.el.textContent = String(state.controls[action] || '—');
      awaitingRebind = null;
      return;
    }
    // assign the key (use e.key for readability; normalize Space to ' ')
    const key = e.key;
    state.controls[action] = key;
    awaitingRebind.el.textContent = key;
    awaitingRebind = null;
  }

  // expose a helper to read binding (used elsewhere if needed)
  window.getBinding = (action) => state.controls && state.controls[action];

  function showTab(name) {
    // ensure achievements panel visibility is controlled explicitly on every tab switch
    try {
      if (typeof achievementsPanel !== 'undefined' && achievementsPanel) {
        if (name === 'achievements') achievementsPanel.style.display = '';
        else achievementsPanel.style.display = 'none';
      }
    } catch (e) {}

    if (name === 'general') {
      tabGeneral.style.display = '';
      tabEnv.style.display = 'none';
      if (tabControls) tabControls.style.display = 'none';
      tabButtons.forEach(b => b.classList.toggle('active', b.dataset.tab === 'general'));

      // When opening General, ensure any Environment subtab (e.g. World) is closed
      try { showSubtab(''); } catch (e) {}
    } else if (name === 'env') {
      tabGeneral.style.display = 'none';
      tabEnv.style.display = '';
      if (tabControls) tabControls.style.display = 'none';
      tabButtons.forEach(b => b.classList.toggle('active', b.dataset.tab === 'env'));
      // When opening Environment, default to the Objects subtab for immediate editing
      try { showSubtab('objects'); } catch (e) {}
    } else if (name === 'controls') {
      tabGeneral.style.display = 'none';
      tabEnv.style.display = 'none';
      if (tabControls) tabControls.style.display = '';
      tabButtons.forEach(b => b.classList.toggle('active', b.dataset.tab === 'controls'));
      try { showSubtab(''); } catch (e) {}
      renderControlsList();
    } else if (name === 'extras') {
      // show Extras panel and hide other tabs
      tabGeneral.style.display = 'none';
      tabEnv.style.display = 'none';
      if (tabControls) tabControls.style.display = 'none';
      tabButtons.forEach(b => b.classList.toggle('active', b.dataset.tab === 'extras'));
      try { showSubtab(''); } catch (e) {}
      // ensure extras panel exists and is up-to-date
      try {
        ensureExtrasPanel();
        if (extrasPanel) extrasPanel.style.display = '';
        populateExtras();
      } catch (e) {}
    } else if (name === 'achievements') {
      // show achievements panel and hide other tabs
      tabGeneral.style.display = 'none';
      tabEnv.style.display = 'none';
      if (tabControls) tabControls.style.display = 'none';
      tabButtons.forEach(b => b.classList.toggle('active', b.dataset.tab === 'achievements'));
      try { showSubtab(''); } catch (e) {}

      // ensure achievements panel (created later) is visible and up-to-date
      try {
        if (achievementsPanel) achievementsPanel.style.display = '';
        populateAchievements();
        try { if (typeof populateExtras === 'function') populateExtras(); } catch(e) {}
      } catch (e) {}
    } else {
      tabGeneral.style.display = 'none';
      tabEnv.style.display = 'none';
      if (tabControls) tabControls.style.display = 'none';
      tabButtons.forEach(b => b.classList.toggle('active', false));
      try { showSubtab(''); } catch (e) {}
    }
  }
  function applySolidColor(hex) {
    // set scene background to a THREE.Color and clear renderer DOM gradient/image CSS
    try { scene.background = new THREE.Color(hex); } catch (e) { scene.background = null; }
    renderer.domElement.style.background = '';
  }

  function applyCssGradient(css) {
    // CSS gradients can't be used as scene.background; use renderer DOM element background and set scene background null.
    scene.background = null;
    renderer.domElement.style.background = css;
  }

  async function applyImageFromUrl(url) {
    if (!url) return;
    // prefer to set scene.background as a texture so WebGL renders it behind scene; fallback to DOM background if loading fails.
    const loader = new THREE.TextureLoader();
    return new Promise((resolve) => {
      loader.load(url, (tex) => {
        tex.encoding = THREE.sRGBEncoding;
        scene.background = tex;
        renderer.domElement.style.background = '';
        resolve(true);
      }, undefined, () => {
        // on error, fallback to CSS background
        renderer.domElement.style.background = `url(${url}) center / cover no-repeat`;
        scene.background = null;
        resolve(false);
      });
    });
  }

  function applyImageFromFile(file) {
    if (!file) return;
    const url = URL.createObjectURL(file);
    // load as texture
    const loader = new THREE.TextureLoader();
    loader.load(url, (tex) => {
      tex.encoding = THREE.sRGBEncoding;
      scene.background = tex;
      renderer.domElement.style.background = '';
      URL.revokeObjectURL(url);
    }, undefined, () => {
      // fallback to css
      renderer.domElement.style.background = `url(${url}) center / cover no-repeat`;
      scene.background = null;
    });
  }

  function showSubtab(name) {
    subtabButtons.forEach(b => b.classList.toggle('active', b.dataset.sub === name));
    // Show/hide objects and world panes
    if (name === 'objects') {
      objectsControls.style.display = '';
      if (worldControls) worldControls.style.display = 'none';
    } else if (name === 'world') {
      objectsControls.style.display = 'none';
      if (worldControls) worldControls.style.display = '';
      // initialize controls to current state
      try {
        if (scene.background && scene.background.isColor) {
          bgColorEl.value = '#' + scene.background.getHexString();
        } else {
          // if CSS gradient is present on renderer, reflect it (not parsed into color)
          const cssBg = (renderer.domElement && renderer.domElement.style && renderer.domElement.style.background) || '';
          bgGradientCss.value = cssBg || '';
        }
      } catch (e) {}
    } else {
      objectsControls.style.display = 'none';
      if (worldControls) worldControls.style.display = 'none';
    }

    // Show the Objects-specific Back button only when the objects subtab is active
    try {
      const objsBack = document.getElementById('settings-back-env');
      if (objsBack) objsBack.style.display = (name === 'objects') ? '' : 'none';
    } catch (e) {}
  }

  tabButtons.forEach(b => {
    b.addEventListener('click', () => showTab(b.dataset.tab));
  });
  subtabButtons.forEach(b => {
    b.addEventListener('click', () => showSubtab(b.dataset.sub));
  });

  // global key listener for binding mode
  window.addEventListener('keydown', onKeyForBind, true);

  // Raycaster for asset highlight detection
  const highlightRay = new THREE.Raycaster();
  highlightRay.far = 20; // reasonable distance for hover detection

  // reset to defaults
  if (controlsResetBtn) {
    controlsResetBtn.addEventListener('click', () => {
      state.controls = Object.assign({}, defaultControls);
      renderControlsList();
    });
  }

  // Utility: replace geometry for a box safely
  function updateBoxGeometry(idx, w, h) {
    const b = interactiveBoxes[idx];
    if (!b) return;
    const oldGeom = b.geometry;
    const depth = (oldGeom.parameters && oldGeom.parameters.depth) ? oldGeom.parameters.depth : (Math.max(w, h) * 0.8 || 1);
    const newGeom = new THREE.BoxGeometry(w, h, depth);
    b.geometry = newGeom;
    // adjust vertical position so bottom stays on same ground level if original bottom was on ground.
    // compute half-heights and set position.y to half-height (or preserve previous center offset)
    // We'll preserve center but if box was resting on ground (y == halfHeight before), keep it so.
    const prevHalfH = (oldGeom.parameters && oldGeom.parameters.height) ? oldGeom.parameters.height * 0.5 : 0.5;
    const wasOnGround = Math.abs(b.position.y - prevHalfH) < 0.001 || b.position.y >= prevHalfH - 0.01;
    if (wasOnGround) {
      b.position.y = h * 0.5;
    } else {
      // keep same midpoint height
      // nothing to change
    }
    // update saved initial snapshot too so resets keep modified dimensions
    if (interactiveBoxesInitial[idx]) {
      interactiveBoxesInitial[idx].pos = b.position.clone();
      interactiveBoxesInitial[idx].quat = b.quaternion.clone();
      interactiveBoxesInitial[idx].rot = b.rotation.clone();
      interactiveBoxesInitial[idx].dynamic = !!b.userData.dynamic;
      interactiveBoxesInitial[idx].velocity = b.userData.velocity ? b.userData.velocity.clone() : new THREE.Vector3();
      // store geometry dims for future reference (not used elsewhere but helpful)
      interactiveBoxesInitial[idx].geom = { width: w, height: h, depth };
    }
    // dispose old geometry to free memory
    try { oldGeom.dispose(); } catch (e) {}
  }

  // Build the objects controls list (one detailed row per box)
  function populateObjectsControls() {
    if (!objectsControls) return;
    objectsControls.innerHTML = '';
    // container style: vertical list; each item collapsible-like but kept compact for mobile
    for (let i = 0; i < interactiveBoxes.length; i++) {
      const b = interactiveBoxes[i];
      const geom = b.geometry && b.geometry.parameters ? b.geometry.parameters : { width: 1, height: 1, depth: 1 };
      const w = parseFloat(geom.width || 1).toFixed(2);
      const h = parseFloat(geom.height || 1).toFixed(2);
      const d = parseFloat(geom.depth || 1).toFixed(2);
      const pos = b.position;
      const px = pos.x.toFixed(2), py = pos.y.toFixed(2), pz = pos.z.toFixed(2);

      const item = document.createElement('div');
      item.style.display = 'flex';
      item.style.flexDirection = 'column';
      item.style.gap = '6px';
      item.style.padding = '8px';
      item.style.marginBottom = '8px';
      item.style.borderRadius = '8px';
      item.style.background = 'rgba(0,0,0,0.06)';
      item.innerHTML = `
        <div style="display:flex; align-items:center; justify-content:space-between; gap:8px;">
          <div style="font-weight:700; color:var(--ui);">#${i+1}</div>
          <div style="display:flex; gap:8px; align-items:center;">
            <button class="focus-btn" data-idx="${i}" type="button" style="pointer-events:auto; padding:6px 8px; border-radius:6px; border:0; background:rgba(255,255,255,0.06); color:var(--ui);">Focus</button>
            <button class="reset-btn" data-idx="${i}" type="button" style="pointer-events:auto; padding:6px 8px; border-radius:6px; border:0; background:rgba(255,255,255,0.04); color:var(--ui);">Reset</button>
          </div>
        </div>
        <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
          <label style="font-size:12px; color:var(--ui);">W <input data-idx="${i}" data-dim="w" class="obj-dim" type="number" step="0.1" min="0.2" value="${w}" style="width:84px; margin-left:6px;"/></label>
          <label style="font-size:12px; color:var(--ui);">H <input data-idx="${i}" data-dim="h" class="obj-dim" type="number" step="0.1" min="0.2" value="${h}" style="width:84px; margin-left:6px;"/></label>
          <label style="font-size:12px; color:var(--ui);">D <input data-idx="${i}" data-dim="d" class="obj-dim" type="number" step="0.1" min="0.2" value="${d}" style="width:84px; margin-left:6px;"/></label>
        </div>
        <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
          <label style="font-size:12px; color:var(--ui);">X <input data-idx="${i}" data-dim="px" class="obj-pos" type="number" step="0.1" value="${px}" style="width:84px; margin-left:6px;"/></label>
          <label style="font-size:12px; color:var(--ui);">Y <input data-idx="${i}" data-dim="py" class="obj-pos" type="number" step="0.1" value="${py}" style="width:84px; margin-left:6px;"/></label>
          <label style="font-size:12px; color:var(--ui);">Z <input data-idx="${i}" data-dim="pz" class="obj-pos" type="number" step="0.1" value="${pz}" style="width:84px; margin-left:6px;"/></label>
        </div>
      `;
      objectsControls.appendChild(item);
    }

    // wire listeners for geometry inputs (w,h,d)
    const geomInputs = objectsControls.querySelectorAll('.obj-dim');
    geomInputs.forEach(inp => {
      inp.addEventListener('change', (ev) => {
        const idx = parseInt(ev.target.dataset.idx, 10);
        // read trio values
        const getVal = (k) => parseFloat(objectsControls.querySelector(`input[data-idx="${idx}"][data-dim="${k}"]`).value) || 0.2;
        const newW = Math.max(0.2, getVal('w'));
        const newH = Math.max(0.2, getVal('h'));
        const newD = Math.max(0.2, getVal('d'));
        // Replace geometry with new dims (updateBoxGeometry handles height/width and preserves depth heuristic;
        // here we provide explicit depth by constructing a new BoxGeometry and applying similar adjustments)
        const b = interactiveBoxes[idx];
        if (!b) return;
        const oldGeom = b.geometry;
        const newGeom = new THREE.BoxGeometry(newW, newH, newD);
        b.geometry = newGeom;
        // adjust vertical position if it was resting on ground
        const prevHalfH = (oldGeom.parameters && oldGeom.parameters.height) ? oldGeom.parameters.height * 0.5 : 0.5;
        const wasOnGround = Math.abs(b.position.y - prevHalfH) < 0.001 || b.position.y >= prevHalfH - 0.01;
        if (wasOnGround) b.position.y = newH * 0.5;
        // update initial snapshot so reset uses new values
        if (interactiveBoxesInitial[idx]) {
          interactiveBoxesInitial[idx].pos = b.position.clone();
          interactiveBoxesInitial[idx].quat = b.quaternion.clone();
          interactiveBoxesInitial[idx].rot = b.rotation.clone();
          interactiveBoxesInitial[idx].dynamic = !!b.userData.dynamic;
          interactiveBoxesInitial[idx].velocity = b.userData.velocity ? b.userData.velocity.clone() : new THREE.Vector3();
          interactiveBoxesInitial[idx].geom = { width: newW, height: newH, depth: newD };
        }
        try { oldGeom.dispose(); } catch (e) {}
      });
    });

    // wire listeners for position inputs (px,py,pz)
    const posInputs = objectsControls.querySelectorAll('.obj-pos');
    posInputs.forEach(inp => {
      inp.addEventListener('change', (ev) => {
        const idx = parseInt(ev.target.dataset.idx, 10);
        const getVal = (k) => parseFloat(objectsControls.querySelector(`input[data-idx="${idx}"][data-dim="${k}"]`).value) || 0;
        const nx = getVal('px'), ny = getVal('py'), nz = getVal('pz');
        const b = interactiveBoxes[idx];
        if (!b) return;
        b.position.set(nx, ny, nz);
        // update snapshot too
        if (interactiveBoxesInitial[idx]) interactiveBoxesInitial[idx].pos = b.position.clone();
      });
    });

    // wire focus and reset buttons
    const focusBtns = objectsControls.querySelectorAll('.focus-btn');
    focusBtns.forEach(btn => {
      btn.addEventListener('click', (ev) => {
        const idx = parseInt(ev.target.dataset.idx, 10);
        const b = interactiveBoxes[idx];
        if (!b) return;
        // move the camera rig near the object for quick inspection
        const target = b.position.clone();
        // place the player a few meters back along camera forward so object is in view
        yaw.position.x = target.x - 3;
        yaw.position.z = target.z;
        // position the rig vertically at eye height above the object's top
        const halfH = (b.geometry.parameters.height || 1) * 0.5;
        yaw.position.y = target.y + halfH + state.height;
        // ensure we update previous Y for collision checks
        prevYawY = yaw.position.y;
        // open settings remain open so user can continue editing
      });
    });

    const resetBtns = objectsControls.querySelectorAll('.reset-btn');
    resetBtns.forEach(btn => {
      btn.addEventListener('click', (ev) => {
        const idx = parseInt(ev.target.dataset.idx, 10);
        const snap = interactiveBoxesInitial[idx];
        const b = interactiveBoxes[idx];
        if (!b || !snap) return;
        b.position.copy(snap.pos);
        b.quaternion.copy(snap.quat);
        b.rotation.copy(snap.rot);
        b.userData.dynamic = !!snap.dynamic;
        if (!b.userData.velocity) b.userData.velocity = new THREE.Vector3();
        b.userData.velocity.copy(snap.velocity);
        // also update the inputs to reflect restored state
        const qW = (b.geometry.parameters && b.geometry.parameters.width) ? b.geometry.parameters.width.toFixed(2) : '1.00';
        const qH = (b.geometry.parameters && b.geometry.parameters.height) ? b.geometry.parameters.height.toFixed(2) : '1.00';
        const qD = (b.geometry.parameters && b.geometry.parameters.depth) ? b.geometry.parameters.depth.toFixed(2) : '1.00';
        const inputsW = objectsControls.querySelector(`input[data-idx="${idx}"][data-dim="w"]`);
        const inputsH = objectsControls.querySelector(`input[data-idx="${idx}"][data-dim="h"]`);
        const inputsD = objectsControls.querySelector(`input[data-idx="${idx}"][data-dim="d"]`);
        if (inputsW) inputsW.value = qW;
        if (inputsH) inputsH.value = qH;
        if (inputsD) inputsD.value = qD;
        const ipx = objectsControls.querySelector(`input[data-idx="${idx}"][data-dim="px"]`);
        const ipy = objectsControls.querySelector(`input[data-idx="${idx}"][data-dim="py"]`);
        const ipz = objectsControls.querySelector(`input[data-idx="${idx}"][data-dim="pz"]`);
        if (ipx) ipx.value = b.position.x.toFixed(2);
        if (ipy) ipy.value = b.position.y.toFixed(2);
        if (ipz) ipz.value = b.position.z.toFixed(2);
      });
    });
  }

  // Wire world background controls (if present)
  // Gradients and URL loads still require explicit "Apply" clicks.
  // helper: convert a simple CSS linear-gradient(...) string into a Three.js CanvasTexture
  function cssGradientToCanvasTexture(css) {
    // extract numeric angle (deg) and hex color stops (basic support)
    const angleMatch = css.match(/(-?\d+)(deg)/);
    const angleDeg = angleMatch ? parseInt(angleMatch[1], 10) % 360 : 180; // default vertical
    const colorMatches = Array.from(css.matchAll(/#([0-9a-fA-F]{3,6})/g)).map(m => m[0]);
    // fallback to two-tone if parsing fails
    const colors = colorMatches.length ? colorMatches : ['#0d0f12', '#071018'];

    // canvas size (wide to preserve gradient look on sky)
    const w = 1024, h = 256;
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');

    // map angle to gradient coordinates
    const rad = (angleDeg * Math.PI) / 180;
    const cx = Math.cos(rad), cy = Math.sin(rad);
    // gradient from center in direction specified
    const x0 = w * 0.5 - cx * w * 0.5;
    const y0 = h * 0.5 - cy * h * 0.5;
    const x1 = w * 0.5 + cx * w * 0.5;
    const y1 = h * 0.5 + cy * h * 0.5;

    const grad = ctx.createLinearGradient(x0, y0, x1, y1);
    // distribute color stops evenly
    const step = 1 / Math.max(1, colors.length - 1);
    for (let i = 0; i < colors.length; i++) {
      grad.addColorStop(i * step, colors[i]);
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    const tex = new THREE.CanvasTexture(canvas);
    tex.encoding = THREE.sRGBEncoding;
    tex.needsUpdate = true;
    // set wrap so it tiles nicely if needed
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    return tex;
  }

  if (applyGradientBtn) {
    applyGradientBtn.addEventListener('click', () => {
      const css = (bgGradientCss && bgGradientCss.value) || (bgGradientPresets && bgGradientPresets.value) || '';
      if (!css) return;
      // If it's a CSS gradient string (contains "gradient"), convert to a canvas texture for the scene background.
      if (css.toLowerCase().includes('gradient')) {
        try {
          const tex = cssGradientToCanvasTexture(css);
          scene.background = tex;
          // clear any DOM background so in-game sky is used
          renderer.domElement.style.background = '';
        } catch (e) {
          // fallback to DOM CSS if canvas conversion fails
          applyCssGradient(css);
        }
      } else {
        // not a gradient: treat as CSS (fallback) or color; use applyCssGradient which sets DOM background
        applyCssGradient(css);
      }
    });
  }

  // Color chooser: apply only on change/commit (not while sliding)
  if (bgColorEl) {
    bgColorEl.addEventListener('change', (e) => {
      applySolidColor(e.target.value);
    });
  }

  if (applyBgUrlBtn) {
    applyBgUrlBtn.addEventListener('click', async () => {
      const url = bgImageUrl.value.trim();
      if (!url) return;
      await applyImageFromUrl(url);
    });
  }

  // File chooser: auto-apply selected image file to the scene background immediately.
  let pendingBgFile = null;
  if (bgImageFile) {
    bgImageFile.addEventListener('change', (e) => {
      pendingBgFile = e.target.files && e.target.files[0] ? e.target.files[0] : null;
      if (!pendingBgFile) return;
      // Apply the selected file as a texture for the in-game sky (preferred) and fall back to DOM background on error.
      applyImageFromFile(pendingBgFile);
      // clear file input so the same file can be chosen again later if desired
      try { bgImageFile.value = ''; } catch (err) {}
      pendingBgFile = null;
    });
  }

  if (bgResetBtn) {
    bgResetBtn.addEventListener('click', () => {
      // restore default: scene color as original dark color and clear dom background
      scene.background = new THREE.Color(0x071018);
      renderer.domElement.style.background = '';
      if (bgColorEl) bgColorEl.value = '#071018';
      if (bgGradientCss) bgGradientCss.value = '';
      if (bgGradientPresets) bgGradientPresets.value = '';
      if (bgImageUrl) bgImageUrl.value = '';
      if (bgImageFile) {
        bgImageFile.value = '';
        pendingBgFile = null;
      }
    });
  }

  // Achievements: initialize list of possible unlocks (titles/descriptions).
  // Create per-achievement boolean variables (state.achVars) that mirror the unlocked state.
  if (!state.achievements) {
    state.achievements = [
      { id: 'read-warning', title: 'Achievement Unlocked', subtitle: 'I can read!', desc: 'Accepted the warning dialog', unlocked: false },
      { id: 'first-pickup', title: 'Collector', subtitle: 'Pick up an object', desc: 'Pick up your first object', unlocked: false },
      { id: 'throw-pro', title: 'Throw Master', subtitle: 'Send it flying', desc: 'Throw an object with charge', unlocked: false },
      { id: 'mesmerizing', title: 'Mesmerizing', subtitle: 'You unleashed chaos', desc: 'Triggered chaos mode for the first time', unlocked: false }
    ];
  }
  // Ensure the achievement boolean map exists and is synced to the achievements array at startup.
  state.achVars = state.achVars || {};
  for (const a of state.achievements) {
    if (a && a.id) {
      state.achVars[a.id] = !!a.unlocked;
      // also create a dedicated boolean variable for each achievement on the root state:
      // state["ach_<id>"] === true/false
      state[`ach_${a.id}`] = !!a.unlocked;
    }
  }

  // read session marker that indicates at least one achievement was unlocked previously this session
  try {
    const hadAny = !!sessionStorage.getItem('hadAnyUnlock');
    state._hadAnyUnlock = hadAny;
  } catch (e) {
    state._hadAnyUnlock = false;
  }

  // create an achievements panel element (will be shown by the tab logic)
  let achievementsPanel = document.getElementById('settings-tab-achievements');
  if (!achievementsPanel) {
    achievementsPanel = document.createElement('div');
    achievementsPanel.id = 'settings-tab-achievements';
    achievementsPanel.style.display = 'none';
    achievementsPanel.style.maxWidth = '360px';
    achievementsPanel.style.padding = '6px';
    achievementsPanel.style.maxHeight = '260px';
    achievementsPanel.style.overflow = 'auto';
    achievementsPanel.style.borderRadius = '8px';
    achievementsPanel.style.background = 'linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01))';
    // container header
    const header = document.createElement('div');
    header.style.fontWeight = '700';
    header.style.color = 'var(--ui)';
    header.style.marginBottom = '8px';
    header.textContent = 'Achievements';
    achievementsPanel.appendChild(header);
    // list container
    const list = document.createElement('div');
    list.id = 'ach-list';
    list.style.display = 'flex';
    list.style.flexDirection = 'column';
    list.style.gap = '8px';
    achievementsPanel.appendChild(list);

    // Reset progress row: glowing red button
    const resetRow = document.createElement('div');
    resetRow.className = 'reset-progress-row';
    const resetBtn = document.createElement('button');
    resetBtn.className = 'reset-progress-btn';
    resetBtn.type = 'button';
    resetBtn.textContent = 'RESET PROGRESS';
    resetRow.appendChild(resetBtn);
    achievementsPanel.appendChild(resetRow);

    // Confirmation panel moved into a dedicated settings-only "reset" pane (hidden by default).
    // This pane is not reachable via the normal settings tabs and is only shown when the
    // RESET PROGRESS button is pressed.
    const resetConfirm = document.createElement('div');
    resetConfirm.id = 'reset-confirm';
    resetConfirm.setAttribute('aria-hidden', 'true');
    resetConfirm.style.display = 'none';
    // ensure the pane is inert by default when not in use
    resetConfirm.style.pointerEvents = 'none';
    resetConfirm.style.marginTop = '8px';
    resetConfirm.innerHTML = `
      <div class="confirm-panel pause-panel">
        <div class="confirm-title">ARE YOU SURE?</div>

        <!-- Subtext follows the requested wording (corrected spelling) -->
        <div class="confirm-sub">Any achivement you have unlocked will be reset to the first state you booted the game in, are you sure you want to reset your progress?</div>

        <!-- Keep the typed-confirmation guard from v96: require typing RESET to enable the Yes button -->
        <div style="margin-top:8px; text-align:left; font-size:13px; color:rgba(255,255,255,0.9);">
          To confirm, type <strong>RESET</strong> below:
        </div>
        <div style="margin-top:8px;">
          <input class="confirm-input" type="text" placeholder="Type RESET to enable" aria-label="Confirm reset" />
        </div>

        <!-- Buttons: Yes / No (Yes starts disabled until typed confirmation) -->
        <div class="confirm-actions" style="margin-top:10px;">
          <button type="button" class="confirm-yes" disabled>Yes</button>
          <button type="button" class="confirm-no">No</button>
        </div>

        <!-- Back to Achievements link (only visible inside settings when this pane is shown) -->
        <div style="margin-top:10px; text-align:center;">
          <button type="button" class="confirm-back" style="pointer-events:auto; padding:8px 12px; border-radius:8px; border:0; background:rgba(255,255,255,0.06); color:var(--ui);">Back</button>
        </div>
      </div>
    `;
    // append the reset pane inside the settings panel (so it appears like a settings-only tab)
    try { settingsPanel.appendChild(resetConfirm); } catch (e) {}
    // insert achievements panel into settings panel
    try { settingsPanel.appendChild(achievementsPanel); } catch (e) {}

    // Ensure the RESET PROGRESS button works even when Settings is closed:
    try {
      const globalResetBtn = achievementsPanel.querySelector('.reset-progress-btn');
      const resetConfirmEl = document.getElementById('reset-confirm') || achievementsPanel.querySelector('#reset-confirm');
      const achListEl = achievementsPanel.querySelector('#ach-list');
      function showResetPaneFromAnywhere() {
        // open the settings panel UI (use window.openSettings if the app overrode it, fallback to openSettings)
        try {
          if (typeof window.openSettings === 'function') window.openSettings();
          else openSettings();
        } catch (e) { try { openSettings(); } catch (ee) {} }

        // hide the normal achievements list and show the dedicated reset confirmation pane
        try {
          if (achListEl) achListEl.style.display = 'none';
          if (resetConfirmEl) {
            resetConfirmEl.setAttribute('aria-hidden', 'false');
            resetConfirmEl.style.display = '';
            // make interactive
            resetConfirmEl.style.pointerEvents = 'auto';
            // clear and disable yes until typed
            const input = resetConfirmEl.querySelector('.confirm-input');
            const yes = resetConfirmEl.querySelector('.confirm-yes');
            if (input) input.value = '';
            if (yes) yes.disabled = true;
            // focus input for convenience if allowed
            try { if (input) input.focus(); } catch (e) {}
          }
          if (settingsPanel) settingsPanel.setAttribute('aria-hidden', 'false');
        } catch (e) {}
      }
      if (globalResetBtn) {
        globalResetBtn.addEventListener('click', (ev) => {
          ev.preventDefault();
          showResetPaneFromAnywhere();
        });
      }

      // If user navigates away from Achievements via the settings tabs, ensure the reset pane is hidden
      // and the achievements list restored to prevent it being reachable through normal tab navigation.
      const tabButtons = document.querySelectorAll('.tab-btn');
      tabButtons.forEach(tb => {
        tb.addEventListener('click', () => {
          try {
            if (resetConfirmEl) {
              resetConfirmEl.setAttribute('aria-hidden', 'true');
              resetConfirmEl.style.display = 'none';
              // make inert when not in use
              resetConfirmEl.style.pointerEvents = 'none';
            }
            if (achListEl) achListEl.style.display = '';
          } catch (e) {}
        });
      });
    } catch (e) {}
  }

  // Extras panel removed — no DOM panel will be created for Extras
  let extrasPanel = null;
  function ensureExtrasPanel() { /* extras removed */ }

  // extras removed: no-op populateExtras and no pause-menu extras wiring
  function populateExtras() { /* extras removed */ }

  // populate achievements list UI
  function populateAchievements() {
    const list = document.getElementById('ach-list');
    if (!list) return;
    list.innerHTML = '';
    for (const a of state.achievements) {
      const item = document.createElement('div');
      item.style.display = 'flex';
      item.style.justifyContent = 'space-between';
      item.style.alignItems = 'center';
      item.style.padding = '10px';
      item.style.borderRadius = '8px';
      item.style.background = a.unlocked ? 'linear-gradient(90deg, rgba(77,182,172,0.06), rgba(77,182,172,0.03))' : 'rgba(255,255,255,0.02)';
      item.setAttribute('data-ach-id', a.id || '');
      const left = document.createElement('div');
      left.style.display = 'flex';
      left.style.flexDirection = 'column';
      left.style.gap = '2px';
      const title = document.createElement('div');
      title.textContent = a.title + (a.subtitle ? ` — ${a.subtitle}` : '');
      title.style.fontWeight = '700';
      title.style.color = a.unlocked ? 'var(--accent)' : 'var(--ui)';
      title.style.fontSize = '13px';
      const desc = document.createElement('div');
      desc.textContent = a.desc || '';
      desc.style.fontSize = '12px';
      desc.style.color = 'rgba(255,255,255,0.7)';
      left.appendChild(title);
      left.appendChild(desc);
      const right = document.createElement('div');
      right.className = 'ach-status';
      right.style.fontWeight = '800';
      right.style.fontSize = '12px';
      right.style.padding = '6px 8px';
      right.style.borderRadius = '8px';
      right.style.minWidth = '86px';
      right.style.textAlign = 'center';
      // initial visual state: if unlocked mark unlocked, otherwise show locked
      if (a.unlocked) {
        right.textContent = 'Unlocked';
        right.classList.add('unlocked');
        right.style.background = 'rgba(77,182,172,0.14)';
        right.style.color = '#4df0d0';
      } else {
        right.textContent = 'Locked';
        right.classList.add('locked');
        right.style.background = 'rgba(255,255,255,0.02)';
        right.style.color = 'rgba(255,255,255,0.65)';
      }
      item.appendChild(left);
      item.appendChild(right);
      list.appendChild(item);
    }
  }

  // When settings panel opens, populate controls so they reflect current scene state
  const origOpenSettings = openSettings;
  window.openSettings = function() {
    origOpenSettings();
    // populate the objects list fresh
    populateObjectsControls();
    // ensure any environment subtab is closed when opening General by default
    showTab('general');
    showSubtab('');
    // ensure achievements UI is up-to-date
    populateAchievements();
    try { if (typeof populateExtras === 'function') populateExtras(); } catch (e) {}

    // Wire Reset Progress button and confirmation modal (created earlier)
    try {
      const resetBtn = achievementsPanel.querySelector('.reset-progress-btn');
      const resetConfirm = document.getElementById('reset-confirm');
      const yesBtn = resetConfirm ? resetConfirm.querySelector('.confirm-yes') : null;
      const noBtn = resetConfirm ? resetConfirm.querySelector('.confirm-no') : null;
      if (resetBtn && resetConfirm) {
        resetBtn.onclick = () => {
          // open the dedicated settings-only reset pane (hide achievements list so user only sees the reset content)
          const input = resetConfirm.querySelector('.confirm-input');
          if (input) input.value = '';
          const yes = resetConfirm.querySelector('.confirm-yes');
          if (yes) yes.disabled = true;
          // hide achievements list and show the reset pane visually inside settings
          const achList = achievementsPanel.querySelector('#ach-list');
          if (achList) achList.style.display = 'none';
          resetConfirm.setAttribute('aria-hidden', 'false');
          resetConfirm.style.display = '';
          // ensure settings panel is visible (openSettings already called when settings opened)
          if (settingsPanel) settingsPanel.setAttribute('aria-hidden', 'false');
        };
      }
      if (noBtn && resetConfirm) {
        noBtn.onclick = () => {
          // close reset pane and restore achievements list
          resetConfirm.setAttribute('aria-hidden', 'true');
          resetConfirm.style.display = 'none';
          const achList = achievementsPanel.querySelector('#ach-list');
          if (achList) achList.style.display = '';
        };
      }
      if (yesBtn && resetConfirm) {
        // protect action behind explicit typed confirmation: require exact "RESET"
        const input = resetConfirm.querySelector('.confirm-input');
        if (input) {
          input.addEventListener('input', (ev) => {
            const v = (ev.target.value || '').trim();
            // enable Yes only when the user typed RESET (case-insensitive)
            if (yesBtn) yesBtn.disabled = (v.toUpperCase() !== 'RESET');
          });
        }
        yesBtn.onclick = () => {
          // only proceed if enabled
          if (yesBtn.disabled) return;
          // Reset achievements to initial state (locked as when game booted)
          try {
            if (state.achievements && Array.isArray(state.achievements)) {
              for (const a of state.achievements) {
                // clear unlocked flags and any transient _wasLocked markers
                a.unlocked = false;
                if (a._wasLocked) delete a._wasLocked;
                // also update per-achievement boolean variable if present
                if (a.id && state.achVars) state.achVars[a.id] = false;
                // clear the dedicated root-level boolean for this achievement as well
                if (a.id) state[`ach_${a.id}`] = false;
              }
            }
            // Persist reset to sessionStorage so re-opening during session reflects cleared progress
            try { sessionStorage.setItem('achievementsResetAt', String(Date.now())); } catch (e) {}
          } catch (e) {}
          // refresh list UI and hide confirmation pane
          populateAchievements();
          resetConfirm.setAttribute('aria-hidden', 'true');
          resetConfirm.style.display = 'none';
          // clear and blur input for cleanliness
          if (input) { input.value = ''; input.blur(); }
          if (yesBtn) yesBtn.disabled = true;
          // restore achievements list view inside settings
          const achList = achievementsPanel.querySelector('#ach-list');
          if (achList) achList.style.display = '';
        };

        // also wire the Back button inside the pane to behave like No (close the pane)
        const backBtn = resetConfirm.querySelector('.confirm-back');
        if (backBtn) {
          backBtn.addEventListener('click', () => {
            resetConfirm.setAttribute('aria-hidden', 'true');
            resetConfirm.style.display = 'none';
            // make inert again
            resetConfirm.style.pointerEvents = 'none';
            const achList = achievementsPanel.querySelector('#ach-list');
            if (achList) achList.style.display = '';
          });
        }
      }
    } catch (e) {}
  };

  // initial population so controls are available if settings already opened
  populateObjectsControls();
  // ensure controls list ready too
  renderControlsList();

  // Wire preset buttons for quick binding sets (WASD or Arrow keys)
  try {
    const presetWASD = document.getElementById('preset-wasd');
    const presetArrows = document.getElementById('preset-arrows');
    if (presetWASD) {
      presetWASD.addEventListener('click', () => {
        state.controls = Object.assign({}, state.controls, {
          forward: 'w',
          back: 's',
          left: 'a',
          right: 'd'
        });
        renderControlsList();
      });
    }
    if (presetArrows) {
      presetArrows.addEventListener('click', () => {
        state.controls = Object.assign({}, state.controls, {
          forward: 'ArrowUp',
          back: 'ArrowDown',
          left: 'ArrowLeft',
          right: 'ArrowRight'
        });
        renderControlsList();
      });
    }
  } catch (e) {
    // ignore if DOM not available
  }
})();

// helper: check bindings mapped in state.controls and interpret current key state
function getBindingKey(action) {
  if (!state.controls) return '';
  const b = state.controls[action] || '';
  // normalize single-character printable keys to lowercase for the keys map
  if (b.length === 1) return b.toLowerCase();
  // normalize arrow names to lowercase (e.g. "ArrowUp")
  if (b.toLowerCase().startsWith('arrow')) return b.toLowerCase();
  return b;
}
function bindingPressed(action) {
  const k = getBindingKey(action);
  if (!k) return false;
  // common special handling
  if (k === ' ' || k === 'Space') {
    return !!keys[' '] || !!keys['space'] || !!keys['Space'];
  }
  if (k.toLowerCase() === 'shift' || k === 'Shift') return !!keys['shift'];
  if (k.toLowerCase() === 'control' || k === 'Control') return !!keys['ctrl'];
  // arrows and single letters are stored lowercased in keys map when possible
  return !!keys[k.toLowerCase()] || !!keys[k];
}

let paused = false;
function setPaused(v) {
  paused = !!v;
  if (pauseMenu) pauseMenu.setAttribute('aria-hidden', String(!paused));

  // When the Pause menu is shown, ensure the Extras panel is hidden so it's only visible
  // when explicitly opened via the Extras button.
  try {
    const extrasEl = document.getElementById('settings-tab-extras');
    if (paused && extrasEl) {
      extrasEl.style.display = 'none';
      // also ensure settings panel is not left open/in-focus while Pause is active
      if (settingsPanel) settingsPanel.setAttribute('aria-hidden', 'true');
      // ensure pause main content is visible when returning to Pause menu
      const main = document.getElementById('pause-main');
      if (main) main.style.display = '';
    }
  } catch (e) {}

  // show cursor when paused (desktop)
  if (paused) {
    try { document.exitPointerLock(); } catch {}
    canvas.style.cursor = 'auto';
  } else {
    // restore grab cursor if not pointer locked
    if (document.pointerLockElement !== canvas) canvas.style.cursor = 'grab';
  }
}
function togglePaused() { setPaused(!paused); }

if (pauseBtn) pauseBtn.addEventListener('click', () => togglePaused());
if (resumeBtn) resumeBtn.addEventListener('click', () => setPaused(false));
if (quitBtn) quitBtn.addEventListener('click', () => {
  // simple "quit" behavior: reload page to reset state
  location.reload();
});
// ESC key toggles pause (listen globally)
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    // ignore when typing in inputs (none present now) but keep safe guard
    const active = document.activeElement;
    if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable)) return;
    togglePaused();
    e.preventDefault();
  }
});

// --- Pickup / Throw helpers ---

function worldPositionOfCameraLocal(vecLocal) {
  // transform a vector from camera local space to the world group's space (world root contains the player)
  const v = vecLocal.clone();
  pitch.updateWorldMatrix(true, false);
  camera.updateWorldMatrix(true, false);
  camera.localToWorld(v);
  return v;
}

function findNearestPickupable() {
  const camWorldPos = new THREE.Vector3();
  camera.getWorldPosition(camWorldPos);
  let nearest = null;
  let nearestDist = Infinity;
  for (const b of interactiveBoxes) {
    // ignore currently held
    if (state.held === b) continue;
    const d = camWorldPos.distanceTo(b.getWorldPosition(new THREE.Vector3()));
    if (d < nearestDist && d <= state.reach) {
      nearestDist = d;
      nearest = b;
    }
  }
  return nearest;
}

function handlePickupToggle() {
  if (state.held) {
    // Drop the held object more like a gentle backwards toss:
    // - use the player's backward direction (opposite of forward)
    // - apply a smaller horizontal speed so it's not a full throw
    // - add a modest upward lift so it settles naturally
    const playerFwd = camera.getPlayerDirection().clone().normalize(); // horizontal forward
    const backward = playerFwd.clone().multiplyScalar(-1); // opposite direction to the player
    const horizSpeed = 0.8; // slower than the throw/drop used previously
    const upwardBoost = 0.6; // gentle upward lift (less than throw's arc)
    const v = backward.multiplyScalar(horizSpeed);
    v.y = upwardBoost;
    dropObject(state.held, v);
    state.held = null;
  } else {
    const target = findNearestPickupable();
    if (target) {
      pickUpObject(target);
    }
  }
}

function pickUpObject(mesh) {
  // Reset physics and mark as held.
  mesh.userData.dynamic = false;
  mesh.userData.velocity.set(0, 0, 0);

  // store the player's current forward direction (use camera forward in world space)
  const forward = camera.getPlayerDirection().clone();
  state.pickupForward = forward;

  // Ensure it's in the world root so we can position it by world coords each frame
  world.add(mesh);

  // Orient the mesh so it faces away from the player: compute a world-space quaternion that
  // aligns the object's forward to the stored pickup forward vector while keeping Y-up.
  // We fetch the mesh world position, build a lookAt matrix toward (pos + forward),
  // convert to quaternion, and apply directly to the mesh so its world rotation matches.
  const worldPos = mesh.getWorldPosition(new THREE.Vector3());
  const lookTarget = worldPos.clone().add(forward);
  const up = new THREE.Vector3(0, 1, 0);
  const mat = new THREE.Matrix4();
  mat.lookAt(worldPos, lookTarget, up);
  const worldQuat = new THREE.Quaternion().setFromRotationMatrix(mat);
  mesh.quaternion.copy(worldQuat);

  state.held = mesh;

  // Unlock "Collector" achievement on first pickup
  try {
    if (!state.achievements) state.achievements = [];
    // prefer id match, then title/subtitle fallback
    const ach = state.achievements.find(a => a.id === 'first-pickup' || a.title === 'Collector' || (a.subtitle && a.subtitle.toLowerCase().includes('pick up')));
    if (ach && !ach.unlocked) {
      ach.unlocked = true;
      try { showAchievement(ach.title || 'Collector', ach.subtitle || 'Pick up an object'); } catch (e) {}
    }
  } catch (e) {}
}

function dropObject(mesh, initialVelocity = new THREE.Vector3(0, 0, 0)) {
  // Place into world with initial velocity. Preserve current world rotation/appearance.
  // compute world position and quaternion
  mesh.updateWorldMatrix(true, false);
  const worldPos = new THREE.Vector3();
  const worldQuat = new THREE.Quaternion();
  mesh.getWorldPosition(worldPos);
  mesh.getWorldQuaternion(worldQuat);
  // ensure mesh is a direct child of the world so world transform is represented by mesh.position/quaternion
  world.add(mesh);
  mesh.position.copy(worldPos);
  mesh.quaternion.copy(worldQuat);

  // If no explicit velocity supplied (zero vector), make the drop a gentle backward toss
  // opposite the player's current facing direction so it moves away from the player.
  const vel = initialVelocity.clone();
  if (vel.length() === 0) {
    const playerFwd = camera.getPlayerDirection().clone().normalize();
    const backward = playerFwd.multiplyScalar(-1);
    const horizSpeed = 0.8; // slower than a throw
    const upwardBoost = 0.6; // gentle lift
    vel.copy(backward.multiplyScalar(horizSpeed));
    vel.y = upwardBoost;
  }

  mesh.userData.dynamic = true;
  mesh.userData.velocity.copy(vel);

  // clear stored pickup forward when object is dropped
  state.pickupForward = null;
}

function throwHeldObject(strength = null) {
  if (!state.held) return;
  // use provided strength (from charge) or fallback to base value
  const spd = (typeof strength === 'number') ? strength : state.throwBase;

  // Compute the held object's world-facing forward (local -Z) including Y axis,
  // so it will be launched in whatever direction the object is oriented.
  const toThrow = state.held;

  // fetch world quaternion of the object
  const worldQuat = new THREE.Quaternion();
  toThrow.getWorldQuaternion(worldQuat);

  // object's forward in world space (local -Z)
  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(worldQuat).normalize();

  // Base throw along object's forward
  const throwVel = forward.clone().multiplyScalar(spd);

  // Add an upward arc: always give a small base upward boost, plus extra boost
  // when the object is pitched upward (forward.y > 0) to emphasize Y-axis influence.
  const baseUp = Math.max(1.2, spd * 0.08);
  const pitchUpBoost = Math.max(0, forward.y) * Math.max(0, spd * 0.12);
  throwVel.y += baseUp + pitchUpBoost;

  state.held = null;
  state.pickupForward = null;
  dropObject(toThrow, throwVel);

  // Unlock "Throw Master" achievement for a sufficiently strong charged throw
  try {
    const strengthValue = spd;
    // require meaningful charge above base to qualify (tunable)
    const threshold = state.throwBase + 6;
    if (strengthValue >= threshold) {
      if (!state.achievements) state.achievements = [];
      const ach = state.achievements.find(a => a.id === 'throw-pro' || a.title === 'Throw Master' || (a.subtitle && a.subtitle.toLowerCase().includes('throw')));
      if (ach && !ach.unlocked) {
        ach.unlocked = true;
        try { showAchievement(ach.title || 'Throw Master', ach.subtitle || 'Send it flying'); } catch (e) {}
      }
    }
  } catch (e) {}
}

 // showOutOfBounds: display a centered red message that floats up and fades, and reset the box
 function showOutOfBounds() {
   if (!oobEl) return;
   oobState.active = true;
   oobState.timeLeft = oobState.duration;
   // set initial position/visuals
   oobEl.style.transition = 'none';
   oobEl.style.opacity = '1';
   oobEl.style.transform = 'translateX(-50%) translateY(0)';
   oobEl.textContent = 'OUT OF BOUNDS!';
 }
 
 // startChaos: enable a short, violent world shake and rainbow background cycle
 function startChaos() {
   if (state.chaosActive) return;
   state.chaosActive = true;
   state.chaosTimeLeft = state.chaosDuration;
   // set a cooldown so chaos won't immediately retrigger during the restoration/reset phase
   state.chaosCooldown = performance.now() + state.chaosDuration + 500;
   // capture original background to restore later
   // Save original background (handle Color, Texture, or CSS background on renderer)
   if (!startChaos._origBg) {
     if (scene.background && scene.background.isColor) {
       startChaos._origBg = { type: 'color', value: scene.background.clone() };
     } else if (scene.background && scene.background.isTexture) {
       startChaos._origBg = { type: 'texture', value: scene.background.clone() };
     } else {
       // fallback to renderer DOM background CSS
       startChaos._origBg = { type: 'css', value: renderer.domElement.style.background || '' };
     }
   }
   // make sure world root offset starts at zero
   world.position.set(0, 0, 0);

   // Save pre-chaos transforms so we can fully restore later
   startChaos._saved = startChaos._saved || {};
   startChaos._saved.boxes = interactiveBoxes.map(b => ({
     pos: b.position.clone(),
     quat: b.quaternion.clone(),
     rot: b.rotation.clone(),
     dynamic: !!b.userData.dynamic,
     velocity: b.userData.velocity ? b.userData.velocity.clone() : new THREE.Vector3()
   }));
   startChaos._saved.yaw = {
     pos: yaw.position.clone(),
     quat: yaw.quaternion ? yaw.quaternion.clone() : new THREE.Quaternion(),
     rotation: yaw.rotation.clone(),
     velocity: yaw.userData && yaw.userData.velocity ? yaw.userData.velocity.clone() : new THREE.Vector3()
   };

   // force objects to become dynamic and give them wild initial velocities so they fly off
   for (const b of interactiveBoxes) {
     b.userData.dynamic = true;
     if (!b.userData.velocity) b.userData.velocity = new THREE.Vector3();
     b.userData.velocity.set((Math.random() - 0.5) * 12, Math.random() * 12 + 2, (Math.random() - 0.5) * 12);
   }

   // give the player rig a velocity so the player itself will be tossed around
   if (!yaw.userData) yaw.userData = {};
   yaw.userData.velocity = new THREE.Vector3((Math.random() - 0.5) * 4, Math.random() * 4 + 1, (Math.random() - 0.5) * 4);

   // Unlock the "Mesmerizing" achievement the first time chaos starts
   try {
     // ensure an entry exists in the achievements list
     if (!state.achievements) state.achievements = [];
     let mesmer = state.achievements.find(a => a.id === 'mesmerizing' || (a.title && a.title.toLowerCase().includes('mesmerizing')));
     if (!mesmer) {
       mesmer = {
         id: 'mesmerizing',
         title: 'Mesmerizing',
         subtitle: 'You unleashed chaos',
         desc: 'Triggered chaos mode for the first time',
         unlocked: false
       };
       state.achievements.push(mesmer);
     }
     if (!mesmer.unlocked) {
       mesmer.unlocked = true;
       // sync boolean maps
       state.achVars = state.achVars || {};
       state.achVars[mesmer.id] = true;
       state[`ach_${mesmer.id}`] = true;
       // show the special rainbow achievement
       try { showAchievement(mesmer.title, mesmer.subtitle); } catch (e) {}
     }
   } catch (e) {}
 }

 // Animation and movement loop
let prevTime = performance.now();
let fpsCounter = { last: performance.now(), frames: 0 };

// track previous vertical position of the player rig to detect downward crossings of object tops
let prevYawY = 0;

function animate() {
  requestAnimationFrame(animate);
  const now = performance.now();
  const dt = Math.min(0.05, (now - prevTime) / 1000);
  prevTime = now;

  // if warning not accepted, skip game input/physics/rendering to avoid accidental play
  if (!warningAccepted) {
    renderer.render(scene, camera);
    return;
  }

  // Read keyboard input according to current bindings (supports remapped keys)
  let kForward = 0, kRight = 0;
  if (bindingPressed('forward')) kForward += 1;
  if (bindingPressed('back')) kForward -= 1;
  if (bindingPressed('left')) kRight -= 1;
  if (bindingPressed('right')) kRight += 1;

  // Combine keyboard and joystick inputs (joystickInput stays {0,0} if not available)
  state.forward = joystickInput.forward + kForward;
  state.right = joystickInput.right + kRight;

  // Normalize so combined input doesn't exceed magnitude 1
  const mag = Math.hypot(state.forward, state.right);
  if (mag > 1) { state.forward /= mag; state.right /= mag; }

  // Update rotation
  yaw.rotation.y = state.yaw;
  pitch.rotation.x = state.pitch;

  // Movement in local space (yaw affects forward/right)
  const forwardVec = new THREE.Vector3(0, 0, -1).applyQuaternion(yaw.quaternion);
  const rightVec = new THREE.Vector3(1, 0, 0).applyQuaternion(yaw.quaternion);

  // apply sprint and crouch multipliers
  let speed = state.moveSpeed * (keys['shift'] ? state.sprintMultiplier : 1);
  if (keys['ctrl']) speed *= state.crouchSpeedMult;
  const vel = new THREE.Vector3();
  vel.addScaledVector(forwardVec, state.forward * speed * dt);
  vel.addScaledVector(rightVec, state.right * speed * dt);

  // Move camera rig (horizontal)
  // apply tentative horizontal move first, then resolve top-only collisions with boxes
  const proposedPos = yaw.position.clone().add(vel);

  // Top-only blocking: if player's feet are within a small vertical band near a box top and the horizontal footprint overlaps,
  // push the player out along the axis of greatest penetration so the player cannot move into the box from the top area.
  const playerFeetY = proposedPos.y - state.height;
  const topBandHalf = 0.35; // half-height of vertical band around the top where blocking applies
  for (const b of interactiveBoxes) {
    const halfW = Math.abs((b.geometry.parameters.width || 1) * 0.5);
    const halfD = Math.abs((b.geometry.parameters.depth || 1) * 0.5);
    const halfH = Math.abs((b.geometry.parameters.height || 1) * 0.5);
    const topY = b.position.y + halfH;

    // Only consider blocking when the player's feet are near the box top
    if (playerFeetY >= topY - topBandHalf && playerFeetY <= topY + topBandHalf) {
      // compute horizontal delta between proposed player position and box center
      const dx = proposedPos.x - b.position.x;
      const dz = proposedPos.z - b.position.z;
      const overlapX = halfW + 0.25 - Math.abs(dx); // small inset so player can slide near edges
      const overlapZ = halfD + 0.25 - Math.abs(dz);

      // if overlapping in both axes, resolve along the axis of larger penetration
      if (overlapX > 0 && overlapZ > 0) {
        if (overlapX < overlapZ) {
          // resolve along X
          const push = (dx > 0) ? overlapX : -overlapX;
          proposedPos.x += push;
        } else {
          // resolve along Z
          const push = (dz > 0) ? overlapZ : -overlapZ;
          proposedPos.z += push;
        }
      } else if (overlapX > 0) {
        const push = (dx > 0) ? overlapX : -overlapX;
        proposedPos.x += push;
      } else if (overlapZ > 0) {
        const push = (dz > 0) ? overlapZ : -overlapZ;
        proposedPos.z += push;
      }
    }
  }

  // commit corrected horizontal position
  yaw.position.copy(proposedPos);

  // Vertical physics (gravity + jump)
  // integrate velocity
  state.vy += state.gravity * dt;
  // apply vertical movement
  yaw.position.y += state.vy * dt;

  // top-only collision with interactive boxes:
  // If the player is moving downward and crosses an object's top surface within its horizontal footprint,
  // snap the player to that top and zero vertical velocity. This allows phasing through sides/bottom.
  let landedOnObject = false;
  if (state.vy <= 0) { // only consider downward motion
    const px = yaw.position.x;
    const pz = yaw.position.z;
    for (const b of interactiveBoxes) {
      // compute box top y and horizontal half-extents in world space (boxes are axis-aligned)
      const halfW = Math.abs((b.geometry.parameters.width || 1) * 0.5);
      const halfD = Math.abs((b.geometry.parameters.depth || 1) * 0.5);
      const halfH = Math.abs((b.geometry.parameters.height || 1) * 0.5);
      const topY = b.position.y + halfH;

      // check horizontal footprint (axis-aligned AABB test)
      const dx = Math.abs(px - b.position.x);
      const dz = Math.abs(pz - b.position.z);
      const withinFootprint = dx <= halfW * 0.9 && dz <= halfD * 0.9; // slightly inset to avoid edge sticking

      // detect crossing: previously above the surface and now at or below the surface height + eye offset
      const playerFeetY = yaw.position.y - state.height; // player's foot y in world (rig.y is eye height)
      const prevPlayerFeetY = prevYawY - state.height;
      if (withinFootprint && prevPlayerFeetY > topY && playerFeetY <= topY) {
        // snap player so their feet sit on the object's top
        yaw.position.y = topY + state.height;
        state.vy = 0;
        landedOnObject = true;

        // Make this object fully static on player contact so the player only interacts with its top.
        // Stop any dynamic motion and clear velocity so the object won't be pushed by the player.
        b.userData.dynamic = false;
        if (b.userData.velocity) b.userData.velocity.set(0, 0, 0);

        // landed onto an object: reset jump state
        state.grounded = true;
        state.jumpCount = 0;
        state.lastJumpPress = 0;
        break;
      }
    }
  }

  // ground collision (world floor)
  if (!landedOnObject && yaw.position.y <= state.height) {
    yaw.position.y = state.height;
    state.vy = 0;
    // landed: reset grounded jump state so player can double-jump again next time
    state.grounded = true;
    state.jumpCount = 0;
    state.lastJumpPress = 0;
  } else if (!landedOnObject) {
    state.grounded = false;
  }

  // Update dynamic objects physics (simple gravity + ground collide)
  for (let idx = 0; idx < interactiveBoxes.length; idx++) {
    const b = interactiveBoxes[idx];
    if (!b.userData.dynamic) continue;
    // integrate
    b.userData.velocity.y += state.gravity * dt;
    b.position.addScaledVector(b.userData.velocity, dt);

    // If a box falls far below the map or wanders too far out, reset it to its saved initial transform
    const OOB_Y = -30;
    const OOB_XZ = 110;
    if (b.position.y < OOB_Y || Math.abs(b.position.x) > OOB_XZ || Math.abs(b.position.z) > OOB_XZ) {
      // restore initial snapshot if available
      const snap = interactiveBoxesInitial[idx];
      if (snap) {
        b.position.copy(snap.pos);
        b.quaternion.copy(snap.quat);
        b.rotation.copy(snap.rot);
        b.userData.dynamic = !!snap.dynamic;
        if (!b.userData.velocity) b.userData.velocity = new THREE.Vector3();
        b.userData.velocity.copy(snap.velocity);
      } else {
        // fallback: place it above ground near origin
        b.position.set(0, 1, 0);
        b.userData.velocity.set(0, 0, 0);
        b.userData.dynamic = false;
      }
      // trigger HUD message
      showOutOfBounds();
      // continue to next object
      continue;
    }

    // ground collision (ground at y=0, boxes have varying heights; approximate by half-height)
    const halfHeight = (b.geometry.parameters.height || 1) / 2;
    if (b.position.y - halfHeight <= 0) {
      b.position.y = halfHeight;
      // simple bounce dampening
      if (Math.abs(b.userData.velocity.y) > 0.5) {
        b.userData.velocity.y = -b.userData.velocity.y * 0.25;
      } else {
        b.userData.velocity.y = 0;
      }
      // friction for horizontal
      b.userData.velocity.x *= 0.8;
      b.userData.velocity.z *= 0.8;
      // if very small velocities, stop
      if (b.userData.velocity.length() < 0.01) {
        b.userData.velocity.set(0, 0, 0);
        b.userData.dynamic = false; // come to rest
      }
    }
  }

  // Simple pairwise collision between boxes (objects collide with each other but not the player)
  // Use sphere-based approximation derived from box extents and apply positional correction + simple velocity response.
  for (let i = 0; i < interactiveBoxes.length; i++) {
    const A = interactiveBoxes[i];
    // derive a stable radius for A from geometry params (fallback to 0.6)
    const aW = Math.abs((A.geometry.parameters.width) || 1);
    const aH = Math.abs((A.geometry.parameters.height) || 1);
    const aD = Math.abs((A.geometry.parameters.depth) || 1);
    const rA = Math.max(aW, aH, aD) * 0.5 * 0.9; // slightly smaller to avoid jitter

    for (let j = i + 1; j < interactiveBoxes.length; j++) {
      const B = interactiveBoxes[j];
      const bW = Math.abs((B.geometry.parameters.width) || 1);
      const bH = Math.abs((B.geometry.parameters.height) || 1);
      const bD = Math.abs((B.geometry.parameters.depth) || 1);
      const rB = Math.max(bW, bH, bD) * 0.5 * 0.9;

      const delta = new THREE.Vector3().subVectors(B.position, A.position);
      const dist = delta.length();
      const minDist = rA + rB;
      if (dist > 0 && dist < minDist) {

        // penetration depth & normal
        const pen = minDist - dist;
        const n = delta.normalize();

        // positional correction: push each object away proportional to whether they're dynamic
        const aDynamic = !!A.userData.dynamic;
        const bDynamic = !!B.userData.dynamic;
        const totalDynamic = (aDynamic ? 1 : 0) + (bDynamic ? 1 : 0) || 1;

        if (aDynamic) A.position.addScaledVector(n, -pen * (bDynamic ? 0.5 : 1) );
        if (bDynamic) B.position.addScaledVector(n, pen * (aDynamic ? 0.5 : 1) );

        // simple velocity response along collision normal (1D along n)
        const va = A.userData.velocity || new THREE.Vector3();
        const vb = B.userData.velocity || new THREE.Vector3();
        const rel = new THREE.Vector3().subVectors(vb, va);
        const relAlong = rel.dot(n);

        // only resolve if moving towards each other
        if (relAlong < 0) {
          const restitution = 0.35; // some bounce
          // impulse scalar (split by dynamic counts)
          const jImpulse = -(1 + restitution) * relAlong / totalDynamic;
          if (aDynamic) va.addScaledVector(n, -jImpulse * (bDynamic ? 0.5 : 1));
          if (bDynamic) vb.addScaledVector(n, jImpulse * (aDynamic ? 0.5 : 1));
          // write back
          if (A.userData.velocity) A.userData.velocity.copy(va);
          if (B.userData.velocity) B.userData.velocity.copy(vb);

          // --- collision-triggered chaos: on a sufficiently strong impact, roll random chance and start chaos ---
          // compute impact strength from relative velocity along the normal (positive magnitude)
          const impactStrength = Math.abs(relAlong);
          // require a minimum impact to avoid tiny bumps triggering chaos
          const impactThreshold = 2.0;
          if (impactStrength >= impactThreshold) {
            const nowMs = performance.now();
            if (Math.random() < state.chaosChance && nowMs > (state.chaosCooldown || 0)) {
              startChaos();
            }
          }
        }
      }
    }
  }

  // If holding an object, position it in front of the camera each frame without changing its rotation,
  // so appearance stays the same while it follows the player.
  if (state.held) {
    const worldPos = worldPositionOfCameraLocal(state.holdOffset);
    state.held.position.copy(worldPos);
    // keep held object's world rotation as-is (do not modify quaternion)
  }

  // Asset highlight update: cast a short ray forward from camera to determine what object is under crosshair
  if (state.showAssetOnHighlight && assetHighlightEl) {
    const camPos = new THREE.Vector3();
    camera.getWorldPosition(camPos);
    const camDir = new THREE.Vector3();
    camera.getWorldDirection(camDir);
    highlightRay.set(camPos, camDir);
    const hits = highlightRay.intersectObjects(interactiveBoxes, true);
    if (hits && hits.length > 0) {
      const top = hits[0].object;
      // find index and info
      const idx = interactiveBoxes.indexOf(top);
      const name = (top.userData && top.userData.name) ? top.userData.name : (idx >= 0 ? `Box #${idx+1}` : 'Object');
      const geom = top.geometry && top.geometry.parameters ? top.geometry.parameters : { width: 1, height: 1, depth: 1 };
      const info = `w:${(geom.width||1).toFixed(2)} h:${(geom.height||1).toFixed(2)} d:${(geom.depth||1).toFixed(2)}`;
      assetNameEl.textContent = name;
      assetInfoEl.textContent = info;
      assetHighlightEl.style.display = '';
    } else {
      assetNameEl.textContent = '—';
      assetInfoEl.textContent = 'No object';
      assetHighlightEl.style.display = 'none';
    }
  } else if (assetHighlightEl) {
    assetHighlightEl.style.display = 'none';
  }

  // Smooth camera local Y for crouch visuals (only adjust camera local position; collision/jump logic unchanged)
  const desiredEye = keys['ctrl'] ? state.crouchEye : state.height;
  // smooth interpolation factor
  const t = Math.min(1, 10 * dt);
  camera.position.y = THREE.MathUtils.lerp(camera.position.y, desiredEye, t);

  // Chaos mode update: apply world shake (offset the world group) and rainbow background while active.
  if (state.chaosActive) {
    // decrease timer
    state.chaosTimeLeft -= (dt * 1000);
    const frac = Math.max(0, state.chaosTimeLeft / state.chaosDuration);
    // intensity fades out over time
    const intensity = state.chaosIntensity * Math.max(0.2, frac); // keep some baseline so it's violent early->mid

    // strong random jitter applied to world position to make everything feel untethered
    world.position.x = (Math.random() * 2 - 1) * intensity * 6;
    world.position.y = (Math.random() * 2 - 1) * intensity * 4;
    world.position.z = (Math.random() * 2 - 1) * intensity * 3;

    // Inject chaotic velocity perturbations into every dynamic object so they jerk and fly
    for (const b of interactiveBoxes) {
      if (!b.userData.dynamic) {
        b.userData.dynamic = true;
        if (!b.userData.velocity) b.userData.velocity = new THREE.Vector3();
      }
      // random kick proportional to intensity
      const kick = new THREE.Vector3((Math.random() - 0.5) * 18 * intensity, (Math.random() - 0.2) * 22 * intensity, (Math.random() - 0.5) * 18 * intensity);
      b.userData.velocity.add(kick.multiplyScalar(dt)); // apply as impulse scaled by dt for stability

      // small additional angular tumble for visual chaos (rotate locally)
      b.rotation.x += (Math.random() - 0.5) * 6 * intensity * dt;
      b.rotation.y += (Math.random() - 0.5) * 6 * intensity * dt;
      b.rotation.z += (Math.random() - 0.5) * 6 * intensity * dt;
    }

    // Toss the player rig itself: apply yaw.userData.velocity to move the rig and random kicks so the player flies
    if (!yaw.userData) yaw.userData = {};
    if (!yaw.userData.velocity) yaw.userData.velocity = new THREE.Vector3();
    // add jitter to the rig's velocity
    yaw.userData.velocity.x += (Math.random() - 0.5) * 12 * intensity * dt;
    yaw.userData.velocity.y += (Math.random() - 0.2) * 14 * intensity * dt;
    yaw.userData.velocity.z += (Math.random() - 0.5) * 12 * intensity * dt;

    // apply the rig velocity directly to its position so the player flies away
    yaw.position.addScaledVector(yaw.userData.velocity, dt);

    // also apply a small angular wobble to the view so the camera rolls/pitches during chaos
    yaw.rotation.y += (Math.random() - 0.5) * 2.5 * intensity * dt;
    pitch.rotation.x += (Math.random() - 0.5) * 2.5 * intensity * dt;

    // rainbow background: cycle hue over time faster when more intense
    const timeHue = (performance.now() * state.chaosColorSpeed * (1 + frac * 6)) % 1;
    const hue = timeHue;
    // convert H to RGB via HSL helper
    const c = new THREE.Color();
    c.setHSL(hue, 0.95, 0.52);
    scene.background = c;

    if (state.chaosTimeLeft <= 0) {
      // end chaos: restore background and reset world offset
      state.chaosActive = false;

      // restore background (handle previously saved color/texture/css)
      if (startChaos._origBg) {
        const s = startChaos._origBg;
        if (s.type === 'color' && s.value && s.value.isColor) {
          scene.background = s.value.clone();
          renderer.domElement.style.background = '';
        } else if (s.type === 'texture' && s.value) {
          scene.background = s.value.clone();
          renderer.domElement.style.background = '';
        } else if (s.type === 'css') {
          scene.background = null;
          renderer.domElement.style.background = s.value || '';
        } else {
          // fallback
          scene.background = new THREE.Color(0x071018);
          renderer.domElement.style.background = '';
        }
      }

      // If we saved pre-chaos transforms, restore them exactly
      if (startChaos._saved && startChaos._saved.boxes) {
        for (let i = 0; i < interactiveBoxes.length; i++) {
          const b = interactiveBoxes[i];
          const s = startChaos._saved.boxes[i];
          if (s) {
            b.position.copy(s.pos);
            b.quaternion.copy(s.quat);
            b.rotation.copy(s.rot);
            b.userData.dynamic = !!s.dynamic;
            if (!b.userData.velocity) b.userData.velocity = new THREE.Vector3();
            b.userData.velocity.copy(s.velocity);
          }
        }
      }

      // restore yaw/player rig transform and velocity
      if (startChaos._saved && startChaos._saved.yaw) {
        const sy = startChaos._saved.yaw;
        yaw.position.copy(sy.pos);
        if (sy.quat) yaw.quaternion.copy(sy.quat);
        if (sy.rotation) yaw.rotation.copy(sy.rotation);
        if (!yaw.userData) yaw.userData = {};
        yaw.userData.velocity = sy.velocity ? sy.velocity.clone() : new THREE.Vector3();
      }

      // reset world group offset to zero (clear the shake)
      world.position.set(0, 0, 0);

      // clear any residual small velocities (fully calm) to avoid immediate re-tossing
      for (const b of interactiveBoxes) {
        if (b.userData.velocity) b.userData.velocity.multiplyScalar(0.0);
      }
      if (yaw.userData && yaw.userData.velocity) yaw.userData.velocity.multiplyScalar(0.0);

      // clear saved snapshot (optional, keep memory low)
      startChaos._saved = null;
    }
  }

  // OUT-OF-BOUNDS HUD update: animate floating/fade when active
  if (oobState.active && oobEl) {
    oobState.timeLeft -= (dt * 1000);
    const frac = 1 - Math.max(0, oobState.timeLeft / oobState.duration); // 0->1 over lifetime
    // move up by up to 36px and fade out
    const up = Math.round(frac * -36);
    const opacity = Math.max(0, 1 - frac * 1.1);
    oobEl.style.transform = `translateX(-50%) translateY(${up}px)`;
    oobEl.style.opacity = String(opacity);
    if (oobState.timeLeft <= 0) {
      oobState.active = false;
      oobEl.style.opacity = '0';
      oobEl.style.transform = 'translateX(-50%) translateY(0)';
      // clear text after fade
      setTimeout(() => { if (oobEl) oobEl.textContent = ''; }, 250);
    }
  }

  renderer.render(scene, camera);

  // FPS display (update every 0.5s)
  fpsCounter.frames++;
  if (now - fpsCounter.last > 500) {
    const fps = Math.round((fpsCounter.frames * 1000) / (now - fpsCounter.last));
    fpsEl.textContent = fps + ' FPS';
    fpsCounter.last = now;
    fpsCounter.frames = 0;
  }
}

animate();