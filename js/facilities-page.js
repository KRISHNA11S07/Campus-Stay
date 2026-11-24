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
    CS.toast("Facilities could not be loaded. Refresh before editing.");
    return;
  } else {
    renderFacilities(allFacilities);
  }

  // Load existing selections
  const { data: existing, error: selectionError } = await sb
    .from('property_facilities')
    .select('facility_id')
    .eq('property_id', propertyId);

  if (selectionError) { CS.toast("Current facilities could not be loaded. Refresh before editing."); return; }
  if (existing) {
    existing.forEach(pf => selectedFacilities.add(pf.facility_id));
    updateSelectionUI();
  }

  function renderFacilities(facilities) {
    const grid = $('fac-grid');
    grid.innerHTML = facilities.map(f => `
      <label class="fac-select-item ${selectedFacilities.has(f.id) ? 'selected' : ''}" data-fac="${CS.escapeHTML(f.id)}">
        <input type="checkbox" value="${CS.escapeHTML(f.id)}" ${selectedFacilities.has(f.id) ? 'checked' : ''}>
        <span>${CS.escapeHTML(f.icon)}</span>
        <span>${CS.escapeHTML(f.label)}</span>
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
      const { error } = await sb.rpc('replace_listing_details', {
        p_property: propertyId, p_section: 'facilities', p_values: Array.from(selectedFacilities)
      });
      if (error) throw error;

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
