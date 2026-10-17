/* ============================================================
   CampusStay — Liquid Glass SVG Filter System
   
   Creates and mounts a single global SVG element containing
   all filter primitives needed for the Liquid Glass effect:
   
   1. feImage        — loads the displacement map (data URI)
   2. feDisplacementMap — refracts the background through the map
   3. feGaussianBlur  — frosted glass blur
   4. feColorMatrix   — saturation boost + slight warmth
   5. feComposite     — alpha masking
   6. feMerge         — layer compositing
   
   The SVG is mounted once in <body> and referenced by CSS via
   backdrop-filter: url(#liquid-glass-refract).
   
   Feature detection determines whether the browser supports
   SVG-referenced backdrop-filters; if not, a CSS fallback
   class is applied to <html>.
   ============================================================ */

const LiquidGlassFilters = (() => {
  'use strict';

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const FILTER_ID = 'liquid-glass-refract';
  const GOOEY_FILTER_ID = 'liquid-gooey';
  const SVG_CONTAINER_ID = 'liquid-glass-svg-filters';

  let _mounted = false;
  let _supported = null; // null = untested, true/false = tested
  let _svgEl = null;
  let _displacementMapURI = null;

  /**
   * Test whether the browser supports using an SVG filter
   * reference inside backdrop-filter. This is the key feature
   * that makes the refraction effect work.
   *
   * Strategy: create a temporary element, apply the filter via
   * backdrop-filter: url(#test), and check if the computed style
   * retains the url() reference (browsers that don't support it
   * will drop the value).
   */
  function detectSupport() {
    if (_supported !== null) return _supported;

    // Basic backdrop-filter support check first
    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;top:-9999px;width:1px;height:1px;';
    document.body.appendChild(el);

    // Test 1: basic backdrop-filter support
    el.style.backdropFilter = 'blur(1px)';
    el.style.webkitBackdropFilter = 'blur(1px)';
    const hasBackdrop = !!(el.style.backdropFilter || el.style.webkitBackdropFilter);

    // Test 2: SVG filter reference in backdrop-filter
    // Most browsers support backdrop-filter: blur(), but not all support url() refs
    let hasSvgRef = false;
    if (hasBackdrop) {
      el.style.backdropFilter = 'url(#__lg_test_filter)';
      el.style.webkitBackdropFilter = 'url(#__lg_test_filter)';
      const computed = getComputedStyle(el);
      const val = computed.backdropFilter || computed.webkitBackdropFilter || '';
      hasSvgRef = val.includes('url(');
    }

    document.body.removeChild(el);

    _supported = hasBackdrop && hasSvgRef;

    // Apply fallback class if SVG filters aren't supported
    if (!_supported) {
      document.documentElement.classList.add('liquid-glass-fallback');
    }

    return _supported;
  }

  /**
   * Create the SVG namespace element helper.
   */
  function svgEl(tag, attrs = {}) {
    const el = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) {
      el.setAttribute(k, v);
    }
    return el;
  }

  /**
   * Build and mount the global SVG filter element.
   *
   * @param {string} displacementMapURI — the data:image/png URI from displacement.js
   * @param {Object} opts — configuration overrides
   */
  function mount(displacementMapURI, opts = {}) {
    if (_mounted) {
      // If already mounted but map changed, update the feImage href
      if (displacementMapURI !== _displacementMapURI) {
        updateDisplacementMap(displacementMapURI);
      }
      return;
    }

    _displacementMapURI = displacementMapURI;

    const cfg = Object.assign({
      blurAmount: 0.8,           // Gaussian blur stdDeviation for frosted glass
      displacementScale: 22,    // Strength of the refraction displacement
      saturation: 1.15,         // Color saturation boost (>1 = more vibrant)
      brightness: 1.04,         // Slight brightness lift
    }, opts);

    // Create the root SVG container (hidden, zero-size)
    _svgEl = svgEl('svg', {
      id: SVG_CONTAINER_ID,
      xmlns: SVG_NS,
      version: '1.1',
      style: 'position:absolute;width:0;height:0;pointer-events:none;visibility:hidden;overflow:hidden;',
      'aria-hidden': 'true'
    });

    const defs = svgEl('defs');

    // ── FILTER 1: Main Liquid Glass Refraction Filter ──
    const filter = svgEl('filter', {
      id: FILTER_ID,
      x: '-10%',
      y: '-10%',
      width: '120%',
      height: '120%',
      filterUnits: 'objectBoundingBox',
      primitiveUnits: 'objectBoundingBox',
      'color-interpolation-filters': 'sRGB'
    });

    // Step 1: Load displacement map as an image
    const feImage = svgEl('feImage', {
      href: displacementMapURI,
      result: 'dispMap',
      x: '0',
      y: '0',
      width: '1',
      height: '1',
      preserveAspectRatio: 'none'
    });
    // Fallback for older browsers using xlink:href
    feImage.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', displacementMapURI);
    filter.appendChild(feImage);

    // Step 2: Pre-blur the SourceGraphic so the color channels blur softly and keep their chromatic edges sharp
    filter.appendChild(svgEl('feGaussianBlur', {
      in: 'SourceGraphic',
      stdDeviation: String(cfg.blurAmount),
      result: 'preBlurred'
    }));

    // Step 3: Color Channel Separation (extract Red, Green, and Blue layers)
    filter.appendChild(svgEl('feColorMatrix', {
      in: 'preBlurred',
      type: 'matrix',
      values: '1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0',
      result: 'redSource'
    }));
    filter.appendChild(svgEl('feColorMatrix', {
      in: 'preBlurred',
      type: 'matrix',
      values: '0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0',
      result: 'greenSource'
    }));
    filter.appendChild(svgEl('feColorMatrix', {
      in: 'preBlurred',
      type: 'matrix',
      values: '0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0',
      result: 'blueSource'
    }));

    // Step 4: Apply Displacement Map with slightly different scales for Red, Green, and Blue
    // This creates physically accurate chromatic aberration (dispersion) around the edges
    const scaleRed = cfg.displacementScale;
    const scaleGreen = cfg.displacementScale * 1.06;
    const scaleBlue = cfg.displacementScale * 1.12;

    filter.appendChild(svgEl('feDisplacementMap', {
      in: 'redSource',
      in2: 'dispMap',
      scale: String(scaleRed),
      xChannelSelector: 'R',
      yChannelSelector: 'G',
      result: 'redDisplaced'
    }));
    filter.appendChild(svgEl('feDisplacementMap', {
      in: 'greenSource',
      in2: 'dispMap',
      scale: String(scaleGreen),
      xChannelSelector: 'R',
      yChannelSelector: 'G',
      result: 'greenDisplaced'
    }));
    filter.appendChild(svgEl('feDisplacementMap', {
      in: 'blueSource',
      in2: 'dispMap',
      scale: String(scaleBlue),
      xChannelSelector: 'R',
      yChannelSelector: 'G',
      result: 'blueDisplaced'
    }));

    // Step 5: Screen blend the separated displaced channels back together
    filter.appendChild(svgEl('feBlend', {
      in: 'redDisplaced',
      in2: 'greenDisplaced',
      mode: 'screen',
      result: 'rgCombined'
    }));
    filter.appendChild(svgEl('feBlend', {
      in: 'rgCombined',
      in2: 'blueDisplaced',
      mode: 'screen',
      result: 'rgbCombined'
    }));

    // Step 6: Saturation and brightness adjustment (vibrant Apple tint)
    const satMatrix = [
      cfg.saturation, 0, 0, 0, (cfg.brightness - 1) * 0.5,
      0, cfg.saturation, 0, 0, (cfg.brightness - 1) * 0.5,
      0, 0, cfg.saturation, 0, (cfg.brightness - 1) * 0.5,
      0, 0, 0, 1, 0
    ].join(' ');

    filter.appendChild(svgEl('feColorMatrix', {
      in: 'rgbCombined',
      type: 'matrix',
      values: satMatrix,
      result: 'tinted'
    }));

    // Step 7: Composite within the source graphic's alpha mask
    filter.appendChild(svgEl('feComposite', {
      in: 'tinted',
      in2: 'SourceGraphic',
      operator: 'in',
      result: 'masked'
    }));

    // Step 8: Final merge render
    const feMerge = svgEl('feMerge');
    feMerge.appendChild(svgEl('feMergeNode', { in: 'masked' }));
    filter.appendChild(feMerge);

    defs.appendChild(filter);

    // ── FILTER 2: Gooey liquid blob filter (for buttons) ──
    // Coexist with the existing gooey filter from fx.js
    if (!document.getElementById(GOOEY_FILTER_ID)) {
      const gooeyFilter = svgEl('filter', { id: GOOEY_FILTER_ID });
      gooeyFilter.appendChild(svgEl('feGaussianBlur', {
        in: 'SourceGraphic',
        stdDeviation: '6',
        result: 'blur'
      }));
      gooeyFilter.appendChild(svgEl('feColorMatrix', {
        in: 'blur',
        mode: 'matrix',
        values: '1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 19 -9',
        result: 'goo'
      }));
      gooeyFilter.appendChild(svgEl('feComposite', {
        in: 'SourceGraphic',
        in2: 'goo',
        operator: 'atop'
      }));
      defs.appendChild(gooeyFilter);
    }

    _svgEl.appendChild(defs);
    document.body.appendChild(_svgEl);
    _mounted = true;

    // Run feature detection after mount
    detectSupport();
  }

  /**
   * Update the displacement map URI in an already-mounted filter.
   * This allows regenerating the map on resize without remounting.
   */
  function updateDisplacementMap(newURI) {
    if (!_mounted || !_svgEl) return;
    _displacementMapURI = newURI;

    const feImage = _svgEl.querySelector(`#${FILTER_ID} feImage`);
    if (feImage) {
      feImage.setAttribute('href', newURI);
      feImage.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', newURI);
    }
  }

  /**
   * Remove the SVG element from the DOM (cleanup).
   */
  function unmount() {
    if (_svgEl && _svgEl.parentNode) {
      _svgEl.parentNode.removeChild(_svgEl);
    }
    _mounted = false;
    _svgEl = null;
  }

  /**
   * Get the CSS url() reference for the main filter.
   */
  function getFilterURL() {
    return `url(#${FILTER_ID})`;
  }

  /**
   * Check if SVG-referenced backdrop-filter is supported.
   */
  function isSupported() {
    if (_supported === null) detectSupport();
    return _supported;
  }

  // Public API
  return {
    mount,
    unmount,
    updateDisplacementMap,
    getFilterURL,
    isSupported,
    detectSupport,
    FILTER_ID,
    SVG_CONTAINER_ID
  };
})();

// Expose globally
window.LiquidGlassFilters = LiquidGlassFilters;
