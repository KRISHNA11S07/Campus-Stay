/* ============================================================
   CampusStay — property details page
   Handles both static demo LISTINGS and Supabase-created properties
   ============================================================ */
document.addEventListener('DOMContentLoaded', async () => {
  const id = new URLSearchParams(location.search).get('id');
  const root = document.getElementById('prop-root');

  // Try static demo data first
  const l = LISTINGS.find((x) => x.id === id);

  if (l) {
    renderDemoProperty(l, root);
    return;
  }

  // Not in demo data — try Supabase
  if (typeof getSupabase === 'function') {
    try {
      await renderSupabaseProperty(id, root);
    } catch (err) {
      console.error('Error loading property:', err);
      showNotFound(root);
    }
  } else {
    showNotFound(root);
  }
});

function escapeHTML(value = '') {
  return String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' }[char]));
}

function safeMediaUrl(value) {
  try {
    const url = new URL(String(value || ''), window.location.href);
    return ['https:', 'blob:'].includes(url.protocol) ? url.href : '';
  } catch (_) {
    return '';
  }
}

function showNotFound(root) {
  root.innerHTML = `<div class="empty-state glass"><div class="big">🏚️</div><h3>Listing not found</h3>
    <p style="color:var(--text-2); margin:.5rem 0 1.2rem;">It may have been rented out or removed.</p>
    <a class="btn btn-primary" href="listings.html">Browse other stays</a></div>`;
}

