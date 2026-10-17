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

/* Curated Unsplash photo IDs per accommodation type */
const IMG = (id) => `https://images.unsplash.com/photo-${id}?q=80&w=1100&auto=format&fit=crop`;
const PHOTO_SETS = {
  flat: [
    ['1502672260266-1c1ef2d93688', '1560448204-e02f11c3d0e2', '1556912173-3bb406ef7e77', '1493809842364-78817add7ffb'],
    ['1560448204-603b3fc33ddc', '1522708323590-d24dbb6b0267', '1567767292278-a4f21aa2d36e', '1586023492125-27b2c045efd7'],
    ['1554995207-c18c203602cb', '1502672023488-70e25813eb80', '1505693416388-ac5ce068fe85', '1560185007-cde436f6a4d0'],
  ],
  room: [
    ['1522771739844-6a9f6d5f14af', '1505691938895-1758d7feb511', '1540518614846-7eded433c457', '1598928506311-c55ded91a20c'],
    ['1631049307264-da0ec9d70304', '1567016432779-094069958ea5', '1522708323590-d24dbb6b0267', '1505692794403-34d4982f88aa'],
    ['1555854877-bab0e564b8d5', '1560185007-c5ca9d2c014d', '1522771739844-6a9f6d5f14af', '1540518614846-7eded433c457'],
  ],
  pg: [
    ['1555854877-bab0e564b8d5', '1560185007-c5ca9d2c014d', '1522771739844-6a9f6d5f14af', '1540518614846-7eded433c457'],
    ['1576941089067-2de3c901e126', '1598928636135-d146006ff4be', '1564540583246-934409427776', '1567767292278-a4f21aa2d36e'],
    ['1502672260266-1c1ef2d93688', '1560448204-e02f11c3d0e2', '1631049307264-da0ec9d70304', '1567016432779-094069958ea5'],
  ],
  hostel: [
    ['1555854877-bab0e564b8d5', '1631049035182-249067d7618e', '1596079890744-c1a0462d0975', '1598928506311-c55ded91a20c'],
    ['1560185007-cde436f6a4d0', '1576675784201-0e142b423952', '1522771739844-6a9f6d5f14af', '1505693416388-ac5ce068fe85'],
    ['1554995207-c18c203602cb', '1502672023488-70e25813eb80', '1540518614846-7eded433c457', '1598928506311-c55ded91a20c'],
  ],
  apartment: [
    ['1545324418-cc1a3fa10c00', '1512917774080-9991f1c4c750', '1560448204-603b3fc33ddc', '1502672260266-1c1ef2d93688'],
    ['1512917774080-9991f1c4c750', '1545324418-cc1a3fa10c00', '1560448204-e02f11c3d0e2', '1556912173-3bb406ef7e77'],
  ],
  villa: [
    ['1564013799919-ab600027ffc6', '1520250497591-112f2f40a3f4', '1613490493576-7d6f0c7c6f07', '1600596542815-ffad4c1539a9'],
    ['1600585154340-be6161a56a0c', '1564013799919-ab600027ffc6', '1613490493576-7d6f0c7c6f07', '1520250497591-112f2f40a3f4'],
  ],
};
let _setIdx = {};
function _photos(type) {
  const pool = PHOTO_SETS[type] || PHOTO_SETS.flat;
  const i = (_setIdx[type] = (_setIdx[type] || 0)) % pool.length;
  _setIdx[type]++;
  return pool[i].map(IMG);
}
function _mk(o) {
  return Object.assign(
    { verified: false, available: true, rules: [], deposit: o.rent * 2, images: _photos(o.type) },
    o
  );
}

