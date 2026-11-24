# Engineering baseline — original CampusStay, 737a409

The nested GitHub checkout on main contains six staged Supabase replay changes. The root lockfile is untracked. The ignored runtime config supplies the browser connection. The backup is outside this checkout.

Static HTML, shared CSS, page scripts and supabase-js implement the application. Supabase Auth establishes identity, a signup trigger creates the profile, policies enforce row access, and private Storage supplies signed property images. The separate Express/Mongoose project has health tests and no housing routes. Its /api/v1 middleware responds before its health handler. GitHub Pages is reported deployed; repository CI describes an older GitLab copy step that omits most pages.

Existing screens include role selection, student preferences, owner landing, a seven-step listing wizard, dashboard, inquiries, settings, browsing and review forms. Source paths exist for OTP/OAuth, profile creation, KIT filtering and media uploads; live end-to-end behavior requires an isolated Supabase deployment. Local catalog tests cover migration replay; they do not exercise these screens.

The role selector issues a self-promotion RPC and hides RPC/profile failures behind the same message. 006 previously had invalid PostgreSQL syntax. A missing deployed RPC is plausible but the failing hosted operation is unknown. There is no owner application/review record, admin dashboard or trusted owner verification. Admin redirects lead to a missing page. Listing submission involves multiple writes and deletes partially created data on failure. Owner and student pages contain database text interpolated into HTML, legacy sample data paths, and conflicting rent units. An ignored runtime config must be supplied at deployment. UI fading and effective deployed grants need direct verification.

Confirmed in migration source: nullable admin password check inside a privileged function; self-service owner role grant; mutable inquiry authorship and mismatched owners; booking and review subqueries compare inner columns to themselves; listing default outside its CHECK. Existing 006 policies temporarily widen access; 007 removes them. Some guards omit schema. Already-recorded migrations do not pick up file edits. 005 deletes reference rows. Live function ownership, grants, historical policy drift, admin assignments and exposure remain unknown.

Order: contain admin provisioning, enforce immutable inquiry relationships and booking/review eligibility, fix the default for fresh and existing databases, test the chain on populated and clean PostgreSQL fixtures. Then gate owner privileges on verified applications, audit decisions, connect the existing UI, and validate publication and privacy through the full flow. Hosted OAuth, Storage and release settings require a separate Preview.

## Continuation and authentication findings

The original checkout is `D:\SY SEM III\room-rent-website-main\room-rent-website-main` on `main` at `737a409520fc5c8b6b079a32c439c5c8be22da7a`. The parent repository and both named backups were excluded. The original UTF-16 patch attachment contains the four migration diffs. Their before/after Git blob identifiers match the corresponding index diffs. The six-file index also contains the README and replay test. The working-tree versions have moved beyond that index. Review the full working tree, including new files, before preparing any commit. All tests below used the working-tree versions.

The interrupted Chrome assertion in `supabase/tests/browser-flows.cjs` expected the email-confirmation message after a successful registration, but observed “We could not create your account. Please try again.” The helper returned Supabase’s inner data object. The form destructured an additional data layer and raised an exception when reading the user. The sign-in handler did the same when reading the session. Both callers now consume the actual return type. Email confirmation stays enabled. Auth forms start disabled until their handlers and client are ready, and use POST as their fallback method.

The ignored local runtime config exists, assigns the expected browser global, and contains the original project URL and a structurally valid publishable key. The actual SDK initialized from that file offline. A clean GitHub checkout omits it. The old validator accepted any sufficiently long key and the Google button stayed enabled when the client was missing. The error handler then collapsed initialization failure into the generic Google-startup error. The current application checks the browser key class and project origin, detects SDK failure, disables unavailable operations and reports the cause. OAuth error and callback handling cover cancellation, redirect errors, a missing session and a missing profile. No code or screenshot available here establishes which origin served the screenshot or the actual Google provider setting there.

The manually dispatched Pages workflow packages only static content with explicit public build variables. It does not run on push. The operator must verify the existing Pages source and Google/Supabase settings before opting into publishing. Authorized role and application status determine account destinations. Browser role hints only request an application. An SDK test used intercepted endpoints and the Pages subpath. It did not sign into a real Google account or establish that Google accepts the hosted redirect URI.

## Security and workflow results

