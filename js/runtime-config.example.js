/*
 * Copy these values into js/runtime-config.js for local development, or have
 * your deployment pipeline generate that file from protected CI variables.
 * Never place a Supabase service-role key in browser code.
 */
window.CAMPUSSTAY_RUNTIME_CONFIG = Object.freeze({
  supabaseUrl: 'https://YOUR_PROJECT_REF.supabase.co',
  supabaseAnonKey: 'YOUR_SUPABASE_ANON_KEY'
});
