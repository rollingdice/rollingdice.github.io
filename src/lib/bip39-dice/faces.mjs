// CSPRNG-anchored dice faces (ADR-0003).
// The resting face values come from crypto.getRandomValues, uniformly
// distributed over 1..6 with rejection sampling (no modulo bias).
// The physics renderers animate a tumble but settle on exactly these faces,
// so the visible pattern is the auditable carrier of the randomness.

export function randomDiceFace() {
  // getRandomValues returns 0..255 uniformly. Reject 252..255 so that
  // floor(x / 42) over 0..251 is exactly uniform over 0..5.
  const buf = new Uint8Array(1);
  let x;
  do {
    crypto.getRandomValues(buf);
    x = buf[0];
  } while (x >= 252);
  return (x % 6) + 1; // 1..6
}

export function rollGrid(cols, rows) {
  const faces = [];
  for (let i = 0; i < cols * rows; i++) faces.push(randomDiceFace());
  return faces;
}

/** The 100-digit roll string read left->right, top->bottom (ADR-0001). */
export function gridToRollString(faces) {
  return faces.join('');
}
