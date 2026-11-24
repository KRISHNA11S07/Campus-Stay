# CampusStay isolated Preview release

**Verdict.** The reviewed working tree is suitable for a disposable Supabase Preview attempt. Authentication and database authorization passed locally. Hosted OAuth, email delivery, real service permissions and production exposure remain open.

## Source and release boundary

The source is the nested original repository on `main`, commit `737a409520fc5c8b6b079a32c439c5c8be22da7a`. There are 38 tracked paths with unstaged changes. Six also have older staged versions: `supabase/README.md`, migrations `002_rls.sql`, `006_owner_role.sql`, `010_inquiries_reports.sql`, `011_listing_lifecycle.sql`, and `supabase/tests/validate_policy_replay.py` (staged as added). There are 19 untracked release paths and one excluded untracked root `package-lock.json`. The five groups below are the complete 57-path working-tree release manifest. Files can rely on changes in later groups. Validate and publish only the complete candidate.

The public browser application calls Supabase directly. The Pages artifact contains HTML, CSS, JavaScript and its generated public runtime config. The Express/Mongoose foundation is outside the artifact and there is no active frontend API integration with it. Express remains absent locally. Its previous health-test failure is outside this release gate.

## Regression evidence

- `validate_policy_replay.py` passed for 001–014 in order: 432 SQL statements, eight DO blocks, 20 PL/pgSQL bodies and 85 policy declarations. It reproduced the historic 002 policy collision and invalid 006 syntax. Historical replay simulation is separate from database execution.
- `postgres-security.cjs` executed actual PostgreSQL logic through PGlite/pgcrypto in an empty database, a populated fresh chain and an upgrade constructed from 001–011 at `737a409`. Only the four unsupported 006 policy clauses were normalized in the historical fixture. The regression covers effective roles, immutable inquiry authorship, property/owner relationships, booking/review eligibility, valid defaults, private data and Storage, stale decisions, audit, drafts, atomic submission and retries. The legacy-owner regression exercises the administrative hold described below.
- `browser-flows.cjs` passed in Chrome using synthetic sessions and intercepted requests. Coverage includes email registration with confirmation, email sign-in/out, student selection, owner application and review, dashboard gating, failed upload, resume and submission, enquiry status, approved discovery, saved stays, responsive navigation and themes.
- `auth-runtime.cjs` passed with the real local Supabase JS 2.116.0 bundle. All provider, Auth and PostgREST traffic was intercepted. The test covered initialization failures, construction of the Google authorization URL, a synthetic callback, restored sessions, four role destinations and a packaged Pages subpath. The rehearsal used only synthetic configuration; the ignored original runtime file was excluded.
- The four SQL blocks in the [production assessment](PRODUCTION-REVIEW.md) were checked against an in-memory historical function with its original grant and a hardened fixture. The historical signature, normalized body and effective grant matched without invoking the function. Absence of the history or audit table is handled by selecting the applicable blocks.
- Local Git integrity checks include staged/unstaged whitespace, candidate manifest equality, and redacted checks for high-confidence private credentials in locally reachable history, the index and nonignored files. These checks cannot establish whether a secret ever existed in an unavailable remote ref or an external dashboard.
- A disposable local Git copy reproduced the older six-file index. The worktree preparation and four regression suites ran there. Five separate temporary indexes confirmed the exact staged paths for each proposed commit. File hashes matched across all 57 release paths. The rehearsal created no commits and used no remote service.

## Legacy owners and property visibility

