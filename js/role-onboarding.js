/* First-session role selection. Role promotion happens only through the
   database RPC; preferences merely record that the choice was completed. */
document.addEventListener('cs:auth-ready', async (event) => {
  const { profile, session, user } = event.detail;
  const status = document.getElementById('role-choice-status');
  const buttons = [...document.querySelectorAll('[data-role-choice]')];

  if (!profileNeedsRoleSelection(profile)) {
    window.location.replace(getPostAuthDestination(profile));
    return;
  }

  async function choose(role) {
    buttons.forEach((button) => { button.disabled = true; });
    status.textContent = role === 'owner' ? 'Preparing your owner workspace…' : 'Setting up your student experience…';
    try {
      const sb = getSupabase();
      if (!sb) throw new Error('Supabase is not configured.');

      let resolved = profile;

      /* Promote student → owner through the secure database RPC */
      if (role === 'owner' && profile.role !== 'owner') {
        const rpcResult = await sb.rpc('promote_to_owner');
        if (rpcResult.error) throw rpcResult.error;
        /* Re-fetch profile to get the updated role */
        resolved = await waitForProfile(session);
      }

      if (!resolved) throw new Error('Your profile is still being prepared.');

      /* Mark the onboarding step as completed */
      const preferences = resolved.preferences || {};
      const nextPreferences = {
        ...preferences,
        onboarding: {
          ...(preferences.onboarding || {}),
          role_selected: true,
          ...(role === 'owner' ? { owner_complete: false } : { student_complete: false })
        }
      };

      const updateResult = await sb.from('profiles').update({ preferences: nextPreferences }).eq('id', user.id);
      if (updateResult.error) throw updateResult.error;

      resolved = { ...resolved, preferences: nextPreferences, role: role === 'owner' ? 'owner' : resolved.role };
      cacheAuthenticatedUser(resolved, user);
      window.location.assign(role === 'owner' ? 'owner-onboarding.html' : 'student-onboarding.html');
    } catch (error) {
      console.warn('[CampusStay] Role selection failed:', error.message || error);
      status.textContent = 'We could not save that choice. Please try again.';
      buttons.forEach((button) => { button.disabled = false; });
    }
  }

  buttons.forEach((button) => button.addEventListener('click', () => choose(button.dataset.roleChoice)));
});
