/* ============================================================
   CampusStay — homepage logic
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  /* College autocomplete */
  const datalist = document.getElementById('college-list');
  COLLEGES.forEach((c) => {
    const opt = document.createElement('option');
    opt.value = c.name;
    datalist.appendChild(opt);
  });

  /* College chips */
  const chips = document.getElementById('college-chips');
  chips.innerHTML = COLLEGES.map(
    (c) => `<a class="chip glass" href="listings.html?college=${c.id}">🎓 ${c.name}</a>`
  ).join('');

  /* Hero search → geolocation → listings page */
  document.getElementById('hero-search').addEventListener('submit', (e) => {
    e.preventDefault();
    const q = document.getElementById('college-input').value;
    const college = CS.findCollege(q);
    if (!college) {
      CS.toast('College not found — try one from the suggestions');
      return;
    }
    const go = (params) => (location.href = 'listings.html?' + new URLSearchParams(params));
    CS.toast('📍 Requesting your location…');
    if (!navigator.geolocation) return go({ college: college.id });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        sessionStorage.setItem('cs:origin', JSON.stringify({ lat: pos.coords.latitude, lng: pos.coords.longitude, label: 'your location' }));
        go({ college: college.id, geo: '1' });
      },
      () => {
        CS.toast('Location denied — searching around ' + college.name);
        sessionStorage.removeItem('cs:origin');
        go({ college: college.id });
      },
      { timeout: 8000 }
    );
  });

  /* Featured = top rated */
  const featured = [...LISTINGS].sort((a, b) => CS.avgRating(b) - CS.avgRating(a)).slice(0, 6);
  const grid = document.getElementById('featured-grid');
  if (grid) {
    grid.innerHTML = featured.map((l) => CS.listingCard(l)).join('');
    CS.bindWishlistButtons(grid);
    grid.querySelectorAll('.reveal').forEach((el) => el.classList.add('in'));
    if (CS._bindTilt) CS._bindTilt();
    CS.initLazyImages();
  }

  /* Full-screen 4K property showcase */
  const showcaseData = [
    { img: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?q=80&w=2400&auto=format&fit=crop', kicker: 'Featured stay', title: 'Tarabai Park 2BHK Flat, Kolhapur', desc: 'Spacious 2BHK in a gated complex — minutes from KIT Kolhapur with sunset balcony.', rent: '₹12,000', rating: '4.6★', id: 'kit-04' },
    { img: 'https://images.unsplash.com/photo-1555854877-bab0e564b8d5?q=80&w=2400&auto=format&fit=crop', kicker: 'Top rated girls PG', title: 'Lakshmi Girls PG, Chandanwadi', desc: 'Biometric access, delicious home meals, CCTV and dedicated study space near KIT Kolhapur.', rent: '₹8,000', rating: '4.8★', id: 'kit-05' },
    { img: 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?q=80&w=2400&auto=format&fit=crop', kicker: 'Premium co-living', title: 'Shivam Boys PG, Kasaba Bawda', desc: 'Just 800m from KIT gate — home-cooked meals, power backup and high-speed Wi-Fi.', rent: '₹7,500', rating: '4.7★', id: 'kit-01' },
  ];
  const stage = document.getElementById('showcase-stage');
  if (stage) {
    stage.innerHTML = showcaseData.map((s, i) => `
      <div class="showcase-slide ${i === 0 ? 'active' : ''}" data-slide="${i}">
        <div class="img" style="background-image:url('${s.img}')"></div>
        <div class="grad"></div>
        <div class="showcase-content"><div class="container"><div class="inner">
          <span class="kicker">${s.kicker}</span>
          <h2>${s.title}</h2>
          <p>${s.desc}</p>
          <div class="showcase-meta">
            <div><b>${s.rent}</b><span>per month</span></div>
            <div><b>${s.rating}</b><span>student rating</span></div>
          </div>
          <a class="btn btn-primary" href="property.html?id=${s.id}">View this stay →</a>
        </div></div></div>
      </div>`).join('') +
      `<div class="showcase-dots">${showcaseData.map((_, i) => `<button class="${i === 0 ? 'active' : ''}" data-dot="${i}" aria-label="Slide ${i + 1}"></button>`).join('')}</div>`;
    let cur = 0;
    const slides = stage.querySelectorAll('.showcase-slide');
    const dots = stage.querySelectorAll('[data-dot]');
    const show = (n) => {
      cur = (n + slides.length) % slides.length;
      slides.forEach((s, i) => s.classList.toggle('active', i === cur));
      dots.forEach((d, i) => d.classList.toggle('active', i === cur));
    };
    dots.forEach((d) => d.addEventListener('click', () => { show(+d.dataset.dot); restart(); }));
    let timer = setInterval(() => show(cur + 1), 5000);
    const restart = () => { clearInterval(timer); timer = setInterval(() => show(cur + 1), 5000); };
  }

  /* Animated counters */
  const fmt = (n) => (n >= 1000 ? (n / 1000).toFixed(n % 1000 === 0 ? 0 : 1) + 'k+' : n + '+');
  const counterIO = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      counterIO.unobserve(el);
      const target = +el.dataset.count;
      const t0 = performance.now(), dur = 1600;
      const tick = (t) => {
        const p = Math.min((t - t0) / dur, 1);
        const eased = 1 - Math.pow(1 - p, 3);
        el.textContent = fmt(Math.round(target * eased));
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }, { threshold: 0.4 });
  document.querySelectorAll('[data-count]').forEach((el) => counterIO.observe(el));

  /* FAQ accordion */
  document.querySelectorAll('.faq-item').forEach((item) => {
    item.querySelector('.faq-q').addEventListener('click', () => {
      const open = item.classList.contains('open');
      document.querySelectorAll('.faq-item.open').forEach((i) => {
        i.classList.remove('open');
        i.querySelector('.faq-a').style.maxHeight = null;
      });
      if (!open) {
        item.classList.add('open');
        const a = item.querySelector('.faq-a');
        a.style.maxHeight = a.scrollHeight + 'px';
      }
    });
  });
});
