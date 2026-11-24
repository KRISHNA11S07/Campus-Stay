/* ============================================================
   CampusStay — Supabase client and authenticated identity helpers

   The Supabase session is the source of truth. `cs:user` is only a
   presentation cache for the navbar; it is never used to authorize a route.
   ============================================================ */

const _runtimeConfig = window.CAMPUSSTAY_RUNTIME_CONFIG || {};
const SUPABASE_URL = typeof _runtimeConfig.supabaseUrl === 'string'
  ? _runtimeConfig.supabaseUrl.trim()
  : '';
const browserKey = _runtimeConfig.supabasePublishableKey || _runtimeConfig.supabaseAnonKey;
const SUPABASE_ANON_KEY = typeof browserKey === 'string' ? browserKey.trim() : '';

// Public browser key only. Keep Razorpay secrets on a server/Edge Function.
const RAZORPAY_KEY_ID = 'YOUR_RAZORPAY_KEY_ID';

let _supabaseClient = null;

function isSupabaseConfigured() {
  return !getSupabaseConfigurationError();
}

function getSupabaseConfigurationError() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return 'Sign-in is unavailable because the Supabase browser configuration is missing.';
  }
  const project = /^https:\/\/([a-z0-9-]+)\.supabase\.co\/?$/i.exec(SUPABASE_URL);
  if (!project) {
    return 'Supabase URL must use the https://<project-ref>.supabase.co format.';
  }
  if (/^sb_publishable_[A-Za-z0-9_-]{12,}$/.test(SUPABASE_ANON_KEY)) return '';
  // Older projects use an anon JWT as their public browser key.
  const jwt = /^[A-Za-z0-9_-]+\.([A-Za-z0-9_-]+)\.[A-Za-z0-9_-]+$/.exec(SUPABASE_ANON_KEY);
  if (jwt) {
    try {
      const claims = JSON.parse(atob(jwt[1].replace(/-/g, '+').replace(/_/g, '/')));
      if (claims.role === 'anon' && (!claims.ref || claims.ref === project[1])) return '';
    } catch { /* Malformed legacy key. */ }
  }
  return 'Sign-in requires a valid public Supabase browser key.';
}

function getSupabase() {
  if (_supabaseClient) return _supabaseClient;
  if (typeof window.supabase === 'undefined' || !window.supabase.createClient) {
    console.error('[CampusStay] Supabase JS library was not loaded.');
    return null;
  }
  if (!isSupabaseConfigured()) {
    console.warn('[CampusStay] ' + getSupabaseConfigurationError());
    return null;
  }

  try {
    _supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    });
  } catch {
    console.warn('[CampusStay] Supabase client initialization failed.');
  }
  return _supabaseClient;
}

// Storage remains private. Resolve time-limited URLs only after the bucket's
// RLS policies have authorized the current user to read each object.
async function resolveMediaUrls(media, expiresIn = 3600) {
  if (!Array.isArray(media) || media.length === 0) return media || [];
  const paths = [...new Set(media.map((item) => item?.storage_path).filter(Boolean))];
  if (paths.length === 0) return media;

  const signedByPath = new Map();
  try {
    const result = await getSupabase()?.storage.from('property-media').createSignedUrls(paths, expiresIn);
    if (result && !result.error) {
      for (const item of result.data || []) {
        if (item?.path && item.signedUrl && !item.error) signedByPath.set(item.path, item.signedUrl);
      }
    }
  } catch {
    // A failed signing request must leave path-backed media unavailable.
  }
  return media.map((item) => item.storage_path ? {
    ...item,
    file_url: signedByPath.get(item.storage_path) || ''
  } : item);
}

function cacheAuthenticatedUser(profile, user) {
  if (typeof CS === 'undefined' || !profile || !user) return;
  CS.store('user', {
    id: user.id,
    name: profile.full_name || user.user_metadata?.full_name || user.user_metadata?.name || 'CampusStay member',
    phone: profile.phone || user.phone || '',
    role: profile.role || 'student',
    avatarUrl: profile.avatar_url || user.user_metadata?.avatar_url || ''
  });
}

function clearAuthenticatedUserCache() {
  try { localStorage.removeItem('cs:user'); } catch (_) {}
}

async function getSession() {
  const sb = getSupabase();
  if (!sb) return null;
  const { data, error } = await sb.auth.getSession();
  if (error) {
    console.warn('[CampusStay] Session restore failed:', error.message);
    return null;
  }
  return data.session || null;
}

async function getCurrentUser() {
  const session = await getSession();
  return session?.user || null;
}

