/* ============================================================
   CampusStay — shared core: theme, nav, animations, helpers
   ============================================================ */
const CS = {
  /* ---------- storage helpers ---------- */
  store(key, val) {
    try {
      localStorage.setItem("cs:" + key, JSON.stringify(val));
    } catch (e) {
      console.warn("[CS] LocalStorage write failed", e);
    }
  },
  read(key, fallback = null) {
    try {
      const v = localStorage.getItem("cs:" + key);
      return v ? JSON.parse(v) : fallback;
    } catch {
      return fallback;
    }
  },

  /* ---------- theme ---------- */
  initTheme() {
    const saved = CS.read("theme", "light");
    document.documentElement.dataset.theme = saved;
    const updateIcon = (b) => {
      const label = b.querySelector('.btn-label') || b;
      label.textContent = saved === "dark" ? "☀️" : "🌙";
    };
    document.querySelectorAll("[data-theme-toggle]").forEach((b) => {
      updateIcon(b);
      b.addEventListener("click", () => {
        const current = document.documentElement.dataset.theme;
        const next = current === "dark" ? "light" : "dark";
        document.documentElement.dataset.theme = next;
        CS.store("theme", next);
        document.querySelectorAll("[data-theme-toggle]").forEach((x) => {
          const l = x.querySelector('.btn-label') || x;
          l.textContent = next === "dark" ? "☀️" : "🌙";
        });
      });
    });
  },

  /* ---------- navbar + mobile menu ---------- */
  initNav() {
    const nav = document.querySelector('.navbar');
    if (nav) {
      let ticking = false;
      const updateNav = () => {
        nav.classList.toggle('scrolled', window.scrollY > 15);
        ticking = false;
      };
      window.addEventListener('scroll', () => {
        if (!ticking) { requestAnimationFrame(updateNav); ticking = true; }
      }, { passive: true });
      updateNav();
    }

    const burger = document.querySelector('.hamburger');
    const mobileMenu = document.querySelector('.mobile-menu');
    if (burger && mobileMenu) {
      burger.addEventListener('click', () => {
        const open = mobileMenu.classList.toggle('open');
        burger.setAttribute('aria-expanded', String(open));
      });
      mobileMenu.addEventListener('click', (event) => {
        if (event.target.closest('a')) mobileMenu.classList.remove('open');
      });
    }

    const initials = (name = '') => name.trim().split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase() || 'C';
    const escapeHTML = (value = '') => String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' }[char]));

    const renderRoleLinks = (user) => {
      // Keep the primary information architecture stable after sign-in. Only
      // the dashboard destination changes with the verified database role.
      const dashboard = user.role === 'owner' ? 'owner-dashboard.html' : 'matches.html';
      const links = [
        ['index.html#explore', 'Explore'],
        ['index.html#showcase', 'Showcase'],
        ['index.html#how', 'How it works'],
        [user.role === 'owner' ? 'my-listings.html' : 'saved.html', 'Wishlist'],
        [dashboard, 'Dashboard']
      ];
      document.querySelectorAll('.navbar .nav-links').forEach((container) => {
        container.innerHTML = links.map(([href, label]) => `<a href="${href}">${label}</a>`).join('');
      });
      document.querySelectorAll('.mobile-menu').forEach((container) => {
        const existingFooter = container.querySelector('.mobile-menu-footer');
        container.innerHTML = links.map(([href, label]) => `<a href="${href}">${label}</a>`).join('')
          + '<a href="profile.html" class="btn btn-primary" data-auth-cta>Account</a>';
        if (existingFooter) container.appendChild(existingFooter);
      });
    };

    const mountUserMenu = (user) => {
      renderRoleLinks(user);
      document.querySelectorAll('[data-auth-cta]').forEach((el) => {
        if (el.dataset.userMenuMounted === 'true') return;
        const firstName = (user.name || 'Member').trim().split(/\s+/)[0];
        const avatar = user.avatarUrl
          ? `<img src="${escapeHTML(user.avatarUrl)}" alt="">`
          : escapeHTML(initials(user.name));
        const isOwner = user.role === 'owner';
        const routes = [
          ['profile.html', 'My profile'],
          [isOwner ? 'settings.html' : 'preferences.html', isOwner ? 'Account preferences' : 'My preferences'],
          [isOwner ? 'my-listings.html' : 'saved.html', isOwner ? 'My listings' : 'Saved rooms'],
          ['notifications.html', 'Notifications'],
          ['settings.html', 'Settings'],
          ['help.html', 'Help & support']
        ];
        const wrap = document.createElement('div');
        wrap.className = 'user-menu-wrap';
        wrap.dataset.userMenuMounted = 'true';
        wrap.innerHTML = `
          <button class="user-menu-trigger" type="button" aria-label="Open account menu" aria-expanded="false" aria-haspopup="menu">
            <span class="user-menu-avatar">${avatar}</span><span class="user-menu-name">${escapeHTML(firstName)}</span>
          </button>
          <div class="user-dropdown" role="menu">
            <div class="user-dropdown-header">
              <span class="ud-avatar">${avatar}</span>
              <div class="ud-info"><b>Hi, ${escapeHTML(firstName)}</b><span>${isOwner ? 'Property owner' : 'Student'}</span></div>
            </div>
            ${routes.map(([href, label]) => `<a href="${href}" role="menuitem"><span class="dd-icon" aria-hidden="true">${label === 'Notifications' ? '◌' : '›'}</span>${label}</a>`).join('')}
            <hr><button class="dd-danger" type="button" data-logout><span class="dd-icon" aria-hidden="true">←</span>Log out</button>
          </div>`;
        el.replaceWith(wrap);

        const trigger = wrap.querySelector('.user-menu-trigger');
        const dropdown = wrap.querySelector('.user-dropdown');
        const close = () => {
          dropdown.classList.remove('open');
          trigger.setAttribute('aria-expanded', 'false');
        };
        trigger.addEventListener('click', (event) => {
          event.stopPropagation();
          const next = !dropdown.classList.contains('open');
          document.querySelectorAll('.user-dropdown.open').forEach((menu) => menu.classList.remove('open'));
          dropdown.classList.toggle('open', next);
          trigger.setAttribute('aria-expanded', String(next));
          if (next) dropdown.querySelector('a, button')?.focus();
        });
        dropdown.addEventListener('click', (event) => {
          if (event.target.closest('a')) close();
        });
        document.addEventListener('click', (event) => { if (!wrap.contains(event.target)) close(); });
        document.addEventListener('keydown', (event) => {
          if (event.key === 'Escape' && dropdown.classList.contains('open')) { close(); trigger.focus(); }
        });
        wrap.querySelector('[data-logout]').addEventListener('click', async () => {
          try { if (typeof signOut === 'function') await signOut(); } catch (error) { console.warn('[CampusStay] Sign out failed', error); }
          CS.toast('Signed out successfully.');
          window.setTimeout(() => { window.location.href = 'index.html'; }, 350);
        });
      });
    };

    // The persistent Supabase session, rather than browser storage, controls
    // what authenticated navigation is rendered.
    if (typeof getAuthContext === 'function') {
      const renderAuthenticatedState = async (session = null) => {
        const context = session
          ? { session, user: session.user, profile: await waitForProfile(session) }
          : await getAuthContext();
        const { profile, user } = context;
        if (profile && user) {
          mountUserMenu({
            name: profile.full_name || user.user_metadata?.full_name || 'Member',
            role: profile.role,
            avatarUrl: profile.avatar_url || user.user_metadata?.avatar_url || ''
          });
        }
        document.body.classList.remove('cs-auth-pending');
        document.body.classList.add('cs-auth-ready');
      };

      const restoreSignInButton = () => {
        // Remove any user menus and restore the Sign in link
        document.querySelectorAll('.user-menu-wrap').forEach((wrap) => {
          const link = document.createElement('a');
          link.href = 'auth.html';
          link.className = 'btn btn-primary btn-sm';
          link.dataset.authCta = '';
          link.textContent = 'Sign in';
          wrap.replaceWith(link);
        });
        // Also restore mobile menu auth CTAs
        document.querySelectorAll('.mobile-menu [data-auth-cta]').forEach((el) => {
          if (el.tagName === 'A') {
            el.href = 'auth.html';
            el.textContent = 'Sign in';
          }
        });
        document.body.classList.remove('cs-auth-pending');
        document.body.classList.add('cs-auth-ready');
      };

      // Try instant rendering from cached user data to avoid flicker
      const cached = CS.read('user');
      if (cached && cached.name) {
        mountUserMenu({
          name: cached.name,
          role: cached.role || 'student',
          avatarUrl: cached.avatarUrl || ''
        });
      }

      if (typeof isSupabaseConfigured !== 'function' || isSupabaseConfigured()) {
        if (!cached) document.body.classList.add('cs-auth-pending');
      }
      renderAuthenticatedState().catch(() => {
        if (!cached) restoreSignInButton();
        document.body.classList.remove('cs-auth-pending');
        document.body.classList.add('cs-auth-ready');
      });

      if (typeof onAuthStateChange === 'function') {
        onAuthStateChange((event, session) => {
          if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED' || event === 'INITIAL_SESSION') {
            if (session) {
              renderAuthenticatedState(session).catch(() => {});
            } else if (event === 'INITIAL_SESSION') {
              // No session on initial check — user is logged out
              restoreSignInButton();
            }
          }
          if (event === 'SIGNED_OUT') {
            clearAuthenticatedUserCache();
            restoreSignInButton();
          }
        });
      }
    }
  },

  /* ---------- scroll reveal + count-up + stagger ---------- */
  initReveal() {
    // Reveal all items immediately if IntersectionObserver is unsupported
    if (!("IntersectionObserver" in window)) {
      document.querySelectorAll(".reveal, .reveal-group").forEach((el) => el.classList.add("in"));
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          const el = e.target;

          if (el.classList.contains("reveal-group")) {
            const children = Array.from(el.querySelectorAll(".reveal"));
            children.forEach((ch, i) => {
              ch.style.setProperty("--stagger", `${i * 0.12}`);
              setTimeout(() => ch.classList.add("in"), i * 80);
              io.unobserve(ch);
            });
            io.unobserve(el);
            return;
          }

          el.classList.add("in");
          io.unobserve(el);

          if (el.matches("[data-count]") || el.querySelector("[data-count]")) {
            const target = el.matches("[data-count]")
              ? el
              : el.querySelector("[data-count]");
            CS.countUp(target);
          }
        });
      },
      { threshold: 0.08, rootMargin: "0px 0px -20px 0px" },
    );

    document
      .querySelectorAll(".reveal, .reveal-group")
      .forEach((el) => io.observe(el));
  },

  /* ---------- Lenis smooth scroll ---------- */
  initSmoothScroll() {
    if (CS.lenis || CS._lenisInitialized) return;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const touch = matchMedia("(pointer: coarse)").matches;

    if (reduce || touch || !window.Lenis) {
      document.documentElement.style.scrollBehavior = reduce ? "auto" : "smooth";
      return;
    }

    try {
      const lenis = new window.Lenis({
        duration: 1.2,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        smoothWheel: true,
        syncTouch: false,
        wheelMultiplier: 0.95,
      });
      CS.lenis = lenis;
      CS._lenisInitialized = true;
      document.documentElement.style.scrollBehavior = "auto";

      if (window.ScrollTrigger) {
        lenis.on("scroll", window.ScrollTrigger.update);
      }

      if (window.gsap) {
        const tick = (time) => lenis.raf(time * 1000);
        window.gsap.ticker.add(tick);
        window.gsap.ticker.lagSmoothing(0);

        const onPageHide = () => {
          window.gsap.ticker.remove(tick);
          lenis.destroy();
          CS.lenis = null;
          CS._lenisInitialized = false;
        };
        window.addEventListener("pagehide", onPageHide, { once: true });
        return;
      }

      let rafId = 0;
      const animate = (time) => {
        lenis.raf(time);
        rafId = requestAnimationFrame(animate);
      };
      rafId = requestAnimationFrame(animate);
      window.addEventListener("pagehide", () => {
        cancelAnimationFrame(rafId);
        lenis.destroy();
        CS.lenis = null;
        CS._lenisInitialized = false;
      }, { once: true });
    } catch (err) {
      console.warn("[CS] Lenis init failed, using native scroll:", err);
    }
  },

  /* ---------- simple parallax for elements marked .parallax ---------- */
  initParallax() {
    const els = Array.from(document.querySelectorAll(".parallax"));
    if (!els.length) return;
    let raf = null;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        const scrollY = window.scrollY || window.pageYOffset;
        const vh = window.innerHeight;
        els.forEach((el) => {
          const r = el.getBoundingClientRect();
          const mid = r.top + r.height / 2;
          const pct = Math.max(-1, Math.min(1, (vh / 2 - mid) / (vh / 2)));
          const depth = Number(el.dataset.depth || el.dataset.parallax || 0.12);
          el.style.transform = `translate3d(0, ${-pct * depth * 100}px, 0)`;
          el.style.willChange = "transform, opacity";
        });
        raf = null;
      });
    };
    addEventListener("scroll", onScroll, { passive: true });
    addEventListener("resize", onScroll, { passive: true });
    onScroll();
  },

  /* ---------- 3D tilt microinteraction for .card-3d ---------- */
  init3DTilt() {
    const cards = document.querySelectorAll(".card-3d, .tilt");
    if (!cards.length) return;
    cards.forEach((c) => {
      const onMove = (e) => {
        const rect = c.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width - 0.5;
        const y = (e.clientY - rect.top) / rect.height - 0.5;
        const rx = (y * 14).toFixed(2);
        const ry = (x * -20).toFixed(2);
        c.style.transform = `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg) translateZ(6px)`;
      };
      const onLeave = () => {
        c.style.transform = "";
      };
      c.addEventListener("mousemove", onMove);
      c.addEventListener("mouseleave", onLeave);
    });
  },

  /* ---------- page transitions: graceful exit then navigate ---------- */
  initPageTransitions() {
    document.querySelectorAll("a").forEach((a) => {
      if (a.target === "_blank") return;
      const href = a.getAttribute("href");
      if (
        !href ||
        (href.startsWith("http") && !href.startsWith(location.origin))
      )
        return;
      a.addEventListener("click", (e) => {
        const isHash =
          href.startsWith("#") ||
          href.startsWith("mailto:") ||
          href.startsWith("tel:") ||
          href.startsWith("javascript:");
        if (isHash) return;
        e.preventDefault();
        document.body.classList.add("page-exit");
        setTimeout(() => (location.href = href), 350);
      });
    });
  },

  /* ---------- preloader: hide after load or fallback timeout ---------- */
  initPreloader() {
    const pre = document.querySelector(".preloader");
    if (!pre) {
      document.body.classList.add("cs-page-ready");
      return;
    }
    if (pre._handled) return;
    pre._handled = true;

    let returning = false;
    try {
      returning = localStorage.getItem("cs:loader-seen") === "true";
      localStorage.setItem("cs:loader-seen", "true");
    } catch {
      // Private browsing can block storage
    }
    pre.classList.toggle("preloader--returning", returning);
    const duration = returning ? 100 : 1200;
    let hidden = false;
    const hide = () => {
      if (hidden) return;
      hidden = true;
      pre.classList.add("hide");
      document.body.classList.add("cs-page-ready");
      setTimeout(() => {
        try {
          pre.remove();
        } catch {}
      }, 500);
    };

    if (document.readyState === "complete") {
      setTimeout(hide, duration);
    } else {
      window.addEventListener("load", () => setTimeout(hide, duration), { once: true });
    }
    // SAFETY: hard fallback — 2.5 seconds max guaranteed dismiss
    setTimeout(hide, Math.min(duration + 800, 2500));
  },

  /* ---------- count-up animation for numeric badges ---------- */
  countUp(el) {
    if (!el) return;
    const raw = Number(el.dataset.count || el.textContent.replace(/[^0-9]/g, "") || 0);
    if (!raw || el._counting) return;
    el._counting = true;
    const dur = 1100;
    const start = performance.now();
    const from = 0;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / dur);
      const eased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      const v = Math.round(from + (raw - from) * eased);
      el.textContent = v.toLocaleString("en-IN");
      if (t < 1) requestAnimationFrame(tick);
      else {
        el._counting = false;
      }
    };
    requestAnimationFrame(tick);
  },

  /* ---------- lazy image fade-in ---------- */
  initLazyImages() {
    const imgs = Array.from(document.querySelectorAll('img[loading="lazy"]'));
    if (!imgs.length) return;
    if (!("IntersectionObserver" in window)) {
      imgs.forEach((img) => img.classList.add("in"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          const img = e.target;
          img.classList.add("in");
          img.style.transition =
            "opacity 600ms var(--ease-out-smooth, ease-out), transform 600ms var(--ease-out-smooth, ease-out)";
          io.unobserve(img);
        });
      },
      { threshold: 0.08 },
    );
    imgs.forEach((i) => io.observe(i));
  },

  /* ---------- toast ---------- */
  toast(msg) {
    let t = document.querySelector(".toast");
    if (!t) {
      t = document.createElement("div");
      t.className = "toast glass";
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(CS._toastT);
    CS._toastT = setTimeout(() => t.classList.remove("show"), 2600);
  },

  /* ---------- wishlist ---------- */
  wishlist: () => CS.read("wishlist", []),
  inWishlist: (id) => CS.wishlist().includes(id),
  toggleWishlist(id) {
    const list = CS.wishlist();
    const i = list.indexOf(id);
    if (i >= 0) {
      list.splice(i, 1);
      CS.toast("Removed from wishlist");
    } else {
      list.push(id);
      CS.toast("❤️ Saved to wishlist");
    }
    CS.store("wishlist", list);
    return i < 0;
  },

  /* ---------- geo + formatting ---------- */
  haversineKm(a, b) {
    const R = 6371,
      d = (x) => (x * Math.PI) / 180;
    const dLat = d(b.lat - a.lat),
      dLng = d(b.lng - a.lng);
    const h =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(d(a.lat)) * Math.cos(d(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  },
  inr: (n) => "₹" + Number(n || 0).toLocaleString("en-IN"),
  stars(rating) {
    const r = Number(rating) || 0;
    const full = Math.floor(r),
      half = r - full >= 0.5;
    return (
      "★".repeat(full) +
      (half ? "½" : "") +
      "☆".repeat(Math.max(0, 5 - full - (half ? 1 : 0)))
    );
  },
  avgRating(l) {
    if (!l) return 4.5;
    const extra = CS.read("reviews:" + l.id, []);
    const all = [...(l.reviews || []), ...extra];
    if (!all.length) return Number(l.rating) || 4.5;
    return (
      Math.round(
        (all.reduce((s, r) => s + Number(r.rating || 5), 0) / all.length) * 10,
      ) / 10
    );
  },
  reviewCount(l) {
    if (!l) return 0;
    return (l.reviews || []).length + CS.read("reviews:" + l.id, []).length;
  },

  escapeHTML(value = "") {
    return String(value).replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#039;", '"': "&quot;" }[char]));
  },
  safeImageUrl(value) {
    try {
      const url = new URL(String(value || ""), window.location.href);
      return ["https:", "blob:"].includes(url.protocol) ? url.href : "";
    } catch (_) {
      return "";
    }
  },

  /* ---------- listing card ---------- */
  listingCard(l, distanceKm) {
    if (!l) return "";
    const fav = CS.inWishlist(l.id);
    const rating = CS.avgRating(l);
    const facs = (l.facilities || [])
      .slice(0, 3)
      .map(
        (f) => {
          const facObj = (typeof FACILITIES !== "undefined" && FACILITIES[f]) ? FACILITIES[f] : { icon: "✨", label: f };
          return `<span class="fac-pill">${CS.escapeHTML(facObj.icon)} ${CS.escapeHTML(facObj.label)}</span>`;
        },
      )
      .join("");
    const more =
      (l.facilities || []).length > 3
        ? `<span class="fac-pill">+${l.facilities.length - 3} more</span>`
        : "";
    const id = encodeURIComponent(String(l.id || ""));
    const title = CS.escapeHTML(l.title || "Accommodation");
    const area = CS.escapeHTML(l.area || "Near campus");
    const type = CS.escapeHTML(String(l.type || "stay").toUpperCase());
    const imgUrl = CS.escapeHTML(CS.safeImageUrl(l.images && l.images[0]) || "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?q=80&w=1100&auto=format&fit=crop");

    return `
    <article class="listing-card glass reveal in tilt card-3d">
      <a href="property.html?id=${id}" class="lc-media">
        <img src="${imgUrl}" alt="${title}" loading="lazy">
        <span class="lc-badges">
          <span class="tag type">${type}</span>
          ${l.verified ? '<span class="tag verified">✓ Verified</span>' : ""}
          ${!l.available ? '<span class="tag full">Full</span>' : ""}
        </span>
      </a>
      <button class="heart-btn ${fav ? "active" : ""}" data-wish="${id}" aria-label="Save to wishlist">${fav ? "♥" : "♡"}</button>
      <div class="lc-body">
        <div class="lc-top">
          <a href="property.html?id=${id}"><h3>${title}</h3></a>
          <span class="rating-chip">★ ${rating}</span>
        </div>
        <div class="lc-loc">📍 ${area} · ${CS.reviewCount(l)} reviews</div>
        <div class="lc-facilities">${facs}${more}</div>
        <div class="lc-foot">
          <span class="price">${CS.inr(l.rent)}<small>/month</small></span>
          <span class="dist">${distanceKm != null ? "📏 " + distanceKm.toFixed(1) + " km away" : ""}</span>
        </div>
      </div>
    </article>`;
  },
  bindWishlistButtons(scope = document) {
    scope.querySelectorAll("[data-wish]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        const added = CS.toggleWishlist(btn.dataset.wish);
        btn.classList.toggle("active", added);
        btn.textContent = added ? "♥" : "♡";
      });
    });
  },

  findCollege(q) {
    if (!q || typeof COLLEGES === "undefined") return null;
    q = q.trim().toLowerCase();
    return (
      COLLEGES.find((c) => c.name.toLowerCase() === q) ||
      COLLEGES.find((c) => c.name.toLowerCase().includes(q) || q.includes(c.id))
    );
  },

  initTooltips() {
    let tooltip = null;
    document.addEventListener("mouseover", (e) => {
      const target = e.target.closest && e.target.closest("[data-tooltip]");
      if (!target || target.dataset.tooltipBound) return;

      target.dataset.tooltipBound = "true";

      const showTooltip = () => {
        if (tooltip) tooltip.remove();
        tooltip = document.createElement("div");
        tooltip.className = "custom-tooltip glass";
        tooltip.textContent = target.dataset.tooltip;
        document.body.appendChild(tooltip);

        const updatePosition = () => {
          if (!tooltip || !target) return;
          const rect = target.getBoundingClientRect();
          const x = rect.left + rect.width / 2;
          const y = rect.top - 8;
          tooltip.style.left = `${x}px`;
          tooltip.style.top = `${y}px`;
        };

        updatePosition();
        tooltip.offsetWidth; // Force layout
        tooltip.classList.add("show");

        window.addEventListener("scroll", updatePosition, { passive: true });
        window.addEventListener("resize", updatePosition, { passive: true });

        target.addEventListener("mouseleave", function onLeave() {
          if (tooltip) {
            tooltip.classList.remove("show");
            const tRef = tooltip;
            setTimeout(() => tRef.remove(), 200);
            tooltip = null;
          }
          window.removeEventListener("scroll", updatePosition);
          window.removeEventListener("resize", updatePosition);
          target.removeEventListener("mouseleave", onLeave);
        });
      };

      target.addEventListener("mouseenter", showTooltip);
      showTooltip();
    });
  },

  initLockedCards() {
    document.addEventListener(
      "click",
      (e) => {
        const lockedCard = e.target.closest(".cat-card.locked");
        if (lockedCard) {
          e.preventDefault();
          e.stopPropagation();
        }
      },
      true,
    );
  },

  /* ---------- cookie consent ---------- */
  initCookieConsent() {
    if (document.querySelector('.cookie-banner')) return;
    const saved = CS.read('cookie-consent');
    const show = (managing = false) => {
      let banner = document.querySelector('.cookie-banner');
      if (!banner) {
        banner = document.createElement('aside');
        banner.className = 'cookie-banner glass';
        banner.setAttribute('aria-label', 'Cookie preferences');
        banner.innerHTML = `
          <div class="cookie-copy"><span class="cookie-mark" aria-hidden="true">◌</span><div><strong>Your privacy, clearly handled.</strong><p>We use essential cookies to keep your account secure, plus optional cookies to improve the experience.</p><a href="help.html#privacy">Learn more</a></div></div>
          <div class="cookie-manage"><label><input type="checkbox" data-cookie-analytics> Allow experience analytics</label></div>
          <div class="cookie-actions"><button type="button" class="btn btn-ghost btn-sm" data-cookie-reject>Reject non-essential</button><button type="button" class="btn btn-ghost btn-sm" data-cookie-manage>Manage preferences</button><button type="button" class="btn btn-primary btn-sm" data-cookie-accept>Accept all</button></div>`;
        document.body.appendChild(banner);
        const close = (analytics) => {
          CS.store('cookie-consent', { essential: true, analytics: Boolean(analytics), updatedAt: new Date().toISOString() });
          banner.classList.remove('show');
          window.setTimeout(() => banner.remove(), 250);
        };
        banner.querySelector('[data-cookie-accept]').addEventListener('click', () => close(true));
        banner.querySelector('[data-cookie-reject]').addEventListener('click', () => close(false));
        banner.querySelector('[data-cookie-manage]').addEventListener('click', () => {
          banner.classList.toggle('is-managing');
        });
        banner.querySelector('[data-cookie-analytics]').checked = saved?.analytics === true;
      }
      banner.classList.toggle('is-managing', managing);
      requestAnimationFrame(() => banner.classList.add('show'));
    };
    if (!saved) show(false);
    window.CS_openCookiePreferences = () => show(true);
  },
};

document.addEventListener("DOMContentLoaded", () => {
  CS.initTheme();
  CS.initNav();
  CS.initReveal();
  CS.initSmoothScroll();
  CS.initPreloader();
  // GSAP owns transform-heavy motion when it is available.
  if (!window.gsap || !window.ScrollTrigger) {
    CS.initParallax();
    CS.init3DTilt();
    CS.initPageTransitions();
  }
  CS.initLazyImages();
  CS.initTooltips();
  CS.initLockedCards();
  CS.initCookieConsent();
});
