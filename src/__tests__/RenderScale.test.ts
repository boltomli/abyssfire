import { describe, expect, it } from 'vitest';
import { renderScaleFor } from '../rendering/RenderScale';

describe('render scale', () => {
  it('matches the device pixels the canvas covers, in half steps up to 2', () => {
    expect(renderScaleFor(1, 'high')).toBe(1);
    expect(renderScaleFor(1.3, 'high')).toBe(1.5);
    expect(renderScaleFor(2.3, 'high')).toBe(2);
    expect(renderScaleFor(4, 'high')).toBe(2);
  });

  it('is capped by render quality (phones and weak machines stay at 1)', () => {
    expect(renderScaleFor(3, 'low')).toBe(1);
    expect(renderScaleFor(3, 'balanced')).toBe(1.5);
  });

  it('never renders below the logical size', () => {
    expect(renderScaleFor(0.6, 'high')).toBe(1);
  });
});
