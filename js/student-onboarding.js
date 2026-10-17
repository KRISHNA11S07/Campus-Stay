/* CampusStay student onboarding — deliberately optional. */
document.addEventListener('cs:auth-ready', async (event) => {
  const preferences = [
    ['night-owl', '◒', 'Night Owl'], ['early-bird', '☀', 'Early Bird'], ['studious', '✦', 'Studious'],
    ['fitness', '◌', 'Fitness Freak'], ['sporty', '◐', 'Sporty'], ['traveller', '↗', 'Traveller'],
    ['party-lover', '♪', 'Party Lover'], ['pet-lover', '♡', 'Pet Lover'], ['vegetarian', '⌁', 'Vegetarian'],
    ['non-alcoholic', '◈', 'Non-Alcoholic'], ['music-lover', '♫', 'Music Lover'], ['non-smoker', '○', 'Non-Smoker']
  ];
  const root = document.getElementById('preference-chips');
  const selected = new Set(event.detail.profile?.preferences?.lifestyle || []);
  root.innerHTML = preferences.map(([id, symbol, label]) => `<button class="preference-chip ${selected.has(id) ? 'active' : ''}" type="button" data-preference="${id}" aria-pressed="${selected.has(id)}"><span class="preference-symbol" aria-hidden="true">${symbol}</span>${label}</button>`).join('');
  root.addEventListener('click', (event) => {
    const chip = event.target.closest('[data-preference]');
    if (!chip) return;
    const id = chip.dataset.preference;
    selected.has(id) ? selected.delete(id) : selected.add(id);
    chip.classList.toggle('active', selected.has(id));
    chip.setAttribute('aria-pressed', String(selected.has(id)));
  });

  async function finish(saveSelection) {
    const button = document.getElementById(saveSelection ? 'save-preferences' : 'skip-preferences');
    button.disabled = true;
    try {
      const sb = getSupabase();
      const profile = event.detail.profile || await getProfile(event.detail.session);
      const current = profile?.preferences || {};
      const next = {
        ...current,
        ...(saveSelection ? { lifestyle: [...selected] } : {}),
        onboarding: { ...(current.onboarding || {}), student_complete: true }
      };
      const { error } = await sb.from('profiles').update({ preferences: next }).eq('id', event.detail.user.id);
      if (error) throw error;
      CS.toast(saveSelection && selected.size ? 'Preferences saved. Finding your fit…' : 'No problem — you can set preferences later.');
      window.setTimeout(() => { window.location.href = 'index.html'; }, 500);
    } catch (error) {
      button.disabled = false;
      CS.toast('We could not save that choice. Please try again.');
      console.warn('[Onboarding] preference save failed:', error.message);
    }
  }
  document.getElementById('save-preferences').addEventListener('click', () => finish(true));
  document.getElementById('skip-preferences').addEventListener('click', () => finish(false));
});