- **Admin access.** A nullable/configurable password check in a browser-executable definer function could skip the rejection branch. Both promotion functions are retired by forward migration. Trusted database provisioning emits a role-change audit row. Database tests cover role-column denial, application self-approval denial, missing functions and an audited trusted role change. Existing administrator assignments require operator verification.
- **Inquiry privacy.** Broad table UPDATE and insufficient property checks allowed identity or authorship changes. The database now checks the authenticated student, listing and actual owner and grants owners only status updates. Tests cover impersonation, the wrong owner, pending properties, other owners, protected fields and legitimate status changes. Public review and view projections omit private student/booking identifiers.
- **Bookings and reviews.** Ambiguous identifiers in subqueries bound to inner columns. Explicit outer references, authenticated student ownership, eligible booking state and the property-owner relationship now apply. The receipt table retains existing reviews and prevents future duplicate ratings for the same booking. Users cannot insert payment-provider identifiers, supply review timestamps or confirm bookings. The UI makes a zero-amount request. Payment processing and automatic booking confirmation are outside this implementation.
- **Defaults and preservation.** 011 used a default outside its own CHECK. New rows default to `anyone` and existing valid values survive the upgrade. Previously applied migrations do not rerun when edited. The forward migrations preserve user accounts and listing records. Atomic rule/facility replacement changes only a specifically edited listing and rolls back on failure.
- **Owner applications and admin queues.** Draft, pending, clarification, rejected, approved and suspended states are database-owned. Submission reads confirmed contact from Auth. An applicant supplies an independently checkable property-authority reference. A person must actually review it. Decisions lock and check the application revision, validate the transition and write the actor, reason and timestamp. Legacy self-service owner roles alone confer no listing privileges. Suspension withdraws public listings. Admin queues show application evidence, listings, reports, review activity and deletion requests. Tests exercised authorization, stale decisions, rejection, correction, publication, suspension, report resolution and audit.
- **Drafts and media.** Save is revision checked. Identical retries return the prior revision. Submission checks the folder, private storage object, MIME metadata, allowable size, fields and associations. It writes all listing data atomically and retains a receipt for retry. Public reads require approved, available inventory and attached media. Pending/published Storage mutations are restricted. Private address and verification evidence stay separate from public listing details. In-app enquiry is the default contact option. The server rejects unreviewable media at publication. Confirm existing media metadata and signed-link expiry in Preview.
- **Student experience.** The `js/data.js` diff removed generated sample inventory and photo helpers. KIT coordinates, facility labels and shared reference data remain. Student search and favorites use actual database rows, a five-kilometre campus limit and explicit public discovery. Favorites now use the authenticated student’s database rows. The old unowned shared-device cache is not assigned to any account. Browser tests exercised discovery, a type filter, rent display, detail views, review rendering, enquiries, saved stays, preferences, navigation and theme switching. Existing stored rent amounts with unknown periods are labeled for confirmation.
- **Known scope boundaries.** The legal pages are drafts. A public contact route for people who cannot sign in, operator identity and retention decisions need approval. Deletion requests enter a real admin queue and require operator fulfillment. Identity-document collection, automatic verification of an applicant’s authority, payment processing and real-time notifications are not implemented. A released image link may remain usable until expiry. The original faded panel screenshot could not be reproduced at its source. The conflicting translucent surface was corrected locally and the role page was exercised across themes and widths. This is partial accessibility coverage, not an accessibility certification.

## Validation evidence

From the nested project root, these are the commands used for the isolated suites. The environment paths select existing local test tooling. No project dependency or lockfile installation was required.

```powershell
python supabase/tests/validate_policy_replay.py
$env:PGLITE_DIST = (Resolve-Path '../.migration-validation/package/dist').Path
node supabase/tests/postgres-security.cjs
$env:PLAYWRIGHT_CORE = (Resolve-Path '../.migration-validation/browser/package').Path
$env:CHROME_BINARY = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
node supabase/tests/browser-flows.cjs
$env:SUPABASE_BROWSER_SDK = (Resolve-Path '../.migration-validation/supabase-browser.js').Path
node supabase/tests/auth-runtime.cjs
git diff --cached --check
git -c core.safecrlf=false diff --check
```

- **Parser passed.** pglast 8.8 parsed 14 migrations, 432 SQL statements, eight DO blocks, 20 PL/pgSQL function bodies and 85 policy definitions. Historical duplicate-policy and invalid-006 regressions, named-policy replay and unrelated-policy preservation passed. This simulation counts declarations across history.
- **PostgreSQL-WASM passed.** PGlite 0.4.3 with pgcrypto executed the full chain on an empty database (including an actual second application of 002 at its historical checkpoint), a fresh chain with data present before 011, and a representative historical 001–011 database upgraded by 012–014. For the historical fixture only, four invalid 006 clauses were normalized to create the intended predecessor. Actual PostgreSQL roles, column privileges, triggers and row policies ran with synthetic Auth and Storage schemas. Tests cover atomic rollback, private contact/location, review immutability, stale moderation, duplicate submissions and preservation of existing valid values. This does not exercise a multi-connection managed Supabase deployment.
- **Browser suites.** Headless Chrome opened the actual static pages. The UI suite used a synthetic Supabase client and blocked external requests. It exercised registration, login/logout, role selection, admin review controls, student browsing and protected workflows, photo selection/optimization, failed upload, save, reload, retry and submission. The SDK suite instead used the real local Supabase JS 2.116.0 browser bundle, checked missing/invalid config and failed library loading, and intercepted provider/Auth/PostgREST traffic. It generated a real authorization URL, consumed a synthetic callback and recovered the session across reload for student, applicant, approved owner and admin paths. It also built a temporary Pages artifact and rejected invalid public build configuration.
- **Static checks.** Node syntax checking ran over 30 JavaScript files in `js`, five CJS database/browser test files and the Pages builder. All 29 HTML files resolved their local script and stylesheet paths. Git whitespace checks covered the index and working-tree diffs. A targeted scan also checked new files. The original UTF-16 attachment is unsuitable for a raw `git apply` without decoding and differs from the complete index.
- **Separate backend test did not run successfully.** `npm.cmd --prefix backend test` uses a directory argument not resolved by this Node 24 runner. `node --test backend/tests/health.test.js` then identified the missing Express dependency. The static application does not call this backend for the reviewed workflows.
- **Hosted validation pending.** No Supabase CLI lint, hosted database query, live Storage upload, real PostgREST introspection, Google consent, email delivery, remote Pages operation or live GitHub Preview ran. Real concurrent transactions, production functions and policy drift require an isolated Supabase rehearsal followed by separately authorized operator checks.