/* ── Supabase property rendering ─────────────────────────── */
async function renderSupabaseProperty(id, root) {
  const sb = getSupabase();
  if (!sb) { showNotFound(root); return; }

  // Fetch property with related data
  const { data: prop, error } = await sb
    .from('properties')
    .select(`
      *,
      property_media(id, file_url, storage_path, file_type, display_order),
      property_facilities(facility_id, facilities(label, icon)),
      property_rules(rule_text, display_order)
    `)
    .eq('id', id)
    .single();

  if (error || !prop) { showNotFound(root); return; }
  prop.property_media = await resolveMediaUrls(prop.property_media || []);

  // New listings carry a deliberate public contact snapshot. Older listings
  // fall back to the protected owner profile where the deployment permits it.
  let ownerProfile = null;
  if (!prop.owner_name || !prop.owner_phone) {
    const { data } = await sb.from('profiles')
      .select('full_name, phone, occupation, avatar_url')
      .eq('id', prop.owner_id)
      .single();
    ownerProfile = data;
  }
  const ownerName = prop.owner_name || ownerProfile?.full_name || 'Property Owner';
  const ownerPhone = prop.owner_phone || ownerProfile?.phone || '';
  const ownerWhatsapp = prop.owner_whatsapp || ownerPhone;
  const ownerOccupation = ownerProfile?.occupation || 'Owner';

  // Prepare data
  const college = COLLEGES.find(c => c.id === prop.college_id);
  const images = (prop.property_media || [])
    .sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
    .filter(m => m.file_type === 'image')
    .map(m => safeMediaUrl(m.file_url))
    .filter(Boolean);
  const videos = (prop.property_media || [])
    .filter(m => m.file_type === 'video')
    .map(m => safeMediaUrl(m.file_url))
    .filter(Boolean);
  const facilities = (prop.property_facilities || [])
    .map(pf => ({ icon: pf.facilities?.icon || '✨', label: pf.facilities?.label || 'Facility' }));
  const rules = (prop.property_rules || [])
    .sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
    .map(r => r.rule_text);

  document.title = `${prop.title} — CampusStay`;

  // Gallery
  const allImages = images.length > 0 ? images : ['https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?q=80&w=1100&auto=format&fit=crop'];
  let galleryHtml = buildGallery(allImages, prop.title);

  // Videos section
  let videoHtml = '';
  if (videos.length > 0) {
    videoHtml = `
      <div class="glass reveal in">
        <h3 style="margin-bottom:1.2rem;">🎬 Property Videos</h3>
        <div style="display:grid; gap:.8rem;">
          ${videos.map(v => `<video src="${escapeHTML(v)}" controls style="width:100%; border-radius:12px; max-height:400px;"></video>`).join('')}
        </div>
      </div>`;
  }

  // Distance
  const listedDistance = Number(prop.distance_km);
  const distKm = Number.isFinite(listedDistance)
    ? listedDistance
    : (college && prop.lat != null && prop.lng != null ? CS.haversineKm(college, { lat: prop.lat, lng: prop.lng }) : null);

  // Phone normalization for WhatsApp
  const phoneClean = ownerPhone.replace(/[^0-9]/g, '');
  const waPhone = (ownerWhatsapp || '').replace(/[^0-9]/g, '') || (phoneClean.startsWith('91') ? phoneClean : '91' + phoneClean);
  const waText = encodeURIComponent(`Hi! I found "${prop.title}" on CampusStay and I'm interested. Is it available?`);

  // Verification badge
  const isVerified = prop.verification_status === 'verified';

  root.innerHTML = `
    <!-- Gallery -->
    ${galleryHtml}

    <div class="prop-layout">
      <div class="prop-main">
        <div class="glass reveal in">
          <div class="prop-title-row">
            <div>
              <h1>${escapeHTML(prop.title)}</h1>
              <div class="prop-meta">
                <span>📍 ${escapeHTML(prop.area || 'Location not set')}</span>
                ${distKm != null ? `<span>🎓 ${distKm.toFixed(1)} km from ${escapeHTML(college.name)}</span>` : ''}
              </div>
            </div>
          </div>
          <div style="display:flex; gap:.5rem; margin-top:1rem; flex-wrap:wrap;">
            <span class="tag type">${escapeHTML(prop.type)}</span>
            ${isVerified ? '<span class="tag verified">✓ Verified property</span>' : `<span class="tag">${escapeHTML(prop.verification_status)}</span>`}
            <span class="fac-pill">${prop.gender === 'any' ? '👥 All genders' : prop.gender === 'female' ? '👩 Girls only' : '👨 Boys only'}</span>
          </div>
          <p style="margin-top:1.2rem; color:var(--text-2);">${escapeHTML(prop.description || 'No description provided.')}</p>
        </div>

        ${facilities.length > 0 ? `
        <div class="glass reveal in">
          <h3 style="margin-bottom:1.2rem;">✨ Facilities & amenities</h3>
          <div class="fac-grid">
            ${facilities.map(f => `<div class="fac-item"><span>${escapeHTML(f.icon)}</span> ${escapeHTML(f.label)}</div>`).join('')}
          </div>
        </div>` : ''}

        ${rules.length > 0 ? `
        <div class="glass reveal in">
          <h3 style="margin-bottom:1.2rem;">📋 Property rules</h3>
          <ul class="rules-list">${rules.map(r => `<li><span>•</span> ${escapeHTML(r)}</li>`).join('')}</ul>
        </div>` : ''}

        ${videoHtml}

        ${prop.lat ? `
        <div class="glass reveal in">
          <h3 style="margin-bottom:1.2rem;">🗺️ Location</h3>
          <iframe class="map-frame" loading="lazy" referrerpolicy="no-referrer-when-downgrade"
            src="https://maps.google.com/maps?q=${prop.lat},${prop.lng}&z=15&output=embed"
            title="Map showing ${escapeHTML(prop.title)}"></iframe>
          <p style="font-size:.85rem; color:var(--text-3); margin-top:.7rem;">Exact address shared by the owner after you connect.</p>
        </div>` : ''}
      </div>

      <aside class="prop-side">
        <div class="glass price-box reveal in" style="position:sticky; top:100px;">
          <span class="avail ${prop.available ? 'yes' : 'no'}"><span class="dot"></span>${prop.available ? 'Available now' : 'Currently full'}</span>
          <div class="big-price" style="margin:.6rem 0 1rem;">${CS.inr(prop.rent)}<small>/year</small></div>
          <div class="kv"><span>Security deposit</span><b>${CS.inr(prop.deposit)}</b></div>
          <div class="kv"><span>Accommodation type</span><b style="text-transform:capitalize;">${escapeHTML(prop.type)}</b></div>
          ${distKm != null ? `<div class="kv"><span>Distance from college</span><b>${distKm.toFixed(1)} km</b></div>` : ''}
          <div class="kv"><span>For</span><b>${prop.gender === 'any' ? 'Everyone' : prop.gender === 'female' ? 'Girls' : 'Boys'}</b></div>

          <div style="margin-top:1.4rem;">
            <div class="owner-row">
              <div class="avatar">${escapeHTML(ownerName[0] || 'O')}</div>
              <div><b style="display:block; font-size:.95rem;">${escapeHTML(ownerName)}</b>
              <span style="font-size:.8rem; color:var(--text-3);">${escapeHTML(ownerOccupation)} ${isVerified ? '· ✓ ID verified' : ''}</span></div>
            </div>
            ${ownerPhone ? `
            <div class="contact-btns">
              <a class="btn btn-call" href="tel:${escapeHTML(ownerPhone.replace(/[^+0-9]/g, ''))}">📞 Call</a>
              <a class="btn btn-wa" href="https://wa.me/${waPhone}?text=${waText}" target="_blank" rel="noopener">💬 WhatsApp</a>
            </div>
            ` : '<p style="font-size:.85rem; color:var(--text-3); text-align:center; margin-top:.8rem;">Contact info not available yet.</p>'}
            <p style="font-size:.78rem; color:var(--text-3); margin-top:.9rem; text-align:center;">Zero brokerage · Talk directly to the owner</p>
          </div>
        </div>
      </aside>
    </div>`;

  // Initialize lightbox for gallery
  initLightbox(allImages, prop.title, root);
}

