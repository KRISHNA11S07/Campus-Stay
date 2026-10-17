/* ============================================================
   CampusStay — Review & Submit Logic (Step 5)
   ============================================================ */
document.addEventListener('cs:auth-ready', async () => {
  const $ = (id) => document.getElementById(id);
  const params = new URLSearchParams(location.search);
  const propertyId = params.get('property') || sessionStorage.getItem('cs:property-id');

  if (!propertyId) {
    CS.toast('❌ No property found.');
    setTimeout(() => { location.href = 'owner-dashboard.html'; }, 1000);
    return;
  }

  const sb = getSupabase();
  const user = await getCurrentUser();
  const profile = await getProfile();

  // Set edit link
  $('btn-edit').href = 'add-property.html?edit=' + propertyId;

  // ── Fetch all property data ──────────────────────────
  const { data: property, error: propError } = await sb
    .from('properties')
    .select('*')
    .eq('id', propertyId)
    .eq('owner_id', user.id)
    .single();

  if (propError || !property) {
    $('review-content').innerHTML = '<p style="color:#ef4444;">Property not found.</p>';
    return;
  }

  const { data: media } = await sb
    .from('property_media')
    .select('*')
    .eq('property_id', propertyId)
    .order('display_order');
  const resolvedMedia = await resolveMediaUrls(media || []);

  const { data: facRows } = await sb
    .from('property_facilities')
    .select('facility_id, facilities(label, icon)')
    .eq('property_id', propertyId);

  const { data: rules } = await sb
    .from('property_rules')
    .select('*')
    .eq('property_id', propertyId)
    .order('display_order');

  const college = COLLEGES.find(c => c.id === property.college_id);

  // ── Render review content ────────────────────────────
  $('review-content').innerHTML = `
    <!-- Owner Info -->
    <div class="confirm-section">
      <h3>👤 Owner Information</h3>
      <dl class="confirm-kv">
        <dt>Name</dt><dd>${profile?.full_name || 'Not set'}</dd>
        <dt>Phone</dt><dd>${profile?.phone || 'Not set'}</dd>
        <dt>Occupation</dt><dd>${profile?.occupation || 'Not set'}</dd>
      </dl>
    </div>

    <!-- Property Details -->
    <div class="confirm-section">
      <h3>🏠 Property Details <span class="edit-link" onclick="location.href='add-property.html?edit=${propertyId}'">Edit</span></h3>
      <dl class="confirm-kv">
        <dt>Title</dt><dd>${property.title}</dd>
        <dt>Type</dt><dd style="text-transform:uppercase;">${property.type}</dd>
        <dt>Area</dt><dd>${property.area || 'Not set'}</dd>
        <dt>College</dt><dd>${college ? college.name : 'Not set'}</dd>
        <dt>Rent</dt><dd>₹${property.rent?.toLocaleString('en-IN')}/year</dd>
        <dt>Deposit</dt><dd>₹${property.deposit?.toLocaleString('en-IN')}</dd>
        <dt>For</dt><dd>${property.gender === 'any' ? 'Everyone' : property.gender === 'female' ? 'Girls Only' : 'Boys Only'}</dd>
        <dt>Location</dt><dd>${property.lat ? `${property.lat}, ${property.lng}` : 'Not set'}</dd>
      </dl>
      <p style="margin-top:.8rem; color:var(--text-2); font-size:.9rem;">${property.description || 'No description provided.'}</p>
    </div>

    <!-- Media -->
    <div class="confirm-section">
      <h3>📸 Photos & Videos (${resolvedMedia.length}) <span class="edit-link" onclick="location.href='media-upload.html?property=${propertyId}'">Edit</span></h3>
      ${resolvedMedia.length > 0 ? `
        <div class="confirm-media-grid">
          ${resolvedMedia.map(m => m.file_type === 'video'
            ? `<video src="${m.file_url}" style="width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:10px;" muted></video>`
            : `<img src="${m.file_url}" alt="Property photo" loading="lazy">`
          ).join('')}
        </div>
      ` : '<p style="color:var(--text-3);">No media uploaded.</p>'}
    </div>

    <!-- Facilities -->
    <div class="confirm-section">
      <h3>✨ Facilities (${facRows?.length || 0}) <span class="edit-link" onclick="location.href='facilities.html?property=${propertyId}'">Edit</span></h3>
      ${facRows && facRows.length > 0 ? `
        <div class="confirm-fac-list">
          ${facRows.map(f => `<span class="fac-pill">${f.facilities.icon} ${f.facilities.label}</span>`).join('')}
        </div>
      ` : '<p style="color:var(--text-3);">No facilities selected.</p>'}
    </div>

    <!-- Rules -->
    <div class="confirm-section">
      <h3>📋 Rules (${rules?.length || 0}) <span class="edit-link" onclick="location.href='rules.html?property=${propertyId}'">Edit</span></h3>
      ${rules && rules.length > 0 ? `
        <ul class="confirm-rules-list">
          ${rules.map(r => `<li>${r.rule_text}</li>`).join('')}
        </ul>
      ` : '<p style="color:var(--text-3);">No rules added.</p>'}
    </div>
  `;

  // ── Submit ───────────────────────────────────────────
  $('btn-submit').addEventListener('click', async () => {
    const btn = $('btn-submit');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Submitting...';

    try {
      // Set verification_status to 'pending' (explicit)
      const { error } = await sb
        .from('properties')
        .update({
          verification_status: 'pending',
          updated_at: new Date().toISOString()
        })
        .eq('id', propertyId)
        .eq('owner_id', user.id);

      if (error) throw error;

      // Clean up sessionStorage
      sessionStorage.removeItem('cs:property-id');
      sessionStorage.removeItem('cs:property-draft');
      sessionStorage.removeItem('cs:property-facilities');
      sessionStorage.removeItem('cs:property-rules');

      CS.toast('🎉 Property submitted for review! Our team will verify it within 48 hours.');
      setTimeout(() => { location.href = 'owner-dashboard.html'; }, 1500);
    } catch (err) {
      console.error('Submit error:', err);
      CS.toast('❌ ' + (err.message || 'Submission failed.'));
      btn.disabled = false;
      btn.textContent = '✅ Confirm & Submit';
    }
  });
});
