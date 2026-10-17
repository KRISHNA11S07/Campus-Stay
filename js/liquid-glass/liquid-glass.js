/* ============================================================
   CampusStay — Liquid Glass Engine (Main Module)
   
   Orchestrates the displacement map generator and SVG filter
   system to apply Apple's Liquid Glass effect to any element
   with the `.glass` class.
   
   Usage:
     LiquidGlass.init();           // Auto-upgrades all .glass elements
     LiquidGlass.apply(element);   // Manually apply to one element
   
   Features:
   - Auto-detects and upgrades all .glass elements on page load
   - MutationObserver for dynamically added elements
   - ResizeObserver for responsive displacement map updates
   - Pointer tracking for specular highlight
   - Dark/light mode adaptive tinting
   - Performance-optimized with RAF batching and will-change
   - Graceful fallback for unsupported browsers
   ============================================================ */

const LiquidGlass = (() => {
  'use strict';

  /* ── State ── */
  let _initialized = false;
  let _displacementURI = null;
  let _isMobile = false;
  let _observer = null;       // MutationObserver
  let _themeObserver = null;
  let _rafId = 0;
  let _pointerX = 0;
  let _pointerY = 0;
  let _activeGlass = null;    // Currently hovered glass element
  let _upgradedElements = new WeakSet(); // Track upgraded elements

  /* ── Configuration ── */
  const CONFIG = {
    // Displacement map settings
    displacement: {
      size: 192,
      radius: 0.42,
      intensity: 0.28,
      edgeSoftness: 0.25,
      chromaticShift: 0.012
    },
    // Mobile overrides
    mobile: {
      size: 128,
      intensity: 0.22,
      chromaticShift: 0.006
    },
    // SVG filter settings
    filter: {
      blurAmount: 0.55,
      displacementScale: 14,
      saturation: 1.1,
      brightness: 1.04
    },
    // Specular highlight
    specular: {
      size: 180,   // px radius of the light spot
      opacity: 0.22 // max opacity of the specular highlight
    },
    // Performance
    resizeDebounce: 200 // ms
  };

  /* ── Selector for all glass elements ── */
  const GLASS_SELECTOR = [
    '.glass',
    '.search-card',
    '.navbar',
    '.mobile-menu',
    '.stats-band',
    '.auth-card',
    '.filters',
    '.cat-card',
    '.step',
    '.testi',
    '.faq-item',
    '.dash-card',
    '.listing-card',
    '.float-card',
    '.price-box'
  ].join(',');

  /* ── Helpers ── */

  /**
   * Debounce function to limit how often a function is called.
   */
  function debounce(fn, ms) {
    let timer;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), ms);
    };
  }

  /**
   * Detect if we're on a mobile/low-power device.
   */
  function checkMobile() {
    _isMobile = window.innerWidth < 768 ||
      matchMedia('(hover: none)').matches ||
      navigator.maxTouchPoints > 1;
  }

  /**
   * Get the computed border-radius of an element (in px).
   */
  function getBorderRadius(el) {
    const computed = getComputedStyle(el);
    const br = parseInt(computed.borderRadius, 10);
    return isNaN(br) ? 0 : br;
  }

  /* ── Core Logic ── */

  /**
   * Generate the displacement map and mount the SVG filter.
   */
  function setupFilter() {
    checkMobile();

    // Generate displacement map
    const mapOpts = _isMobile
      ? Object.assign({}, CONFIG.displacement, CONFIG.mobile)
      : CONFIG.displacement;

    _displacementURI = LiquidGlassDisplacement.generate(mapOpts);

    // Mount the SVG filter (idempotent — safe to call multiple times)
    LiquidGlassFilters.mount(_displacementURI, CONFIG.filter);
  }

  /**
   * Upgrade a single element to use the Liquid Glass effect.
   *
   * This adds the CSS class that triggers the SVG backdrop-filter,
   * and sets up the specular highlight pseudo-element tracking.
   */
  function apply(el) {
    if (!el || _upgradedElements.has(el)) return;
    _upgradedElements.add(el);

    // Add the liquid-glass CSS class
    el.classList.add('liquid-glass-surface');

    // Set initial CSS custom properties for the specular highlight
    el.style.setProperty('--lg-spec-x', '50%');
    el.style.setProperty('--lg-spec-y', '0%');
    el.style.setProperty('--lg-spec-opacity', '0');

    // Scroll-linked reflections are set by fx.js. Keeping their defaults here
    // lets dynamically-rendered cards enter without a visual pop.
    el.style.setProperty('--lg-scroll-opacity', '0');
    el.style.setProperty('--lg-reflect-x', '50%');
    el.style.setProperty('--lg-reflect-y', '-20%');
  }

  /**
   * Scan the DOM and upgrade all matching glass elements.
   */
  function upgradeAll() {
    document.querySelectorAll(GLASS_SELECTOR).forEach(apply);
  }

  /* ── Pointer Tracking ── */

  /**
   * Track pointer position for the specular highlight effect.
   * Uses RAF batching to avoid layout thrashing.
   */
  function onPointerMove(e) {
    _pointerX = e.clientX;
    _pointerY = e.clientY;

    const target = e.target.closest('.liquid-glass-surface');

    if (target !== _activeGlass) {
      // Clear previous element's highlight
      if (_activeGlass) {
        _activeGlass.style.setProperty('--lg-spec-opacity', '0');
      }
      _activeGlass = target;
    }

    if (_activeGlass && !_rafId) {
      _rafId = requestAnimationFrame(paintSpecular);
    }
  }

  /**
   * Paint the specular highlight on the active glass element.
   * Runs inside requestAnimationFrame for smooth 60fps updates.
   */
  function paintSpecular() {
    _rafId = 0;
    if (!_activeGlass) return;

    const rect = _activeGlass.getBoundingClientRect();
    const x = ((_pointerX - rect.left) / rect.width) * 100;
    const y = ((_pointerY - rect.top) / rect.height) * 100;

    // Calculate angle from the element's center to the pointer to rotate the edge light rim dynamically
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const angle = Math.atan2(_pointerY - cy, _pointerX - cx) * (180 / Math.PI);

    // Only show highlight if pointer is within bounds
    if (x >= -10 && x <= 110 && y >= -10 && y <= 110) {
      _activeGlass.style.setProperty('--lg-spec-x', x.toFixed(1) + '%');
      _activeGlass.style.setProperty('--lg-spec-y', y.toFixed(1) + '%');
      _activeGlass.style.setProperty('--lg-light-angle', angle.toFixed(1) + 'deg');
      _activeGlass.style.setProperty('--lg-spec-opacity', '1');
    } else {
      _activeGlass.style.setProperty('--lg-spec-opacity', '0');
    }
  }

  function onPointerLeave() {
    if (_activeGlass) {
      _activeGlass.style.setProperty('--lg-spec-opacity', '0');
      _activeGlass = null;
    }
  }

  /* ── Observers ── */

  /**
   * MutationObserver: auto-upgrade dynamically added elements.
   * This catches listing cards rendered by JS, auth state changes, etc.
   */
  function startMutationObserver() {
    if (_observer) return;

    _observer = new MutationObserver((mutations) => {
      let shouldScan = false;
      for (const m of mutations) {
        if (m.addedNodes.length > 0) {
          shouldScan = true;
          break;
        }
      }
      if (shouldScan) {
        // Batch the upgrade in the next microtask
        queueMicrotask(upgradeAll);
      }
    });

    _observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  /* ── Theme Observer ── */

  /**
   * Watch for dark/light mode changes and update glass tinting.
   * Uses a MutationObserver on the <html> element's data-theme attribute.
   */
  function startThemeObserver() {
    const htmlEl = document.documentElement;

    _themeObserver = new MutationObserver(() => {
      const theme = htmlEl.dataset.theme || 'light';
      document.body.classList.toggle('liquid-glass-dark', theme === 'dark');
    });

    _themeObserver.observe(htmlEl, {
      attributes: true,
      attributeFilter: ['data-theme']
    });

    // Set initial state
    const currentTheme = htmlEl.dataset.theme || 'light';
    document.body.classList.toggle('liquid-glass-dark', currentTheme === 'dark');
  }

  /* ── Window Resize Handler ── */

  function onWindowResize() {
    const wasMobile = _isMobile;
    checkMobile();

    // Regenerate displacement map if mobile state changed
    if (wasMobile !== _isMobile) {
      const mapOpts = _isMobile
        ? Object.assign({}, CONFIG.displacement, CONFIG.mobile)
        : CONFIG.displacement;

      _displacementURI = LiquidGlassDisplacement.generate(mapOpts);
      LiquidGlassFilters.updateDisplacementMap(_displacementURI);
    }
  }

  /* ── Public API ── */

  /**
   * Initialize the entire Liquid Glass system.
   * Call once on page load. Safe to call multiple times (idempotent).
   */
  function init() {
    if (_initialized) return;
    _initialized = true;

    // 1. Setup the SVG filter system
    setupFilter();

    // 2. Feature detection
    const supported = LiquidGlassFilters.isSupported();

    // 3. Start observers
    startMutationObserver();
    startThemeObserver();

    // 4. Upgrade all existing glass elements
    upgradeAll();

    // 5. Pointer tracking for specular highlights (desktop only)
    if (!_isMobile) {
      document.addEventListener('pointermove', onPointerMove, { passive: true });
      document.addEventListener('pointerleave', onPointerLeave, { passive: true });
    }

    // 6. Window resize handler
    window.addEventListener('resize', debounce(onWindowResize, 250), { passive: true });

    // Log status
    if (supported) {
      console.log('[LiquidGlass] ✓ SVG displacement filter active');
    } else {
      console.log('[LiquidGlass] ✗ SVG backdrop-filter not supported — using blur fallback');
    }
  }

  /**
   * Force a re-scan of the DOM and upgrade any new glass elements.
   * Useful after dynamic content injection.
   */
  function refresh() {
    upgradeAll();
  }

  /**
   * Cleanup — remove all event listeners and observers.
   */
  function destroy() {
    if (_observer) { _observer.disconnect(); _observer = null; }
    if (_themeObserver) { _themeObserver.disconnect(); _themeObserver = null; }
    document.removeEventListener('pointermove', onPointerMove);
    document.removeEventListener('pointerleave', onPointerLeave);
    window.removeEventListener('resize', onWindowResize);
    LiquidGlassFilters.unmount();
    _initialized = false;
    _upgradedElements = new WeakSet();
  }

  return {
    init,
    apply,
    refresh,
    destroy,
    get isSupported() { return LiquidGlassFilters.isSupported(); }
  };
})();

// Expose globally
window.LiquidGlass = LiquidGlass;

/* ── Auto-Initialize ──
   Initialize as soon as the DOM is ready.
   If the DOM is already loaded, init immediately. */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => LiquidGlass.init());
} else {
  LiquidGlass.init();
}