/* ── Demo property rendering (preserves existing behavior) ── */
function renderDemoProperty(l, root) {
  document.title = `${l.title} — CampusStay`;
  const college = COLLEGES.find((c) => c.id === l.college);
  const distKm = college ? CS.haversineKm(college, l) : null;
  const rating = CS.avgRating(l);
  const extraReviews = CS.read('reviews:' + l.id, []);
  const allReviews = [...extraReviews, ...l.reviews];
  const fav = CS.inWishlist(l.id);
  const waText = encodeURIComponent(`Hi! I found "${l.title}" on CampusStay and I'm interested. Is it available?`);

  let galleryHtml = buildGallery(l.images, l.title);

  root.innerHTML = `
    <!-- Gallery -->
    ${galleryHtml}

    <div class="prop-layout">
      <div class="prop-main">
        <div class="glass reveal in">
          <div class="prop-title-row">
            <div>
              <h1>${l.title}</h1>
              <div class="prop-meta">
                <span>📍 ${l.area}</span>
                ${distKm != null ? `<span>🎓 ${distKm.toFixed(1)} km from ${college.name}</span>` : ''}
                <span class="rating-chip">★ ${rating} (${allReviews.length} reviews)</span>
              </div>
            </div>
            <button class="heart-btn ${fav ? 'active' : ''}" data-wish="${l.id}" style="position:static;" aria-label="Save">${fav ? '♥' : '♡'}</button>
          </div>
          <div style="display:flex; gap:.5rem; margin-top:1rem; flex-wrap:wrap;">
            <span class="tag type">${l.type}</span>
            ${l.verified ? '<span class="tag verified">✓ Verified property</span>' : ''}
            <span class="fac-pill">${l.gender === 'any' ? '👥 All genders' : l.gender === 'female' ? '👩 Girls only' : '👨 Boys only'}</span>
          </div>
          <p style="margin-top:1.2rem; color:var(--text-2);">${l.description}</p>
        </div>

        <div class="glass reveal in">
          <h3 style="margin-bottom:1.2rem;">✨ Facilities & amenities</h3>
          <div class="fac-grid">
            ${l.facilities.map((f) => `<div class="fac-item"><span>${FACILITIES[f].icon}</span> ${FACILITIES[f].label}</div>`).join('')}
          </div>
        </div>

        ${l.type === 'hostel' && l.rules.length ? `
        <div class="glass reveal in">
          <h3 style="margin-bottom:1.2rem;">📋 Hostel rules</h3>
          <ul class="rules-list">${l.rules.map((r) => `<li><span>•</span> ${r}</li>`).join('')}</ul>
        </div>` : ''}

        <div class="glass reveal in">
          <h3 style="margin-bottom:1.2rem;">🗺️ Location</h3>
          <iframe class="map-frame" loading="lazy" referrerpolicy="no-referrer-when-downgrade"
            src="https://maps.google.com/maps?q=${l.lat},${l.lng}&z=15&output=embed"
            title="Map showing ${l.title}"></iframe>
          <p style="font-size:.85rem; color:var(--text-3); margin-top:.7rem;">Exact address shared by the owner after you connect.</p>
        </div>

        <div class="glass reveal in">
          <h3 style="margin-bottom:.4rem;">⭐ Ratings & reviews</h3>
          <p style="color:var(--text-2); font-size:.9rem;">★ ${rating} average · ${allReviews.length} student reviews</p>
          <div id="reviews">
            ${allReviews.map((r) => `
              <div class="review">
                <div class="r-head"><b>${r.name}</b><span class="stars">${CS.stars(+r.rating)}</span></div>
                <p>${r.text}</p>
                <span class="r-date">${r.date}</span>
              </div>`).join('')}
          </div>
          <form class="review-form" id="review-form">
            <b style="font-size:.95rem;">Write a review</b>
            <select id="rv-rating" required>
              <option value="">Your rating…</option>
              <option value="5">★★★★★ — Loved it</option>
              <option value="4">★★★★ — Good</option>
              <option value="3">★★★ — Okay</option>
              <option value="2">★★ — Poor</option>
              <option value="1">★ — Terrible</option>
            </select>
            <textarea id="rv-text" rows="3" placeholder="Share your honest experience for future students…" required></textarea>
            <button class="btn btn-primary" type="submit">Post review</button>
          </form>
        </div>
      </div>

      <aside class="prop-side">
        <div class="glass price-box reveal in" style="position:sticky; top:100px;">
          <span class="avail ${l.available ? 'yes' : 'no'}"><span class="dot"></span>${l.available ? 'Available now' : 'Currently full'}</span>
          <div class="big-price" style="margin:.6rem 0 1rem;">${CS.inr(l.rent)}<small>/month</small></div>
          <div class="kv"><span>Security deposit</span><b>${CS.inr(l.deposit)}</b></div>
          <div class="kv"><span>Accommodation type</span><b style="text-transform:capitalize;">${l.type}</b></div>
          ${distKm != null ? `<div class="kv"><span>Distance from college</span><b>${distKm.toFixed(1)} km</b></div>` : ''}
          <div class="kv"><span>For</span><b>${l.gender === 'any' ? 'Everyone' : l.gender === 'female' ? 'Girls' : 'Boys'}</b></div>

          <div style="margin-top:1.4rem;">
            <div class="owner-row">
              <div class="avatar">${l.owner.name[0]}</div>
              <div><b style="display:block; font-size:.95rem;">${l.owner.name}</b>
              <span style="font-size:.8rem; color:var(--text-3);">${l.owner.role} ${l.verified ? '· ✓ ID verified' : ''}</span></div>
            </div>
            <div class="contact-btns">
              <a class="btn btn-call" href="tel:${l.owner.phone}">📞 Call</a>
              <a class="btn btn-wa" href="https://wa.me/${l.owner.phone.replace('+', '')}?text=${waText}" target="_blank" rel="noopener">💬 WhatsApp</a>
            </div>
            <p style="font-size:.78rem; color:var(--text-3); margin-top:.9rem; text-align:center;">Zero brokerage · Talk directly to the ${l.owner.role.toLowerCase()}</p>
          </div>
        </div>
      </aside>
    </div>`;

  CS.bindWishlistButtons(root);

  // Review form
  document.getElementById('review-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const user = CS.read('user');
    if (!user) {
      CS.toast('Sign in to post a review');
      setTimeout(() => (location.href = 'auth.html?next=' + encodeURIComponent(location.pathname + location.search)), 900);
      return;
    }
    const review = {
      name: user.name,
      rating: +document.getElementById('rv-rating').value,
      text: document.getElementById('rv-text').value.trim(),
      date: new Date().toISOString().slice(0, 10),
    };
    if (!review.rating || !review.text) return;
    const extra = CS.read('reviews:' + l.id, []);
    extra.unshift(review);
    CS.store('reviews:' + l.id, extra);
    CS.toast('⭐ Review posted — thank you!');
    setTimeout(() => location.reload(), 900);
  });

  // Lightbox
  initLightbox(l.images, l.title, root);
}

