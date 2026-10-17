-- ============================================================
-- CampusStay — Migration: KIT College Only
-- Remove all colleges except KIT from the database
-- ============================================================

-- Update any properties referencing non-KIT colleges to use 'kit'
UPDATE public.properties
SET college_id = 'kit'
WHERE college_id != 'kit' AND college_id IS NOT NULL;

-- Delete non-KIT colleges
DELETE FROM public.colleges WHERE id != 'kit';
