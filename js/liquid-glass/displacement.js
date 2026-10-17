/* ============================================================
   CampusStay — Liquid Glass Displacement Map Generator
   
   Generates a radial displacement map on an offscreen canvas.
   The map encodes horizontal displacement in the Red channel
   and vertical displacement in the Green channel. A neutral
   value (128, 128) means "no displacement"; deviations from
   128 push pixels in the corresponding direction.
   
   The result is a base64 PNG data-URI suitable for use with
   SVG feImage → feDisplacementMap.
   ============================================================ */

const LiquidGlassDisplacement = (() => {
  'use strict';

  /**
   * Default configuration for the displacement map.
   * - size:       Canvas pixel dimensions (square). Higher = sharper map but more memory.
   * - radius:     The radius of the "lens" effect as a fraction of size (0–1).
   * - intensity:  How strong the refraction push is (0–1). Maps to channel deviation from 128.
   * - edgeSoftness: How gradually the effect fades at the edges (0–1).
   * - chromaticShift: Additional offset between R and G channels for prismatic fringing.
   */
  const DEFAULTS = {
    size: 256,
    radius: 0.42,
    intensity: 0.38,
    edgeSoftness: 0.25,
    chromaticShift: 0.012
  };

  /**
   * Attempt to reuse a shared offscreen canvas to avoid GC thrash
   * when regenerating maps on resize.
   */
  let _sharedCanvas = null;
  let _sharedCtx = null;

  function getCanvas(size) {
    if (_sharedCanvas && _sharedCanvas.width === size && _sharedCanvas.height === size) {
      return { canvas: _sharedCanvas, ctx: _sharedCtx };
    }
    // Prefer OffscreenCanvas for workers, fall back to regular canvas
    if (typeof OffscreenCanvas !== 'undefined') {
      _sharedCanvas = new OffscreenCanvas(size, size);
    } else {
      _sharedCanvas = document.createElement('canvas');
      _sharedCanvas.width = size;
      _sharedCanvas.height = size;
    }
    _sharedCtx = _sharedCanvas.getContext('2d', { willReadFrequently: true });
    return { canvas: _sharedCanvas, ctx: _sharedCtx };
  }

  /**
   * Attempt to apply a rounded-rectangle clip to match the element's
   * border-radius. This ensures the displacement map fades cleanly
   * at rounded corners rather than creating hard-edge artifacts.
   */
  function clipRoundedRect(ctx, size, borderRadius) {
    const r = Math.min(borderRadius, size / 2);
    if (r <= 0) return; // No clipping needed

    ctx.beginPath();
    // Top-left
    ctx.moveTo(r, 0);
    ctx.lineTo(size - r, 0);
    ctx.arcTo(size, 0, size, r, r);
    // Top-right → Bottom-right
    ctx.lineTo(size, size - r);
    ctx.arcTo(size, size, size - r, size, r);
    // Bottom-right → Bottom-left
    ctx.lineTo(r, size);
    ctx.arcTo(0, size, 0, size - r, r);
    // Bottom-left → Top-left
    ctx.lineTo(0, r);
    ctx.arcTo(0, 0, r, 0, r);
    ctx.closePath();
    ctx.clip();
  }

  /**
   * Generate the displacement map as a base64 data-URI.
   *
   * The algorithm:
   * 1. For each pixel, compute the distance from center (normalized 0–1).
   * 2. Compute a refraction vector pointing away from center, modulated by
   *    a bell-shaped intensity curve (strong at edges, zero at center and beyond radius).
   * 3. Encode the vector into R (horizontal) and G (vertical) channels.
   * 4. Add a slight chromatic shift: R channel is offset slightly outward
   *    relative to G, creating the prismatic color fringe at edges.
   *
   * @param {Object} opts — override any DEFAULTS key
   * @returns {string} data:image/png;base64,... URI
   */
  function generate(opts = {}) {
    const cfg = Object.assign({}, DEFAULTS, opts);
    const { size, radius, intensity, edgeSoftness, chromaticShift } = cfg;

    const { canvas, ctx } = getCanvas(size);

    // Optional: clip to rounded rect for corner matching
    ctx.save();
    ctx.clearRect(0, 0, size, size);

    if (cfg.borderRadius && cfg.borderRadius > 0) {
      // Scale borderRadius from CSS px to canvas px
      const scaledRadius = (cfg.borderRadius / (cfg.elementSize || size)) * size;
      clipRoundedRect(ctx, size, scaledRadius);
    }

    const imageData = ctx.createImageData(size, size);
    const data = imageData.data;

    const cx = size / 2;
    const cy = size / 2;
    const maxR = size * radius;
    const edgeFade = edgeSoftness * maxR;

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const idx = (y * size + x) * 4;

        // Vector from center
        const dx = x - cx;
        const dy = y - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Normalized distance (0 at center, 1 at maxR)
        const normDist = dist / maxR;

        if (normDist >= 1.0) {
          // Outside the lens — neutral (no displacement)
          data[idx]     = 128; // R
          data[idx + 1] = 128; // G
          data[idx + 2] = 128; // B (unused but set for clean output)
          data[idx + 3] = 255; // A
          continue;
        }

        // Bell-shaped intensity curve: strong near the edge ring, weak at center
        // This creates the "lens edge refraction" look of Apple's glass
        const edgeCurve = Math.sin(normDist * Math.PI);

        // Smooth falloff at the outer boundary
        const outerFade = normDist > (1.0 - edgeSoftness)
          ? 1.0 - ((normDist - (1.0 - edgeSoftness)) / edgeSoftness)
          : 1.0;

        // Combined intensity
        const i = edgeCurve * outerFade * intensity;

        // Direction unit vector (from center outward)
        const len = dist || 1; // avoid division by zero
        const nx = dx / len;
        const ny = dy / len;

        // Displacement offset encoded as deviation from 128
        // R channel = horizontal displacement
        // G channel = vertical displacement
        const displaceR = nx * i * 127;
        const displaceG = ny * i * 127;

        // Chromatic shift: slightly stronger displacement on R channel
        // This separates color channels at edges for that prismatic fringe
        const chromR = nx * chromaticShift * 127;
        const chromG = ny * chromaticShift * 127;

        data[idx]     = Math.round(Math.max(0, Math.min(255, 128 + displaceR + chromR))); // R
        data[idx + 1] = Math.round(Math.max(0, Math.min(255, 128 + displaceG + chromG))); // G
        data[idx + 2] = 128; // B — neutral
        data[idx + 3] = 255; // A — fully opaque
      }
    }

    ctx.putImageData(imageData, 0, 0);
    ctx.restore();

    // Convert to data URI
    if (canvas instanceof OffscreenCanvas) {
      // OffscreenCanvas doesn't support toDataURL — we convert via blob
      // But for synchronous usage we need regular canvas
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = size;
      tempCanvas.height = size;
      const tempCtx = tempCanvas.getContext('2d');
      tempCtx.putImageData(imageData, 0, 0);
      return tempCanvas.toDataURL('image/png');
    }

    return canvas.toDataURL('image/png');
  }

  /**
   * Generate a lighter, faster displacement map for mobile devices.
   * Uses a smaller canvas and reduced intensity.
   */
  function generateMobile(opts = {}) {
    return generate(Object.assign({
      size: 128,
      intensity: 0.22,
      chromaticShift: 0.006
    }, opts));
  }

  // Public API
  return {
    generate,
    generateMobile,
    DEFAULTS
  };
})();

// Expose globally for other modules
window.LiquidGlassDisplacement = LiquidGlassDisplacement;
