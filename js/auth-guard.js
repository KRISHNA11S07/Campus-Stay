/* CampusStay route protection — authorization comes from Supabase + profiles. */
(function () {
  'use strict';

  const roleHomes = { student: 'index.html', owner: 'owner-dashboard.html', admin: 'admin-dashboard.html' };

  function currentRelativePath() {
    const leaf = window.location.pathname.split('/').pop() || 'index.html';
    return leaf + window.location.search + window.location.hash;
  }

  function goToAuth() {
    const next = encodeURIComponent(currentRelativePath());
    window.location.replace('auth.html?next=' + next);
  }

  async function checkAuth() {
    const body = document.body;
    const requiredRole = body.dataset.requireAuth;
    if (!requiredRole) return;

    try {
      const { session, user, profile } = await getAuthContext();
      if (!session || !user) {
        clearAuthenticatedUserCache();
        goToAuth();
        return;
      }

      // A signed-in user without a profile is a deployment/data issue, not a
      // reason to silently loop them back to the sign-in screen.
      if (!profile) {
        body.classList.add('auth-ready');
        document.dispatchEvent(new CustomEvent('cs:auth-error', {
          detail: { message: 'Your session is active, but your profile is still being prepared.' }
        }));
        return;
      }

      if (requiredRole !== 'any' && profile.role !== requiredRole) {
        const destination = roleHomes[profile.role] || 'index.html';
        if (typeof CS !== 'undefined') CS.toast('This page is only available to ' + requiredRole + ' accounts.');
        // The old delayed redirect made a protected route appear briefly and
        // then "bounce" home. Resolve the role mismatch before rendering.
        window.location.replace(destination);
        return;
      }

      body.classList.add('auth-ready');
      document.dispatchEvent(new CustomEvent('cs:auth-ready', { detail: { session, user, profile } }));
    } catch (error) {
      console.warn('[CampusStay] Auth guard failed:', error.message);
      clearAuthenticatedUserCache();
      goToAuth();
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', checkAuth, { once: true });
  else checkAuth();
})();
