/* ============================================================
   CampusStay — Premium GSAP & ScrollTrigger FX Engine
   
   Provides immersive scroll storytelling, parallax, spring-eased
   3D tilt, magnetic buttons, text animations, and micro-interactions
   mimicking Apple, Stripe, and Linear interfaces.
   
   Requires: GSAP & ScrollTrigger
   ============================================================ */

(function () {
  'use strict';

  // Check user preferences for animations
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let refreshGlassReflections = null;

  /* ---------- Scroll Progress Bar ---------- */
  const injectScrollProgress = () => {
    const bar = document.createElement('div');
    bar.className = 'scroll-progress';
    document.body.appendChild(bar);
    
    gsap.to(bar, {
      scaleX: 1,
      transformOrigin: 'left center',
      ease: 'none',
      scrollTrigger: {
        trigger: document.documentElement,
        start: 'top top',
        end: 'bottom bottom',
        scrub: true
      }
    });
  };

  /* ---------- Page transitions ---------- */
  const initPageTransitions = () => {
    if (document.querySelector('.page-veil')) return;
    const veil = document.createElement('div');
    veil.className = 'page-veil';
    // SAFETY: veil starts hidden — it only shows during page exit
    veil.style.opacity = '0';
    veil.style.pointerEvents = 'none';
    document.body.appendChild(veil);

    // Helper to always reset the veil state (used by both pageshow and safety net)
    const resetVeil = () => {
      veil.style.opacity = '0';
      veil.style.pointerEvents = 'none';
      veil.style.visibility = 'hidden';
      veil.style.display = 'none';
      // Also remove duplicate transition classes from main.js
      document.body.classList.remove('cs-leaving', 'page-exit', 'page-enter');
      document.body.style.opacity = '';
      document.body.style.pointerEvents = '';
      document.body.style.visibility = '';
    };

    // FIX: Always reset on pageshow — bfcache OR first load OR back/forward
    window.addEventListener('pageshow', resetVeil);
    // Also reset immediately on init as a safety net
    resetVeil();

    const sameOrigin = (a) => a.host === location.host;

    document.addEventListener('click', (e) => {
      const a = e.target.closest('a');
      if (!a || !a.href || a.target === '_blank' || a.hasAttribute('download')) return;
      const rawHref = a.getAttribute('href') || '';
      if (rawHref.startsWith('#') || rawHref.startsWith('javascript:') || rawHref.startsWith('tel:') || rawHref.startsWith('mailto:')) return;

      let url;
      try {
        url = new URL(a.href, location.origin);
      } catch {
        return;
      }
      if (!sameOrigin(url)) return;
      if (url.pathname === location.pathname && url.hash) return;
      if (url.pathname === location.pathname && url.search === location.search) return;

      e.preventDefault();
      veil.style.visibility = 'visible';
      veil.style.display = '';
      veil.style.pointerEvents = 'all';

      try {
        gsap.to(veil, {
          opacity: 1,
          duration: 0.35,
          ease: 'power2.inOut',
          onComplete: () => {
            document.body.classList.add('cs-leaving');
            // Use replace for back-button safety; preserve return path
            try { sessionStorage.setItem('cs:lastNav', Date.now().toString()); } catch {}
            location.href = a.href;
          }
        });
      } catch (err) {
        // Fallback: if GSAP fails, navigate immediately
        console.warn('[FX] GSAP transition failed, navigating directly:', err);
        location.href = a.href;
      }
    });
  };

  if (reduce) {
    // Fallback simple preloader and page exit for reduced motion
    const pre = document.querySelector('.preloader');
    if (pre) {
      pre.classList.add('hide');
      setTimeout(() => {
        try { pre.remove(); } catch {}
      }, 300);
    }
    document.body.classList.add('cs-page-ready');
    return;
  }

  /* ---------- Immersive Hero Word Reveal ---------- */
  const initHeroTextReveal = () => {
    const target = document.querySelector('[data-words]');
    if (!target) return;

    const wrapWords = (node) => {
      node.childNodes.forEach((child) => {
        if (child.nodeType === Node.TEXT_NODE) {
          const text = child.textContent;
          if (!text.trim()) return;
          const frag = document.createDocumentFragment();
          
          text.split(/(\s+)/).forEach((token) => {
            if (!token.trim()) {
              frag.appendChild(document.createTextNode(token));
              return;
            }
            const span = document.createElement('span');
            span.className = 'reveal-word';
            span.textContent = token;
            frag.appendChild(span);
          });
          child.replaceWith(frag);
        } else if (child.nodeType === Node.ELEMENT_NODE && child.tagName !== 'BR') {
          wrapWords(child);
        }
      });
    };

    wrapWords(target);
    
    // GSAP fromTo: words default to visible in CSS; GSAP animates them from hidden
    gsap.fromTo(target.querySelectorAll('.reveal-word'), 
      {
        opacity: 0,
        y: 20,
        rotateX: -12,
        filter: 'blur(5px)'
      },
      {
        opacity: 1,
        y: 0,
        rotateX: 0,
        filter: 'blur(0px)',
        duration: 0.9,
        ease: 'power3.out',
        stagger: 0.04,
        delay: 0.15
      }
    );
  };

  /* ---------- Parallax Scroll Background & Images ---------- */
  const initParallaxScroll = () => {
    const cinemaImg = document.querySelector('.cinema-bg .ph');
    if (cinemaImg) {
      gsap.to(cinemaImg, {
        yPercent: 18,
        scale: 1.04,
        ease: 'none',
        scrollTrigger: {
          trigger: '.cinema-hero',
          start: 'top top',
          end: 'bottom top',
          scrub: true
        }
      });
    }

    document.querySelectorAll('[data-parallax]').forEach((el) => {
      if (el === cinemaImg) return;
      const speed = parseFloat(el.dataset.parallax) || 0.15;
      gsap.to(el, {
        y: () => -window.innerHeight * speed * 0.5,
        ease: 'none',
        scrollTrigger: {
          trigger: el,
          start: 'top bottom',
          end: 'bottom top',
          scrub: true
        }
      });
    });
  };

  /* ---------- Progressive Section Reveals ---------- */
  const initSectionScrollStories = () => {
    // SAFETY: sections start visible in CSS (opacity:1). GSAP animates
    // from a slightly reduced state — if GSAP fails, content stays readable.
    gsap.utils.toArray('section, .trust-strip').forEach((sec) => {
      if (sec.classList.contains('showcase') || sec.id === 'how' || sec.classList.contains('cs-scroll-managed')) return;

      gsap.from(sec, {
        opacity: 0.35,
        y: 20,
        duration: 0.75,
        ease: 'power3.out',
        clearProps: 'opacity,transform',
        scrollTrigger: {
          trigger: sec,
          start: 'top 88%',
          toggleActions: 'play none none none'
        }
      });
    });

    // Cascade Grid/Stagger reveals
    const grids = ['.cat-grid', '.listing-grid', '.steps-grid', '.testi-grid', '.college-chips', '.dash-grid', '.faq-list'];
    
    grids.forEach((selector) => {
      const grid = document.querySelector(selector);
      if (!grid) return;

      gsap.from(grid.children, {
        opacity: 0.2,
        y: 20,
        scale: 0.98,
        duration: 0.7,
        ease: 'power3.out',
        stagger: 0.08,
        clearProps: 'opacity,transform',
        scrollTrigger: {
          trigger: grid,
          start: 'top 85%',
          toggleActions: 'play none none none'
        }
      });
    });
  };

  /* ---------- Dynamic Specular Highlights Travelling on Scroll ---------- */
  const initScrollGlassSpecularReflections = () => {
    if (refreshGlassReflections) {
      refreshGlassReflections();
      return;
    }
    const active = new Set();
    const observed = new WeakSet();
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isTouch = matchMedia('(pointer: coarse)').matches;
    if (reduced || isTouch) return;
    let raf = 0;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(({ target, isIntersecting }) => {
        if (isIntersecting) active.add(target);
        else {
          active.delete(target);
          target.style.setProperty('--lg-scroll-opacity', '0');
        }
      });
    }, { rootMargin: '15% 0px' });

    const observe = () => {
      document.querySelectorAll('.liquid-glass-surface').forEach((el) => {
        if (!observed.has(el)) {
          observed.add(el);
          observer.observe(el);
        }
      });
    };

    const paint = () => {
      raf = 0;
      if (reduced) return;
      const viewport = window.innerHeight || 1;
      active.forEach((el) => {
        const rect = el.getBoundingClientRect();
        const progress = Math.max(0, Math.min(1, (viewport - rect.top) / (viewport + rect.height)));
        el.style.setProperty('--lg-reflect-y', `${(-28 + progress * 150).toFixed(1)}%`);
        el.style.setProperty('--lg-reflect-x', `${(35 + progress * 30).toFixed(1)}%`);
        el.style.setProperty('--lg-scroll-opacity', (0.10 + Math.sin(progress * Math.PI) * 0.12).toFixed(2));
      });
    };

    const requestPaint = () => {
      if (!raf) raf = requestAnimationFrame(paint);
    };

    observe();
    let mutTimer = 0;
    new MutationObserver(() => {
      clearTimeout(mutTimer);
      mutTimer = setTimeout(() => { observe(); requestPaint(); }, 100);
    }).observe(document.body, { childList: true, subtree: true });
    addEventListener('scroll', requestPaint, { passive: true });
    addEventListener('resize', requestPaint, { passive: true });
    refreshGlassReflections = () => { observe(); requestPaint(); };
    requestPaint();
  };

  /* ---------- Navbar compact morph on Scroll ---------- */
  const initNavbarMorph = () => {
    const nav = document.querySelector('.navbar');
    if (!nav) return;

    ScrollTrigger.create({
      start: 'top -30px',
      onEnter: () => nav.classList.add('scrolled'),
      onLeaveBack: () => nav.classList.remove('scrolled')
    });
  };

  /* ---------- 3D Elastic Tilt Cards ---------- */
  const init3DSpringTilt = () => {
    if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;

    document.querySelectorAll('.tilt, .card-3d').forEach((card) => {
      if (card.dataset.gsapTiltBound) return;
      card.dataset.gsapTiltBound = 'true';
      const MAX_ROTATION = 6;

      card.addEventListener('pointermove', (e) => {
        const rect = card.getBoundingClientRect();
        const px = (e.clientX - rect.left) / rect.width - 0.5;
        const py = (e.clientY - rect.top) / rect.height - 0.5;
        
        gsap.to(card, {
          rotateX: -py * MAX_ROTATION,
          rotateY: px * MAX_ROTATION,
          translateZ: 8,
          duration: 0.4,
          ease: 'power2.out',
          overwrite: 'auto'
        });

        card.style.setProperty('--mx', (px + 0.5) * 100 + '%');
        card.style.setProperty('--my', (py + 0.5) * 100 + '%');
      });

      card.addEventListener('pointerleave', () => {
        gsap.to(card, {
          rotateX: 0,
          rotateY: 0,
          translateZ: 0,
          duration: 0.6,
          ease: 'power2.out',
          overwrite: 'auto'
        });
        card.style.removeProperty('--mx');
        card.style.removeProperty('--my');
      });
    });
  };

  /* ---------- Spring Magnetic Buttons ---------- */
  const initMagneticButtons = () => {
    const buttons = document.querySelectorAll('.btn, button.btn-primary, button.btn-ghost, button.btn-call, button.btn-wa, .auth-submit');
    
    buttons.forEach((btn) => {
      if (btn.dataset.magneticBound) return;
      btn.dataset.magneticBound = 'true';
      if (
        btn.classList.contains('showcase-dot') ||
        btn.classList.contains('lightbox-close') ||
        btn.classList.contains('lightbox-prev') ||
        btn.classList.contains('lightbox-next') ||
        btn.classList.contains('del-btn') ||
        btn.classList.contains('remove-btn') ||
        btn.hasAttribute('data-dot') ||
        (btn.offsetWidth > 0 && btn.offsetWidth < 24)
      ) return;

      if (!btn.dataset.magneticInit) {
        btn.dataset.magneticInit = 'true';
        if (!btn.querySelector('.btn-label')) {
          btn.classList.add('liquid-glass-btn');
          const label = document.createElement('span');
          label.className = 'btn-label';
          while (btn.firstChild) label.appendChild(btn.firstChild);
          btn.appendChild(label);

          const reflection = document.createElement('span');
          reflection.className = 'btn-reflection';
          btn.appendChild(reflection);

          const blobsContainer = document.createElement('div');
          blobsContainer.className = 'btn-blobs-container';
          for (let i = 1; i <= 4; i++) {
            const blob = document.createElement('div');
            blob.className = `btn-blob blob-${i}`;
            blobsContainer.appendChild(blob);
          }
          btn.appendChild(blobsContainer);
        }
      }

      if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;

      btn.addEventListener('mousemove', (e) => {
        const rect = btn.getBoundingClientRect();
        const pullFactorX = btn.classList.contains('btn-sm') ? 0.06 : 0.09;
        const pullFactorY = btn.classList.contains('btn-sm') ? 0.07 : 0.1;
        const mx = e.clientX - rect.left - rect.width / 2;
        const my = e.clientY - rect.top - rect.height / 2;

        gsap.to(btn, {
          x: mx * pullFactorX,
          y: my * pullFactorY,
          scale: 1.012,
          duration: 0.3,
          ease: 'power3.out',
          overwrite: 'auto'
        });

        const sx = ((e.clientX - rect.left) / rect.width) * 100;
        const sy = ((e.clientY - rect.top) / rect.height) * 100;
        btn.style.setProperty('--btn-mx', sx.toFixed(1) + '%');
        btn.style.setProperty('--btn-my', sy.toFixed(1) + '%');
      });

      btn.addEventListener('mouseleave', () => {
        gsap.to(btn, { x: 0, y: 0, scale: 1, duration: 0.6, ease: 'power2.out', overwrite: 'auto' });
      });

      btn.addEventListener('pointerdown', (e) => {
        const rect = btn.getBoundingClientRect();
        const ripple = document.createElement('div');
        ripple.className = 'btn-ripple';
        ripple.style.left = `${e.clientX - rect.left}px`;
        ripple.style.top = `${e.clientY - rect.top}px`;
        const container = btn.querySelector('.btn-blobs-container');
        if (container) {
          container.appendChild(ripple);
          setTimeout(() => { ripple.classList.add('fade-out'); setTimeout(() => ripple.remove(), 600); }, 450);
        }
      });
    });
  };

  /* ---------- Apple Scroll Storytelling (How section) ---------- */
  const initHowScrollStory = () => {
    const howSection = document.getElementById('how');
    if (!howSection) return;
    const steps = howSection.querySelectorAll('.step');
    if (!steps.length) return;

    if (window.innerWidth < 1025) {
      steps.forEach((step) => gsap.set(step, { opacity: 1, scale: 1 }));
      return;
    }

    gsap.fromTo(steps,
      { opacity: 0.3, scale: 0.96, filter: 'blur(3px)' },
      {
        opacity: 1,
        scale: 1.0,
        filter: 'blur(0px)',
        duration: 0.7,
        ease: 'power2.out',
        stagger: { amount: 1.2, from: 'start' },
        scrollTrigger: {
          trigger: howSection,
          start: 'top 50%',
          end: 'bottom 80%',
          scrub: true
        }
      }
    );
  };

  /* ---------- Search Input Focus Zoom & Highlight ---------- */
  const initSearchFocus = () => {
    const searchCard = document.querySelector('.search-card');
    const searchInput = document.querySelector('#college-input');
    if (searchCard && searchInput) {
      searchInput.addEventListener('focus', () => {
        gsap.to(searchCard, {
          scale: 1.025,
          boxShadow: 'var(--lg-inset-light), 0 35px 95px -20px rgba(99, 102, 241, 0.28)',
          duration: 0.55,
          ease: 'power3.out'
        });
      });
      searchInput.addEventListener('blur', () => {
        gsap.to(searchCard, {
          scale: 1.0,
          boxShadow: 'var(--lg-inset-light), var(--lg-shadow-light)',
          duration: 0.55,
          ease: 'power3.out'
        });
      });
    }
  };

  /* ---------- Cursor Glow tracking ---------- */
  const initCursorGlow = () => {
    if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    const cursor = document.querySelector('.cursor-glow');
    if (!cursor) return;

    let cx = 0, cy = 0;
    let tx = 0, ty = 0;
    let visible = false;
    let raf = 0;

    const tick = () => {
      if (!visible) { raf = 0; return; }
      cx += (tx - cx) * 0.095;
      cy += (ty - cy) * 0.095;
      cursor.style.left = cx + 'px';
      cursor.style.top = cy + 'px';
      raf = requestAnimationFrame(tick);
    };

    const targetList = 'a, button, .btn, .cat-card, .listing-card, .chip, .step, .testi, .dash-card, .faq-item, input, select, textarea';

    document.addEventListener('pointermove', (e) => {
      tx = e.clientX;
      ty = e.clientY;
      if (!visible) {
        visible = true;
        if (!raf) raf = requestAnimationFrame(tick);
        gsap.to(cursor, { opacity: 1, duration: 0.35 });
      }
      const active = e.target.closest(targetList);
      cursor.classList.toggle('glow-active', !!active);
    }, { passive: true });

    document.addEventListener('pointerleave', () => {
      visible = false;
      gsap.to(cursor, { opacity: 0, duration: 0.35 });
    }, { passive: true });
  };

  /* ---------- Preloader complete ---------- */
  const initPreloader = () => {
    const pre = document.querySelector('.preloader');
    if (!pre) {
      document.body.classList.add('cs-page-ready');
      return;
    }

    // Skip if main.js already handled the preloader
    if (pre.classList.contains('hide') || pre._handled) {
      document.body.classList.add('cs-page-ready');
      return;
    }
    pre._handled = true;

    let returning = false;
    try {
      returning = localStorage.getItem('cs:loader-seen') === 'true';
      localStorage.setItem('cs:loader-seen', 'true');
    } catch {
      // Private browsing can block storage
    }
    pre.classList.toggle('preloader--returning', returning);
    const duration = returning ? 100 : 950;
    let hidden = false;

    const hide = () => {
      if (hidden) return;
      hidden = true;
      gsap.to(pre, {
        opacity: 0,
        filter: 'blur(4px)',
        duration: 0.45,
        ease: 'power2.out',
        onComplete: () => {
          try { pre.remove(); } catch {}
          document.body.classList.add('cs-page-ready');
        }
      });
    };

    if (document.readyState === 'complete') setTimeout(hide, duration);
    else window.addEventListener('load', () => setTimeout(hide, duration), { once: true });
    // SAFETY: hard fallback — preloader MUST go away within 2.2 seconds max
    setTimeout(hide, Math.min(duration + 700, 2200));
  };

  /* ---------- Initialize Everything ---------- */
  const init = () => {
    if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') {
      gsap.registerPlugin(ScrollTrigger);
    } else {
      console.warn('[FX] GSAP/ScrollTrigger not loaded. Animations falling back.');
      document.body.classList.add('cs-page-ready');
      return;
    }

    injectScrollProgress();
    initPageTransitions();
    initHeroTextReveal();
    initParallaxScroll();
    initSectionScrollStories();
    initScrollGlassSpecularReflections();
    initNavbarMorph();
    init3DSpringTilt();
    initMagneticButtons();
    initSearchFocus();
    initCursorGlow();
    initPreloader();

    // Rebind tilt/magnetics when new content dynamically renders
    const baseBind = CS._bindTilt;
    CS._bindTilt = () => {
      if (baseBind) baseBind();
      init3DSpringTilt();
      initMagneticButtons();
      initScrollGlassSpecularReflections();
    };
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
