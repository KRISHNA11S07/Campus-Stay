/* ============================================================
   CampusStay — homepage logic
   ============================================================ */
document.addEventListener('DOMContentLoaded', async () => {
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

  const grid = document.getElementById('featured-grid');
  try {
    const [listings] = await Promise.all([publishedKitListings(), CS.loadWishlist()]);
    if (listings && listings.length) {
      grid.innerHTML = listings.slice(0, 6).map((l) => CS.listingCard(l, l.distanceKm)).join('');
      CS.bindWishlistButtons(grid);
    } else {
      grid.innerHTML = `
        <div class="empty-state-card glass" style="grid-column: 1 / -1; text-align: center; padding: 3rem 1.5rem; border-radius: 20px;">
          <span style="font-size: 2.5rem; display: block; margin-bottom: 0.8rem;">🏠</span>
          <p style="font-weight: 700; font-size: 1.1rem; margin-bottom: 0.4rem; color: var(--text);">No approved stays are currently available within 5 km of KIT.</p>
          <p style="color: var(--text-2); font-size: 0.9rem; margin-bottom: 1.5rem;">New verified properties around campus are added regularly. Check back soon or explore all listings.</p>
          <a href="listings.html" class="btn btn-primary btn-sm">Explore All Stays →</a>
        </div>`;
    }
  } catch (err) {
    console.warn('[CampusStay] Featured listings load failed:', err?.message || err);
    grid.innerHTML = `
      <div class="empty-state-card glass" style="grid-column: 1 / -1; text-align: center; padding: 3rem 1.5rem; border-radius: 20px;">
        <span style="font-size: 2.5rem; display: block; margin-bottom: 0.8rem;">⚠️</span>
        <p style="font-weight: 700; font-size: 1.1rem; margin-bottom: 0.4rem; color: var(--text);">Listings could not be loaded. Refresh to retry.</p>
        <p style="color: var(--text-2); font-size: 0.9rem; margin-bottom: 1.5rem;">Unable to connect to the properties directory. Check your connection.</p>
        <button type="button" class="btn btn-primary btn-sm" onclick="location.reload()">Refresh Page</button>
      </div>`;
  }

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
