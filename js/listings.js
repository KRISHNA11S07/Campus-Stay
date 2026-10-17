/* ============================================================
   CampusStay — listings: geo radius search, ranking, filters
   ============================================================ */
document.addEventListener('DOMContentLoaded', async () => {
  const params = new URLSearchParams(location.search);
  const isWishlistView = params.get('view') === 'wishlist';
  const college = COLLEGES.find((c) => c.id === params.get('college')) || null;
  const RADIUS_KM = 5;

  /* Origin point: user geolocation (if granted on homepage) else the college */
  let origin = null;
  try { origin = JSON.parse(sessionStorage.getItem('cs:origin')); } catch { /* noop */ }
  if (!params.get('geo')) origin = null;
  if (!origin && college) origin = { lat: college.lat, lng: college.lng, label: college.name };

  /* Page heading */
  const title = document.getElementById('page-title');
  const sub = document.getElementById('page-sub');
  if (isWishlistView) {
    title.textContent = '❤️ Your wishlist';
    sub.textContent = 'Stays you saved for later.';
  } else if (college) {
    title.textContent = `Stays near ${college.name}`;
    sub.textContent = origin && origin.label === 'your location'
      ? `Within ${RADIUS_KM} km of your current location · ranked by rating`
      : `Within ${RADIUS_KM} km of campus · ranked by rating`;
  } else if (params.get('type')) {
    const t = params.get('type');
    title.textContent = `Browse ${t === 'pg' ? 'PGs' : t + 's'}`;
  }
  if (!origin) document.getElementById('distance-group').style.display = 'none';

  /* Pre-apply type filter from URL with lock protection */
  if (params.get('type')) {
    const t = params.get('type');
    if (t === 'apartment' || t === 'villa') {
      CS.toast(`🔒 ${t.charAt(0).toUpperCase() + t.slice(1)}s are coming soon!`);
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete('type');
      window.history.replaceState({}, '', newUrl);
    } else {
      const cb = document.querySelector(`input[name="type"][value="${t}"]`);
      if (cb) cb.checked = true;
    }
  }

  /* Facility filter checkboxes */
  document.getElementById('facility-filters').innerHTML = Object.entries(FACILITIES)
    .map(([k, f]) => `<label class="f-check"><input type="checkbox" name="fac" value="${k}"> ${f.icon} ${f.label}</label>`)
    .join('');

  /* Mobile filters toggle */
  document.getElementById('filters-toggle').addEventListener('click', () =>
    document.getElementById('filters').classList.toggle('open'));

  /* Range labels */
  const rentEl = document.getElementById('f-rent'), distEl = document.getElementById('f-dist');
  const syncRanges = () => {
    document.getElementById('rent-val').textContent = CS.inr(+rentEl.value);
    document.getElementById('dist-val').textContent = (+distEl.value).toFixed(1) + ' km';
  };

  /* Distance annotate */
  let withDistance = LISTINGS.map((l) => ({
    l,
    dist: origin ? CS.haversineKm(origin, l) : null,
  }));

  async function loadPublishedOwnerListings() {
    const sb = typeof getSupabase === 'function' ? getSupabase() : null;
    if (!sb) return;
    const { data, error } = await sb
      .from('properties')
      .select('id,type,title,description,area,city,lat,lng,rent,deposit,available,verification_status,distance_km,property_media(file_url,storage_path,display_order),property_facilities(facility_id)')
      .eq('verification_status', 'verified')
      .order('created_at', { ascending: false });
    if (error || !data?.length) return;
    const hydrated = await Promise.all(data.map(async (property) => ({
      ...property,
      property_media: await resolveMediaUrls(property.property_media || [])
    })));
    const remote = hydrated.map((property) => ({
      id: property.id,
      type: property.type,
      title: property.title,
      area: [property.area, property.city].filter(Boolean).join(', ') || 'Near campus',
      lat: property.lat,
      lng: property.lng,
      rent: Number(property.rent || 0),
      deposit: Number(property.deposit || 0),
      available: property.available !== false,
      verified: true,
      rating: 4.5,
      reviews: [],
      facilities: (property.property_facilities || []).map((item) => item.facility_id),
      images: (property.property_media || []).sort((a, b) => (a.display_order || 0) - (b.display_order || 0)).map((item) => item.file_url),
      distanceKm: Number(property.distance_km)
    }));
    withDistance = [...LISTINGS, ...remote].map((l) => ({
      l,
      dist: origin && Number.isFinite(l.lat) && Number.isFinite(l.lng)
        ? CS.haversineKm(origin, l)
        : (Number.isFinite(l.distanceKm) ? l.distanceKm : null)
    }));
  }

  function currentFilters() {
    return {
      types: [...document.querySelectorAll('input[name="type"]:checked')].map((i) => i.value),
      facs: [...document.querySelectorAll('input[name="fac"]:checked')].map((i) => i.value),
      maxRent: +rentEl.value,
      maxDist: +distEl.value,
      minRating: +document.querySelector('input[name="rating"]:checked').value,
      verified: document.getElementById('f-verified').checked,
      available: document.getElementById('f-available').checked,
      sort: document.getElementById('sort').value,
    };
  }

  function render() {
    syncRanges();
    const f = currentFilters();
    let rows = withDistance;

    if (isWishlistView) {
      const wl = CS.wishlist();
      rows = rows.filter((r) => wl.includes(r.l.id));
    } else if (origin) {
      rows = rows.filter((r) => r.dist <= RADIUS_KM);
    }

    rows = rows.filter((r) => {
      const l = r.l;
      if (f.types.length && !f.types.includes(l.type)) return false;
      if (l.rent > f.maxRent) return false;
      if (origin && !isWishlistView && r.dist > f.maxDist) return false;
      if (CS.avgRating(l) < f.minRating) return false;
      if (f.verified && !l.verified) return false;
      if (f.available && !l.available) return false;
      if (f.facs.length && !f.facs.every((x) => l.facilities.includes(x))) return false;
      return true;
    });

    /* Ranking: rating-first by default (rating desc, then review count desc) */
    const sorters = {
      rating: (a, b) => CS.avgRating(b.l) - CS.avgRating(a.l) || CS.reviewCount(b.l) - CS.reviewCount(a.l),
      distance: (a, b) => (a.dist ?? 1e9) - (b.dist ?? 1e9),
      'rent-asc': (a, b) => a.l.rent - b.l.rent,
      'rent-desc': (a, b) => b.l.rent - a.l.rent,
    };
    rows.sort(sorters[f.sort]);

    const grid = document.getElementById('results-grid');
    document.getElementById('result-count').textContent =
      rows.length === 0 ? 'No stays found' : `${rows.length} stay${rows.length > 1 ? 's' : ''} found`;

    if (!rows.length) {
      grid.innerHTML = `
        <div class="empty-state glass" style="grid-column:1/-1;">
          <div class="big">🔍</div>
          <h3>Nothing matches those filters</h3>
          <p style="color:var(--text-2); margin:.5rem 0 1.2rem;">${isWishlistView ? 'Your wishlist is empty — tap the ♡ on any listing to save it.' : 'Try widening your rent or distance range.'}</p>
          <button class="btn btn-primary" id="empty-reset">${isWishlistView ? 'Browse listings' : 'Reset filters'}</button>
        </div>`;
      document.getElementById('empty-reset').addEventListener('click', () =>
        isWishlistView ? (location.href = 'listings.html') : resetFilters());
      return;
    }

    grid.innerHTML = rows.map((r) => CS.listingCard(r.l, r.dist)).join('');
    CS.bindWishlistButtons(grid);
    if (CS._bindTilt) CS._bindTilt();
    grid.querySelectorAll('.reveal').forEach((el, i) => setTimeout(() => el.classList.add('in'), i * 60));
    CS.initLazyImages();
  }

  function resetFilters() {
    document.querySelectorAll('#filters input[type="checkbox"]').forEach((i) => (i.checked = i.id === 'f-available'));
    document.querySelector('input[name="rating"][value="0"]').checked = true;
    rentEl.value = 50000;
    distEl.value = 5;
    render();
  }

  document.getElementById('filters').addEventListener('input', render);
  document.getElementById('sort').addEventListener('change', render);
  document.getElementById('clear-filters').addEventListener('click', resetFilters);

  await loadPublishedOwnerListings();
  render();
});
