// Replay core for the explainer pages. The demos replay the original
// translated routines instead of paraphrasing them: a seek checkpoint puts the
// guest machine into the requested scene, and createOpeningSequence drives the
// real generated drawing code forward frame by frame. Frames come back as the
// original 320×200 indexed buffer plus the live DAC palette.
import { restoreCheckpoint } from '../runtime/checkpoint.mjs';
import { createOpeningSequence, previewTiming } from '../runtime/sequence.mjs';

export const FPS = previewTiming.fps;

export class SceneReplay {
  constructor({ baseBytes, checkpointBytes, files, start, end }) {
    this.baseBytes = baseBytes instanceof Uint8Array ? baseBytes : new Uint8Array(baseBytes);
    if (this.baseBytes.length !== 0x800000) throw new Error('Demo startup data is not the 8 MiB guest RAM');
    this.checkpointBytes = checkpointBytes;
    this.files = new Map(files);
    this.startIndex = Math.round(start * FPS);      // checkpoint restore point
    this.endIndex = Math.round(end * FPS) - 1;      // last frame before the next scene
    this._seed();
  }

  _seed() {
    const { machine, state } = restoreCheckpoint(this.baseBytes, this.checkpointBytes);
    // The restored checkpoint carries the full DAC palette, so the initial
    // palette argument is never consulted. extendCavern lets the cavern page
    // cross the order-35 boundary from the wire-grid scene into the cavern.
    this._next = createOpeningSequence(machine, [], {
      files: this.files,
      resume: state.sequence,
      extendCavern: true,
    });
    this._index = state.nextIndex;
    this._last = null;
    if (this._index <= this.startIndex) this._last = this._next(this._index) ?? null;
  }

  // Advance toward the requested composition second. Replays from the
  // checkpoint when the target is behind the current index. To keep the page
  // interactive during long rebuilds, spend at most `budget` frames AND at
  // most `maxWallMs` milliseconds per call; repeat calls finish the journey.
  advanceTo(seconds, { budget = 4, maxWallMs = 24 } = {}) {
    const target = Math.min(this.endIndex, Math.max(this.startIndex, Math.round(seconds * FPS)));
    if (target < this._index) this._seed();
    const startedAt = performance.now();
    while (this._index < target && budget-- > 0) {
      const frame = this._next(++this._index);
      if (!frame) break; // composition signalled the scene boundary; clamp here
      this._last = frame;
      if (budget > 0 && performance.now() - startedAt >= maxWallMs) break;
    }
    return {
      index: this._index,
      target,
      done: this._index >= target && this._last !== null,
      frame: this._last,
    };
  }
}

// Convert a composition frame (indexed 64000 pixels + DAC palette in 0..63)
// into canvas-ready RGBA, the same expansion the production player uses.
export function frameToRgba(frame) {
  const rgba = new Uint8ClampedArray(64000 * 4);
  for (let i = 0; i < frame.pixels.length; i++) {
    const rgb = frame.palette[frame.pixels[i]];
    for (let channel = 0; channel < 3; channel++) rgba[i * 4 + channel] = (rgb[channel] << 2) | (rgb[channel] >> 4);
    rgba[i * 4 + 3] = 255;
  }
  return rgba;
}
