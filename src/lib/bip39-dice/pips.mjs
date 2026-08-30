// Shared dice-domain constants and the standard d6 pip layout,
// used by both the 2D and 3D renderers (ADR-0005: identical derivation
// and identical dice rendering across renderers).

export const GRID_COLS = 10;
export const GRID_ROWS = 10;

/** Pip offsets for each face 1..6, in units of the die size (0 = centre). */
export const PIP_LAYOUT = {
  1: [[0, 0]],
  2: [[-1, -1], [1, 1]],
  3: [[-1, -1], [0, 0], [1, 1]],
  4: [[-1, -1], [1, -1], [-1, 1], [1, 1]],
  5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]],
  6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]],
};
