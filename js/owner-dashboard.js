/* ============================================================
   CampusStay — Owner Dashboard Logic
   ============================================================ */
document.addEventListener('cs:auth-ready', async () => {
  const profile = await getProfile();
  const user = await getCurrentUser();

  if (!profile) return;

  // Update greeting
  const greeting = document.getElementById('dash-greeting');
  greeting.textContent = `Welcome back, ${profile.full_name || 'Owner'}! Manage your properties below.`;

  const badge = document.getElementById('dash-user-badge');
  badge.textContent = `🏠 ${profile.full_name || 'Owner'} · ${profile.occupation || 'Property Owner'}`;

  // Update nav auth CTA
  CS.store('user', {
    name: profile.full_name || 'Owner',
    phone: profile.phone,
    role: 'owner'
  });

  // Fetch my properties & render stats
  await loadMyProperties();
});

async function loadMyProperties() {
  const sb = getSupabase();
  const user = await getCurrentUser();
  const container = document.getElementById('my-properties');
  const statsContainer = document.getElementById('dash-stats');

  const { data: properties, error } = await sb
    .from('properties')
    .select(`
      *,
      property_media(file_url, storage_path, display_order)
    `)
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error loading properties:', error);
    container.innerHTML = `
      <div class="empty-state glass">
        <div class="big">⚠️</div>
        <h3>Error loading properties</h3>
        <p style="color:var(--text-2);">${error.message}</p>
      </div>`;
    return;
  }

  // Render stats
  if (statsContainer) {
    const total = properties ? properties.length : 0;
    const pending = properties ? properties.filter(p => p.verification_status === 'pending').length : 0;
    const verified = properties ? properties.filter(p => p.verification_status === 'verified').length : 0;
    const rejected = properties ? properties.filter(p => p.verification_status === 'rejected').length : 0;

    statsContainer.innerHTML = `
      <div class="stat-card glass">
        <div class="stat-icon">🏠</div>
        <div class="stat-value">${total}</div>
        <div class="stat-label">Total</div>
      </div>
      <div class="stat-card glass">
        <div class="stat-icon">⏳</div>
        <div class="stat-value">${pending}</div>
        <div class="stat-label">Pending</div>
      </div>
      <div class="stat-card glass">
        <div class="stat-icon">✅</div>
        <div class="stat-value">${verified}</div>
        <div class="stat-label">Verified</div>
      </div>
      <div class="stat-card glass">
        <div class="stat-icon">❌</div>
        <div class="stat-value">${rejected}</div>
        <div class="stat-label">Rejected</div>
      </div>
    `;
  }

  if (!properties || properties.length === 0) {
    container.innerHTML = `
      <div class="empty-state glass" style="padding:3rem;">
        <div class="big">🏠</div>
        <h3>No properties yet</h3>
        <p style="color:var(--text-2); margin:.5rem 0 1.2rem;">Click one of the categories above to list your first property!</p>
      </div>`;
    return;
  }

  const hydratedProperties = await Promise.all(properties.map(async (prop) => ({ ...prop, property_media: await resolveMediaUrls(prop.property_media || []) })));
  container.innerHTML = hydratedProperties.map(prop => {
    const thumb = prop.property_media && prop.property_media.length > 0
      ? prop.property_media.sort((a, b) => a.display_order - b.display_order)[0].file_url
      : 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?q=80&w=200&auto=format&fit=crop';

    const statusClass = prop.verification_status;
    const statusLabel = prop.verification_status.charAt(0).toUpperCase() + prop.verification_status.slice(1);

    return `
      <div class="prop-status-card glass" data-prop-id="${prop.id}">
        <img class="thumb" src="${thumb}" alt="${prop.title}" loading="lazy">
        <div>
          <h3>${prop.title}</h3>
          <p class="meta">
            📍 ${prop.area || 'Location not set'} · 
            ${prop.type.toUpperCase()} · 
            ₹${prop.rent?.toLocaleString('en-IN') || '0'}/year
          </p>
          ${prop.rejection_reason ? `<p class="meta" style="color:#ef4444;margin-top:.3rem;">Reason: ${prop.rejection_reason}</p>` : ''}
          <div class="prop-card-actions" style="margin-top:.6rem; display:flex; gap:.5rem; flex-wrap:wrap;">
            <a href="add-property.html?edit=${prop.id}&type=${prop.type}" class="btn btn-ghost btn-sm">✏️ Edit</a>
            <a href="property.html?id=${prop.id}" class="btn btn-ghost btn-sm">👁️ View</a>
            <button class="btn btn-ghost btn-sm" style="color:#ef4444; border-color:rgba(239,68,68,.3);" onclick="deleteProperty('${prop.id}', this)">🗑️ Delete</button>
          </div>
        </div>
        <span class="status-badge ${statusClass}">${statusLabel}</span>
      </div>`;
  }).join('');
}

// Delete property handler
async function deleteProperty(propertyId, btn) {
  if (!confirm('Are you sure you want to delete this property? This cannot be undone.')) return;

  btn.disabled = true;
  btn.textContent = '⏳';

  try {
    const sb = getSupabase();
    const user = await getCurrentUser();

    // Delete related data first
    await sb.from('property_rules').delete().eq('property_id', propertyId);
    await sb.from('property_facilities').delete().eq('property_id', propertyId);
    
    // Delete media from storage and DB
    const { data: media } = await sb.from('property_media').select('storage_path').eq('property_id', propertyId);
    if (media && media.length > 0) {
      const paths = media.map(m => m.storage_path).filter(Boolean);
      if (paths.length > 0) {
        await sb.storage.from('property-media').remove(paths);
      }
    }
    await sb.from('property_media').delete().eq('property_id', propertyId);

    // Delete the property itself (RLS ensures only own property)
    const { error } = await sb
      .from('properties')
      .delete()
      .eq('id', propertyId)
      .eq('owner_id', user.id);

    if (error) throw error;

    CS.toast('🗑️ Property deleted successfully.');
    await loadMyProperties(); // Refresh the list
  } catch (err) {
    console.error('Delete error:', err);
    CS.toast('❌ ' + (err.message || 'Failed to delete property.'));
    btn.disabled = false;
    btn.textContent = '🗑️ Delete';
  }
}
