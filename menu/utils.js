export function randomInRange(min, max) {
  return Math.random() * (max - min) + min;
}

export function randomPosition3D(radius = 2) {
  // uniform-ish random position inside a box with +/- radius on each axis but bias away from camera
  const x = randomInRange(-radius, radius);
  const y = randomInRange(-radius * 0.7, radius * 0.7);
  const z = randomInRange(-radius, -radius * 0.3); // place cube slightly in front of camera
  return { x, y, z };
}