/* ============================================================
   CampusStay — Facilities Selection Logic (Step 3)
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
  let selectedFacilities = new Set();

  // Set back link
  $('btn-back').href = 'media-upload.html?property=' + propertyId;

  // Fetch all facilities from DB
  const { data: allFacilities, error } = await sb
    .from('facilities')
    .select('*')
    .order('id');

  if (error) {
    console.error('Error loading facilities:', error);
    // Fallback to local data.js FACILITIES
    renderFacilitiesFromLocal();
  } else {
    renderFacilities(allFacilities);
  }

  // Load existing selections
  const { data: existing } = await sb
    .from('property_facilities')
    .select('facility_id')
    .eq('property_id', propertyId);

  if (existing) {
    existing.forEach(pf => selectedFacilities.add(pf.facility_id));
    updateSelectionUI();
  }

  function renderFacilities(facilities) {
    const grid = $('fac-grid');
    grid.innerHTML = facilities.map(f => `
      <label class="fac-select-item ${selectedFacilities.has(f.id) ? 'selected' : ''}" data-fac="${f.id}">
        <input type="checkbox" value="${f.id}" ${selectedFacilities.has(f.id) ? 'checked' : ''}>
        <span>${f.icon}</span>
        <span>${f.label}</span>
      </label>
    `).join('');

    bindCheckboxes();
  }

  function renderFacilitiesFromLocal() {
    const grid = $('fac-grid');
    grid.innerHTML = Object.entries(FACILITIES).map(([id, f]) => `
      <label class="fac-select-item" data-fac="${id}">
        <input type="checkbox" value="${id}">
        <span>${f.icon}</span>
        <span>${f.label}</span>
      </label>
    `).join('');

    bindCheckboxes();
  }

  function bindCheckboxes() {
    $('fac-grid').querySelectorAll('input[type="checkbox"]').forEach(cb => {
      cb.addEventListener('change', () => {
        if (cb.checked) {
          selectedFacilities.add(cb.value);
        } else {
          selectedFacilities.delete(cb.value);
        }
        updateSelectionUI();
      });
    });
  }

  function updateSelectionUI() {
    $('fac-grid').querySelectorAll('.fac-select-item').forEach(item => {
      const fid = item.dataset.fac;
      const cb = item.querySelector('input');
      const isSelected = selectedFacilities.has(fid);
      item.classList.toggle('selected', isSelected);
      cb.checked = isSelected;
    });
  }

  // ── Save & Continue ──────────────────────────────────
  $('btn-next').addEventListener('click', async () => {
    const btn = $('btn-next');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Saving...';

    try {
      // Delete existing facilities for this property
      await sb.from('property_facilities').delete().eq('property_id', propertyId);

      // Insert selected ones
      if (selectedFacilities.size > 0) {
        const rows = Array.from(selectedFacilities).map(fid => ({
          property_id: propertyId,
          facility_id: fid
        }));
        const { error } = await sb.from('property_facilities').insert(rows);
        if (error) throw error;
      }

      // Store in sessionStorage for confirmation page
      sessionStorage.setItem('cs:property-facilities', JSON.stringify(Array.from(selectedFacilities)));

      CS.toast('✅ Facilities saved!');
      setTimeout(() => {
        location.href = 'rules.html?property=' + propertyId;
      }, 600);
    } catch (err) {
      console.error('Facilities save error:', err);
      CS.toast('❌ ' + (err.message || 'Failed to save facilities.'));
      btn.disabled = false;
      btn.textContent = 'Continue to Rules →';
    }
  });
});