async function getProfile(session = null) {
  const activeSession = session || await getSession();
  if (!activeSession) return null;
  const sb = getSupabase();
  if (!sb) return null;

  const { data, error } = await sb
    .from('profiles')
    .select('*,owner_applications(status)')
    .eq('id', activeSession.user.id)
    .maybeSingle();

  if (error) {
    console.warn('[CampusStay] Profile fetch failed:', error.message);
    return null;
  }
  if (!data) return null;
  const application = Array.isArray(data.owner_applications) ? data.owner_applications[0] : data.owner_applications;
  const ownerStatus = application?.status || (data.role === 'owner' ? 'verification_required' : null);
  return { ...data, ownerStatus, role: data.role === 'owner' && ownerStatus !== 'approved' ? 'student' : data.role };
}

async function waitForProfile(session, attempts = 4) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const profile = await getProfile(session);
    if (profile) return profile;
    if (attempt < attempts - 1) {
      await new Promise((resolve) => setTimeout(resolve, 350 * (attempt + 1)));
    }
  }
  return null;
}

async function getAuthContext() {
  const session = await getSession();
  if (!session) {
    clearAuthenticatedUserCache();
    return { session: null, user: null, profile: null };
  }
  // Profiles are created by a database trigger. Waiting briefly here prevents
  // new OAuth users from being treated as logged out while that transaction is
  // still becoming visible to the browser client.
  const profile = await waitForProfile(session);
  if (profile) cacheAuthenticatedUser(profile, session.user);
  return { session, user: session.user, profile };
}

function profileOnboarding(profile, key) {
  const onboarding = profile?.preferences?.onboarding;
  return Boolean(onboarding && onboarding[key] === true);
}

function profileNeedsRoleSelection(profile) {
  const onboarding = profile?.preferences?.onboarding || {};
  // New accounts explicitly receive role_selected: false. Existing accounts
  // without that marker keep their established database role.
  return onboarding.role_selected === false
    || (!profile?.full_name && profile?.role === 'student'
      && onboarding.role_selected !== true
      && onboarding.student_complete !== true
      && onboarding.owner_complete !== true);
}

function getPostAuthDestination(profile, requestedRole) {
  if (profile?.role === 'admin') return 'admin-dashboard.html';
  if (profile?.ownerStatus && profile.ownerStatus !== 'approved') return 'owner-application.html';
  if (profileNeedsRoleSelection(profile)) return 'role-onboarding.html';
  const role = profile?.role || 'student';
  if (role === 'owner') {
    // Existing owners without an onboarding marker remain on their dashboard.
    if (profile?.preferences?.onboarding?.owner_complete === false) return 'owner-onboarding.html';
    return profile && (profileOnboarding(profile, 'owner_complete') || profile.full_name)
      ? 'owner-dashboard.html'
      : 'owner-onboarding.html';
  }
  if (role === 'admin') return 'admin-dashboard.html';
  return profileOnboarding(profile, 'student_complete') ? 'index.html' : 'student-onboarding.html';
}

function appUrl(path) {
  const url = new URL(window.location.href);
  url.search = '';
  url.hash = '';
  const currentPath = url.pathname;
  url.pathname = /\/[^/]*$/.test(currentPath)
    ? currentPath.replace(/\/[^/]*$/, '/' + path)
    : currentPath.replace(/\/$/, '/') + path;
  return url.toString();
}

function safeNextPath(next) {
  if (!next) return null;
  try {
    const candidate = new URL(next, location.href);
    const file = candidate.pathname.split('/').pop();
    if (candidate.origin !== location.origin || !/^[a-z][a-z-]*[.]html$/.test(file) || file === 'auth.html') return null;
    if (candidate.pathname !== new URL(file,location.href).pathname) return null;
    return file + candidate.search + candidate.hash;
  } catch (_) {
    return null;
  }
}

function redirectAfterAuth(profile, requestedRole = null, delay = 0) {
  const next = safeNextPath(new URLSearchParams(location.search).get('next'));
  const ownerOnly = /^owner-(dashboard|onboarding)\.html/i.test(next || '');
  const studentOnly = /^(student-onboarding|preferences)\.html/i.test(next || '');
  const destination = (next && !(ownerOnly && profile?.role !== 'owner') && !(studentOnly && profile?.role === 'owner'))
    ? next
    : getPostAuthDestination(profile, requestedRole);
  window.setTimeout(() => { window.location.href = destination; }, delay);
}

async function completeProfileFromAuth(session, { name = '', onboarding = null } = {}) {
  const sb = getSupabase();
  if (!sb || !session?.user) return null;

  let profile = await waitForProfile(session);
  if (!profile) return null;

  const currentPreferences = profile?.preferences || {};
  const nextPreferences = onboarding
    ? { ...currentPreferences, onboarding: { ...(currentPreferences.onboarding || {}), ...onboarding } }
    : currentPreferences;
  const patch = {};
  if (name && !profile?.full_name) patch.full_name = name;
  if (onboarding) patch.preferences = nextPreferences;

  if (Object.keys(patch).length) {
    const { error } = await sb.from('profiles').update(patch).eq('id', session.user.id);
    if (error) throw error;
    profile = await getProfile(session) || { ...profile, ...patch };
  }

  cacheAuthenticatedUser(profile, session.user);
  return profile;
}

