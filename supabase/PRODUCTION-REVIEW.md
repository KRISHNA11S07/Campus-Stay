# Production security assessment

**Status — blocked pending explicit authorization.** The local checkout cannot establish what was deployed. A database administrator must first confirm the original production project and branch in the Supabase Dashboard, obtain approval for this read-only assessment, and record the target and UTC time in a private incident record. Use an authorized operator session with complete catalog and profile visibility. Missing permissions or RLS-filtered results leave exposure unknown. No access to Auth passwords, tokens, phone numbers or emails is needed.

## 1. Inspect catalog state

Run this block as one selection in the approved SQL editor. It uses a read-only snapshot, short timeouts, built-in catalog functions and a final rollback. It never invokes an application function. Confirm additional exposed schemas in the project's Data API settings and include them in the schema lists below. Preserve the output privately. The hash is a comparison with the LF-normalized function body in commit `737a409`, independent of the function's ACL and owner.

```sql
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '15s';
SET LOCAL lock_timeout = '2s';
SET LOCAL search_path = pg_catalog;

SELECT current_database(), session_user, current_user, transaction_timestamp(),
       current_setting('transaction_read_only') AS read_only,
       to_regclass('public.profiles') AS profiles,
       to_regclass('public.platform_audit') AS audit,
       to_regclass('supabase_migrations.schema_migrations') AS history;

-- Find named overloads in any schema and other privileged routines in the API schema.
-- Indicators and signatures only. Do not print function bodies, GUC values or defaults.
SELECT n.nspname, p.oid::regprocedure AS signature, p.prokind, p.prosecdef,
       pg_get_userbyid(p.proowner) AS function_owner, p.pronargdefaults,
       md5(replace(p.prosrc,chr(13),''))='4e827fc6a4452b2d9247656805fde8dc' AS matches_old_admin_body,
       position('bootstrap' IN lower(p.prosrc))>0 AS mentions_bootstrap,
       position('promote_to_admin' IN lower(p.prosrc))>0 AS references_promotion,
       r.rolname AS caller,
       has_schema_privilege(r.oid,n.oid,'USAGE') AS schema_usage,
       has_function_privilege(r.oid,p.oid,'EXECUTE') AS effective_execute,
       EXISTS (SELECT FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) g
               WHERE g.grantee=0 AND g.privilege_type='EXECUTE') AS public_execute
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
CROSS JOIN pg_roles r
WHERE r.rolname IN ('anon','authenticated','authenticator','service_role')
  AND (p.proname IN ('promote_to_admin','promote_to_owner','get_my_role')
    OR (n.nspname='public' AND (p.prosecdef OR position('promote_to_admin' IN lower(p.prosrc))>0)))
ORDER BY n.nspname,signature,caller;

SELECT r.rolname, r.rolsuper, r.rolbypassrls, r.rolinherit
FROM pg_roles r WHERE r.rolname IN ('anon','authenticated','authenticator','service_role');

SELECT n.nspname, c.relname, pg_get_userbyid(c.relowner) AS table_owner,
       c.relrowsecurity AS rls_enabled, c.relforcerowsecurity AS force_rls
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE c.relkind IN ('r','p') AND n.nspname IN ('public','storage')
ORDER BY 1,2;

SELECT schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check
FROM pg_policies WHERE schemaname IN ('public','storage')
ORDER BY schemaname,tablename,cmd,policyname;

SELECT grantee,table_schema,table_name,privilege_type FROM information_schema.table_privileges
WHERE table_schema IN ('public','storage') ORDER BY 2,3,1,4;
SELECT grantee,table_schema,table_name,column_name,privilege_type FROM information_schema.column_privileges
WHERE table_schema='public' ORDER BY 2,3,4,1,5;
ROLLBACK;
```

Row security and grants both matter. Inspect overlapping permissive policies, owner/BYPASSRLS roles, callable wrappers, writable views and any unexpected profile-role grants. A matching function body, browser EXECUTE and schema USAGE establish the known dangerous authorization path when the function is exposed and its definer can update the role. A different hash can indicate formatting differences or a different unsafe implementation. Have the authorized DBA inspect unfamiliar definitions privately in the dashboard, including definer rights and authorization logic. A missing function today cannot establish that it was always absent.

## 2. Reconcile assignments and deployed versions

Run each applicable block separately. The first requires `public.profiles`, the second requires the history table, and the third requires 012's audit table. Stop on schema or access errors. An absent history table is a finding. The query excludes migration statement bodies.

