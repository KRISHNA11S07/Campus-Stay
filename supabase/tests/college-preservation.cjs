// Run with: node supabase/tests/postgres-security.cjs --college-preservation
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

async function populate(db, affiliations) {
  const owner = '00000000-0000-4000-8000-000000000001';
  const student = '00000000-0000-4000-8000-000000000002';
  await db.query('INSERT INTO auth.users(id) VALUES ($1), ($2)', [owner, student]);
  await db.exec(`INSERT INTO public.colleges(id, name, city, lat, lng)
    VALUES ('custom', 'Custom college', 'Fixture city', 17, 74)`);
  await db.query(`INSERT INTO public.properties(owner_id, type, title, college_id, rent)
    SELECT $1, 'room', 'Fixture stay', affiliation, 1000
    FROM unnest($2::text[]) AS ids(affiliation)`, [owner, affiliations]);
  await db.exec(`
    INSERT INTO public.bookings(student_id, property_id, owner_id, amount, booking_status)
    SELECT '${student}', id, owner_id, 1000, 'confirmed' FROM public.properties;
    INSERT INTO public.reviews(student_id, property_id, booking_id, rating, review_text)
    SELECT student_id, property_id, id, 4, 'Existing review' FROM public.bookings;
    INSERT INTO public.favorites(student_id, property_id)
    SELECT student_id, property_id FROM public.bookings;
    INSERT INTO public.property_media(property_id, file_url, file_type)
    SELECT id, 'https://example.test/photo.jpg', 'image' FROM public.properties;
    INSERT INTO public.property_rules(property_id, rule_text)
    SELECT id, 'Quiet hours' FROM public.properties;
    INSERT INTO public.property_facilities(property_id, facility_id)
    SELECT id, 'wifi' FROM public.properties;
  `);
}

module.exports = async function verifyCollegePreservation(db, directory, mode) {
  const files = fs.readdirSync(directory).filter(file => file.endsWith('.sql')).sort();
  const target = files.indexOf('005_kit_only.sql');
  assert.equal(target, 4);
  const apply = file => db.exec(fs.readFileSync(path.join(directory, file), 'utf8'));
  for (const file of files.slice(0, target)) await apply(file);
  const alreadyApplied = mode === 'colleges-applied';
  let affiliations = [];
  let collegeIds = ['coep', 'kit', 'pict', 'vjti', 'walchand'];
  if (alreadyApplied) {
    // Model an old ledger position in memory. Only seeded reference rows exist here.
    const original = execFileSync('git', ['show', '737a409:supabase/migrations/005_kit_only.sql'],
      { cwd: directory, encoding: 'utf8' });
    await db.exec(original);
    collegeIds = ['kit'];
  }
  if (mode !== 'colleges-clean') {
    affiliations = alreadyApplied ? ['kit', 'custom', null] : ['kit', 'coep', 'custom', null];
    await populate(db, affiliations);
    collegeIds.push('custom');
  }

  // Compare full rows in SQL's JSON representation to retain timestamp precision.
  async function rows(table) {
    return (await db.query(`SELECT to_jsonb(t) AS row FROM public.${table} t ORDER BY to_jsonb(t)`)).rows;
  }
  async function relationships() {
    const result = {};
    for (const table of ['colleges', 'bookings', 'reviews', 'favorites', 'property_media',
                         'property_rules', 'property_facilities']) {
      result[table] = await rows(table);
    }
    result.affiliations = (await db.query('SELECT id, owner_id, college_id FROM public.properties ORDER BY id')).rows;
    return result;
  }

  const before = await relationships();
  const properties = await rows('properties');
  assert.deepEqual(before.colleges.map(({row}) => row.id).sort(), collegeIds.sort());
  assert.equal(properties.length, affiliations.length);
  assert.deepEqual(before.affiliations.map(row => row.college_id).sort(), affiliations.sort());
  assert.equal(before.bookings.length, properties.length);
  assert.equal(before.reviews.length, properties.length);

  if (!alreadyApplied) {
    await apply(files[target]);
    assert.deepEqual(await relationships(), before, '005 changed college data or related records');
    assert.deepEqual(await rows('properties'), properties, '005 changed a property row');
  }

  for (const file of files.slice(target + 1)) await apply(file);
  assert.deepEqual(await relationships(), before, 'A later migration changed college data or related records');
  console.log(`PASS ${mode} through 014: ${before.colleges.length} colleges, ${properties.length} affiliations, ${before.bookings.length} bookings and ${before.reviews.length} reviews preserved`);
};
