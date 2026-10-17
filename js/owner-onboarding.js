/* CampusStay owner onboarding — seven deliberate, recoverable steps. */
document.addEventListener('cs:auth-ready', async (event) => {
  const { profile, user } = event.detail;
  const $ = (id) => document.getElementById(id);
  const escapeHTML = (value = '') => String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' }[char]));
  const query = new URLSearchParams(location.search);
  if (profile.preferences?.onboarding?.owner_complete === true && query.get('new') !== '1') {
    window.location.replace('owner-dashboard.html');
    return;
  }

  let currentStep = 1;
  let publishing = false;
  let photos = [];
  let locationState = { lat: null, lng: null, source: null };

  $('owner-name').value = profile.full_name || user.user_metadata?.full_name || '';
  $('owner-occupation').value = profile.occupation || '';
  $('owner-phone').value = String(profile.phone || '').replace(/^\+91/, '');
  $('owner-whatsapp').value = String(profile.whatsapp || '').replace(/^\+91/, '');
  $('owner-age').value = profile.age || '';
  $('owner-gender').value = profile.gender || '';
  $('property-type').value = query.get('type') || '';

  function renderColleges() {
    const select = $('property-college');
    if (typeof COLLEGES === 'undefined') return;
    select.innerHTML += COLLEGES.map((college) => `<option value="${escapeHTML(college.id)}">${escapeHTML(college.name)} · ${escapeHTML(college.city)}</option>`).join('');
  }

  function renderAmenities() {
    const root = $('amenity-grid');
    const items = typeof FACILITIES === 'undefined' ? [] : Object.entries(FACILITIES);
    root.innerHTML = items.map(([id, facility]) => `<label class="amenity-option"><input type="checkbox" value="${escapeHTML(id)}"><span class="amenity-check">✓</span><span>${escapeHTML(facility.icon || '•')} ${escapeHTML(facility.label || id)}</span></label>`).join('');
  }
  renderColleges();
  renderAmenities();

  function setError(message = '') { $('wizard-error').textContent = message; }
  function setStep(step) {
    currentStep = Math.min(7, Math.max(1, step));
    document.querySelectorAll('.wizard-panel').forEach((panel) => panel.classList.toggle('active', Number(panel.dataset.step) === currentStep));
    document.querySelectorAll('[data-progress-step]').forEach((item) => {
      const number = Number(item.dataset.progressStep);
      item.classList.toggle('active', number === currentStep);
      item.classList.toggle('done', number < currentStep);
    });
    $('wizard-back').hidden = currentStep === 1 || publishing;
    $('wizard-next').textContent = currentStep === 7 ? 'Publish listing' : 'Continue';
    setError();
    if (currentStep === 6) renderPreview();
    document.querySelector('.owner-wizard')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function selectedAmenities() {
    return [...document.querySelectorAll('#amenity-grid input:checked')].map((input) => input.value);
  }

  function validStep(step) {
    const name = $('owner-name').value.trim().replace(/\s+/g, ' ');
    const occupation = $('owner-occupation').value.trim();
    if (step === 1) {
      if (!/^[\p{L}][\p{L}\s.'-]{1,79}$/u.test(name) || name.split(' ').length < 2) return setError('Enter your first and last name.'), false;
      if (occupation.length < 2) return setError('Add your occupation or property role.'), false;
      if (!/^[6-9]\d{9}$/.test($('owner-phone').value.replace(/\D/g, ''))) return setError('Enter a valid 10-digit phone number.'), false;
    }
    if (step === 3) {
      if (!$('property-type').value || $('property-title').value.trim().length < 4 || $('property-description').value.trim().length < 20) return setError('Add a property type, a clear title, and at least a short description.'), false;
      if (Number($('property-rent').value) < 500) return setError('Enter a monthly rent of at least ₹500.'), false;
    }
    if (step === 4) {
      if ($('property-area').value.trim().length < 2) return setError('Add the area or locality students should see.'), false;
    }
    if (step === 6 && photos.length === 0) return setError('Add at least one property photo before publishing.'), false;
    return true;
  }

  function renderPhotos() {
    const root = $('owner-photo-grid');
    root.innerHTML = photos.map((photo, index) => `<article class="owner-photo"><img src="${photo.url}" alt="Property photo ${index + 1}">${index === 0 ? '<span class="owner-photo-primary">Primary image</span>' : ''}<div class="owner-photo-actions"><button type="button" data-photo-move="up" data-photo-index="${index}" aria-label="Move image earlier" ${index === 0 ? 'disabled' : ''}>←</button><button type="button" data-photo-move="down" data-photo-index="${index}" aria-label="Move image later" ${index === photos.length - 1 ? 'disabled' : ''}>→</button><button type="button" data-photo-remove="${index}" aria-label="Remove image">×</button></div></article>`).join('');
    $('owner-upload-status').textContent = photos.length
      ? `${photos.length} photo${photos.length === 1 ? '' : 's'} ready${photos.length < 5 ? ' · we recommend at least 5' : ' · great coverage'}.`
      : 'Your images are kept in this draft until you publish.';
  }

  function imageDimensions(file) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      const objectUrl = URL.createObjectURL(file);
      image.onload = () => { URL.revokeObjectURL(objectUrl); resolve({ width: image.naturalWidth, height: image.naturalHeight }); };
      image.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('This image could not be read.')); };
      image.src = objectUrl;
    });
  }

  async function optimizeImage(file) {
    // Keep originals when the browser cannot produce a smaller WebP. This is
    // intentionally client-side so uploads stay within the owner's control.
    if (!window.HTMLCanvasElement || file.type === 'image/webp') return file;
    const image = new Image();
    const source = URL.createObjectURL(file);
    try {
      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = reject;
        image.src = source;
      });
      const longestEdge = Math.max(image.naturalWidth, image.naturalHeight);
      const scale = Math.min(1, 2200 / longestEdge);
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(image.naturalWidth * scale);
      canvas.height = Math.round(image.naturalHeight * scale);
      canvas.getContext('2d', { alpha: false })?.drawImage(image, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', .84));
      if (!blob || blob.size >= file.size) return file;
      const base = file.name.replace(/\.[^.]+$/, '') || 'property-photo';
      return new File([blob], `${base}.webp`, { type: 'image/webp', lastModified: Date.now() });
    } finally {
      URL.revokeObjectURL(source);
    }
  }

  async function addFiles(fileList) {
    const files = [...fileList];
    let rejected = 0;
    for (const file of files) {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 8 * 1024 * 1024) { rejected += 1; continue; }
      try {
        const optimized = await optimizeImage(file);
        const { width, height } = await imageDimensions(optimized);
        if (width < 640 || height < 420) { rejected += 1; continue; }
        photos.push({ file: optimized, url: URL.createObjectURL(optimized), width, height });
      } catch (_) { rejected += 1; }
    }
    renderPhotos();
    if (rejected) $('owner-upload-status').textContent = `${rejected} file${rejected === 1 ? ' was' : 's were'} skipped. Use JPG, PNG, or WebP up to 8 MB and at least 640 × 420 px.`;
  }

  $('owner-photo-input').addEventListener('change', async (inputEvent) => {
    await addFiles(inputEvent.target.files);
    inputEvent.target.value = '';
  });

  let cameraStream = null;
  const cameraDialog = $('owner-camera-dialog');
  const cameraVideo = $('owner-camera-preview');
  function closeCamera() {
    if (cameraStream) cameraStream.getTracks().forEach((track) => track.stop());
    cameraStream = null;
    if (cameraVideo) cameraVideo.srcObject = null;
    if (cameraDialog?.open) cameraDialog.close();
  }
  async function openCamera() {
    if (!navigator.mediaDevices?.getUserMedia || !cameraDialog?.showModal) {
      $('owner-camera-input').click();
      return;
    }
    try {
      $('owner-camera-message').textContent = 'Requesting camera permission…';
      cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      cameraVideo.srcObject = cameraStream;
      cameraDialog.showModal();
      $('owner-camera-message').textContent = 'When the room is in frame, capture the photo.';
    } catch (error) {
      console.info('[CampusStay] Camera unavailable; using file picker.', error.message);
      $('owner-camera-input').click();
      $('owner-upload-status').textContent = 'Camera access was unavailable, so we opened your image picker instead.';
    }
  }
  $('owner-camera-trigger').addEventListener('click', openCamera);
  $('owner-camera-cancel').addEventListener('click', closeCamera);
  $('owner-camera-fallback').addEventListener('click', () => { closeCamera(); $('owner-camera-input').click(); });
  cameraDialog?.addEventListener('close', closeCamera);
  $('owner-camera-capture').addEventListener('click', async () => {
    if (!cameraVideo.videoWidth || !cameraVideo.videoHeight) {
      $('owner-camera-message').textContent = 'The camera is still starting. Please try again in a moment.';
      return;
    }
    const canvas = document.createElement('canvas');
    canvas.width = cameraVideo.videoWidth;
    canvas.height = cameraVideo.videoHeight;
    canvas.getContext('2d').drawImage(cameraVideo, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', .9));
    if (!blob) return;
    closeCamera();
    await addFiles([new File([blob], `camera-${Date.now()}.jpg`, { type: 'image/jpeg' })]);
  });
  $('owner-camera-input').addEventListener('change', async (inputEvent) => {
    await addFiles(inputEvent.target.files);
    inputEvent.target.value = '';
  });
  const dropZone = $('owner-upload-zone');
  ['dragenter', 'dragover'].forEach((name) => dropZone.addEventListener(name, (dragEvent) => { dragEvent.preventDefault(); dropZone.classList.add('dragover'); }));
  ['dragleave', 'drop'].forEach((name) => dropZone.addEventListener(name, (dragEvent) => { dragEvent.preventDefault(); dropZone.classList.remove('dragover'); }));
  dropZone.addEventListener('drop', (dragEvent) => addFiles(dragEvent.dataTransfer.files));
  $('owner-photo-grid').addEventListener('click', (clickEvent) => {
    const remove = clickEvent.target.closest('[data-photo-remove]');
    const move = clickEvent.target.closest('[data-photo-move]');
    if (remove) {
      const index = Number(remove.dataset.photoRemove);
      URL.revokeObjectURL(photos[index].url);
      photos.splice(index, 1);
      renderPhotos();
    }
    if (move) {
      const index = Number(move.dataset.photoIndex);
      const destination = move.dataset.photoMove === 'up' ? index - 1 : index + 1;
      if (photos[destination]) [photos[index], photos[destination]] = [photos[destination], photos[index]];
      renderPhotos();
    }
  });

  function selectManualLocation() {
    document.querySelectorAll('.location-choice-card').forEach((button) => button.classList.toggle('active', button.id === 'manual-location'));
    $('location-message').textContent = 'Enter the area students can see. The address field stays private.';
    $('property-area').focus();
  }
  $('manual-location').addEventListener('click', selectManualLocation);
  $('allow-location').addEventListener('click', () => {
    if (!navigator.geolocation) { $('location-message').textContent = 'This browser cannot share location. Please enter it manually.'; selectManualLocation(); return; }
    $('allow-location').disabled = true;
    $('location-message').textContent = 'Requesting location after your approval…';
    navigator.geolocation.getCurrentPosition((position) => {
      locationState = { lat: position.coords.latitude, lng: position.coords.longitude, source: 'device' };
      $('property-lat').value = locationState.lat.toFixed(6);
      $('property-lng').value = locationState.lng.toFixed(6);
      $('location-message').textContent = 'Location found. Add the public area / locality below to finish this step.';
      $('allow-location').classList.add('active');
      $('allow-location').disabled = false;
      $('property-area').focus();
    }, () => {
      $('location-message').textContent = 'Location was not shared. You can continue with a manual location.';
      $('allow-location').disabled = false;
      selectManualLocation();
    }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 });
  });

  function renderPreview() {
    const root = $('listing-preview');
    const photo = photos[0];
    const rent = Number($('property-rent').value || 0).toLocaleString('en-IN');
    root.innerHTML = `<div class="listing-preview-media">${photo ? `<img src="${photo.url}" alt="Primary property preview">` : ''}<span>${photos.length} photo${photos.length === 1 ? '' : 's'} selected</span></div><div><h3>${escapeHTML($('property-title').value || 'Your property title')}</h3><p>📍 ${escapeHTML($('property-area').value || 'Area to be confirmed')} · ${escapeHTML(($('property-type').value || 'property').toUpperCase())}</p><p>${escapeHTML($('property-description').value || 'Your property description will appear here.')}</p><div class="preview-meta"><span>₹${rent}/month</span><span>${selectedAmenities().length} amenities</span><span>${document.querySelector('input[name="location-privacy"]:checked').value === 'area_only' ? 'Area only' : 'Approximate pin'}</span></div></div>`;
  }

  function approximateCoordinate(value) {
    return Number.isFinite(value) ? Math.round(value * 1000) / 1000 : null;
  }
  function updatePublishProgress(percent, label) {
    const progress = $('publish-progress');
    progress.hidden = false;
    progress.querySelector('i').style.width = percent + '%';
    $('publish-progress-label').textContent = label;
  }

  async function publishListing() {
    if (!validStep(6) || publishing) return;
    publishing = true;
    setError();
    $('wizard-next').disabled = true;
    $('wizard-back').disabled = true;
    const sb = getSupabase();
    let propertyId = null;
    const storagePaths = [];
    try {
      updatePublishProgress(8, 'Saving your owner profile…');
      const age = $('owner-age').value ? Number($('owner-age').value) : null;
      const gender = $('owner-gender').value || null;
      const { error: ownerError } = await sb.from('profiles').update({
        full_name: $('owner-name').value.trim().replace(/\s+/g, ' '), occupation: $('owner-occupation').value.trim(), age, gender
      }).eq('id', user.id);
      if (ownerError) throw ownerError;

      const phone = '+91' + $('owner-phone').value.replace(/\D/g, '');
      const whatsappDigits = $('owner-whatsapp').value.replace(/\D/g, '');
      const whatsapp = whatsappDigits ? '+91' + whatsappDigits : phone;
      const { error: contactError } = await sb.rpc('set_my_owner_contact', { p_phone: phone, p_whatsapp: whatsapp });
      if (contactError) throw new Error('Owner contact setup is not deployed yet. Run migration 009_listing_details.sql and publish again.');

      const manualLat = Number($('property-lat').value);
      const manualLng = Number($('property-lng').value);
      const exactLat = Number.isFinite(locationState.lat) ? locationState.lat : (Number.isFinite(manualLat) ? manualLat : null);
      const exactLng = Number.isFinite(locationState.lng) ? locationState.lng : (Number.isFinite(manualLng) ? manualLng : null);
      const privacy = document.querySelector('input[name="location-privacy"]:checked').value;
      updatePublishProgress(19, 'Creating your private listing draft…');
      const { data: property, error: propertyError } = await sb.from('properties').insert({
        owner_id: user.id,
        type: $('property-type').value,
        title: $('property-title').value.trim(),
        description: $('property-description').value.trim(),
        area: $('property-area').value.trim(),
        college_id: $('property-college').value || null,
        rent: Number($('property-rent').value),
        deposit: Number($('property-deposit').value || 0),
        city: $('property-city').value.trim() || null,
        available_from: $('property-available-from').value || null,
        distance_km: $('property-distance').value ? Number($('property-distance').value) : null,
        room_bed_count: $('property-capacity').value ? Number($('property-capacity').value) : null,
        owner_name: $('owner-name').value.trim().replace(/\s+/g, ' '),
        owner_phone: phone,
        owner_whatsapp: whatsapp,
        gender: $('property-gender').value,
        // The public table only ever receives an approximate point.
        lat: privacy === 'approximate' ? approximateCoordinate(exactLat) : null,
        lng: privacy === 'approximate' ? approximateCoordinate(exactLng) : null,
        verification_status: 'pending'
      }).select('id').single();
      if (propertyError) throw propertyError;
      propertyId = property.id;

      updatePublishProgress(31, 'Protecting your exact location…');
      const { error: locationError } = await sb.from('property_locations').upsert({
        property_id: propertyId,
        owner_id: user.id,
        exact_lat: exactLat,
        exact_lng: exactLng,
        private_address: $('property-address').value.trim() || null,
        privacy_mode: privacy
      });
      if (locationError) {
        if (/property_locations|does not exist|schema cache/i.test(locationError.message || '')) throw new Error('Location privacy is not deployed yet. Run migration 008_auth_onboarding_privacy.sql and publish again.');
        throw locationError;
      }

      for (let index = 0; index < photos.length; index += 1) {
        const photo = photos[index];
        updatePublishProgress(34 + Math.round((index / photos.length) * 48), `Uploading photo ${index + 1} of ${photos.length}…`);
        const extension = photo.file.name.split('.').pop().toLowerCase();
        const path = `${user.id}/${propertyId}/${Date.now()}_${index}.${extension}`;
        const { error: uploadError } = await sb.storage.from('property-media').upload(path, photo.file, { cacheControl: '3600', upsert: false, contentType: photo.file.type });
        if (uploadError) throw uploadError;
        storagePaths.push(path);
        const { error: mediaError } = await sb.from('property_media').insert({ property_id: propertyId, file_url: '', file_type: 'image', storage_path: path, file_size: photo.file.size, display_order: index });
        if (mediaError) throw mediaError;
      }

      updatePublishProgress(85, 'Saving amenities and property details…');
      const amenities = selectedAmenities();
      if (amenities.length) {
        const { error } = await sb.from('property_facilities').insert(amenities.map((facility_id) => ({ property_id: propertyId, facility_id })));
        if (error) throw error;
      }
      const rules = $('property-rules').value.split('\n').map((rule) => rule.trim()).filter(Boolean);
      if (rules.length) {
        const { error } = await sb.from('property_rules').insert(rules.map((rule_text, display_order) => ({ property_id: propertyId, rule_text, display_order })));
        if (error) throw error;
      }
      const preferences = profile.preferences || {};
      const { error: profileError } = await sb.from('profiles').update({ preferences: { ...preferences, onboarding: { ...(preferences.onboarding || {}), owner_complete: true } } }).eq('id', user.id);
      if (profileError) throw profileError;
      updatePublishProgress(100, 'Listing submitted for verification.');
      CS.toast('Your listing was submitted for review.');
      window.setTimeout(() => { window.location.href = 'owner-dashboard.html'; }, 800);
    } catch (error) {
      console.warn('[Owner onboarding] publish failed:', error.message);
      // Do not leave an inaccessible partial listing behind if a privacy or upload step fails.
      if (storagePaths.length) await sb.storage.from('property-media').remove(storagePaths);
      if (propertyId) await sb.from('properties').delete().eq('id', propertyId);
      updatePublishProgress(0, 'Upload paused. Nothing was published.');
      setError(error.message && error.message.includes('migration 008') ? error.message : 'We could not publish this listing. Check your connection and try again.');
      publishing = false;
      $('wizard-next').disabled = false;
      $('wizard-back').disabled = false;
    }
  }

  $('wizard-next').addEventListener('click', () => {
    if (currentStep === 7) { publishListing(); return; }
    if (!validStep(currentStep)) return;
    setStep(currentStep + 1);
  });
  $('wizard-back').addEventListener('click', () => { if (!publishing) setStep(currentStep - 1); });
  setStep(1);
});