/* ── Gallery builder ─────────────────────────────────────── */
function buildGallery(images, title) {
  images = images.map(safeMediaUrl).filter(Boolean);
  title = escapeHTML(title);
  if (images.length === 0) images = ['https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?q=80&w=1100&auto=format&fit=crop'];
  images = images.map(escapeHTML);
  const imgCount = images.length;
  if (imgCount === 1) {
    return `
      <div class="gallery single-img glass reveal in" style="height:440px;">
        <div class="g-main" style="width:100%; height:100%;"><img src="${images[0]}" alt="${title}" class="lightbox-trigger" data-index="0" style="width:100%; height:100%; object-fit:cover; border-radius:12px; cursor:pointer;"></div>
      </div>`;
  } else if (imgCount === 2) {
    return `
      <div class="gallery double-img glass reveal in" style="display: grid; grid-template-columns: 1fr 1fr; gap: .8rem; height:440px;">
        <div class="g-main" style="height:100%; overflow:hidden;"><img src="${images[0]}" alt="${title}" class="lightbox-trigger" data-index="0" style="width:100%; height:100%; object-fit:cover; border-radius:12px 0 0 12px; cursor:pointer;"></div>
        <div class="g-main" style="height:100%; overflow:hidden;"><img src="${images[1]}" alt="${title}" class="lightbox-trigger" data-index="1" style="width:100%; height:100%; object-fit:cover; border-radius:0 12px 12px 0; cursor:pointer;"></div>
      </div>`;
  } else {
    const sideImgs = images.slice(1, 4);
    const gridRows = sideImgs.length;
    return `
      <div class="gallery glass reveal in" style="display: grid; grid-template-columns: 2fr 1fr; gap: .8rem; height: 440px; border-radius:22px; overflow:hidden;">
        <div class="g-main" style="height:100%; overflow:hidden;"><img src="${images[0]}" alt="${title}" class="lightbox-trigger" data-index="0" style="width:100%; height:100%; object-fit:cover; cursor:pointer;"></div>
        <div class="g-side" style="display: grid; grid-template-rows: repeat(${gridRows}, 1fr); gap: .8rem; height: 100%;">
          ${sideImgs.map((src, idx) => `<div style="overflow:hidden;"><img src="${src}" alt="${title} photo" class="lightbox-trigger" data-index="${idx + 1}" style="width:100%; height:100%; object-fit:cover; cursor:pointer;" loading="lazy"></div>`).join('')}
        </div>
      </div>`;
  }
}

