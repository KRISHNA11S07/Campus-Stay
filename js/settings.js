/* ============================================================
   CampusStay — Settings Page Logic

   Handles profile editing, password changes, preferences,
   notifications, sign out, and account deletion.
   Requires: supabase-config.js, main.js, auth-guard.js
   ============================================================ */
document.addEventListener('cs:auth-ready', async () => {
  const $ = (id) => document.getElementById(id);
  let currentProfile = null;
  let currentUser = null;
  let userRole = 'student';

  // ── Load profile data ──────────────────────────────────────
  try {
    currentUser = await getCurrentUser();
    currentProfile = await getProfile();

    if (!currentProfile) {
      console.warn('[Settings] No profile found');
      return;
    }

    userRole = currentProfile.role || 'student';
    populateProfile(currentProfile, currentUser);
    applyRoleVisibility(userRole);
    loadPreferences(currentProfile.preferences || {});
    loadSavedCount();
  } catch (err) {
    console.error('[Settings] Init error:', err);
  }

  // ── Populate profile form ──────────────────────────────────
  function populateProfile(profile, user) {
    $('s-name').value = profile.full_name || '';
    $('s-occupation').value = profile.occupation || '';
    $('s-age').value = profile.age || '';
    $('s-gender').value = profile.gender || '';
    $('s-phone').value = profile.phone || '';
    $('s-email').value = user?.email || '';

    // Avatar
    const preview = $('avatar-preview');
    if (profile.avatar_url) {
      preview.innerHTML = `<img src="${profile.avatar_url}" alt="Avatar">`;
    } else {
      const initials = (profile.full_name || '?').charAt(0).toUpperCase();
      preview.textContent = initials;
    }

    $('avatar-name').textContent = profile.full_name || 'User';
    $('avatar-role').textContent = userRole === 'owner'
      ? '🏠 Property Owner'
      : '🎓 Student';
  }

  // ── Role-based visibility ──────────────────────────────────
  function applyRoleVisibility(role) {
    document.querySelectorAll('[data-role-show]').forEach(el => {
      const allowed = el.dataset.roleShow;
      if (allowed !== role) {
        el.style.display = 'none';
      }
    });
  }

  // ── Load preferences ───────────────────────────────────────
  function loadPreferences(prefs) {
    // Dark mode toggle
    const isDark = document.documentElement.dataset.theme === 'dark';
    $('pref-dark-mode').checked = isDark;

    // Email notifications
    $('pref-email-notif').checked = prefs.email_notifications !== false;

    // Owner-specific
    if (userRole === 'owner') {
      const typeSelect = $('pref-default-type');
      if (typeSelect) typeSelect.value = prefs.default_property_type || '';

      const bookingNotif = $('pref-booking-notif');
      if (bookingNotif) bookingNotif.checked = prefs.booking_notifications !== false;
    }

    // Student-specific
    if (userRole === 'student') {
      const listingNotif = $('pref-listing-notif');
      if (listingNotif) listingNotif.checked = prefs.listing_notifications !== false;
    }
  }

  // ── Load saved count ───────────────────────────────────────
  async function loadSavedCount() {
    if (userRole !== 'student') return;

    const sb = getSupabase();
    if (!sb) return;

    try {
      const { count, error } = await sb
        .from('favorites')
        .select('*', { count: 'exact', head: true })
        .eq('student_id', currentUser.id);

      if (!error) {
        const list = $('saved-list');
        if (list) {
          list.innerHTML = `
            <div style="padding:1.2rem;border-radius:14px;background:var(--grad-soft);border:1px solid rgba(99,102,241,.15);text-align:center;">
              <span style="font-size:1.8rem;display:block;margin-bottom:.3rem;">❤️</span>
              <strong style="font-size:1.2rem;">${count || 0}</strong>
              <span style="color:var(--text-2);font-size:.85rem;display:block;">saved properties</span>
            </div>`;
        }
      }
    } catch (e) {
      console.warn('[Settings] Could not load favorites count:', e);
    }
  }

  // ── Section navigation ─────────────────────────────────────
  const navItems = document.querySelectorAll('.settings-nav-item');
  const sections = document.querySelectorAll('.settings-section');

  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const target = item.dataset.section;

      navItems.forEach(n => {
        n.classList.remove('active');
        n.setAttribute('aria-selected', 'false');
      });
      item.classList.add('active');
      item.setAttribute('aria-selected', 'true');

      sections.forEach(s => s.classList.remove('active'));
      const sec = $('sec-' + target);
      if (sec) sec.classList.add('active');
    });
  });

  // ── Helper: show message ───────────────────────────────────
  function showMsg(id, text, type = 'success') {
    const el = $(id);
    if (!el) return;
    el.textContent = text;
    el.className = `settings-msg show ${type}`;
    setTimeout(() => { el.className = 'settings-msg'; }, 5000);
  }

  // ── Save Profile ───────────────────────────────────────────
  $('profile-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = $('s-name').value.trim();
    const occupation = $('s-occupation').value.trim();
    const age = parseInt($('s-age').value) || null;
    const gender = $('s-gender').value || null;

    if (!name || name.length < 2) {
      showMsg('profile-msg', '❌ Name must be at least 2 characters.', 'error');
      return;
    }

    if (age && (age < 16 || age > 100)) {
      showMsg('profile-msg', '❌ Age must be between 16 and 100.', 'error');
      return;
    }

    const btn = $('btn-save-profile');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Saving...';

    try {
      const sb = getSupabase();
      if (!sb) throw new Error('Supabase not configured');

      const { error } = await sb
        .from('profiles')
        .update({
          full_name: name,
          occupation: occupation || null,
          age: age,
          gender: gender
        })
        .eq('id', currentUser.id);

      if (error) throw error;

      // Update local storage
      CS.store('user', {
        name: name,
        phone: currentProfile.phone,
        role: userRole
      });

      // Update avatar display
      currentProfile.full_name = name;
      $('avatar-name').textContent = name;
      $('avatar-preview').textContent = name.charAt(0).toUpperCase();

      showMsg('profile-msg', '✅ Profile updated successfully!', 'success');
    } catch (err) {
      console.error('Profile save error:', err);
      showMsg('profile-msg', '❌ ' + (err.message || 'Failed to save.'), 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Save Changes';
    }
  });

  // Cancel profile edits
  $('btn-cancel-profile').addEventListener('click', () => {
    populateProfile(currentProfile, currentUser);
    showMsg('profile-msg', 'Changes discarded.', 'success');
  });

  // ── Password strength indicator ────────────────────────────
  $('s-new-pw').addEventListener('input', (e) => {
    const pw = e.target.value;
    let strength = 0;
    if (pw.length >= 6) strength++;
    if (pw.length >= 10) strength++;
    if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) strength++;
    if (/[0-9]/.test(pw) && /[^a-zA-Z0-9]/.test(pw)) strength++;

    const classes = ['', 'weak', 'medium', 'medium', 'strong'];
    for (let i = 1; i <= 4; i++) {
      const bar = $('str-' + i);
      bar.className = 'strength-bar' + (i <= strength ? ` ${classes[strength]}` : '');
    }
  });

  // ── Change Password ────────────────────────────────────────
  $('password-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const newPw = $('s-new-pw').value;
    const confirmPw = $('s-confirm-pw').value;

    if (!newPw || newPw.length < 6) {
      showMsg('password-msg', '❌ Password must be at least 6 characters.', 'error');
      return;
    }

    if (newPw !== confirmPw) {
      showMsg('password-msg', '❌ Passwords do not match.', 'error');
      return;
    }

    const btn = $('btn-save-pw');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Updating...';

    try {
      const sb = getSupabase();
      if (!sb) throw new Error('Supabase not configured');

      const { error } = await sb.auth.updateUser({ password: newPw });
      if (error) throw error;

      $('s-new-pw').value = '';
      $('s-confirm-pw').value = '';
      // Reset strength bars
      for (let i = 1; i <= 4; i++) {
        $('str-' + i).className = 'strength-bar';
      }

      showMsg('password-msg', '✅ Password updated successfully!', 'success');
    } catch (err) {
      console.error('Password change error:', err);
      showMsg('password-msg', '❌ ' + (err.message || 'Failed to update password.'), 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Update Password';
    }
  });

  // ── Dark mode toggle ───────────────────────────────────────
  $('pref-dark-mode').addEventListener('change', (e) => {
    const theme = e.target.checked ? 'dark' : 'light';
    document.documentElement.dataset.theme = theme;
    CS.store('theme', theme);

    // Update all theme toggle buttons
    document.querySelectorAll('[data-theme-toggle]').forEach(b => {
      const label = b.querySelector('.btn-label') || b;
      label.textContent = theme === 'dark' ? '☀️' : '🌙';
    });
  });

  // ── Save Notification Preferences ──────────────────────────
  $('btn-save-notif').addEventListener('click', async () => {
    const btn = $('btn-save-notif');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Saving...';

    try {
      const prefs = {
        ...(currentProfile.preferences || {}),
        email_notifications: $('pref-email-notif').checked
      };

      if (userRole === 'owner') {
        prefs.booking_notifications = $('pref-booking-notif')?.checked !== false;
      }
      if (userRole === 'student') {
        prefs.listing_notifications = $('pref-listing-notif')?.checked !== false;
      }

      // Also save default property type if owner
      if (userRole === 'owner') {
        const typeSelect = $('pref-default-type');
        if (typeSelect) prefs.default_property_type = typeSelect.value;
      }

      const sb = getSupabase();
      if (!sb) throw new Error('Supabase not configured');

      const { error } = await sb
        .from('profiles')
        .update({ preferences: prefs })
        .eq('id', currentUser.id);

      if (error) throw error;

      currentProfile.preferences = prefs;
      showMsg('notif-msg', '✅ Preferences saved!', 'success');
    } catch (err) {
      console.error('Prefs save error:', err);
      showMsg('notif-msg', '❌ ' + (err.message || 'Failed to save preferences.'), 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Save Preferences';
    }
  });

  // ── Sign Out ───────────────────────────────────────────────
  $('btn-signout').addEventListener('click', async () => {
    const btn = $('btn-signout');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Signing out...';

    try {
      await signOut();
    } catch (err) {
      console.error('Sign out error:', err);
      if (typeof CS !== 'undefined' && CS.toast) {
        CS.toast('❌ Sign out failed. Please try again.');
      }
      btn.disabled = false;
      btn.textContent = 'Sign Out';
    }
  });

  // ── Delete Account ─────────────────────────────────────────
  const deleteModal = $('delete-modal');
  const deleteInput = $('delete-confirm-input');
  const confirmBtn = $('btn-modal-confirm');

  $('btn-delete-account').addEventListener('click', () => {
    deleteModal.classList.add('show');
    deleteInput.value = '';
    confirmBtn.disabled = true;
    deleteInput.focus();
  });

  $('btn-modal-cancel').addEventListener('click', () => {
    deleteModal.classList.remove('show');
  });

  // Close on overlay click
  deleteModal.addEventListener('click', (e) => {
    if (e.target === deleteModal) {
      deleteModal.classList.remove('show');
    }
  });

  // Enable confirm button only when "DELETE" is typed
  deleteInput.addEventListener('input', () => {
    confirmBtn.disabled = deleteInput.value.trim() !== 'DELETE';
  });

  // Perform soft-delete
  confirmBtn.addEventListener('click', async () => {
    if (deleteInput.value.trim() !== 'DELETE') return;

    confirmBtn.disabled = true;
    confirmBtn.innerHTML = '<span class="spinner"></span> Deleting...';

    try {
      const sb = getSupabase();
      if (!sb) throw new Error('Supabase not configured');

      // Soft-delete: clear profile data and mark as deactivated
      const { error } = await sb
        .from('profiles')
        .update({
          full_name: '[Deleted User]',
          occupation: null,
          age: null,
          gender: null,
          avatar_url: null,
          preferences: { deactivated_at: new Date().toISOString() }
        })
        .eq('id', currentUser.id);

      if (error) throw error;

      // Sign out
      await sb.auth.signOut();
      localStorage.removeItem('cs:user');

      if (typeof CS !== 'undefined' && CS.toast) {
        CS.toast('Account deleted. Redirecting...');
      }

      setTimeout(() => {
        window.location.href = 'index.html';
      }, 1200);
    } catch (err) {
      console.error('Delete account error:', err);
      confirmBtn.disabled = false;
      confirmBtn.textContent = 'Delete Account';

      if (typeof CS !== 'undefined' && CS.toast) {
        CS.toast('❌ Failed to delete account: ' + (err.message || 'Unknown error'));
      }
    }
  });

  // ── Keyboard: Escape closes modal ──────────────────────────
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && deleteModal.classList.contains('show')) {
      deleteModal.classList.remove('show');
    }
  });
});