## Release decision

Ready for continued development, independent security review and a disposable GitHub Supabase Preview attempt after reviewing the full diff. Production release is blocked pending the read-only exposure assessment, independent legacy-owner verification, real-provider and Storage tests, coordinated config/migration rollout, and operator/legal decisions. Use the production review document for the emergency and migration sequence.

## Exact file manifest

The subsequent [Preview readiness review](PREVIEW-RELEASE.md) includes the final grouped manifest and Git plan. It rehearsed the pre-approval hold for an existing published listing in both populated fixtures and checked the catalog assessment with synthetic roles.

A path can appear in both index and working-tree sections when the versions differ. The unrelated untracked root lockfile is excluded.

### Staged versions

- `supabase/README.md`
- `supabase/migrations/002_rls.sql`
- `supabase/migrations/006_owner_role.sql`
- `supabase/migrations/010_inquiries_reports.sql`
- `supabase/migrations/011_listing_lifecycle.sql`
- `supabase/tests/validate_policy_replay.py`

### Tracked files with unstaged edits

- `README.md`
- `add-property.html`
- `auth.html`
- `css/account.css`
- `help.html`
- `index.html`
- `js/account-pages.js`
- `js/add-property.js`
- `js/auth-guard.js`
- `js/auth.js`
- `js/data.js`
- `js/facilities-page.js`
- `js/home.js`
- `js/inquiries.js`
- `js/listings.js`
- `js/main.js`
- `js/media-upload.js`
- `js/owner-dashboard.js`
- `js/owner-onboarding.js`
- `js/property.js`
- `js/review-submit.js`
- `js/role-onboarding.js`
- `js/rules-page.js`
- `js/runtime-config.example.js`
- `js/settings.js`
- `js/supabase-config.js`
- `listings.html`
- `owner-dashboard.html`
- `owner-landing.html`
- `owner-onboarding.html`
- `settings.html`
- `supabase/README.md`
- `supabase/migrations/002_rls.sql`
- `supabase/migrations/006_owner_role.sql`
- `supabase/migrations/007_fix_rls_conflicts.sql`
- `supabase/migrations/010_inquiries_reports.sql`
- `supabase/migrations/011_listing_lifecycle.sql`
- `supabase/tests/validate_policy_replay.py`

### New implementation files

- `supabase/PREVIEW-RELEASE.md`
- `.github/workflows/pages.yml`
- `admin-dashboard.html`
- `js/admin-dashboard.js`
- `js/owner-application.js`
- `owner-application.html`
- `privacy.html`
- `scripts/prepare-pages.cjs`
- `supabase/ENGINEERING.md`
- `supabase/PRODUCTION-REVIEW.md`
- `supabase/migrations/012_security_hardening.sql`
- `supabase/migrations/013_owner_verification.sql`
- `supabase/migrations/014_listing_drafts.sql`
- `supabase/tests/auth-runtime.cjs`
- `supabase/tests/browser-flows.cjs`
- `supabase/tests/draft-submission.cjs`
- `supabase/tests/owner-authorization.cjs`
- `supabase/tests/postgres-security.cjs`
- `terms.html`

### Files changed during the authentication and stabilization continuation

- `.github/workflows/pages.yml`
- `README.md`
- `auth.html`
- `index.html`
- `js/admin-dashboard.js`
- `js/auth.js`
- `js/data.js`
- `js/listings.js`
- `js/owner-dashboard.js`
- `js/property.js`
- `js/role-onboarding.js`
- `js/runtime-config.example.js`
- `js/settings.js`
- `js/supabase-config.js`
- `scripts/prepare-pages.cjs`
- `supabase/ENGINEERING.md`
- `supabase/PRODUCTION-REVIEW.md`
- `supabase/README.md`
- `supabase/migrations/002_rls.sql`
- `supabase/migrations/012_security_hardening.sql`
- `supabase/migrations/013_owner_verification.sql`
- `supabase/migrations/014_listing_drafts.sql`
- `supabase/tests/auth-runtime.cjs`
- `supabase/tests/browser-flows.cjs`
- `supabase/tests/draft-submission.cjs`
- `supabase/tests/owner-authorization.cjs`
- `supabase/tests/postgres-security.cjs`