```sql
BEGIN READ ONLY;
SET LOCAL statement_timeout='15s';
SELECT id AS admin_profile_id FROM public.profiles WHERE role='admin' ORDER BY id;
SELECT role,count(*) AS assigned FROM public.profiles GROUP BY role ORDER BY role;
SELECT r.rolname, has_column_privilege(r.oid,'public.profiles','role','UPDATE') AS can_update_role_column
FROM pg_roles r WHERE r.rolname IN ('anon','authenticated','service_role');
ROLLBACK;
```

```sql
BEGIN READ ONLY;
SET LOCAL statement_timeout='15s';
SELECT version FROM supabase_migrations.schema_migrations ORDER BY version;
ROLLBACK;
```

```sql
BEGIN READ ONLY;
SET LOCAL statement_timeout='15s';
SELECT occurred_at,subject_id,previous_value,new_value,actor_id,database_actor
FROM public.platform_audit WHERE action='role' AND (previous_value='admin' OR new_value='admin')
ORDER BY occurred_at,id;
ROLLBACK;
```

Privately match **each admin UUID** against the trusted provisioning record, named approver and current need for access. A count alone cannot identify a suspect account. The local audit begins when 012 is installed. Review retained Auth, database and operator logs for earlier changes. Record only reconciled counts and open discrepancies in shared reporting. Distinguish confirmed exposure, no current evidence for this specific route, and inconclusive assessment. Record current function signature, owner, effective callers and comparable version/schema evidence in each case. History rows alone do not prove what SQL ran.

## 3. Containment decision

A browser-reachable unsafe promotion path, an equivalent privileged wrapper or an unexplained administrator assignment needs immediate operator escalation. Preserve the function identity, ACL, dependencies, time window and relevant logs privately. Obtain separate approval for any containment mutation. For the identified signature, a DBA should remove EXECUTE from PUBLIC, anon, authenticated and any effective inherited grant sources in a controlled transaction, check any wrappers, then repeat the effective-access queries. Review privileged actions and affected sessions. Investigate individual assignments before any change to an account. A repository edit, a password rotation alone or removal of the function cannot establish that past assignments were legitimate.

New admins are provisioned only by a named, trusted database operator with an approved ticket, verified target user ID and a transaction updating that one profile. The role-change trigger records previous/new roles, database session identity, available auth actor and time. Preserve the external operator/ticket record when database logins are shared.

Rehearse the pending migration versions in an isolated copy with synthetic rows. Compare actual named policies, ACLs, functions, schema, bucket privacy and historical versions to the expected predecessor. Stop on drift. Preserve stricter policies until reviewed. Check pre-existing inquiry mismatches and owner verification evidence privately. An owner role alone was historically self-assigned. Obtain independent evidence before approving legacy owners. Leave disputed records untouched. Use an authorized restore point before rollout. Never reset history or replay 005 on production. Coordinate a maintenance window if storage links have already been issued; revoking future reads cannot revoke a previously issued signed URL before it expires.

## Before authorizing a rollout

In the trusted operator console compare the actual privileged function bodies with the reviewed definitions. Catalog flags help triage but cannot establish safety by themselves. Keep definition text, user identifiers and provider metadata inside the authorized environment.

1. Check the original project reference, Preview branch, database roles, function owners, inherited EXECUTE grants, public-schema CREATE privileges, and platform default ACLs. Confirm any deployment from main or Pages publishing trigger separately.
2. Count legacy roles and application evidence, inaccurate booking or inquiry owner references, duplicate reviews by booking, unknown rent periods, URL-only or mismatched media paths, and historic profile numbers inconsistent with Auth. Inventory actual private bucket status, MIME metadata and signed URL expiry. Review stricter existing policies before making changes.
3. Check the verified-phone constraint and references to `profiles_phone_key`. 012 moves uniqueness to verified phone rows without changing any number. Confirm the removal of the obsolete contact setter and promotion functions has no external clients or database dependencies. Existing admin membership requires independent reconciliation. Existing reviews remain present when 012 seeds its booking receipt table.
4. Before 013 goes live, coordinate with legitimate owners. Their stored role and listings survive, but a role issued through the old self-service mechanism is insufficient proof. Obtain authority evidence and have a trusted admin review the application. Verify visibility and re-review any existing pending listing. Legacy media without a valid owned Storage object need correction before republication.
5. Rehearse with a point-in-time restore or backup in an authorized isolated environment, verify recovery, then coordinate database and frontend versions. Earlier access policies and role helpers are unsafe rollback targets. Prefer a reviewed forward repair and restore only under a separate operator recovery plan.
6. Observe fresh and existing-user Google/email flows, real PostgREST relationships, storage upload MIME metadata and signed URL expiry in Preview using disposable accounts. Review concurrent edits, large result sets, backups and retention. Purge orphan draft uploads only under a separate reviewed retention procedure. Select a real public support route for signed-out users, retention terms, operator details and legal review before releasing the draft legal pages or submitting OAuth branding.
