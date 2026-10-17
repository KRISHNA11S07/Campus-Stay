/* CampusStay accommodation explorer — CSS owns the animation; this only
   supplies listing images and provides a clear touch equivalent for hover. */
(function () {
  'use strict';

  /* Curated fallback images per category in case LISTINGS data is empty */
  var FALLBACK_IMAGES = {
    room: 'https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?q=80&w=1100&auto=format&fit=crop',
    pg: 'https://images.unsplash.com/photo-1555854877-bab0e564b8d5?q=80&w=1100&auto=format&fit=crop',
    hostel: 'https://images.unsplash.com/photo-1555854877-bab0e564b8d5?q=80&w=1100&auto=format&fit=crop',
    flat: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?q=80&w=1100&auto=format&fit=crop'
  };

  var imageFor = function (type) {
    /* Prefer a real listing image if available */
    if (Array.isArray(window.LISTINGS)) {
      var match = window.LISTINGS.find(function (listing) { return listing.type === type; });
      if (match && match.images && match.images[0]) return match.images[0];
    }
    return FALLBACK_IMAGES[type] || '';
  };

  function initExplorer() {
    var panels = Array.from(document.querySelectorAll('.explorer-panel[data-category]'));
    if (!panels.length) return;

    /* Assign images to each panel */
    panels.forEach(function (panel) {
      var image = panel.querySelector('[data-category-image]');
      var source = imageFor(panel.dataset.category);
      if (image && source) {
        image.src = source;
      }

      /* Touch interaction: first tap expands, second navigates */
      panel.addEventListener('click', function (event) {
        if (!matchMedia('(pointer: coarse)').matches) return;
        if (!panel.classList.contains('is-expanded')) {
          event.preventDefault();
          panels.forEach(function (item) { item.classList.remove('is-expanded'); });
          panel.classList.add('is-expanded');
        }
        /* If already expanded, the default navigation proceeds */
      });
    });

    /* Clicking outside any panel collapses all */
    document.addEventListener('click', function (event) {
      if (!event.target.closest('.explorer-panel')) {
        panels.forEach(function (panel) { panel.classList.remove('is-expanded'); });
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initExplorer, { once: true });
  } else {
    initExplorer();
  }
})();
