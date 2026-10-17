/* ============================================================
   CampusStay — Media Upload Logic (Step 2)
   Uploads files to Supabase Storage, stores URLs in property_media
   ============================================================ */
document.addEventListener('cs:auth-ready', async () => {
  const $ = (id) => document.getElementById(id);
  const params = new URLSearchParams(location.search);
  const propertyId = params.get('property') || sessionStorage.getItem('cs:property-id');

  if (!propertyId) {
    CS.toast('❌ No property found. Start from the beginning.');
    setTimeout(() => { location.href = 'owner-dashboard.html'; }, 1000);
    return;
  }

  const user = await getCurrentUser();
  const sb = getSupabase();
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
  const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
  const ALLOWED_VIDEO_TYPES = ['video/mp4'];
  const ALLOWED_TYPES = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES];

  let uploadedMedia = []; // { id, file_url, file_type, storage_path }

  // Set back link
  $('btn-back').href = 'add-property.html?edit=' + propertyId;

  // Load existing media
  await loadExistingMedia();

  // ── Drag & Drop ──────────────────────────────────────
  const zone = $('upload-zone');
  zone.addEventListener('dragover', (e) => {
    e.preventDefault();
    zone.classList.add('dragover');
  });
  zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('dragover');
    handleFiles(e.dataTransfer.files);
  });

  // ── File input change ────────────────────────────────
  $('file-input').addEventListener('change', (e) => {
    handleFiles(e.target.files);
    e.target.value = ''; // Reset so same file can be selected again
  });

  // ── Handle files ─────────────────────────────────────
  async function handleFiles(fileList) {
    const files = Array.from(fileList);

    for (const file of files) {
      // Validate type
      if (!ALLOWED_TYPES.includes(file.type)) {
        CS.toast(`❌ ${file.name}: Unsupported file type.`);
        continue;
      }
      // Validate size
      if (file.size > MAX_FILE_SIZE) {
        CS.toast(`❌ ${file.name}: File too large (max 10 MB).`);
        continue;
      }

      await uploadFile(file);
    }
  }

  // ── Upload single file ───────────────────────────────
  async function uploadFile(file) {
    const fileType = file.type.startsWith('video/') ? 'video' : 'image';
    const ext = file.name.split('.').pop();
    const fileName = `${user.id}/${propertyId}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;

    // Show placeholder while uploading
    const tempId = 'temp-' + Date.now();
    const previewUrl = URL.createObjectURL(file);
    addMediaToGrid({ id: tempId, file_url: previewUrl, file_type: fileType, uploading: true });

    updateStatus(`Uploading ${file.name}...`);

    try {
      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await sb.storage
        .from('property-media')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;

      // Persist the protected object path. A signed URL is generated only for
      // an authorized reader when the media is displayed.
      const { data: mediaRecord, error: dbError } = await sb
        .from('property_media')
        .insert({
          property_id: propertyId,
          file_url: '',
          file_type: fileType,
          storage_path: fileName,
          file_size: file.size,
          display_order: uploadedMedia.length
        })
        .select()
        .single();

      if (dbError) throw dbError;

      // Replace temp item with real one
      uploadedMedia = uploadedMedia.filter(m => m.id !== tempId);
      uploadedMedia.push((await resolveMediaUrls([mediaRecord]))[0]);
      renderGrid();

      URL.revokeObjectURL(previewUrl);
      updateStatus(`✅ ${file.name} uploaded successfully!`);
    } catch (err) {
      console.error('Upload error:', err);
      // Remove temp item
      uploadedMedia = uploadedMedia.filter(m => m.id !== tempId);
      renderGrid();
      CS.toast(`❌ Failed to upload ${file.name}: ${err.message}`);
      updateStatus('');
    }
  }

  // ── Remove media ─────────────────────────────────────
  async function removeMedia(mediaId, storagePath) {
    try {
      // Delete from storage
      if (storagePath) {
        await sb.storage.from('property-media').remove([storagePath]);
      }

      // Delete from database
      await sb.from('property_media').delete().eq('id', mediaId);

      uploadedMedia = uploadedMedia.filter(m => m.id !== mediaId);
      renderGrid();
      CS.toast('🗑️ Media removed.');
    } catch (err) {
      console.error('Remove error:', err);
      CS.toast('❌ Failed to remove media.');
    }
  }

  // ── Render grid ──────────────────────────────────────
  function renderGrid() {
    const grid = $('media-grid');
    if (uploadedMedia.length === 0) {
      grid.innerHTML = '';
      return;
    }

    grid.innerHTML = uploadedMedia.map(m => {
      const isVideo = m.file_type === 'video';
      const isUploading = m.uploading;
      return `
        <div class="media-item" data-id="${m.id}">
          ${isVideo
            ? `<video src="${m.file_url}" muted></video>`
            : `<img src="${m.file_url}" alt="Property photo" loading="lazy">`
          }
          ${isUploading
            ? `<div class="upload-progress" style="width:60%;"></div>`
            : `<button class="remove-btn" data-remove="${m.id}" data-path="${m.storage_path || ''}" title="Remove">✕</button>`
          }
        </div>`;
    }).join('');

    // Bind remove buttons
    grid.querySelectorAll('[data-remove]').forEach(btn => {
      btn.addEventListener('click', () => {
        removeMedia(btn.dataset.remove, btn.dataset.path);
      });
    });
  }

  function addMediaToGrid(item) {
    uploadedMedia.push(item);
    renderGrid();
  }

  function updateStatus(text) {
    $('upload-status').textContent = text;
  }

  // ── Load existing media ──────────────────────────────
  async function loadExistingMedia() {
    const { data, error } = await sb
      .from('property_media')
      .select('*')
      .eq('property_id', propertyId)
      .order('display_order');

    if (!error && data) {
      uploadedMedia = await resolveMediaUrls(data);
      renderGrid();
    }
  }

  // ── Next button ──────────────────────────────────────
  $('btn-next').addEventListener('click', () => {
    if (uploadedMedia.length === 0) {
      CS.toast('📸 Please upload at least one photo.');
      return;
    }
    location.href = 'facilities.html?property=' + propertyId;
  });
});
