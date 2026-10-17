# Supabase setup

1. Create a Supabase project and enable Phone Auth. For Google OAuth, set the
   **Site URL** to the deployed CampusStay URL and add both
   `https://YOUR-APP/auth.html` and the matching local development URL (for
   example `http://localhost:8000/auth.html`) under **Authentication → URL
   Configuration → Redirect URLs**. Add the same authorized redirect URI to
   the Google Cloud OAuth client. Supabase remains the secure OAuth callback,
   then returns directly to CampusStay's `auth.html` callback handler.
2. Run the SQL files in this exact order in the Supabase SQL editor:
   `migrations/001_schema.sql` through `migrations/009_listing_details.sql`
   in numeric order.
3. Copy the URL and **anon** key from Supabase Dashboard → Settings → API into
   `js/runtime-config.js`. Do not put a service-role key in this repository or
   in browser code.
4. Confirm that every table has RLS enabled and that the `property-media`
   bucket is private.

The existing SQL files are written for a fresh project. Before applying them
to a project that contains data, export that data and review the migration in
a staging project first.
