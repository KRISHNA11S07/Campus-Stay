-- Owner privileges require administrative verification. Older deployments may
-- have installed this self-service RPC. 002 provisions the private bucket and
-- its scoped policies; 007 cleans up legacy permissive policies.
DROP FUNCTION IF EXISTS public.promote_to_owner();
