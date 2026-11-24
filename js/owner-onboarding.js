/* CampusStay owner onboarding — seven deliberate, recoverable steps. */
document.addEventListener('cs:auth-ready', async (event) => {
  const { profile, user } = event.detail;
  const $ = (id) => document.getElementById(id);
  const escapeHTML = (value = '') => String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' }[char]));
  const query = new URLSearchParams(location.search);
  const sb = getSupabase();
  const draftId = query.get('draft') || crypto.randomUUID();
  let revision = 0;

  let currentStep = 1;
  let publishing = false;
  let dirty = false;
  $('owner-wizard-form').addEventListener('submit', event => event.preventDefault());
  $('owner-wizard-form').addEventListener('input', () => { dirty = true; });
  window.addEventListener('beforeunload', event => {
    if (dirty) { event.preventDefault(); event.returnValue = ''; }
  });
  let photos = [];
  let locationState = { lat: null, lng: null, source: null };

  $('owner-name').value = profile.full_name || user.user_metadata?.full_name || '';
  $('owner-occupation').value = profile.occupation || '';
  $('owner-phone').value = String(profile.phone || '').replace(/^\+91/, '');
  $('owner-whatsapp').value = String(profile.whatsapp || '').replace(/^\+91/, '');
  $('property-type').value = query.get('type') || '';

  function renderColleges() {
    const select = $('property-college');
    if (typeof COLLEGES === 'undefined') return;
    select.innerHTML += COLLEGES.map((college) => `<option value="${escapeHTML(college.id)}">${escapeHTML(college.name)} · ${escapeHTML(college.city)}</option>`).join('');
  }

  function renderAmenities() {
    const root = $('amenity-grid');
    const items = references.map(row => [row.id,row]);
    root.innerHTML = items.map(([id, facility]) => `<label class="amenity-option"><input type="checkbox" value="${escapeHTML(id)}"><span class="amenity-check">✓</span><span>${escapeHTML(facility.icon || '•')} ${escapeHTML(facility.label || id)}</span></label>`).join('');
  }
  const referenceResult = await sb.from('facilities').select('id,label,icon').order('label');
  const references = referenceResult.data || [];
  if (referenceResult.error) { setError('Could not load amenities. Refresh to retry.'); return; }
  renderColleges();
  $('property-college').value = 'kit';
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
    $('wizard-next').textContent = currentStep === 7 ? 'Submit for review' : 'Continue';
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
      if ($('contact-mode').value === 'public' && !/^[6-9]\d{9}$/.test($('owner-phone').value)) return setError('Enter a valid 10-digit phone number.'), false;
    }
    if (step === 3) {
      if (!Array.from(document.querySelectorAll('[data-step="3"] input')).every(input => input.checkValidity())) return setError('Check rent, deposit, capacity and distance.'), false;
      if (!$('property-type').value || $('property-title').value.trim().length < 4 || $('property-description').value.trim().length < 20) return setError('Add a property type, a clear title, and at least a short description.'), false;
      if (Number($('property-rent').value) < 500) return setError('Enter a monthly rent of at least ₹500.'), false;
    }
    if (step === 4) {
      const coordinates = [$('property-lat').value,$('property-lng').value];
      if (Boolean(coordinates[0]) !== Boolean(coordinates[1]) || Math.abs(Number(coordinates[0]))>90 || Math.abs(Number(coordinates[1]))>180) return setError('Enter a valid latitude and longitude together, or leave both blank.'), false;
      if ($('property-area').value.trim().length < 2) return setError('Add the area or locality students should see.'), false;
    }
    if (step === 1 && $('contact-mode').value === 'public' && $('owner-whatsapp').value && !/^[6-9]\d{9}$/.test($('owner-whatsapp').value)) return setError('Enter a valid WhatsApp number or leave it blank.'), false;
    if (step === 6 && photos.length === 0) return setError('Add at least one property photo before submitting.'), false;
    return true;
  }

  function renderPhotos() {
    const root = $('owner-photo-grid');
    root.innerHTML = photos.map((photo, index) => `<article class="owner-photo"><img src="${escapeHTML(CS.safeImageUrl(photo.url))}" alt="Property photo ${index + 1}">${index === 0 ? '<span class="owner-photo-primary">Primary image</span>' : ''}<div class="owner-photo-actions"><button type="button" data-photo-move="up" data-photo-index="${index}" aria-label="Move image earlier" ${index === 0 ? 'disabled' : ''}>←</button><button type="button" data-photo-move="down" data-photo-index="${index}" aria-label="Move image later" ${index === photos.length - 1 ? 'disabled' : ''}>→</button><button type="button" data-photo-remove="${index}" aria-label="Remove image">×</button></div></article>`).join('');
    $('owner-upload-status').textContent = photos.length
      ? `${photos.length} photo${photos.length === 1 ? '' : 's'} ready${photos.length < 5 ? ' · we recommend at least 5' : ' · great coverage'}.`
      : 'Your uploaded photos stay private during review.';
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
      if (photos.length >= 12) { rejected++; continue; }
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 8 * 1024 * 1024) { rejected += 1; continue; }
      try {
        const optimized = await optimizeImage(file);
        const { width, height } = await imageDimensions(optimized);
        if (width < 640 || height < 420) { rejected += 1; continue; }
        photos.push({ file: optimized, key:crypto.randomUUID(), url: URL.createObjectURL(optimized), width, height });
      } catch (_) { rejected += 1; }
    }
    dirty = true;
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
    if (remove || move) dirty = true;
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
      dirty = true;
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
    root.innerHTML = `<div class="listing-preview-media">${photo ? `<img src="${escapeHTML(CS.safeImageUrl(photo.url))}" alt="Primary property preview">` : ''}<span>${photos.length} photo${photos.length === 1 ? '' : 's'} selected</span></div><div><h3>${escapeHTML($('property-title').value || 'Your property title')}</h3><p>📍 ${escapeHTML($('property-area').value || 'Area to be confirmed')} · ${escapeHTML(($('property-type').value || 'property').toUpperCase())}</p><p>${escapeHTML($('property-description').value || 'Your property description will appear here.')}</p><div class="preview-meta"><span>₹${rent}/month</span><span>${selectedAmenities().length} amenities</span><span>${document.querySelector('input[name="location-privacy"]:checked').value === 'area_only' ? 'Area only' : 'Approximate pin'}</span></div></div>`;
    const details = document.createElement('dl');
    for (const [label,value] of [
      ['Rent and deposit','₹'+rent+' per month · deposit ₹'+($('property-deposit').value || 0)],
      ['Room arrangement',$('property-room-type').value],['Capacity',$('property-capacity').value],
      ['Available from',$('property-available-from').value],['City',$('property-city').value],
      ['Near college',$('property-college').selectedOptions[0]?.textContent],['Distance (km)',$('property-distance').value],
      ['Facilities',Array.from(document.querySelectorAll('#amenity-grid input:checked'),n=>n.parentElement.textContent.trim()).join(', ')],
      ['House rules',$('property-rules').value],['Owner',$('owner-name').value],
      ['Contact',$('contact-mode').value==='public' ? [$('owner-phone').value,$('owner-whatsapp').value].filter(Boolean).join(' / ') : 'In-app enquiries only'],
      ['Private address for your records',$('property-address').value]
    ]) {
      if (!value) continue;
      const term=document.createElement('dt'), description=document.createElement('dd');
      term.textContent=label; description.textContent=value; details.append(term,description);
    }
    root.append(details);
  }

  function updatePublishProgress(percent, label) {
    const progress = $('publish-progress');
    progress.hidden = false;
    progress.querySelector('i').style.width = percent + '%';
    $('publish-progress-label').textContent = label;
  }

  function draftFields() {
    return [...document.querySelectorAll('.wizard-panel input[id], .wizard-panel textarea[id], .wizard-panel select[id]')]
      .filter(node => !['file','checkbox','radio'].includes(node.type));
  }
  function payload() {
    return {fields:Object.fromEntries(draftFields().map(node=>[node.id,node.value])),
      privacy:document.querySelector('[name="location-privacy"]:checked').value, step:currentStep,
      amenities:selectedAmenities(),photos:photos.filter(p=>p.path).map(p=>({path:p.path}))};
  }
  async function saveSnapshot() {
    const snapshot = payload();
    const result=await sb.rpc('save_listing_draft',{p_id:draftId,p_revision:revision,p_payload:snapshot});
    if(result.error) throw result.error;
    revision=result.data;
    history.replaceState(null,'','owner-onboarding.html?draft='+encodeURIComponent(draftId));
  }
  async function persist(submit) {
    if(publishing)return;
    if(submit) for(const step of [1,3,4,6]) if(!validStep(step)){const message=$('wizard-error').textContent;setStep(step);setError(message);return;}
    publishing=true;
    document.querySelector('.owner-wizard').inert=true;
    try {
      await saveSnapshot();
      for(const [index,photo] of photos.entries()) {
        if(photo.path)continue;
        updatePublishProgress(10+Math.round(index/photos.length*75),'Uploading photo '+(index+1)+' of '+photos.length);
        const ext=({'image/webp':'webp','image/jpeg':'jpg','image/png':'png'})[photo.file.type];
        const path=user.id+'/'+draftId+'/'+photo.key+'.'+ext;
        const {error}=await sb.storage.from('property-media').upload(path,photo.file,{contentType:photo.file.type,upsert:false});
        if(error && String(error.statusCode)!=='409' && error.error!=='Duplicate')throw error;
        photo.path=path;
        await saveSnapshot();
      }
      if(submit){
        const result=await sb.rpc('submit_listing_draft',{p_id:draftId,p_revision:revision});
        if(result.error)throw result.error;
        updatePublishProgress(100,'Your property has been submitted for review.');
        CS.toast('Your property has been submitted for review.');
        dirty = false;
        location.assign('owner-dashboard.html');
      } else { dirty = false; updatePublishProgress(100,'Draft saved. Resume from your dashboard.'); }
    } catch(error) {
      if (submit) {
        const receipt = await sb.from('listing_drafts').select('submitted_at').eq('id',draftId).maybeSingle();
        if (receipt.data?.submitted_at) { dirty=false; CS.toast('Your property has been submitted for review.'); location.assign('owner-dashboard.html'); return; }
      }
      console.warn('[Listing draft]',error.code||'connection error');
      setError('Save could not be confirmed. Your form is still here. Check your connection. If another tab saved this draft, reopen it from the dashboard.');
    } finally {publishing=false;document.querySelector('.owner-wizard').inert=false;}
  }
  if(query.has('draft')){
    const {data,error}=await sb.from('listing_drafts').select('payload,revision,submitted_at').eq('id',draftId).maybeSingle();
    if(error || !data){setError('Draft unavailable. Return to your dashboard.');return;}
    if(data.submitted_at){location.replace('owner-dashboard.html');return;}
    revision=data.revision;
    for(const node of draftFields()) if(data.payload.fields?.[node.id]!=null)node.value=data.payload.fields[node.id];
    for(const node of document.querySelectorAll('#amenity-grid input'))node.checked=(data.payload.amenities||[]).includes(node.value);
    for(const node of document.querySelectorAll('[name="location-privacy"]'))node.checked=node.value===data.payload.privacy;
    photos=await Promise.all((data.payload.photos||[]).map(async p=>{
      const result=await sb.storage.from('property-media').createSignedUrl(p.path,900);
      return {path:p.path,url:result.data?.signedUrl||''};
    }));
    currentStep=Number(data.payload.step)||1;renderPhotos();
  }
  $('wizard-save').addEventListener('click',()=>persist(false));
  $('wizard-next').addEventListener('click', () => {
    if (currentStep === 7) { persist(true); return; }
    if (!validStep(currentStep)) return;
    setStep(currentStep + 1);
  });
  $('wizard-back').addEventListener('click', () => { if (!publishing) setStep(currentStep - 1); });
  setStep(currentStep);
});
