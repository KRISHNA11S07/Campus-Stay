/* ============================================================
   CampusStay — Maharashtra Data Layer
   50 realistic listings across KIT Kolhapur, Walchand Sangli,
   COEP Pune, VJTI Mumbai, PICT Pune
   ============================================================ */

const COLLEGES = [
  { id: 'kit', name: 'KIT College of Engineering Kolhapur', city: 'Kolhapur, Maharashtra', lat: 16.6945, lng: 74.2342 },
];

const FACILITIES = {
  wifi:         { label: 'High-speed WiFi',    icon: '📶' },
  ac:           { label: 'Air Conditioning',   icon: '❄️' },
  meals:        { label: 'Meals Included',     icon: '🍱' },
  laundry:      { label: 'Laundry',            icon: '🧺' },
  parking:      { label: 'Parking',            icon: '🅿️' },
  gym:          { label: 'Gym',                icon: '🏋️' },
  study:        { label: 'Study Room',         icon: '📚' },
  security:     { label: '24x7 Security',      icon: '🛡️' },
  geyser:       { label: 'Hot Water',          icon: '🚿' },
  housekeeping: { label: 'Housekeeping',       icon: '🧹' },
  power:        { label: 'Power Backup',       icon: '🔋' },
  furnished:    { label: 'Fully Furnished',    icon: '🛋️' },
  pool:         { label: 'Swimming Pool',      icon: '🏊' },
  garden:       { label: 'Garden',             icon: '🌿' },
  cctv:         { label: 'CCTV Cameras',       icon: '📷' },
  lift:         { label: 'Elevator/Lift',      icon: '🛗' },
};

const HOSTEL_RULES_DEFAULT = [
  'Entry closes at 10:30 PM (ID required after 9 PM)',
  'Visitors allowed in common areas only, 9 AM – 7 PM',
  'No smoking or alcohol on the premises',
  'Mess timings: breakfast 7–9, lunch 12:30–2, dinner 8–10',
  'Monthly rent due by the 5th of every month',
  'Maintain cleanliness in common areas at all times',
];

// Published inventory is loaded from Supabase.