async function signOut() {
  const sb = getSupabase();
  if (!sb) throw new Error('Session service unavailable');
  const {error} = await sb.auth.signOut();
  if (error) throw error;
  clearAuthenticatedUserCache();
  if (typeof CS !== 'undefined') CS.savedIds = [];
  for (const key of Object.keys(sessionStorage)) if (key.startsWith('cs:property-') || key==='cs:origin') sessionStorage.removeItem(key);
}

async function sendOTP(phone, role) {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase is not configured');
  const fullPhone = phone.startsWith('+') ? phone : '+91' + phone;
  const { data, error } = await sb.auth.signInWithOtp({
    phone: fullPhone,
    options: { data: { requested_role: role } }
  });
  if (error) throw error;
  return data;
}

async function verifyOTP(phone, token) {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase is not configured');
  const fullPhone = phone.startsWith('+') ? phone : '+91' + phone;
  const { data, error } = await sb.auth.verifyOtp({ phone: fullPhone, token, type: 'sms' });
  if (error) throw error;
  return data;
}

async function signInWithGoogle(role) {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase is not configured');
  try { sessionStorage.setItem('cs:google-requested-role', role); } catch (_) {}
  const callback = new URL(appUrl('auth.html'));
  callback.searchParams.set('google_callback', '1');
  const { data, error } = await sb.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: callback.href,
      // Account selection is still controlled by Google. Do not force a
      // consent interstitial on every return visit.
      queryParams: { access_type: 'offline', prompt: 'select_account' }
    }
  });
  if (error) throw error;
  return data;
}

async function signUpWithEmail(email, password, metadata = {}) {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase is not configured');
  const { data, error } = await sb.auth.signUp({
    email,
    password,
    options: { data: metadata }
  });
  if (error) throw error;
  return data;
}

async function signInWithEmail(email, password) {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase is not configured');
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

function onAuthStateChange(callback) {
  const sb = getSupabase();
  if (!sb) return { unsubscribe() {} };
  const { data } = sb.auth.onAuthStateChange((event, session) => callback(event, session));
  return data.subscription;
}

// Phone number helpers — all storage and outbound calls use normalized digits.
const CS_phone = {
  normalize(phone) {
    if (!phone) return '';
    let digits = String(phone).replace(/[^0-9]/g, '');
    if (digits.length === 10) digits = '91' + digits;
    if (digits.startsWith('0') && digits.length === 11) digits = '91' + digits.substring(1);
    return digits;
  },
  format(phone) {
    const normalized = this.normalize(phone);
    if (!normalized || normalized.length < 10) return phone || '';
    const cc = normalized.startsWith('91') ? normalized.substring(0, 2) : '';
    const rest = cc ? normalized.substring(2) : normalized;
    return rest.length === 10 ? `+${cc} ${rest.slice(0, 5)} ${rest.slice(5)}` : phone;
  },
  toTelHref(phone) {
    const normalized = this.normalize(phone);
    return normalized ? 'tel:+' + normalized : '#';
  },
  toWaHref(phone, message = '') {
    const normalized = this.normalize(phone);
    if (!normalized) return '#';
    const base = `https://wa.me/${normalized}`;
    return message ? `${base}?text=${encodeURIComponent(message)}` : base;
  }
};

// Fetch the public inventory even when a signed-in owner can also read drafts.
async function publishedKitListings() {
  const sb=getSupabase();
  if(!sb) throw new Error('Listing service unavailable');
  const {data,error}=await sb.from('properties')
    .select('id,type,title,area,city,lat,lng,rent,rent_period,deposit,available,distance_km,reviews(rating),property_media(file_url,storage_path,display_order),property_facilities(facility_id)')
    .eq('college_id','kit').eq('available',true).eq('listing_status','published').eq('verification_status','verified').order('created_at',{ascending:false});
  if(error)throw error;
  const result=[];
  for(const p of data){
    const distance=p.lat!=null && p.lng!=null ? CS.haversineKm(COLLEGES[0],p) : p.distance_km;
    if(distance==null || distance>5)continue;
    const media=await resolveMediaUrls(p.property_media||[]);
    result.push({...p,verified:true,distanceKm:Number(distance),facilities:p.property_facilities.map(f=>f.facility_id),
      images:media.sort((a,b)=>a.display_order-b.display_order).map(m=>m.file_url).filter(Boolean)});
  }
  return result;
}
