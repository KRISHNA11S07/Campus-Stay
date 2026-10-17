/* ============================================================
   CampusStay — authentication screen
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  let role = 'student';
  let mode = 'signin';
  let redirecting = false;
  const $ = (id) => document.getElementById(id);
  const authCard = $('auth-card');

  if (!isSupabaseConfigured()) {
    $('auth-config-notice').hidden = false;
  }

  function setBusy(button, busy, label) {
    button.disabled = busy;
    button.innerHTML = busy ? '<span class="spinner"></span>' + label : label;
  }

  function clearErrors() {
    document.querySelectorAll('.auth-field').forEach((field) => field.classList.remove('has-error'));
    document.querySelectorAll('.auth-field-error').forEach((error) => {
      error.textContent = '';
      error.hidden = true;
    });
  }

  function showError(fieldId, errorId, message) {
    $(fieldId)?.classList.add('has-error');
    const error = $(errorId);
    if (error) {
      error.textContent = message;
      error.hidden = false;
    }
  }

  function showMessage(message, type = 'error') {
    const messageBox = $('auth-message');
    messageBox.textContent = message;
    messageBox.className = 'auth-message show ' + type;
  }

  function hideMessage() {
    $('auth-message').className = 'auth-message';
  }

  function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(email);
  }

  function validatePhone(phone) {
    return /^[6-9]\d{9}$/.test(phone);
  }

  function validName(name) {
    return /^[\p{L}][\p{L}\s.'-]{1,79}$/u.test(name) && name.trim().split(/\s+/).length >= 2;
  }

  function friendlyAuthError(error, fallback) {
    const source = String(error?.message || '').toLowerCase();
    if (source.includes('invalid login credentials')) return 'That email or password does not match our records.';
    if (source.includes('email not confirmed')) return 'This account needs administrator support before it can sign in.';
    if (source.includes('already registered') || source.includes('already been registered')) return 'An account already exists for this email. Please sign in instead.';
    if (source.includes('rate limit') || source.includes('too many requests')) return 'Too many attempts. Please wait a moment and try again.';
    if (source.includes('network') || source.includes('fetch')) return 'We could not reach CampusStay. Check your connection and try again.';
    return fallback;
  }

  function updateUI() {
    const signingUp = mode === 'signup';
    const owner = role === 'owner';
    document.documentElement.dataset.authMode = mode;
    document.documentElement.dataset.authRole = role;

    $('auth-title').textContent = signingUp
      ? (owner ? 'Start listing with confidence' : 'Find a place that feels right')
      : (owner ? 'Welcome back, owner' : 'Welcome back');
    $('auth-sub').textContent = signingUp
      ? (owner ? 'Create your account, then build your first listing step by step.' : 'Create your student account in a few calm, simple steps.')
      : (owner ? 'Manage listings, enquiries and your property setup.' : 'Pick up your rental search exactly where you left it.');
    $('signup-form').hidden = !signingUp;
    $('signin-form').hidden = signingUp;
    $('auth-role-copy').textContent = owner ? 'You are continuing as an Owner' : 'You are continuing as a Student';
    $('btn-signup').textContent = owner ? 'Create owner account' : 'Create student account';
    $('btn-signin').textContent = 'Sign in as ' + (owner ? 'Owner' : 'Student');
    $('btn-switch-mode').textContent = signingUp ? 'Sign in instead' : 'Create an account';
    $('auth-switch-copy').textContent = signingUp ? 'Already have an account?' : 'New to CampusStay?';
    clearErrors();
    hideMessage();
  }

  document.querySelectorAll('[data-mode]').forEach((button) => {
    button.addEventListener('click', () => {
      mode = button.dataset.mode;
      document.querySelectorAll('[data-mode]').forEach((item) => item.classList.toggle('active', item === button));
      updateUI();
    });
  });

  document.querySelectorAll('[data-role]').forEach((button) => {
    button.addEventListener('click', () => {
      role = button.dataset.role;
      document.querySelectorAll('[data-role]').forEach((item) => item.classList.toggle('active', item === button));
      updateUI();
    });
  });

  $('btn-switch-mode').addEventListener('click', () => {
    mode = mode === 'signup' ? 'signin' : 'signup';
    document.querySelectorAll('[data-mode]').forEach((item) => item.classList.toggle('active', item.dataset.mode === mode));
    updateUI();
  });

  document.querySelectorAll('[data-password-toggle]').forEach((button) => {
    button.addEventListener('click', () => {
      const input = $(button.dataset.passwordToggle);
      if (!input) return;
      const visible = input.type === 'password';
      input.type = visible ? 'text' : 'password';
      button.setAttribute('aria-pressed', String(visible));
      button.setAttribute('aria-label', visible ? 'Hide password' : 'Show password');
      button.querySelector('[data-password-copy]').textContent = visible ? 'Hide' : 'Show';
    });
  });

  document.querySelectorAll('.auth-field input').forEach((input) => {
    input.addEventListener('input', () => {
      input.closest('.auth-field')?.classList.remove('has-error');
      const error = input.closest('.auth-field')?.querySelector('.auth-field-error');
      if (error) error.hidden = true;
    });
  });

  $('signup-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    clearErrors();
    hideMessage();

    const name = $('signup-name').value.trim().replace(/\s+/g, ' ');
    const email = $('signup-email').value.trim().toLowerCase();
    const phone = $('signup-phone').value.replace(/\D/g, '');
    const password = $('signup-password').value;
    let valid = true;

    if (!validName(name)) {
      showError('field-name', 'error-name', 'Enter your first and last name using letters only.');
      valid = false;
    }
    if (!validateEmail(email)) {
      showError('field-email', 'error-email', 'Enter a valid email address.');
      valid = false;
    }
    if (!validatePhone(phone)) {
      showError('field-phone', 'error-phone', 'Use a valid 10-digit Indian mobile number.');
      valid = false;
    }
    if (password.length < 8) {
      showError('field-password', 'error-password', 'Use at least 8 characters for your password.');
      valid = false;
    }
    if (!valid) return;

    const submit = $('btn-signup');
    setBusy(submit, true, 'Creating your account…');
    try {
      const { data } = await signUpWithEmail(email, password, {
        full_name: name,
        phone: '+91' + phone
      });

      if (!data.user || data.user.identities?.length === 0) {
        throw new Error('already registered');
      }
      if (!data.session) {
        // No client code can create a session when Supabase Confirm email is on.
        // Keep the user out of an email-confirmation dead end and surface the
        // exact deployment setting that must be changed for the requested UX.
        throw new Error('instant session unavailable');
      }

      const profile = await completeProfileFromAuth(data.session, {
        name,
        // Role is selected after the first authenticated session. The browser
        // never assigns an owner role by writing profile metadata directly.
        onboarding: { role_selected: false }
      });
      if (!profile) throw new Error('profile unavailable');

      showMessage('Account created. Taking you to your setup…', 'success');
      redirecting = true;
      redirectAfterAuth(profile, role, 650);
    } catch (error) {
      const instantSession = String(error?.message || '').includes('instant session');
      showMessage(
        instantSession
          ? 'This project still requires email confirmation. Disable “Confirm email” in Supabase Auth settings to enable the direct sign-up flow.'
          : friendlyAuthError(error, 'We could not create your account. Please try again.'),
        'error'
      );
    } finally {
      if (!redirecting) setBusy(submit, false, role === 'owner' ? 'Create owner account' : 'Create student account');
    }
  });

  $('signin-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    clearErrors();
    hideMessage();
    const email = $('signin-email').value.trim().toLowerCase();
    const password = $('signin-password').value;
    let valid = true;
    if (!validateEmail(email)) {
      showError('field-signin-email', 'error-signin-email', 'Enter the email address on your account.');
      valid = false;
    }
    if (!password) {
      showError('field-signin-password', 'error-signin-password', 'Enter your password.');
      valid = false;
    }
    if (!valid) return;

    const submit = $('btn-signin');
    setBusy(submit, true, 'Signing you in…');
    try {
      const { data } = await signInWithEmail(email, password);
      const profile = await waitForProfile(data.session);
      if (!profile) throw new Error('profile unavailable');
      cacheAuthenticatedUser(profile, data.user);
      showMessage('Signed in. Restoring your account…', 'success');
      redirecting = true;
      redirectAfterAuth(profile, profile.role, 500);
    } catch (error) {
      showMessage(
        friendlyAuthError(error, 'We could not sign you in. Please try again.'),
        'error'
      );
    } finally {
      if (!redirecting) setBusy(submit, false, 'Sign in as ' + (role === 'owner' ? 'Owner' : 'Student'));
    }
  });

  $('btn-google-login').addEventListener('click', async () => {
    hideMessage();
    const button = $('btn-google-login');
    setBusy(button, true, 'Opening Google…');
    try {
      try { sessionStorage.setItem('cs:auth-next', new URLSearchParams(location.search).get('next') || ''); } catch (_) {}
      await signInWithGoogle(role);
    } catch (error) {
      setBusy(button, false, 'Continue with Google');
      showMessage(friendlyAuthError(error, 'Google sign-in could not start. Please try again.'), 'error');
    }
  });

  async function restoreSession() {
    try {
      const { session, user, profile } = await getAuthContext();
      if (!session || redirecting) return;

      const callback = new URLSearchParams(location.search).has('google_callback');
      if (callback) {
        const next = sessionStorage.getItem('cs:auth-next') || '';
        let resolvedProfile = profile;
        const googleName = user.user_metadata?.full_name || user.user_metadata?.name || '';
        // An incomplete profile is created by the database trigger on a first
        // Google login. Existing profiles keep their database role.
        if (!resolvedProfile?.full_name) {
          resolvedProfile = await completeProfileFromAuth(session, {
            name: googleName,
            onboarding: { role_selected: false }
          });
        }
        if (!resolvedProfile) throw new Error('profile unavailable');
        cacheAuthenticatedUser(resolvedProfile, user);
        if (next) history.replaceState({}, '', 'auth.html?next=' + encodeURIComponent(next));
        try {
          sessionStorage.removeItem('cs:google-requested-role');
          sessionStorage.removeItem('cs:auth-next');
        } catch (_) {}
        redirecting = true;
        redirectAfterAuth(resolvedProfile, resolvedProfile.role, 150);
        return;
      }

      if (profile) {
        redirecting = true;
        redirectAfterAuth(profile, profile.role, 0);
      }
    } catch (error) {
      console.warn('[Auth] Session restoration failed:', error.message);
      showMessage('We could not restore that session. Please sign in again.', 'error');
    }
  }

  // Decorative card movement is intentionally disabled for touch and reduced motion.
  if (authCard && !matchMedia('(prefers-reduced-motion: reduce), (pointer: coarse)').matches) {
    authCard.addEventListener('pointermove', (event) => {
      const box = authCard.getBoundingClientRect();
      const x = (event.clientX - box.left) / box.width - 0.5;
      const y = (event.clientY - box.top) / box.height - 0.5;
      authCard.style.setProperty('--auth-rotate-x', `${(-y * 1.25).toFixed(2)}deg`);
      authCard.style.setProperty('--auth-rotate-y', `${(x * 1.25).toFixed(2)}deg`);
    });
    authCard.addEventListener('pointerleave', () => {
      authCard.style.removeProperty('--auth-rotate-x');
      authCard.style.removeProperty('--auth-rotate-y');
    });
  }

  updateUI();
  restoreSession();
});
