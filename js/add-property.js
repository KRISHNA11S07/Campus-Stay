/* ============================================================
   CampusStay — Add Property Logic (Step 1)
   ============================================================ */
document.addEventListener('cs:auth-ready', async () => {
  const $ = (id) => document.getElementById(id);
  const params = new URLSearchParams(location.search);
  const propertyType = params.get('type') || 'room';
  const editId = params.get('edit'); // For editing existing draft

  // Set property type (read-only)
  $('prop-type').value = propertyType;

  // Populate college dropdown from data.js constants
  const collegeSelect = $('prop-college');
  COLLEGES.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = c.name;
    collegeSelect.appendChild(opt);
  });

  // Geolocation button
  $('btn-get-location').addEventListener('click', () => {
    if (!navigator.geolocation) {
      CS.toast('❌ Geolocation is not supported by your browser.');
      return;
    }
    CS.toast('📍 Getting your location...');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        $('prop-lat').value = pos.coords.latitude.toFixed(6);
        $('prop-lng').value = pos.coords.longitude.toFixed(6);
        CS.toast('✅ Location set!');
      },
      () => CS.toast('❌ Location access denied.'),
      { timeout: 10000 }
    );
  });

  // If editing, load existing property data
  if (editId) {
    await loadExistingProperty(editId);
  }

  // Load from sessionStorage if returning from later step
  const draft = JSON.parse(sessionStorage.getItem('cs:property-draft') || 'null');
  if (draft && !editId) {
    $('prop-title').value = draft.title || '';
    $('prop-desc').value = draft.description || '';
    $('prop-area').value = draft.area || '';
    $('prop-college').value = draft.college_id || '';
    $('prop-rent').value = draft.rent || '';
    $('prop-deposit').value = draft.deposit || '';
    $('prop-gender').value = draft.gender || 'any';
    $('prop-lat').value = draft.lat || '';
    $('prop-lng').value = draft.lng || '';
  }

  // Form submission
  $('property-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const user = await getCurrentUser();
    if (!user) return;

    // Validate phone
    const phoneRaw = $('prop-phone').value.trim();
    if (phoneRaw && !/^[6-9]\d{9}$/.test(phoneRaw)) {
      CS.toast('❌ Please enter a valid 10-digit phone number.');
      return;
    }

    const propertyData = {
      owner_id: user.id,
      type: $('prop-type').value,
      title: $('prop-title').value.trim(),
      description: $('prop-desc').value.trim(),
      area: $('prop-area').value.trim(),
      college_id: $('prop-college').value,
      lat: parseFloat($('prop-lat').value) || null,
      lng: parseFloat($('prop-lng').value) || null,
      rent: parseInt($('prop-rent').value),
      deposit: parseInt($('prop-deposit').value) || 0,
      gender: $('prop-gender').value,
      listing_status: 'draft',
      rent_period: editId ? ($('prop-rent').dataset.period || null) : 'year',
      ...(editId ? {} : {available:true})
    };

    const btn = $('btn-next-step');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Saving...';

    try {
      const sb = getSupabase();

      propertyData.owner_phone = phoneRaw ? '+91' + phoneRaw : null;
      if (!phoneRaw) propertyData.owner_whatsapp = null;

      let propertyId = editId;

      if (propertyId) {
        // Update existing
        const { error } = await sb
          .from('properties')
          .update(propertyData)
          .eq('id', propertyId)
          .eq('owner_id', user.id).select('id').single();
        if (error) throw error;
      } else {
        // Insert new
        const { data, error } = await sb
          .from('properties')
          .insert(propertyData)
          .select('id')
          .single();
        if (error) throw error;
        propertyId = data.id;
      }

      // Save draft to sessionStorage for subsequent steps
      sessionStorage.setItem('cs:property-id', propertyId);
      sessionStorage.setItem('cs:property-draft', JSON.stringify({
        ...propertyData,
        id: propertyId
      }));

      CS.toast('✅ Property details saved!');
      setTimeout(() => {
        location.href = 'media-upload.html?property=' + propertyId;
      }, 600);
    } catch (err) {
      console.error('Property save error:', err);
      CS.toast('❌ ' + (err.message || 'Failed to save property.'));
      btn.disabled = false;
      btn.textContent = 'Save & Continue to Photos →';
    }
  });

  async function loadExistingProperty(id) {
    const sb = getSupabase();
    const user = await getCurrentUser();
    const { data, error } = await sb
      .from('properties')
      .select('*')
      .eq('id', id)
      .eq('owner_id', user.id)
      .single();

    if (error || !data) {
      CS.toast('Property unavailable. Return to your dashboard.');
      $('btn-next-step').disabled = true;
      return;
    }

    $('prop-title').value = data.title || '';
    $('prop-desc').value = data.description || '';
    $('prop-area').value = data.area || '';
    $('prop-college').value = data.college_id || '';
    $('prop-rent').value = data.rent || '';
    $('prop-rent').dataset.period=data.rent_period||'';
    document.querySelector('label[for=prop-rent]').textContent=data.rent_period==='month'?'Monthly rent (₹/month)':data.rent_period==='year'?'Annual rent (₹/year)':'Rent (existing period unconfirmed)';
    $('prop-rent').min = '1';
    $('prop-deposit').value = data.deposit || '';
    $('prop-gender').value = data.gender || 'any';
    $('prop-lat').value = data.lat || '';
    $('prop-lng').value = data.lng || '';
    $('prop-type').value = data.type;

    $('prop-phone').value = String(data.owner_phone || '').replace(/^\+?91/, '');

    sessionStorage.setItem('cs:property-id', id);
    sessionStorage.setItem('cs:property-draft', JSON.stringify(data));
  }
});