/* ── Lightbox ────────────────────────────────────────────── */
function initLightbox(images, title, root) {
  images = images.map(safeMediaUrl).filter(Boolean);
  if (images.length === 0) return;
  title = String(title || 'Property');
  let lightbox = document.getElementById('lightbox-modal');
  if (!lightbox) {
    lightbox = document.createElement('div');
    lightbox.id = 'lightbox-modal';
    lightbox.className = 'lightbox-modal';
    lightbox.innerHTML = `
      <span class="lightbox-close">&times;</span>
      <button class="lightbox-prev" aria-label="Previous image">&#10094;</button>
      <div class="lightbox-content">
        <img id="lightbox-img" src="" alt="Property View">
      </div>
      <button class="lightbox-next" aria-label="Next image">&#10095;</button>
      <div class="lightbox-caption" id="lightbox-caption"></div>
      <div class="lightbox-thumbnails" id="lightbox-thumbnails"></div>
      <div class="lightbox-zoom-controls">
        <button id="lightbox-zoom-in" title="Zoom In">🔍+</button>
        <button id="lightbox-zoom-out" title="Zoom Out">🔍-</button>
        <button id="lightbox-zoom-reset">Reset</button>
      </div>
    `;
    document.body.appendChild(lightbox);
  }

  let currentImgIndex = 0;
  let currentZoom = 1;

  const showLightboxImage = (index) => {
    currentImgIndex = (index + images.length) % images.length;
    const imgUrl = images[currentImgIndex];
    const lbImg = document.getElementById('lightbox-img');
    lbImg.src = imgUrl;
    currentZoom = 1;
    lbImg.style.transform = `scale(${currentZoom})`;
    document.getElementById('lightbox-caption').textContent = `${title} (${currentImgIndex + 1} of ${images.length})`;
    const thumbs = document.querySelectorAll('.lightbox-thumb');
    thumbs.forEach((thumb, idx) => {
      thumb.classList.toggle('active', idx === currentImgIndex);
    });
  };

  const openLightbox = (index) => {
    showLightboxImage(index);
    const thumbsTrack = document.getElementById('lightbox-thumbnails');
    thumbsTrack.innerHTML = images.map((src, idx) => `
      <img src="${escapeHTML(src)}" class="lightbox-thumb ${idx === currentImgIndex ? 'active' : ''}" data-index="${idx}" alt="Thumb ${idx + 1}">
    `).join('');
    thumbsTrack.querySelectorAll('.lightbox-thumb').forEach((thumb) => {
      thumb.addEventListener('click', (e) => {
        showLightboxImage(parseInt(e.target.dataset.index));
      });
    });
    const modal = document.getElementById('lightbox-modal');
    modal.style.display = 'flex';
    setTimeout(() => modal.classList.add('show'), 10);
  };

  const closeLightbox = () => {
    const modal = document.getElementById('lightbox-modal');
    modal.classList.remove('show');
    setTimeout(() => modal.style.display = 'none', 300);
  };

  document.querySelector('.lightbox-close').addEventListener('click', closeLightbox);
  document.querySelector('.lightbox-prev').addEventListener('click', () => showLightboxImage(currentImgIndex - 1));
  document.querySelector('.lightbox-next').addEventListener('click', () => showLightboxImage(currentImgIndex + 1));

  document.getElementById('lightbox-zoom-in').addEventListener('click', () => {
    currentZoom = Math.min(currentZoom + 0.25, 3);
    document.getElementById('lightbox-img').style.transform = `scale(${currentZoom})`;
  });
  document.getElementById('lightbox-zoom-out').addEventListener('click', () => {
    currentZoom = Math.max(currentZoom - 0.25, 0.75);
    document.getElementById('lightbox-img').style.transform = `scale(${currentZoom})`;
  });
  document.getElementById('lightbox-zoom-reset').addEventListener('click', () => {
    currentZoom = 1;
    document.getElementById('lightbox-img').style.transform = `scale(${currentZoom})`;
  });

  root.querySelectorAll('.lightbox-trigger').forEach((el) => {
    el.addEventListener('click', (e) => {
      openLightbox(parseInt(e.target.dataset.index));
    });
  });

  document.addEventListener('keydown', (e) => {
    const modal = document.getElementById('lightbox-modal');
    if (modal && modal.classList.contains('show')) {
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowLeft') showLightboxImage(currentImgIndex - 1);
      if (e.key === 'ArrowRight') showLightboxImage(currentImgIndex + 1);
    }
  });
}