const LISTINGS = [

  /* ========== KIT KOLHAPUR ========== */
  _mk({ id: 'kit-01', type: 'pg', title: 'Shivam Boys PG, Kasaba Bawda', area: 'Kasaba Bawda, Kolhapur', college: 'kit',
    lat: 16.6980, lng: 74.2310, rent: 7500, deposit: 7500, rating: 4.7, gender: 'male', verified: true,
    facilities: ['wifi', 'meals', 'geyser', 'power', 'study', 'laundry'],
    description: 'Well-managed boys PG just 800 m from KIT gate. Home-cooked Kolhapuri meals, 24x7 power backup, and a dedicated study hall with fast Wi-Fi. Very popular with first-year students.',
    owner: { name: 'Shivraj Patil', role: 'Owner', phone: '+919823001001' },
    reviews: [
      { name: 'Rahul M.', rating: 5, date: '2026-05-10', text: 'Best PG I could find near KIT. Food is authentic Kolhapuri and owner is very helpful.' },
      { name: 'Akash D.', rating: 4.5, date: '2026-03-22', text: 'Study room is great for exam prep. WiFi is solid.' },
      { name: 'Vivek S.', rating: 4.5, date: '2026-01-15', text: 'Value for money. Mess timing is strict but food is good.' },
    ] }),

  _mk({ id: 'kit-02', type: 'hostel', title: 'Sahyadri Boys Hostel', area: 'Rajaram Nagar, Kolhapur', college: 'kit',
    lat: 16.6960, lng: 74.2380, rent: 6500, deposit: 6500, rating: 4.5, gender: 'male', verified: true,
    facilities: ['wifi', 'meals', 'study', 'security', 'power', 'laundry', 'geyser'],
    rules: HOSTEL_RULES_DEFAULT,
    description: 'Budget-friendly boys hostel with 120 rooms, a well-stocked library and a mess serving three meals daily. Ideal for KIT students focused on studies.',
    owner: { name: 'Mahesh Kore', role: 'Manager', phone: '+919823001002' },
    reviews: [
      { name: 'Saurabh P.', rating: 5, date: '2026-04-18', text: 'Library is open till midnight. Perfect for competitive exam prep.' },
      { name: 'Nikhil J.', rating: 4, date: '2026-02-05', text: 'Rooms are basic but clean. Good mess food.' },
      { name: 'Prashant B.', rating: 4.5, date: '2025-12-10', text: 'Security is excellent. Parents are relieved.' },
    ] }),

  _mk({ id: 'kit-03', type: 'room', title: 'Single Room near KIT Gate', area: 'Gokul Nagar, Kolhapur', college: 'kit',
    lat: 16.6920, lng: 74.2320, rent: 5500, deposit: 5500, rating: 4.3, gender: 'any',
    facilities: ['wifi', 'geyser', 'furnished', 'power'],
    description: 'Compact, clean single room with attached bathroom, just 5 minutes walk from KIT. Ideal for students who want independence at a budget price.',
    owner: { name: 'Sunita Desai', role: 'Owner', phone: '+919823001003' },
    reviews: [
      { name: 'Kiran H.', rating: 4, date: '2026-05-02', text: 'Perfect starter room for first year. Very affordable.' },
      { name: 'Pooja N.', rating: 4.5, date: '2026-02-28', text: 'Owner is very cooperative. Attached bath is a big plus.' },
    ] }),

  _mk({ id: 'kit-04', type: 'flat', title: '2BHK Flat, Tarabai Park', area: 'Tarabai Park, Kolhapur', college: 'kit',
    lat: 16.7010, lng: 74.2290, rent: 12000, deposit: 24000, rating: 4.6, gender: 'any', verified: true,
    facilities: ['wifi', 'furnished', 'parking', 'geyser', 'security', 'power'],
    description: 'Spacious 2BHK in a gated complex in upscale Tarabai Park. Share with a friend and split the cost. Minutes from KIT and close to Kolhapur city center.',
    owner: { name: 'Rajendra Patil', role: 'Owner', phone: '+919823001004' },
    reviews: [
      { name: 'Amol K.', rating: 5, date: '2026-04-12', text: 'Best flat in the area. Spacious and very well maintained.' },
      { name: 'Rohan C.', rating: 4, date: '2026-01-20', text: 'Great location. Shared with two friends, rent is very reasonable per head.' },
      { name: 'Sneha V.', rating: 5, date: '2025-11-08', text: 'Safe area, brilliant landlord. Highly recommended.' },
    ] }),

  _mk({ id: 'kit-05', type: 'pg', title: 'Lakshmi Girls PG, Chandanwadi', area: 'Chandanwadi, Kolhapur', college: 'kit',
    lat: 16.6935, lng: 74.2360, rent: 8000, deposit: 8000, rating: 4.8, gender: 'female', verified: true,
    facilities: ['wifi', 'meals', 'security', 'housekeeping', 'geyser', 'laundry', 'cctv'],
    description: 'Premium girls PG with biometric access, round-the-clock CCTV and a resident warden. Nutritious Maharashtrian meals thrice daily. Highly recommended by COEP and KIT girls.',
    owner: { name: 'Vandana Kulkarni', role: 'Manager', phone: '+919823001005' },
    reviews: [
      { name: 'Anjali P.', rating: 5, date: '2026-05-08', text: 'My parents visited and were extremely happy with the security. Food is amazing.' },
      { name: 'Shruti M.', rating: 5, date: '2026-03-30', text: 'Aunty is very caring. Feels safe even at late night study sessions.' },
      { name: 'Rutuja B.', rating: 4.5, date: '2026-01-25', text: 'Housekeeping is great. Minor issue with hot water timing but fixed quickly.' },
    ] }),

  _mk({ id: 'kit-06', type: 'apartment', title: 'Studio Apartment, Shahu Nagar', area: 'Shahu Nagar, Kolhapur', college: 'kit',
    lat: 16.6900, lng: 74.2400, rent: 10500, deposit: 21000, rating: 4.4, gender: 'any',
    facilities: ['wifi', 'ac', 'furnished', 'lift', 'power', 'parking'],
    description: 'Modern studio apartment in a high-rise near KIT. Fully furnished with modular kitchen, AC, lift access and covered parking. Perfect for final-year students who value independence.',
    owner: { name: 'Suresh Pawar', role: 'Owner', phone: '+919823001006' },
    reviews: [
      { name: 'Ganesh T.', rating: 4.5, date: '2026-04-01', text: 'Feels like a proper adult apartment. AC is a blessing in summer.' },
      { name: 'Aditya C.', rating: 4, date: '2026-02-15', text: 'Pricey but worth it. Very convenient.' },
    ] }),

  _mk({ id: 'kit-07', type: 'room', title: 'Double Sharing Room, Nagala Park', area: 'Nagala Park, Kolhapur', college: 'kit',
    lat: 16.6955, lng: 74.2275, rent: 4500, deposit: 4500, rating: 4.2, gender: 'male',
    facilities: ['wifi', 'geyser', 'power', 'laundry'],
    description: 'Affordable double-sharing room near the famous Nagala Park. Popular with first-year KIT students. Clean, safe and extremely budget-friendly.',
    owner: { name: 'Balasaheb Jadhav', role: 'Owner', phone: '+919823001007' },
    reviews: [
      { name: 'Vinit M.', rating: 4, date: '2026-03-05', text: 'Cheapest option near KIT. Simple and functional.' },
      { name: 'Sumit P.', rating: 4.5, date: '2026-01-10', text: 'Owner is helpful and honest. Great for budgets.' },
    ] }),

  _mk({ id: 'kit-08', type: 'hostel', title: 'Mahalaxmi Girls Hostel', area: 'Rankala, Kolhapur', college: 'kit',
    lat: 16.7030, lng: 74.2250, rent: 7000, deposit: 7000, rating: 4.6, gender: 'female', verified: true,
    facilities: ['wifi', 'meals', 'security', 'cctv', 'study', 'housekeeping', 'geyser'],
    rules: HOSTEL_RULES_DEFAULT,
    description: 'Comfortable girls hostel steps away from the iconic Rankala Lake. CCTV, biometric entry and a live-in warden ensure maximum safety. Lakeside evening walks are a bonus.',
    owner: { name: 'Nalini Shinde', role: 'Warden', phone: '+919823001008' },
    reviews: [
      { name: 'Priya K.', rating: 5, date: '2026-05-01', text: 'Morning walk by Rankala lake is something else. Hostel is clean and secure.' },
      { name: 'Divya N.', rating: 4.5, date: '2026-03-18', text: 'Warden is strict but fair. Food is really tasty.' },
    ] }),

  _mk({ id: 'kit-09', type: 'villa', title: 'Garden Villa, Kolhapur Outskirts', area: 'Kasaba Bavda, Kolhapur', college: 'kit',
    lat: 16.6870, lng: 74.2450, rent: 22000, deposit: 44000, rating: 4.9, gender: 'any', verified: true,
    facilities: ['wifi', 'ac', 'furnished', 'parking', 'garden', 'security', 'power', 'cctv', 'gym'],
    description: 'A rare independent villa with a private garden, home gym, two full BHKs, and a covered 2-car garage. Premium living for PhD scholars, faculty or 4-student groups wanting top-tier comfort near KIT.',
    owner: { name: 'Chandrakant Patil', role: 'Owner', phone: '+919823001009' },
    reviews: [
      { name: 'Dr. Abhijit L.', rating: 5, date: '2026-04-25', text: 'Perfect for a research group. Garden is stunning and home gym is fully equipped.' },
      { name: 'Pratik S.', rating: 5, date: '2026-02-10', text: 'Absolutely premium. We were four final years and split the cost — worth every rupee.' },
    ] }),

  _mk({ id: 'kit-10', type: 'pg', title: 'Panchganga Co-living PG', area: 'Rajarampuri, Kolhapur', college: 'kit',
    lat: 16.7000, lng: 74.2395, rent: 9000, deposit: 9000, rating: 4.5, gender: 'any', verified: true,
    facilities: ['wifi', 'meals', 'laundry', 'gym', 'housekeeping', 'power'],
    description: 'Modern co-living PG with a community feel. Gym, app-based meal booking and rooftop study lounge. Students from KIT, Shivaji University and DKTE love this place.',
    owner: { name: 'Omkar Bhosle', role: 'Manager', phone: '+919823001010' },
    reviews: [
      { name: 'Tejas V.', rating: 5, date: '2026-05-15', text: 'Community vibe is unreal. Made lifelong friends here.' },
      { name: 'Sanket P.', rating: 4, date: '2026-03-10', text: 'Gym is great. Meals could have more variety.' },
    ] }),

  /* ========== WALCHAND COLLEGE SANGLI ========== */
  _mk({ id: 'wce-01', type: 'pg', title: 'Engineers\' Den PG, Vishrambag', area: 'Vishrambag, Sangli', college: 'walchand',
    lat: 16.8610, lng: 74.5720, rent: 7000, deposit: 7000, rating: 4.6, gender: 'male', verified: true,
    facilities: ['wifi', 'meals', 'study', 'power', 'geyser', 'laundry'],
    description: 'A legendary PG that has housed Walchand graduates for 15+ years. Strong WiFi, 24x7 power backup, and mess famous for its Sangli-style misal and bhakri.',
    owner: { name: 'Ganpat Kulkarni', role: 'Owner', phone: '+919823002001' },
    reviews: [
      { name: 'Sachin P.', rating: 5, date: '2026-05-12', text: 'Almost every Walchand topper has stayed here. Mess food is legendary.' },
      { name: 'Rohan M.', rating: 4.5, date: '2026-03-20', text: 'Study room is super quiet. Great for gate prep.' },
      { name: 'Yash K.', rating: 4.5, date: '2026-01-08', text: 'Best value for money near WCE. No complaints.' },
    ] }),

  _mk({ id: 'wce-02', type: 'hostel', title: 'Krishna Boys Hostel, Miraj Road', area: 'Miraj Road, Sangli', college: 'walchand',
    lat: 16.8540, lng: 74.5780, rent: 5800, deposit: 5800, rating: 4.4, gender: 'male',
    facilities: ['wifi', 'meals', 'security', 'study', 'power', 'laundry'],
    rules: HOSTEL_RULES_DEFAULT,
    description: 'Established boys hostel on Miraj Road with 90 rooms, a large study hall, and shuttle service to Walchand campus. Affordable and well maintained.',
    owner: { name: 'Vikram Rao', role: 'Manager', phone: '+919823002002' },
    reviews: [
      { name: 'Nikhil S.', rating: 4.5, date: '2026-04-08', text: 'Shuttle to college is very convenient. Rooms are clean.' },
      { name: 'Omkar T.', rating: 4, date: '2026-01-30', text: 'Good hostel at this price. Occasional power issues but backup is there.' },
    ] }),

  _mk({ id: 'wce-03', type: 'room', title: 'Sunny Single Room, Sangli Camp', area: 'Sangli Camp, Sangli', college: 'walchand',
    lat: 16.8600, lng: 74.5700, rent: 4800, deposit: 4800, rating: 4.1, gender: 'any',
    facilities: ['wifi', 'geyser', 'power', 'furnished'],
    description: 'Affordable single room near Sangli railway station and Walchand campus. Landlord family on ground floor provides a homely atmosphere.',
    owner: { name: 'Ranjit Patil', role: 'Owner', phone: '+919823002003' },
    reviews: [
      { name: 'Abhishek J.', rating: 4, date: '2026-03-15', text: 'Station is walking distance. Simple room, great location.' },
      { name: 'Rushik M.', rating: 4, date: '2026-01-22', text: 'Uncle is very helpful. Clean and quiet.' },
    ] }),

  _mk({ id: 'wce-04', type: 'flat', title: '3BHK Shared Flat, Tilak Chowk', area: 'Tilak Chowk, Sangli', college: 'walchand',
    lat: 16.8650, lng: 74.5760, rent: 14000, deposit: 28000, rating: 4.7, gender: 'any', verified: true,
    facilities: ['wifi', 'furnished', 'parking', 'geyser', 'power', 'security'],
    description: 'Spacious 3BHK for a group of three friends near Tilak Chowk. Large living room, fast internet, and the landlord is an ex-Walchand alumnus who understands student needs.',
    owner: { name: 'Dilip Kadam', role: 'Owner', phone: '+919823002004' },
    reviews: [
      { name: 'Kedar S.', rating: 5, date: '2026-05-05', text: 'Landlord is a WCE alumnus himself — totally understands engineering students. Great flat.' },
      { name: 'Prathmesh V.', rating: 4.5, date: '2026-03-01', text: 'Three of us split rent — turns out to be barely ₹5k each. Insane value.' },
    ] }),

  _mk({ id: 'wce-05', type: 'pg', title: 'Vasundhara Girls PG, Vishrambag', area: 'Vishrambag, Sangli', college: 'walchand',
    lat: 16.8580, lng: 74.5740, rent: 7500, deposit: 7500, rating: 4.8, gender: 'female', verified: true,
    facilities: ['wifi', 'meals', 'security', 'housekeeping', 'geyser', 'cctv', 'laundry'],
    description: 'Safe and comfortable girls PG managed by a retired schoolteacher. Home-cooked Maharashtrian food, CCTV on all floors, and a strict no-male-visitor policy for added safety.',
    owner: { name: 'Meena Deshpande', role: 'Owner', phone: '+919823002005' },
    reviews: [
      { name: 'Sneha K.', rating: 5, date: '2026-04-30', text: 'Safest PG in Sangli. Auntie\'s food is as good as home.' },
      { name: 'Manasi P.', rating: 5, date: '2026-02-18', text: 'My go-to recommendation for any WCE girl. Perfect place.' },
      { name: 'Ishika R.', rating: 4.5, date: '2025-11-30', text: 'Clean, safe, and affordable. Exactly what I needed.' },
    ] }),

  _mk({ id: 'wce-06', type: 'apartment', title: '1BHK Premium Apartment, Gaothan', area: 'Gaothan, Sangli', college: 'walchand',
    lat: 16.8620, lng: 74.5800, rent: 9500, deposit: 19000, rating: 4.3, gender: 'any',
    facilities: ['wifi', 'ac', 'furnished', 'lift', 'parking', 'power'],
    description: 'Modern 1BHK apartment with AC and lift in a residential complex near WCE. Perfect for final year or M.Tech students wanting privacy and quality living.',
    owner: { name: 'Avinash Mane', role: 'Owner', phone: '+919823002006' },
    reviews: [
      { name: 'Shubham G.', rating: 4.5, date: '2026-04-15', text: 'AC apartment near WCE for under 10k — deal of the century!' },
      { name: 'Pooja L.', rating: 4, date: '2026-01-28', text: 'Good apartment, lift makes it very convenient with luggage.' },
    ] }),

  _mk({ id: 'wce-07', type: 'hostel', title: 'Pragati Girls Hostel, Sangli', area: 'Station Road, Sangli', college: 'walchand',
    lat: 16.8555, lng: 74.5760, rent: 6200, deposit: 6200, rating: 4.5, gender: 'female', verified: true,
    facilities: ['wifi', 'meals', 'security', 'study', 'housekeeping', 'cctv', 'geyser'],
    rules: HOSTEL_RULES_DEFAULT,
    description: 'Well-known girls hostel near Sangli station with a warden on duty round the clock. Excellent mess, library access until 11 PM, and a medicinal herb garden in the compound.',
    owner: { name: 'Sushama Jagtap', role: 'Warden', phone: '+919823002007' },
    reviews: [
      { name: 'Pallavi D.', rating: 5, date: '2026-05-20', text: 'The warden is the most caring person I\'ve met. Library till 11 PM is perfect.' },
      { name: 'Rutuja S.', rating: 4, date: '2026-03-12', text: 'Great hostel. Curfew is strictly 10:30 PM.' },
    ] }),

  _mk({ id: 'wce-08', type: 'room', title: 'Furnished Room, Sangliwadi', area: 'Sangliwadi, Sangli', college: 'walchand',
    lat: 16.8595, lng: 74.5730, rent: 5200, deposit: 5200, rating: 4.2, gender: 'male',
    facilities: ['wifi', 'furnished', 'geyser', 'power'],
    description: 'Fully furnished single room in a quiet lane near WCE. Kitchen access, consistent power backup and a very reasonable rent. Ideal for budget-conscious students.',
    owner: { name: 'Suresh Patil', role: 'Owner', phone: '+919823002008' },
    reviews: [
      { name: 'Aaditya G.', rating: 4, date: '2026-04-02', text: 'Affordable and decent. Power backup is reliable.' },
      { name: 'Mihir K.', rating: 4.5, date: '2026-02-10', text: 'Fully furnished at this price is a steal.' },
    ] }),

  _mk({ id: 'wce-09', type: 'villa', title: 'Heritage Farmhouse Stay', area: 'Kupwad, Sangli', college: 'walchand',
    lat: 16.8490, lng: 74.5900, rent: 18000, deposit: 36000, rating: 4.8, gender: 'any', verified: true,
    facilities: ['wifi', 'ac', 'furnished', 'parking', 'garden', 'power', 'security', 'cctv'],
    description: 'A stunning heritage farmhouse converted into student accommodation for up to 5 students. Large verandah, vegetable garden, and a peaceful rural setting — 15 minutes from WCE by bike.',
    owner: { name: 'Babasaheb Desai', role: 'Owner', phone: '+919823002009' },
    reviews: [
      { name: 'Prasad M.', rating: 5, date: '2026-04-22', text: 'We were a group of 5 MTech students. This was the best decision of our academic life.' },
      { name: 'Siddharth P.', rating: 4.5, date: '2026-02-28', text: 'Rural setting, fresh air, and fast WiFi. A researcher\'s dream.' },
    ] }),

  _mk({ id: 'wce-10', type: 'pg', title: 'Saraswati Co-ed PG, Near WCE', area: 'Vishrambag, Sangli', college: 'walchand',
    lat: 16.8630, lng: 74.5710, rent: 8500, deposit: 8500, rating: 4.4, gender: 'any',
    facilities: ['wifi', 'meals', 'laundry', 'study', 'power', 'housekeeping'],
    description: 'Mixed PG with separate floors for boys and girls. Strong study culture, weekly movie nights and a mess serving both Maharashtrian and North Indian food.',
    owner: { name: 'Ashok Nair', role: 'Manager', phone: '+919823002010' },
    reviews: [
      { name: 'Vaibhav S.', rating: 4.5, date: '2026-05-08', text: 'Mixed PG done right. Very respectful environment.' },
      { name: 'Neha P.', rating: 4, date: '2026-03-25', text: 'Meals are above average. Study hall is my second home.' },
    ] }),

  /* ========== COEP PUNE ========== */
  _mk({ id: 'coep-01', type: 'flat', title: 'Shivajinagar Heritage Flat', area: 'Shivajinagar, Pune', college: 'coep',
    lat: 18.5320, lng: 73.8440, rent: 18000, deposit: 36000, rating: 4.9, gender: 'any', verified: true,
    facilities: ['wifi', 'ac', 'furnished', 'security', 'parking', 'power', 'lift'],
    description: 'A premium 2BHK in the heart of Shivajinagar — walking distance to COEP campus and Pune\'s FC Road social scene. Top-floor apartment with city views and stunning sunset balcony.',
    owner: { name: 'Anand Kulkarni', role: 'Owner', phone: '+919823003001' },
    reviews: [
      { name: 'Abhishek D.', rating: 5, date: '2026-05-14', text: 'Can\'t beat this location. FC Road is 10 minutes. COEP in 5. City views every evening.' },
      { name: 'Tanvi M.', rating: 5, date: '2026-03-28', text: 'Premium in every sense. Worth every rupee.' },
      { name: 'Aryan P.', rating: 4.5, date: '2026-01-15', text: 'Parking and security are top-notch. Owner is responsive.' },
    ] }),

  _mk({ id: 'coep-02', type: 'pg', title: 'FC Road Boys PG', area: 'FC Road, Pune', college: 'coep',
    lat: 18.5290, lng: 73.8420, rent: 14000, deposit: 14000, rating: 4.7, gender: 'male', verified: true,
    facilities: ['wifi', 'ac', 'meals', 'gym', 'laundry', 'housekeeping', 'study', 'cctv'],
    description: 'Upscale co-living PG on the iconic FC Road. Air-conditioned rooms, a fully equipped gym, a café-style common room and chef-prepared meals. The social hub for COEP students.',
    owner: { name: 'Rahul Joshi', role: 'Manager', phone: '+919823003002' },
    reviews: [
      { name: 'Siddhesh K.', rating: 5, date: '2026-05-18', text: 'FC Road PG is the stuff of legends. Gym, food, location — all 10/10.' },
      { name: 'Parth S.', rating: 4.5, date: '2026-04-02', text: 'A bit expensive but you get what you pay for. Made great friends here.' },
      { name: 'Gaurav T.', rating: 5, date: '2026-02-14', text: 'Worth every rupee. Top notch facilities for students.' },
    ] }),

  _mk({ id: 'coep-03', type: 'hostel', title: 'Bund Garden Boys Hostel', area: 'Sangamwadi, Pune', college: 'coep',
    lat: 18.5350, lng: 73.8510, rent: 11000, deposit: 11000, rating: 4.4, gender: 'male',
    facilities: ['wifi', 'meals', 'study', 'security', 'power', 'laundry', 'geyser'],
    rules: HOSTEL_RULES_DEFAULT,
    description: 'Modern hostel near the Bund Garden with 60 AC rooms, a 24x7 reading room and a mess rated highly for its South-Indian breakfast. Peaceful riverside location.',
    owner: { name: 'Prashant Deshpande', role: 'Manager', phone: '+919823003003' },
    reviews: [
      { name: 'Sushant R.', rating: 4.5, date: '2026-04-20', text: 'Riverside location is incredibly peaceful. Breakfast is the best part.' },
      { name: 'Kunal B.', rating: 4, date: '2026-02-07', text: 'Good overall. WiFi drops occasionally during evenings.' },
    ] }),

  _mk({ id: 'coep-04', type: 'room', title: 'Modern Room, Deccan Gymkhana', area: 'Deccan Gymkhana, Pune', college: 'coep',
    lat: 18.5210, lng: 73.8390, rent: 13000, deposit: 13000, rating: 4.5, gender: 'any', verified: true,
    facilities: ['wifi', 'ac', 'furnished', 'geyser', 'security'],
    description: 'Stylish AC room in a boutique building near Deccan Gymkhana. Walking distance to COEP, Symbiosis and numerous premium cafés. Ideal for final year students.',
    owner: { name: 'Varsha Apte', role: 'Owner', phone: '+919823003004' },
    reviews: [
      { name: 'Vedant N.', rating: 4.5, date: '2026-05-05', text: 'Deccan Gymkhana address is a flex. Room is beautiful.' },
      { name: 'Aishwarya K.', rating: 4.5, date: '2026-03-09', text: 'AC room at a fair price. Madam is very accommodating.' },
    ] }),

  _mk({ id: 'coep-05', type: 'pg', title: 'Pune Colive Girls PG, Kothrud', area: 'Kothrud, Pune', college: 'coep',
    lat: 18.5040, lng: 73.8150, rent: 15000, deposit: 15000, rating: 4.8, gender: 'female', verified: true,
    facilities: ['wifi', 'ac', 'meals', 'gym', 'security', 'laundry', 'housekeeping', 'cctv', 'lift'],
    description: 'Luxury girls-only co-living in Kothrud with daily housekeeping, 24x7 CCTV, biometric access, a rooftop terrace and gourmet meals. The finest student accommodation near COEP and Pune universities.',
    owner: { name: 'Priya Joshi', role: 'Manager', phone: '+919823003005' },
    reviews: [
      { name: 'Pooja D.', rating: 5, date: '2026-05-22', text: 'This is not a PG — this is a boutique hotel for students. Absolute luxury.' },
      { name: 'Asmita V.', rating: 5, date: '2026-04-10', text: 'Parents couldn\'t believe the quality. Biometric entry gives them peace of mind.' },
      { name: 'Riddhi S.', rating: 4.5, date: '2026-02-20', text: 'Rooftop terrace is stunning. Meals are chef-quality.' },
    ] }),

  _mk({ id: 'coep-06', type: 'apartment', title: 'Riverside 2BHK, Yerwada', area: 'Yerwada, Pune', college: 'coep',
    lat: 18.5510, lng: 73.8780, rent: 22000, deposit: 44000, rating: 4.6, gender: 'any', verified: true,
    facilities: ['wifi', 'ac', 'furnished', 'parking', 'lift', 'security', 'gym', 'power'],
    description: 'Premium 2BHK apartment with riverview balcony in a gated society with clubhouse and gym. 20 minutes from COEP. Ideal for working students or those in their final year.',
    owner: { name: 'Nitin Shah', role: 'Owner', phone: '+919823003006' },
    reviews: [
      { name: 'Viraj M.', rating: 5, date: '2026-05-10', text: 'River view every morning is priceless. Society amenities are amazing.' },
      { name: 'Devika P.', rating: 4.5, date: '2026-03-18', text: 'Premium stay. Gym access is great for maintaining routine during exams.' },
    ] }),

  _mk({ id: 'coep-07', type: 'flat', title: '1BHK Cozy Flat, Shivajinagar', area: 'Shivajinagar, Pune', college: 'coep',
    lat: 18.5280, lng: 73.8490, rent: 15500, deposit: 31000, rating: 4.5, gender: 'any',
    facilities: ['wifi', 'furnished', 'geyser', 'security', 'power'],
    description: 'Charming 1BHK steps from COEP main gate. Perfect for a couple of close friends. Quaint colonial building with character and a balcony overlooking a tree-lined street.',
    owner: { name: 'Usha Rane', role: 'Owner', phone: '+919823003007' },
    reviews: [
      { name: 'Mayur L.', rating: 4.5, date: '2026-04-28', text: 'Character building, beautiful street view. Walking to COEP in 5 minutes.' },
      { name: 'Shriya D.', rating: 4.5, date: '2026-02-22', text: 'Cozy and convenient. Owner is very thoughtful.' },
    ] }),

  _mk({ id: 'coep-08', type: 'hostel', title: 'Savitribai Phule Girls Hostel', area: 'Shivajinagar, Pune', college: 'coep',
    lat: 18.5300, lng: 73.8460, rent: 10000, deposit: 10000, rating: 4.7, gender: 'female', verified: true,
    facilities: ['wifi', 'meals', 'security', 'study', 'housekeeping', 'cctv', 'geyser', 'power'],
    rules: HOSTEL_RULES_DEFAULT,
    description: 'Named after Maharashtra\'s first female teacher, this girls hostel near COEP is renowned for its safe environment, inspiring study culture and nutritious meals. Waiting list every year.',
    owner: { name: 'Dr. Lata Deore', role: 'Warden', phone: '+919823003008' },
    reviews: [
      { name: 'Apurva N.', rating: 5, date: '2026-05-02', text: 'Most inspiring place I\'ve stayed. Warden is a brilliant mentor.' },
      { name: 'Vrushali P.', rating: 5, date: '2026-03-14', text: 'Apply early — this fills up faster than COEP admissions!' },
      { name: 'Gauri T.', rating: 4.5, date: '2026-01-20', text: 'Study environment is exceptional. Meals are filling and healthy.' },
    ] }),

  _mk({ id: 'coep-09', type: 'villa', title: 'Bungalow Retreat, Bavdhan', area: 'Bavdhan, Pune', college: 'coep',
    lat: 18.5170, lng: 73.7870, rent: 35000, deposit: 70000, rating: 4.9, gender: 'any', verified: true,
    facilities: ['wifi', 'ac', 'furnished', 'pool', 'gym', 'garden', 'parking', 'security', 'cctv', 'power'],
    description: 'A stunning 4BHK bungalow with a private swimming pool and gym in upscale Bavdhan. Sleeps 6 students in luxury. 25 minutes from COEP. Perfect for startups, research teams or senior students.',
    owner: { name: 'Sudhir Bapat', role: 'Owner', phone: '+919823003009' },
    reviews: [
      { name: 'Rohit A.', rating: 5, date: '2026-05-18', text: 'Pool, gym, 4BHK, garden — this is student living redefined. Six of us shared and it was a dream.' },
      { name: 'Sanika V.', rating: 5, date: '2026-03-30', text: 'Our startup team stayed here for a semester. Productive and luxurious.' },
    ] }),

  _mk({ id: 'coep-10', type: 'pg', title: 'Camp Area Boys PG, Pune', area: 'Pune Camp, Pune', college: 'coep',
    lat: 18.5195, lng: 73.8700, rent: 12000, deposit: 12000, rating: 4.3, gender: 'male', verified: true,
    facilities: ['wifi', 'meals', 'ac', 'laundry', 'power', 'study'],
    description: 'Well-connected PG in Pune Camp area. AC rooms, reliable WiFi and a mess serving a mix of Maharashtrian and continental food. Metro connectivity makes college commute easy.',
    owner: { name: 'Dilip Thakur', role: 'Manager', phone: '+919823003010' },
    reviews: [
      { name: 'Aniket S.', rating: 4.5, date: '2026-04-05', text: 'Metro connectivity from Camp is a huge advantage. AC rooms are a bonus.' },
      { name: 'Vijay N.', rating: 4, date: '2026-02-12', text: 'Good PG overall. Food has improved recently.' },
    ] }),

  /* ========== VJTI MUMBAI ========== */
  _mk({ id: 'vjti-01', type: 'pg', title: 'Matunga Premium Boys PG', area: 'Matunga East, Mumbai', college: 'vjti',
    lat: 19.0250, lng: 72.8680, rent: 15000, deposit: 15000, rating: 4.8, gender: 'male', verified: true,
    facilities: ['wifi', 'ac', 'meals', 'laundry', 'security', 'housekeeping', 'cctv', 'study'],
    description: 'Upscale boys PG 3 minutes from VJTI main gate in the prestigious Matunga East. South Indian breakfast daily, AC rooms, biometric entry and a terrace reading zone with Mumbai skyline views.',
    owner: { name: 'Suresh Iyer', role: 'Manager', phone: '+919823004001' },
    reviews: [
      { name: 'Chirag M.', rating: 5, date: '2026-05-20', text: 'Matunga address, VJTI proximity, AC, and Iyer uncle\'s dosas. Does it get better?' },
      { name: 'Siddhart N.', rating: 5, date: '2026-04-05', text: 'Best PG in Mumbai for engineering students without question.' },
      { name: 'Harsh K.', rating: 4.5, date: '2026-02-18', text: 'Sky view terrace in the evenings is something else. Very safe.' },
    ] }),

  _mk({ id: 'vjti-02', type: 'hostel', title: 'Dadar Boys Hostel', area: 'Dadar West, Mumbai', college: 'vjti',
    lat: 19.0180, lng: 72.8440, rent: 12000, deposit: 12000, rating: 4.5, gender: 'male', verified: true,
    facilities: ['wifi', 'meals', 'security', 'study', 'laundry', 'power', 'cctv'],
    rules: HOSTEL_RULES_DEFAULT,
    description: 'Well-established hostel in Dadar West, connected to VJTI by a direct bus. Strong alumni network, 24x7 security and a famous mess serving authentic Mumbai street-food-inspired meals.',
    owner: { name: 'Rajan Pawar', role: 'Manager', phone: '+919823004002' },
    reviews: [
      { name: 'Atharva P.', rating: 5, date: '2026-05-12', text: 'Hostel has an incredible alumni network. Made connections that led to my internship.' },
      { name: 'Rushil D.', rating: 4, date: '2026-03-22', text: 'Dadar location is unbeatable for Mumbai travel.' },
    ] }),

  _mk({ id: 'vjti-03', type: 'flat', title: '2BHK Flat, Sion', area: 'Sion, Mumbai', college: 'vjti',
    lat: 19.0390, lng: 72.8620, rent: 25000, deposit: 50000, rating: 4.6, gender: 'any', verified: true,
    facilities: ['wifi', 'ac', 'furnished', 'security', 'parking', 'lift', 'power'],
    description: 'Premium 2BHK in Sion with lift and covered parking. Central Mumbai location with easy access to VJTI, CST and BKC. Ideal for internship season or final year students needing Mumbai connectivity.',
    owner: { name: 'Manish Shah', role: 'Owner', phone: '+919823004003' },
    reviews: [
      { name: 'Mitesh J.', rating: 4.5, date: '2026-05-08', text: 'Sion is perfectly central. VJTI in 15 min, BKC in 20 — couldn\'t ask for more.' },
      { name: 'Dipti N.', rating: 5, date: '2026-03-15', text: 'Beautifully maintained flat. Lift and parking in Mumbai at this price is rare.' },
    ] }),

  _mk({ id: 'vjti-04', type: 'room', title: 'Student Room, Wadala', area: 'Wadala, Mumbai', college: 'vjti',
    lat: 19.0120, lng: 72.8560, rent: 10000, deposit: 10000, rating: 4.2, gender: 'male',
    facilities: ['wifi', 'geyser', 'furnished', 'power'],
    description: 'Clean single room in Wadala, well-connected to VJTI by local train. Shared kitchen and common area with 4 other student residents in the same building.',
    owner: { name: 'Ramesh Kadam', role: 'Owner', phone: '+919823004004' },
    reviews: [
      { name: 'Nikhil P.', rating: 4, date: '2026-04-20', text: 'Basic but clean. Wadala station connectivity saves daily commute.' },
      { name: 'Shreyas M.', rating: 4.5, date: '2026-02-05', text: 'Good for budget living in Mumbai. Owner is very fair.' },
    ] }),

  _mk({ id: 'vjti-05', type: 'pg', title: 'Matunga Girls PG, Hindu Colony', area: 'Hindu Colony, Dadar', college: 'vjti',
    lat: 19.0210, lng: 72.8490, rent: 16000, deposit: 16000, rating: 4.9, gender: 'female', verified: true,
    facilities: ['wifi', 'ac', 'meals', 'security', 'housekeeping', 'laundry', 'cctv', 'lift', 'geyser'],
    description: 'A gem of a girls PG in a safe society in the Hindu Colony. AC rooms, gourmet South Indian meals, CCTV and a rooftop yoga space. Top rated for safety and quality in all of Mumbai.',
    owner: { name: 'Geetha Krishnaswamy', role: 'Manager', phone: '+919823004005' },
    reviews: [
      { name: 'Aishwarya R.', rating: 5, date: '2026-05-22', text: 'This is a lifestyle, not just a PG. Yoga terrace is my morning ritual now.' },
      { name: 'Prerna S.', rating: 5, date: '2026-04-08', text: 'Parents did not want me living elsewhere after seeing this. Impeccable safety.' },
      { name: 'Kavya T.', rating: 5, date: '2026-02-28', text: 'Quality of food and cleanliness is restaurant-level. Highly recommend.' },
    ] }),

  _mk({ id: 'vjti-06', type: 'apartment', title: 'Modern Studio, Bandra East', area: 'Bandra East, Mumbai', college: 'vjti',
    lat: 19.0540, lng: 72.8520, rent: 28000, deposit: 56000, rating: 4.7, gender: 'any', verified: true,
    facilities: ['wifi', 'ac', 'furnished', 'lift', 'parking', 'gym', 'security', 'power'],
    description: 'Chic studio apartment in Bandra East with gym access, covered parking and 24x7 security in a premium society. A 30-minute drive from VJTI — ideal for VJTI students with internships in BKC.',
    owner: { name: 'Arun Nair', role: 'Owner', phone: '+919823004006' },
    reviews: [
      { name: 'Akshay V.', rating: 5, date: '2026-05-15', text: 'BKC startup scene 10 min away. VJTI 30 min. This is the power duo.' },
      { name: 'Mrunal K.', rating: 4.5, date: '2026-03-20', text: 'Premium apartment at a premium price, but Mumbai prices, so fair.' },
    ] }),

  _mk({ id: 'vjti-07', type: 'hostel', title: 'Shramik Girls Hostel, Dadar', area: 'Dadar East, Mumbai', college: 'vjti',
    lat: 19.0230, lng: 72.8470, rent: 13500, deposit: 13500, rating: 4.6, gender: 'female', verified: true,
    facilities: ['wifi', 'meals', 'security', 'cctv', 'study', 'laundry', 'housekeeping', 'geyser'],
    rules: HOSTEL_RULES_DEFAULT,
    description: 'Trusted girls hostel in Dadar East operational for 20+ years. Close to the Central Line and VJTI. Renowned for its exceptional security, home-style meals and a nurturing community.',
    owner: { name: 'Vasudha Bhatt', role: 'Warden', phone: '+919823004007' },
    reviews: [
      { name: 'Nidhi A.', rating: 5, date: '2026-04-30', text: 'Aunty is like a second mother. Safest I\'ve felt in Mumbai.' },
      { name: 'Rashmi G.', rating: 4.5, date: '2026-03-05', text: 'Been here 3 years. Never thought of moving. Community is the best part.' },
    ] }),

  _mk({ id: 'vjti-08', type: 'flat', title: 'Shared 1BHK, Chembur', area: 'Chembur, Mumbai', college: 'vjti',
    lat: 19.0633, lng: 72.8998, rent: 20000, deposit: 40000, rating: 4.4, gender: 'any',
    facilities: ['wifi', 'furnished', 'parking', 'power', 'geyser', 'security'],
    description: 'Spacious 1BHK in Chembur, shared between two students. Quick access to Eastern Freeway and Monorail to VJTI. Large balcony, building security and covered parking.',
    owner: { name: 'Santosh Jha', role: 'Owner', phone: '+919823004008' },
    reviews: [
      { name: 'Omkar R.', rating: 4.5, date: '2026-05-01', text: 'Monorail + Eastern Freeway to VJTI makes commute a breeze.' },
      { name: 'Tanvi S.', rating: 4, date: '2026-03-08', text: 'Big balcony and good natural light. Comfortable split with a friend.' },
    ] }),

  _mk({ id: 'vjti-09', type: 'villa', title: 'Sea Breeze Villa, Chembur', area: 'Chembur, Mumbai', college: 'vjti',
    lat: 19.0700, lng: 72.8990, rent: 45000, deposit: 90000, rating: 4.8, gender: 'any', verified: true,
    facilities: ['wifi', 'ac', 'furnished', 'pool', 'gym', 'parking', 'security', 'garden', 'cctv', 'power'],
    description: 'Extraordinary Mumbai villa with a private pool, home gym and landscaped garden. Accommodates up to 6 students in comfort. Sea breeze all year round, 40 minutes from VJTI.',
    owner: { name: 'Deepak Hegde', role: 'Owner', phone: '+919823004009' },
    reviews: [
      { name: 'Nakul T.', rating: 5, date: '2026-05-20', text: 'A private pool in Mumbai? Yes, this exists. Six of us from VJTI MTech had the year of our lives.' },
      { name: 'Isha P.', rating: 5, date: '2026-04-12', text: 'Impossibly premium. Sea breeze every morning is magical.' },
    ] }),

  _mk({ id: 'vjti-10', type: 'pg', title: 'Techies\' Nest PG, Matunga', area: 'Matunga West, Mumbai', college: 'vjti',
    lat: 19.0240, lng: 72.8630, rent: 13500, deposit: 13500, rating: 4.5, gender: 'any', verified: true,
    facilities: ['wifi', 'meals', 'laundry', 'study', 'security', 'power', 'housekeeping'],
    description: 'Mixed PG designed for engineering students. Whiteboards in every room, high-speed fibre internet, a mini library with engineering textbooks and a Raspberry Pi lab in the common area.',
    owner: { name: 'Vijay Menon', role: 'Manager', phone: '+919823004010' },
    reviews: [
      { name: 'Shubham P.', rating: 5, date: '2026-05-06', text: 'Whiteboards in rooms and a Pi lab in common area — literally built for engineers.' },
      { name: 'Ritika K.', rating: 4, date: '2026-03-25', text: 'Great tech-focused PG. Mixed environment is respectful.' },
    ] }),

  /* ========== PICT PUNE ========== */
  _mk({ id: 'pict-01', type: 'pg', title: 'Trimurti Boys PG, Dhankawadi', area: 'Dhankawadi, Pune', college: 'pict',
    lat: 18.4590, lng: 73.8510, rent: 8500, deposit: 8500, rating: 4.7, gender: 'male', verified: true,
    facilities: ['wifi', 'meals', 'study', 'power', 'laundry', 'geyser', 'security'],
    description: 'Highly rated boys PG just 500 m from PICT campus. Strong engineering study culture, fast internet for coding sessions and a mess famous for its authentic Maharashtrian thali.',
    owner: { name: 'Datta Jadhav', role: 'Owner', phone: '+919823005001' },
    reviews: [
      { name: 'Saket P.', rating: 5, date: '2026-05-16', text: 'Half of PICT\'s CS department lives here. Best study environment.' },
      { name: 'Aakash M.', rating: 4.5, date: '2026-04-08', text: 'Mess thali is legendary. WiFi speed is excellent for leetcode sessions.' },
      { name: 'Tushar B.', rating: 5, date: '2026-02-25', text: 'Owner Sir treats students like sons. Very responsible management.' },
    ] }),

  _mk({ id: 'pict-02', type: 'hostel', title: 'Pragyan Boys Hostel, Katraj', area: 'Katraj, Pune', college: 'pict',
    lat: 18.4530, lng: 73.8450, rent: 7800, deposit: 7800, rating: 4.5, gender: 'male', verified: true,
    facilities: ['wifi', 'meals', 'study', 'security', 'power', 'laundry', 'cctv'],
    rules: HOSTEL_RULES_DEFAULT,
    description: 'Popular PICT hostel with a strong coding culture. Multiple coding rooms with monitors and ergonomic chairs, a 24x7 mess and regular hackathon nights.',
    owner: { name: 'Nishant Kulkarni', role: 'Manager', phone: '+919823005002' },
    reviews: [
      { name: 'Varun S.', rating: 5, date: '2026-05-10', text: 'Coding rooms with dual monitors! Where else in India does a hostel have this?' },
      { name: 'Dipesh T.', rating: 4.5, date: '2026-03-28', text: 'Hackathon nights at the hostel are so much fun. Great community.' },
      { name: 'Harsh C.', rating: 4, date: '2026-01-18', text: 'Food has improved. WiFi is fast enough for video calls.' },
    ] }),

  _mk({ id: 'pict-03', type: 'flat', title: '2BHK IT Hub Flat, Dhankawadi', area: 'Dhankawadi, Pune', college: 'pict',
    lat: 18.4610, lng: 73.8530, rent: 16000, deposit: 32000, rating: 4.6, gender: 'any', verified: true,
    facilities: ['wifi', 'ac', 'furnished', 'parking', 'security', 'power', 'lift'],
    description: 'Modern 2BHK in a gated IT society walking distance from PICT. Shares building with young tech professionals — great networking environment. Three workstations already set up.',
    owner: { name: 'Harshad Wagh', role: 'Owner', phone: '+919823005003' },
    reviews: [
      { name: 'Abhijeet P.', rating: 4.5, date: '2026-05-03', text: 'Neighbours are all engineers. Brilliant for networking during placement season.' },
      { name: 'Chitra N.', rating: 5, date: '2026-03-20', text: '3 workstations already set up! Just plugin and code.' },
    ] }),

  _mk({ id: 'pict-04', type: 'pg', title: 'Ananya Girls PG, Warje', area: 'Warje, Pune', college: 'pict',
    lat: 18.4850, lng: 73.8010, rent: 9500, deposit: 9500, rating: 4.7, gender: 'female', verified: true,
    facilities: ['wifi', 'meals', 'security', 'housekeeping', 'laundry', 'geyser', 'cctv', 'study'],
    description: 'Safe and comfortable girls PG in Warje with daily housekeeping, freshly cooked Maharashtrian meals and a quiet study atmosphere. Shuttle service to PICT three times daily.',
    owner: { name: 'Madhuri Pawar', role: 'Manager', phone: '+919823005004' },
    reviews: [
      { name: 'Riya V.', rating: 5, date: '2026-05-18', text: 'Shuttle to PICT is a lifesaver! PG is clean and food is delicious.' },
      { name: 'Sanjana K.', rating: 4.5, date: '2026-04-12', text: 'Very safe. CCTV everywhere and management is responsive.' },
      { name: 'Aarti B.', rating: 5, date: '2026-02-08', text: 'Freshly cooked meals every day. Feels like home.' },
    ] }),

  _mk({ id: 'pict-05', type: 'room', title: 'Budget Room, Bibwewadi', area: 'Bibwewadi, Pune', college: 'pict',
    lat: 18.4660, lng: 73.8470, rent: 6000, deposit: 6000, rating: 4.2, gender: 'male',
    facilities: ['wifi', 'geyser', 'furnished', 'power'],
    description: 'Compact, clean and affordable single room near Bibwewadi bus stop. 15 minutes to PICT by local bus. Shared kitchen available. Best price-to-quality ratio near PICT.',
    owner: { name: 'Vijay Khandagale', role: 'Owner', phone: '+919823005005' },
    reviews: [
      { name: 'Prafull S.', rating: 4, date: '2026-04-18', text: 'Cheapest option near PICT that is still clean and safe. Recommended.' },
      { name: 'Omkar N.', rating: 4.5, date: '2026-02-14', text: 'Owner is very reasonable. Bus connectivity is good.' },
    ] }),

  _mk({ id: 'pict-06', type: 'apartment', title: 'Smart 1BHK, Ambegaon Bk', area: 'Ambegaon Bk, Pune', college: 'pict',
    lat: 18.4510, lng: 73.8380, rent: 12000, deposit: 24000, rating: 4.4, gender: 'any',
    facilities: ['wifi', 'ac', 'furnished', 'parking', 'power', 'security'],
    description: 'Smart home-enabled 1BHK apartment. App-controlled lighting, AC and security camera. 10 minutes from PICT. Perfect for tech-forward students who value smart living.',
    owner: { name: 'Nikhil Joshi', role: 'Owner', phone: '+919823005006' },
    reviews: [
      { name: 'Yash P.', rating: 4.5, date: '2026-05-08', text: 'Smart home features are actually useful. Controlling AC from bed is bliss.' },
      { name: 'Pallavi S.', rating: 4, date: '2026-02-20', text: 'Good apartment. Smart features work well once set up.' },
    ] }),

  _mk({ id: 'pict-07', type: 'hostel', title: 'Vidyanidhi Girls Hostel, Katraj', area: 'Katraj, Pune', college: 'pict',
    lat: 18.4540, lng: 73.8420, rent: 8000, deposit: 8000, rating: 4.6, gender: 'female', verified: true,
    facilities: ['wifi', 'meals', 'security', 'study', 'cctv', 'housekeeping', 'laundry', 'geyser'],
    rules: HOSTEL_RULES_DEFAULT,
    description: 'Highly recommended girls hostel near PICT known for its supportive community. Regular guest lectures, career counseling sessions and a dedicated meditation room.',
    owner: { name: 'Archana Gokhale', role: 'Warden', phone: '+919823005007' },
    reviews: [
      { name: 'Mrunmai B.', rating: 5, date: '2026-05-15', text: 'Guest lecture series every month is invaluable for career guidance.' },
      { name: 'Anuja P.', rating: 5, date: '2026-04-02', text: 'Meditation room helps during exam stress. Warden is brilliant.' },
      { name: 'Sayali K.', rating: 4.5, date: '2026-01-30', text: 'Community of PICT girls is very supportive. Great place to grow.' },
    ] }),

  _mk({ id: 'pict-08', type: 'flat', title: '3BHK Student Villa, Dhayari', area: 'Dhayari, Pune', college: 'pict',
    lat: 18.4450, lng: 73.8200, rent: 18000, deposit: 36000, rating: 4.5, gender: 'any', verified: true,
    facilities: ['wifi', 'furnished', 'parking', 'geyser', 'security', 'garden', 'power'],
    description: 'Large 3BHK with a private garden terrace in peaceful Dhayari. Perfect for a group of 3-4 students. Dedicated parking, solar water heating and a landlord who is a PICT alumnus.',
    owner: { name: 'Amar Warghat', role: 'Owner', phone: '+919823005008' },
    reviews: [
      { name: 'Prasad D.', rating: 4.5, date: '2026-05-05', text: 'Garden terrace is perfect for weekend barbecues. Great space for 4.' },
      { name: 'Kunal H.', rating: 4.5, date: '2026-03-22', text: 'Landlord being a PICT alum means he truly understands student needs.' },
    ] }),

  _mk({ id: 'pict-09', type: 'villa', title: 'Tech Bungalow, Narhe', area: 'Narhe, Pune', college: 'pict',
    lat: 18.4390, lng: 73.8290, rent: 30000, deposit: 60000, rating: 4.8, gender: 'any', verified: true,
    facilities: ['wifi', 'ac', 'furnished', 'parking', 'gym', 'garden', 'security', 'power', 'cctv', 'pool'],
    description: 'A stunning independent bungalow built for tech-focused students. Dedicated server room, fiber internet, home cinema, gym and a pool. 15 minutes from PICT. For groups of 5-6 serious students.',
    owner: { name: 'Vinod Bharati', role: 'Owner', phone: '+919823005009' },
    reviews: [
      { name: 'Rohan G.', rating: 5, date: '2026-05-20', text: 'Dedicated server room for our project! Our team had the best semester building here.' },
      { name: 'Snehal D.', rating: 5, date: '2026-04-15', text: 'Home cinema, pool and fiber internet. This bungalow is what engineering dreams are made of.' },
    ] }),

  _mk({ id: 'pict-10', type: 'pg', title: 'Silicon PG, Sahakarnagar', area: 'Sahakarnagar, Pune', college: 'pict',
    lat: 18.4710, lng: 73.8530, rent: 10500, deposit: 10500, rating: 4.5, gender: 'any', verified: true,
    facilities: ['wifi', 'meals', 'ac', 'laundry', 'study', 'security', 'power', 'housekeeping'],
    description: 'Premium co-living PG popular with PICT, PCCOE and MIT students. AC rooms, coding-friendly atmosphere, strong WiFi and a mess serving both veg and non-veg options. Waiting list every June.',
    owner: { name: 'Supriya Gokhale', role: 'Manager', phone: '+919823005010' },
    reviews: [
      { name: 'Mandar S.', rating: 4.5, date: '2026-05-12', text: 'The go-to PG for PICT CS students. Coding sessions till 2 AM in the common room.' },
      { name: 'Aditi N.', rating: 5, date: '2026-04-01', text: 'Mixed PG done right. Respectful, clean and great food.' },
      { name: 'Kiran B.', rating: 4, date: '2026-02-10', text: 'Good PG. Would love more variety in the mess menu.' },
    ] }),
];
