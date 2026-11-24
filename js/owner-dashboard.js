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
        <p style="color:var(--text-2);">Please refresh and try again.</p>
      </div>`;
    return;
  }

  const drafts=await sb.from('listing_drafts').select('id,payload').eq('owner_id',user.id).is('submitted_at',null);
  const enquiries=await sb.from('inquiries').select('id',{count:'exact',head:true}).eq('owner_id',user.id);
  if(drafts.error || enquiries.error){container.textContent='Dashboard counts could not be loaded. Refresh to retry.';return;}
  const draftList=document.getElementById('saved-drafts');
  draftList.replaceChildren();
  for(const draft of drafts.data){
    const link=document.createElement('a');link.className='btn btn-ghost';
    link.href='owner-onboarding.html?draft='+encodeURIComponent(draft.id);
    link.textContent='Resume '+(draft.payload.fields?.['property-title']||'untitled draft');draftList.append(link);
  }
  const metrics=[['Properties',properties.length],['Drafts',drafts.data.length+properties.filter(p=>p.listing_status==='draft').length],
    ...['pending','published','rejected','paused','rented'].map(state=>[state,properties.filter(p=>p.listing_status===state).length]),['Enquiries',enquiries.count]];
  statsContainer.innerHTML=metrics.map(([label,value])=>`<div class="stat-card glass"><div class="stat-value">${value}</div><div class="stat-label">${label}</div></div>`).join('');
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

    const statusClass = prop.listing_status;
    const statusLabel = prop.listing_status;

    return `
      <div class="prop-status-card glass" data-prop-id="${prop.id}">
        <img class="thumb" src="${CS.escapeHTML(CS.safeImageUrl(thumb))}" alt="${CS.escapeHTML(prop.title)}" loading="lazy">
        <div>
          <h3>${CS.escapeHTML(prop.title)}</h3>
          <p class="meta">
            📍 ${CS.escapeHTML(prop.area || 'Location not set')} ·
            ${prop.type.toUpperCase()} ·
            ₹${prop.rent?.toLocaleString('en-IN') || '0'}${prop.rent_period ? "/"+prop.rent_period : " (confirm period)"}
          </p>
          ${prop.rejection_reason ? `<p class="meta" style="color:#ef4444;margin-top:.3rem;">Reason: ${CS.escapeHTML(prop.rejection_reason)}</p>` : ''}
          <div class="prop-card-actions" style="margin-top:.6rem; display:flex; gap:.5rem; flex-wrap:wrap;">
            <a href="add-property.html?edit=${prop.id}&type=${prop.type}" class="btn btn-ghost btn-sm">✏️ Edit</a>
            <a href="property.html?id=${prop.id}" class="btn btn-ghost btn-sm">👁️ View</a>
            <button class="btn btn-ghost btn-sm" data-state="${prop.listing_status==='published'?'paused':'pending'}" data-id="${prop.id}">${prop.listing_status==='published'?'Pause':'Submit for review'}</button>
            <button class="btn btn-ghost btn-sm" data-availability="${prop.available?'false':'true'}" data-id="${prop.id}">${prop.available?'Mark unavailable':'Mark available'}</button>
          </div>
        </div>
        <span class="status-badge ${statusClass}">${statusLabel}</span>
      </div>`;
  }).join('');
}

document.getElementById('my-properties').addEventListener('click',async event=>{
  const button=event.target.closest('button[data-id]');if(!button)return;
  const patch=button.dataset.state?{listing_status:button.dataset.state}:{available:button.dataset.availability==='true',listing_status:'pending'};
  if(!confirm('Save this change? Availability edits return the listing for review.'))return;
  button.disabled=true;
  const result=await getSupabase().from('properties').update(patch).eq('id',button.dataset.id).select('id').single();
  if(result.error){button.disabled=false;CS.toast('Change could not be confirmed. Refresh before retrying.');return;}
  await loadMyProperties();
});