1. Before rollout, record private counts and stable property/owner IDs, existing moderation evidence, lifecycle states and media provenance. Reconcile the admin roster first. An old profile role can originate from self-service promotion.
2. Migration 013 leaves those accounts and listings in place. A profile with stored owner role and no approved application has effective student access. It can apply with a server-confirmed contact and checkable authority reference. It cannot grant itself owner access or submit listings. Anonymous readers cannot see that owner's old published properties while the owner is unapproved.
3. **Review every already-published property before approving that legacy owner.** On an available historical listing the existing published and verified values can become publicly effective immediately upon owner approval. For any property without independent listing approval evidence, or with uncertain photos, have an authorized admin pause it with a reason through the moderation queue **before** approving the application. Recheck the hold and audit record. This is an operator action for an authorized environment. If the admin cannot verify the inventory or hold, defer owner approval.
4. Verify the applicant's identity, confirmed contact, and authority to manage the properties. Request clarification or reject with feedback when evidence is insufficient. Record the admin decision against the current application revision. Verify that a held property stays paused after owner approval. The verified owner can correct it and submit for listing review. The administrator reviews the current version and owned media before publishing it.
5. Record counts and compare IDs before and after. Existing reviews, bookings, enquiries and property rows remain associated with their original IDs. Check anonymous discovery and private cross-account access separately. Suspension pauses public properties. Check previously issued signed links against their expiry window. Keep evidence references inside the authorized workspace.

## Hosted Preview gates

