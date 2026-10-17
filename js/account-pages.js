/* CampusStay account routes. Each page receives a verified auth context. */
document.addEventListener('cs:auth-ready', async (event) => {
  const page = document.body.dataset.accountPage;
  const { profile, user, session } = event.detail;
  const escapeHTML = (value = '') => String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' }[char]));
  const initials = (name = '') => name.split(/\s+/).filter(Boolean).map((item) => item[0]).join('').slice(0, 2).toUpperCase() || 'C';

  const lifestyle = [
    ['night-owl', '◒', 'Night Owl'], ['early-bird', '☀', 'Early Bird'], ['studious', '✦', 'Studious'],
    ['fitness', '◌', 'Fitness Freak'], ['sporty', '◐', 'Sporty'], ['traveller', '↗', 'Traveller'],
    ['party-lover', '♪', 'Party Lover'], ['pet-lover', '♡', 'Pet Lover'], ['vegetarian', '⌁', 'Vegetarian'],
    ['non-alcoholic', '◈', 'Non-Alcoholic'], ['music-lover', '♫', 'Music Lover'], ['non-smoker', '○', 'Non-Smoker']
  ];

  function renderPreferenceEditor() {
    const root = document.getElementById('preference-chips');
    if (!root) return;
    const selected = new Set(profile.preferences?.lifestyle || []);
    root.innerHTML = lifestyle.map(([id, symbol, label]) => `<button class="preference-chip ${selected.has(id) ? 'active' : ''}" type="button" data-preference="${id}" aria-pressed="${selected.has(id)}"><span class="preference-symbol" aria-hidden="true">${symbol}</span>${label}</button>`).join('');
    root.addEventListener('click', (clickEvent) => {
      const chip = clickEvent.target.closest('[data-preference]');
      if (!chip) return;
      const id = chip.dataset.preference;
      selected.has(id) ? selected.delete(id) : selected.add(id);
      chip.classList.toggle('active', selected.has(id));
      chip.setAttribute('aria-pressed', String(selected.has(id)));
    });
    document.getElementById('save-preferences')?.addEventListener('click', async () => {
      const button = document.getElementById('save-preferences');
      button.disabled = true;
      const original = button.textContent;
      button.textContent = 'Saving…';
      try {
        const current = profile.preferences || {};
        const next = { ...current, lifestyle: [...selected], onboarding: { ...(current.onboarding || {}), student_complete: true } };
        const { error } = await getSupabase().from('profiles').update({ preferences: next }).eq('id', user.id);
        if (error) throw error;
        profile.preferences = next;
        CS.toast('Preferences saved.');
      } catch (error) {
        console.warn('[Account] preferences save failed:', error.message);
        CS.toast('We could not save your preferences. Please try again.');
      } finally {
        button.disabled = false;
        button.textContent = original;
      }
    });
  }

  if (page === 'profile') {
    const root = document.getElementById('profile-root');
    const name = profile.full_name || user.user_metadata?.full_name || 'CampusStay member';
    const owner = profile.role === 'owner';
    const avatar = profile.avatar_url
      ? `<img src="${escapeHTML(profile.avatar_url)}" alt="${escapeHTML(name)}">`
      : escapeHTML(initials(name));
    const preferenceCount = profile.preferences?.lifestyle?.length || 0;
    root.innerHTML = `
      <aside class="account-surface profile-summary">
        <div class="profile-avatar">${avatar}</div><h2>${escapeHTML(name)}</h2><p class="profile-email">${escapeHTML(user.email || 'Email not available')}</p>
        <span class="role-badge">${owner ? '⌂ Property owner' : '✦ Student'}</span><br><span class="verification-badge">● ${user.email_confirmed_at || user.phone_confirmed_at ? 'Verified account' : 'Account active'}</span>
        <a class="btn btn-primary" href="settings.html">Edit profile</a>
      </aside>
      <div class="profile-content">
        <section class="account-surface profile-section"><div class="section-heading"><div><h2>Account details</h2><p>Your private information is visible only to you.</p></div></div><div class="detail-list"><div class="detail-item"><span>Full name</span><b>${escapeHTML(name)}</b></div><div class="detail-item"><span>Email</span><b>${escapeHTML(user.email || 'Not set')}</b></div><div class="detail-item"><span>Phone</span><b>${escapeHTML(CS_phone.format(profile.phone) || 'Not set')}</b></div><div class="detail-item"><span>Role</span><b>${owner ? 'Property owner' : 'Student'}</b></div></div></section>
        <section class="account-surface profile-section"><div class="section-heading"><div><h2>${owner ? 'Owner workspace' : 'Your rental setup'}</h2><p>${owner ? 'Manage properties and keep your listing details up to date.' : preferenceCount ? preferenceCount + ' lifestyle preference' + (preferenceCount === 1 ? '' : 's') + ' saved.' : 'Personalize your recommendations anytime.'}</p></div></div><div class="quick-link-grid">${owner ? '<a class="quick-link" href="my-listings.html">My listings <span>→</span></a><a class="quick-link" href="owner-onboarding.html?new=1">Add listing <span>→</span></a>' : '<a class="quick-link" href="preferences.html">My preferences <span>→</span></a><a class="quick-link" href="saved.html">Saved rooms <span>→</span></a>'}<a class="quick-link" href="notifications.html">Notifications <span>→</span></a><a class="quick-link" href="settings.html">Privacy & settings <span>→</span></a></div></section>
        <section class="account-surface profile-section"><div class="section-heading"><div><h2>Need a hand?</h2><p>Support is one tap away, and your cookie choices remain under your control.</p></div><a class="btn btn-ghost btn-sm" href="help.html">Help & support</a></div></section>
      </div>`;
  }

  if (page === 'preferences') renderPreferenceEditor();

  if (page === 'saved') {
    const root = document.getElementById('saved-root');
    const savedIds = CS.wishlist();
    const listings = (typeof LISTINGS === 'undefined' ? [] : LISTINGS).filter((listing) => savedIds.includes(listing.id));
    if (!listings.length) {
      root.innerHTML = '<div class="account-surface empty-account-state"><div class="empty-icon">♡</div><h2>Nothing saved yet</h2><p>When a room feels promising, save it here so it is easy to compare later.</p><a class="btn btn-primary" href="listings.html">Explore stays</a></div>';
    } else {
      root.innerHTML = listings.map((listing) => CS.listingCard(listing)).join('');
      CS.bindWishlistButtons(root);
    }
  }

  if (page === 'notifications') {
    const root = document.getElementById('notifications-root');
    const owner = profile.role === 'owner';
    root.innerHTML = `<article class="notification-item"><span class="notification-dot"></span><div><h3>You are all caught up</h3><p>${owner ? 'New enquiries and listing review updates will appear here.' : 'New matches, saved-room changes, and account updates will appear here.'}</p></div></article><article class="notification-item"><span class="notification-dot" style="opacity:.38"></span><div><h3>Notification choices are yours</h3><p>Control email and account notifications from Settings at any time.</p></div></article>`;
  }

  if (page === 'matches') {
    const root = document.getElementById('matches-root');
    const count = profile.preferences?.lifestyle?.length || 0;
    root.innerHTML = `<div class="empty-icon">✦</div><h2>${count ? 'Your match profile is ready' : 'Set your match profile'}</h2><p>${count ? 'We saved ' + count + ' lifestyle preference' + (count === 1 ? '' : 's') + '. Explore verified rooms while we make matching more specific.' : 'Choose a few optional lifestyle preferences and we will use them to improve future matches.'}</p><a class="btn btn-primary" href="${count ? 'listings.html' : 'preferences.html'}">${count ? 'Browse verified rooms' : 'Set preferences'}</a>`;
  }

  if (page === 'my-listings') {
    const root = document.getElementById('my-listings-root');
    root.innerHTML = '<div class="account-surface empty-account-state"><div class="empty-icon">⌂</div><h2>Loading your listings</h2></div>';
    try {
      const { data, error } = await getSupabase().from('properties').select('id,title,area,type,rent,verification_status,property_media(file_url,storage_path,display_order)').eq('owner_id', user.id).order('created_at', { ascending: false });
      if (error) throw error;
      if (!data?.length) {
        root.innerHTML = '<div class="account-surface empty-account-state"><div class="empty-icon">⌂</div><h2>Your first listing starts here</h2><p>Set up your property with photos, location privacy, amenities, and a preview before it is submitted for review.</p><a class="btn btn-primary" href="owner-onboarding.html?new=1">Set up a property</a></div>';
      } else {
        const hydrated = await Promise.all(data.map(async (listing) => ({ ...listing, property_media: await resolveMediaUrls(listing.property_media || []) })));
        root.innerHTML = hydrated.map((listing) => {
          const media = [...(listing.property_media || [])].sort((a, b) => a.display_order - b.display_order);
          const thumb = media[0]?.file_url || 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?q=80&w=700&auto=format&fit=crop';
          const status = ['pending', 'verified', 'rejected'].includes(listing.verification_status) ? listing.verification_status : 'pending';
          return `<article class="account-surface listing-management-card"><img class="listing-thumb" src="${escapeHTML(thumb)}" alt="${escapeHTML(listing.title)}"><h2>${escapeHTML(listing.title)}</h2><p>${escapeHTML(listing.area || 'Area not set')} · ${escapeHTML(String(listing.type || '').toUpperCase())} · ₹${Number(listing.rent || 0).toLocaleString('en-IN')}/year</p><div class="listing-management-foot"><span class="status-pill ${status}">${status.charAt(0).toUpperCase() + status.slice(1)}</span><a class="btn btn-ghost btn-sm" href="add-property.html?edit=${encodeURIComponent(listing.id)}&type=${encodeURIComponent(listing.type)}">Edit</a></div></article>`;
        }).join('');
      }
    } catch (error) {
      console.warn('[Account] listing load failed:', error.message);
      root.innerHTML = '<div class="account-surface empty-account-state"><div class="empty-icon">!</div><h2>We could not load your listings</h2><p>Please refresh the page or try again in a moment.</p></div>';
    }
  }
});
