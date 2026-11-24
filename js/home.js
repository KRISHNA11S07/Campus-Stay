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

  const grid=document.getElementById('featured-grid');
  try {
    const [listings]=await Promise.all([publishedKitListings(),CS.loadWishlist()]);
    grid.innerHTML=listings.slice(0,6).map(l=>CS.listingCard(l,l.distanceKm)).join('');
    if(!listings.length)grid.textContent='No approved stays are currently available within 5 km of KIT.';
    CS.bindWishlistButtons(grid);
  } catch {grid.textContent='Listings could not be loaded. Refresh to retry.';}

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
