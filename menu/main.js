import * as THREE from "three";

const canvas = document.getElementById("gl");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setClearColor(0x000000);

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(50, 2, 0.1, 100);
camera.position.set(0, 0, 3);

const ambient = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambient);

const dir = new THREE.DirectionalLight(0xffffff, 0.6);
dir.position.set(3, 5, 2);
scene.add(dir);

// cube
const geometry = new THREE.BoxGeometry(1, 1, 1);
const material = new THREE.MeshStandardMaterial({ color: 0x9be7ff, metalness: 0.2, roughness: 0.35 });
const cube = new THREE.Mesh(geometry, material);
scene.add(cube);

// subtle wireframe accent
const wire = new THREE.LineSegments(
  new THREE.EdgesGeometry(geometry),
  new THREE.LineBasicMaterial({ color: 0x0b2a36, linewidth: 1 })
);
cube.add(wire);



// rotation speed (radians/sec)
const spinSpeed = { x: 0.5, y: 0.8, z: 0.3 };

 // center the cube in the scene
 cube.position.set(0, 0, 0);
 cube.rotation.set(0.2, 0.6, 0);

// responsive resize
function resize() {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (canvas.width !== Math.floor(w * renderer.getPixelRatio()) || canvas.height !== Math.floor(h * renderer.getPixelRatio())) {
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
}

function animate() {
  resize();

  // gentle continuous rotation
  cube.rotation.x += spinSpeed.x * 0.01;
  cube.rotation.y += spinSpeed.y * 0.01;
  cube.rotation.z += spinSpeed.z * 0.01;

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

requestAnimationFrame(animate);

// ensure canvas fills viewport without scrolling (mobile-friendly)
function setupCanvasSize() {
  canvas.style.width = "100vw";
  canvas.style.height = "100vh";
  renderer.setSize(innerWidth, innerHeight, false);
}
setupCanvasSize();
window.addEventListener("resize", () => {
  setupCanvasSize();
});

 // play button: redirect to a YouTube link
const playBtn = document.getElementById("playBtn");
if (playBtn) {
  playBtn.addEventListener("click", () => {
       // redirect to a link 
    window.location.href = "https://mrvaporwave25.github.io/3d-world/";
  });
}

// quit button: attempt to close the window when clicked
const quitBtn = document.getElementById("quitBtn");
if (quitBtn) {
  quitBtn.addEventListener("click", () => {
    // window.close() will only succeed for windows opened via script in many browsers,
    // but this invokes the close attempt per the requested behavior.
    window.close();
  });
}
