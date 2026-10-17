-- ============================================================
-- CampusStay — Seed Data (Colleges + Facilities)
-- Run this AFTER 001_schema.sql and 002_rls.sql
-- ============================================================

-- Colleges
INSERT INTO public.colleges (id, name, city, lat, lng) VALUES
  ('kit',      'KIT College of Engineering Kolhapur',    'Kolhapur, Maharashtra',  16.6945, 74.2342),
  ('walchand', 'Walchand College of Engineering Sangli', 'Sangli, Maharashtra',    16.8569, 74.5750),
  ('coep',     'COEP Technological University Pune',     'Shivajinagar, Pune',     18.5308, 73.8474),
  ('vjti',     'VJTI Mumbai',                            'Matunga, Mumbai',        19.0227, 72.8665),
  ('pict',     'PICT Pune',                              'Dhankawadi, Pune',       18.4574, 73.8487)
ON CONFLICT (id) DO NOTHING;

-- Facilities
INSERT INTO public.facilities (id, label, icon) VALUES
  ('wifi',         'High-speed WiFi',    '📶'),
  ('fast_wifi',    'Fast WiFi',          '⚡'),
  ('ac',           'Air Conditioning',   '❄️'),
  ('meals',        'Meals Included',     '🍱'),
  ('laundry',      'Laundry',            '🧺'),
  ('parking',      'Parking',            '🅿️'),
  ('gym',          'Gym',                '🏋️'),
  ('study',        'Study Room',         '📚'),
  ('security',     '24x7 Security',      '🛡️'),
  ('geyser',       'Hot Water',          '🚿'),
  ('hot_water',    'Hot Water',          '🚿'),
  ('housekeeping', 'Housekeeping',       '🧹'),
  ('power',        'Power Backup',       '🔋'),
  ('furnished',    'Fully Furnished',    '🛋️'),
  ('pool',         'Swimming Pool',      '🏊'),
  ('garden',       'Garden',             '🌿'),
  ('cctv',         'CCTV Cameras',       '📷'),
  ('lift',         'Elevator/Lift',      '🛗'),
  ('solar',        'Solar Power',        '☀️'),
  ('aquaguard',    'Aquaguard/RO Water', '💧'),
  ('water_247',    '24/7 Water Supply',  '🚰')
ON CONFLICT (id) DO NOTHING;