Use a new, non-production Preview branch for the original repository. Confirm the integration target directory and its production Git branch with the operator. Review the configured automatic production-deployment setting before any remote action. Supabase builds a new Preview schema from migrations; later runs consult branch history. This repository has no `supabase/config.toml` or hosted provider settings. Check the resulting branch configuration explicitly. Use synthetic users, rows and Storage objects. [Supabase GitHub branching](https://supabase.com/docs/guides/deployment/branching/github-integration)

1. Inspect the branch-specific project reference and migration logs. Verify versions 001–014 exactly once and compare policies, effective grants, private bucket, functions and triggers with the local candidate. If 002 fails again, capture the failing version, history and actual policy state on **Preview** and investigate drift. Never use a replay of 005, a reset or a fabricated history entry as a shortcut.
2. Build a separate static test site with the Preview URL and **its own publishable key**. For a local test artifact, supply the two public values via `CAMPUSSTAY_SUPABASE_URL` and `CAMPUSSTAY_SUPABASE_PUBLISHABLE_KEY`, then run `node scripts/prepare-pages.cjs` with a fresh output directory. Serve that directory from the allowed test origin. Keep the original ignored file out of this worktree. The checked-in Pages workflow runs on manual dispatch with a main-only build and publishes to the Pages environment; a Preview PR does not require dispatching it.
3. Check Preview Auth Site URL, exact allowed frontend return URLs (including any repository subpath), email confirmation, test mail delivery and Google provider enablement. In the test Google client, register the precise **Supabase provider callback URL displayed for Preview**. The app returns to its own `auth.html?google_callback=1` after Google; email confirmation returns to `auth.html`. Use a test provider configuration and approved test accounts. Keep the OAuth client secret in provider settings. [Supabase Google setup](https://supabase.com/docs/guides/auth/social-sign-in/auth-google)
4. Use two students, a pending applicant, two verified owners and a separately provisioned test admin. Run signup, email-link confirmation, Google consent, callback, reload, logout and route checks. Observe PostgREST and Storage using those sessions. Verify mismatched-account reads/writes fail, supported enquiries and statuses succeed, and no browser client can elevate roles. Check private draft files, actual MIME metadata, signed media, failed uploads, duplicate submits, rejection/resubmission and suspension.
5. Check that only approved, available stays appear in KIT discovery, and that the admin queue and audit identify the actual decision and operator. Rehearse the legacy-owner hold. Save test evidence against the tested commit and Preview project reference, without credentials. Stop at the Preview result. A green migration check alone does not authorize merging, publishing Pages or making any production change.

## Exact Git plan for the operator

The following is a proposed PowerShell session. The release inspection takes place in a separate Git worktree. Its index starts at the committed base. The original index remains with the original checkout. All Git commands use an explicit repository path. A pre-existing worktree directory or branch causes preparation to stop.

```powershell
$ErrorActionPreference = 'Stop'
function Invoke-ReleaseGit {
    & git @args
    if ($LASTEXITCODE -ne 0) { throw 'Git command failed. Stop and inspect the result.' }
}
$src = (Resolve-Path -LiteralPath 'D:\SY SEM III\room-rent-website-main\room-rent-website-main').Path
$base = '737a409520fc5c8b6b079a32c439c5c8be22da7a'
$branch = 'preview/campusstay-auth-rls-737a409'
$review = Join-Path ([IO.Path]::GetTempPath()) 'CampusStay-preview-737a409'
if ((Resolve-Path -LiteralPath (Invoke-ReleaseGit -C $src rev-parse --show-toplevel)).Path -ne $src) { throw 'Wrong source repository' }
if ((Invoke-ReleaseGit -C $src rev-parse HEAD) -ne $base) { throw 'Base changed; review the new base first' }
if ((Invoke-ReleaseGit -C $src branch --show-current) -ne 'main') { throw 'Unexpected source branch' }
if (Test-Path -LiteralPath $review) { throw 'Choose a new, empty worktree location' }
Invoke-ReleaseGit -C $src status --short --branch --untracked-files=all
$groups = @(
    [pscustomobject]@{ Subject = 'Harden and migrate Supabase authorization, verification and drafts'; Files = @(
        'supabase/migrations/002_rls.sql'
        'supabase/migrations/006_owner_role.sql'
        'supabase/migrations/007_fix_rls_conflicts.sql'
        'supabase/migrations/010_inquiries_reports.sql'
        'supabase/migrations/011_listing_lifecycle.sql'
        'supabase/migrations/012_security_hardening.sql'
        'supabase/migrations/013_owner_verification.sql'
        'supabase/migrations/014_listing_drafts.sql'
        'supabase/tests/validate_policy_replay.py'
        'supabase/tests/postgres-security.cjs'
        'supabase/tests/owner-authorization.cjs'
        'supabase/tests/draft-submission.cjs'
    ) }
    [pscustomobject]@{ Subject = 'Restore authentication and connect owner applications and moderation'; Files = @(
        'auth.html'
        'admin-dashboard.html'
        'owner-application.html'
        'owner-landing.html'
        'help.html'
        'settings.html'
        'privacy.html'
        'terms.html'
        'css/account.css'
        'js/auth.js'
        'js/auth-guard.js'
        'js/supabase-config.js'
        'js/role-onboarding.js'
        'js/owner-application.js'
        'js/admin-dashboard.js'
        'js/settings.js'
        'js/main.js'
        'js/account-pages.js'
    ) }
    [pscustomobject]@{ Subject = 'Connect owner listing drafts, enquiries and student discovery'; Files = @(
        'add-property.html'
        'index.html'
        'listings.html'
        'owner-dashboard.html'
        'owner-onboarding.html'
        'js/add-property.js'
        'js/data.js'
        'js/facilities-page.js'
        'js/home.js'
        'js/inquiries.js'
        'js/listings.js'
        'js/media-upload.js'
        'js/owner-dashboard.js'
        'js/owner-onboarding.js'
        'js/property.js'
        'js/review-submit.js'
        'js/rules-page.js'
        'supabase/tests/browser-flows.cjs'
    ) }
    [pscustomobject]@{ Subject = 'Package the static Pages site with public runtime configuration'; Files = @(
        '.github/workflows/pages.yml'
        'js/runtime-config.example.js'
        'scripts/prepare-pages.cjs'
        'supabase/tests/auth-runtime.cjs'
    ) }
    [pscustomobject]@{ Subject = 'Document setup, production assessment and isolated Preview release'; Files = @(
        'README.md'
        'supabase/README.md'
        'supabase/ENGINEERING.md'
        'supabase/PRODUCTION-REVIEW.md'
        'supabase/PREVIEW-RELEASE.md'
    ) }
)
$all = @($groups | ForEach-Object { $_.Files })
if ($all.Count -ne 57 -or @($all | Sort-Object -Unique).Count -ne $all.Count) { throw 'Release manifest has changed' }
$changed = @(Invoke-ReleaseGit -C $src diff --name-only HEAD) + @(Invoke-ReleaseGit -C $src ls-files --others --exclude-standard)
$included = @($changed | Where-Object { $_ -ne 'package-lock.json' } | Sort-Object -Unique)
if (Compare-Object ($all | Sort-Object) $included) { throw 'Review differences between current files and the manifest' }
Invoke-ReleaseGit -C $src worktree add -b $branch $review $base
foreach ($f in $all) {
    $from = Join-Path $src $f
    $to = Join-Path $review $f
    [void][IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($to))
    Copy-Item -LiteralPath $from -Destination $to
    if ((Get-FileHash -LiteralPath $from).Hash -ne (Get-FileHash -LiteralPath $to).Hash) { throw "Copy mismatch: $f" }
}
if ((Test-Path -LiteralPath (Join-Path $review 'js/runtime-config.js')) -or (Test-Path -LiteralPath (Join-Path $review 'package-lock.json'))) { throw 'Excluded local file in release worktree' }
Invoke-ReleaseGit -C $review diff --check
Invoke-ReleaseGit -C $review status --short --untracked-files=all
```

Run the tests in the separate worktree so Git history, the candidate files and the environment agree. Paths below refer to the existing local tool cache.

```powershell
$toolsDir = Join-Path (Split-Path $src -Parent) '.migration-validation'
$env:PGLITE_DIST = (Resolve-Path (Join-Path $toolsDir 'package/dist')).Path
$env:PLAYWRIGHT_CORE = (Resolve-Path (Join-Path $toolsDir 'browser/package')).Path
$env:SUPABASE_BROWSER_SDK = (Resolve-Path (Join-Path $toolsDir 'supabase-browser.js')).Path
$env:CHROME_BINARY = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
Push-Location -LiteralPath $review
try {
    python supabase/tests/validate_policy_replay.py
    if ($LASTEXITCODE) { throw 'Policy replay validation failed' }
    foreach ($suite in 'postgres-security','browser-flows','auth-runtime') {
        node "supabase/tests/$suite.cjs"
        if ($LASTEXITCODE) { throw "Suite failed: $suite" }
    }
} finally { Pop-Location }
```

Only after reviewing the complete candidate and deciding to create local commits, run the following **in the same PowerShell session**. The staged-path check uses the exact group membership. Check the stored origin privately against `KRISHNA11S07/Campus-Stay` before authorizing any push.

```powershell
foreach ($group in $groups) {
    $files = $group.Files
    Invoke-ReleaseGit -C $review add -- @files
    $staged = @(Invoke-ReleaseGit -C $review diff --cached --name-only)
    if (!$staged.Count -or (Compare-Object ($files | Sort-Object) ($staged | Sort-Object))) { throw 'Unexpected staged file set' }
    Invoke-ReleaseGit -C $review diff --cached --check
    Invoke-ReleaseGit -C $review diff --cached --stat
    Invoke-ReleaseGit -C $review commit -m $group.Subject
}
Invoke-ReleaseGit -C $review diff --check $base HEAD
$committed = @(Invoke-ReleaseGit -C $review diff --name-only $base HEAD)
if (Compare-Object ($all | Sort-Object) ($committed | Sort-Object)) { throw 'Final commit range differs from manifest' }
if (Invoke-ReleaseGit -C $review status --porcelain) { throw 'Candidate worktree changed after commits' }
Invoke-ReleaseGit -C $review log --oneline "$base..HEAD"
Invoke-ReleaseGit -C $src diff --cached --name-status
```

After a separate decision to start hosted Preview, the branch-only push is `Invoke-ReleaseGit -C $review push --set-upstream origin "HEAD:refs/heads/$branch"`. Open a **draft PR** from that branch to the configured base and inspect the Supabase Preview check. Leave the PR unmerged and the Pages publish workflow undispatched.
