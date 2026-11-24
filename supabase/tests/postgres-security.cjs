// Run with an installed @electric-sql/pglite or PGLITE_DIST pointing to its dist directory.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const dist = process.env.PGLITE_DIST;
const { PGlite } = require(dist ? path.join(dist,'index.cjs') : '@electric-sql/pglite');
const { pgcrypto } = require(dist ? path.join(dist,'contrib/pgcrypto.cjs') : '@electric-sql/pglite/contrib/pgcrypto');
const root = path.resolve(__dirname,'../..');
const ids = Array.from({length:9}, (_,i) => `00000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`);
const [student,other,owner,second,admin,listing,alternate,booking,pending] = ids;
async function run(mode) {
  const upgrade=mode==='upgrade';
  const db = new PGlite({extensions:{pgcrypto}});
  const sql = s => db.exec(s);
  const rows = async s => (await db.query(s)).rows;
  const actor = async (id,role='authenticated') => {
    await sql('RESET ROLE');
    await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[id || '']);
    await sql('SET ROLE '+role);
  };
  try {
    await sql(`CREATE ROLE anon; CREATE ROLE authenticated;
      CREATE SCHEMA auth; CREATE SCHEMA storage;
      CREATE TABLE auth.users(id uuid primary key, phone text, phone_confirmed_at timestamptz,email text,email_confirmed_at timestamptz);
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      CREATE TABLE storage.buckets(id text primary key,name text,public boolean);
      CREATE TABLE storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,metadata jsonb);
      ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
      CREATE FUNCTION storage.foldername(text) RETURNS text[] LANGUAGE sql AS $$SELECT (string_to_array($1,'/'))[1:array_length(string_to_array($1,'/'),1)-1]$$;
      GRANT USAGE ON SCHEMA auth,storage TO anon,authenticated;
      GRANT SELECT,INSERT,UPDATE,DELETE ON storage.objects TO anon,authenticated;`);
    const dir=path.join(root,'supabase/migrations');
    if (mode.startsWith('colleges-')) {
      await require('./college-preservation.cjs')(db, dir, mode);
      return;
    }
    for (const file of fs.readdirSync(dir).filter(x=>x.endsWith('.sql')).sort()) {
      let source=fs.readFileSync(path.join(dir,file),'utf8');
      if(upgrade && Number(file.slice(0,3))<=11) {
        source=execFileSync('git',['show','737a409:supabase/migrations/'+file],{cwd:root,encoding:'utf8'});
        // The committed 006 never compiled. Model a previously applied 006
        // with precisely the four unsupported policy clauses normalized.
        if(file.startsWith('006')) source=source.replaceAll('CREATE POLICY IF NOT EXISTS','CREATE POLICY');
      }
      await sql(source);
      if(mode==='empty' && file.startsWith('002')) await sql(source);
      if(mode!=='empty' && file.startsWith('009')) {
        for(const id of ids.slice(0,5)) await db.query('INSERT INTO auth.users(id,email,email_confirmed_at) VALUES ($1,$2,now())',[id,id+'@example.test']);
        await sql(`UPDATE public.profiles SET role='owner' WHERE id IN ('${owner}','${second}'); UPDATE public.profiles SET role='admin' WHERE id='${admin}'`);
        if(!upgrade) await sql(`INSERT INTO properties(id,owner_id,type,title,rent) VALUES ('${listing}','${owner}','room','Before 011',1000)`);
      }
      if(mode!=='empty' && file.startsWith('012')) {
        await db.query("UPDATE properties SET listing_status='published' WHERE id=$1",[listing]);
      }
      if(upgrade && file.startsWith('011')) await sql(`INSERT INTO properties(id,owner_id,type,title,rent,available_for) VALUES ('${listing}','${owner}','room','Legacy row',1000,'family')`);
    }
    assert.equal((await rows("SELECT to_regprocedure('public.promote_to_admin(text)') IS NULL AND to_regprocedure('public.promote_to_owner()') IS NULL AS closed"))[0].closed,true);
    if(mode==='empty') {
      assert.equal((await rows('SELECT count(*)::int AS n FROM profiles'))[0].n,0);
      assert.equal((await rows("SELECT public FROM storage.buckets WHERE id='property-media'"))[0].public,false);
      console.log('PASS full migration chain on an empty database');
      return;
    }
    assert.equal((await rows(`SELECT available_for FROM properties WHERE id='${listing}'`))[0].available_for,upgrade?'family':'anyone');
    // Platform-specific fixtures run after all migrations and before exercising the policies.
    await require('./owner-authorization.cjs')({sql,rows,actor,ids,db});
    await sql(`RESET ROLE; UPDATE properties SET listing_status='published' WHERE id='${listing}';
      INSERT INTO properties(id,owner_id,type,title,rent,listing_status) VALUES ('${alternate}','${second}','flat','Alternate',2000,'published'),('${pending}','${owner}','pg','Pending',2000,'pending');`);
    await actor(student);
    assert.equal((await rows('SELECT id FROM profiles')).length,1);
    const deny = s=>assert.rejects(sql(s),e=>e.code==='42501');
    await deny("UPDATE profiles SET role='admin'");
    const inquiry=(p,o,u)=>`INSERT INTO inquiries(property_id,owner_id,student_id,message) VALUES ('${p}','${o}','${u}','Fixture message')`;
    await sql(inquiry(listing,owner,student));
    await deny(inquiry(listing,second,student)); await deny(inquiry(listing,owner,other)); await deny(inquiry(pending,owner,student));
    const request=(p,o,u)=>`INSERT INTO bookings(property_id,owner_id,student_id,amount) VALUES ('${p}','${o}','${u}',0)`;
    await deny(request(listing,second,student)); await deny(request(listing,owner,other)); await deny(request(pending,owner,student)); await sql(request(listing,owner,student));
    const createdBooking=(await rows('SELECT id FROM bookings'))[0].id;
    const review=(p,u)=>`INSERT INTO reviews(booking_id,property_id,student_id,rating) VALUES ('${createdBooking}','${p}','${u}',5)`;
    await deny(review(listing,student));
    await sql("RESET ROLE; UPDATE bookings SET booking_status='confirmed'");
    await actor(student); await deny(review(alternate,student)); await deny(review(listing,other)); await sql(review(listing,student));
    await assert.rejects(sql(review(listing,student)),e=>e.code==='23505');
    await sql('RESET ROLE');
    const legacy=(await db.query("INSERT INTO bookings(student_id,property_id,owner_id,amount,booking_status) VALUES($1,$2,$3,0,'confirmed') RETURNING id",[student,listing,second])).rows[0].id;
    await actor(student);
    await assert.rejects(db.query('INSERT INTO reviews(student_id,property_id,booking_id,rating) VALUES($1,$2,$3,4)',[student,listing,legacy]),e=>e.code==='42501');
    const report=(await db.query("INSERT INTO reports(reporter_id,reason) VALUES($1,'Review this fixture') RETURNING id",[student])).rows[0].id;
    const moderateReport=()=>db.query("SELECT moderate_record('report',$1,'resolved','Investigated',(SELECT updated_at FROM reports WHERE id=$1))",[report]);
    await assert.rejects(moderateReport(),e=>e.code==='42501');
    await actor(admin);await moderateReport();
    assert.equal((await db.query("SELECT count(*)::int AS count FROM platform_audit WHERE action='report' AND subject_id=$1",[report])).rows[0].count,1);
    await actor(second); assert.equal((await rows('SELECT * FROM inquiries')).length,0);
    await actor(owner); assert.equal((await rows('SELECT * FROM inquiries')).length,1);
    await sql("UPDATE inquiries SET status='contacted'");
    for(const col of ['student_id','property_id','owner_id','message','created_at','id']) await deny('UPDATE inquiries SET '+col+'='+col);
    await actor(admin); await sql("UPDATE inquiries SET status='closed'");
    assert.equal((await rows('SELECT status FROM inquiries'))[0].status,'closed');
    await actor(null,'anon');
    await deny('SELECT student_id,booking_id FROM reviews');
    assert.equal((await rows('SELECT rating FROM reviews'))[0].rating,5);
    await actor(student); await sql(`INSERT INTO favorites(student_id,property_id) VALUES ('${student}','${listing}')`);
    await actor(other); assert.equal((await rows('SELECT * FROM favorites')).length,0);
    await deny('SELECT viewer_id FROM property_views');
    await actor(admin); await deny("UPDATE profiles SET role='admin'");
    await sql('RESET ROLE');
    assert.deepEqual(await rows("SELECT relname FROM pg_class WHERE relkind='r' AND relnamespace='public'::regnamespace AND NOT relrowsecurity"),[]);
    await sql(`UPDATE profiles SET role='admin' WHERE id='${other}'`);
    assert.equal((await rows(`SELECT count(*)::int AS n FROM platform_audit WHERE action='role' AND subject_id='${other}' AND new_value='admin'`))[0].n,1);
    await sql(`UPDATE profiles SET role='student' WHERE id='${other}'`);
    await sql(`UPDATE profiles SET phone='+919999990001',phone_verified=false WHERE id='${other}';
      UPDATE auth.users SET phone='+919999990001',phone_confirmed_at=now() WHERE id='${student}'`);
    assert.equal((await rows(`SELECT phone_verified FROM profiles WHERE id='${student}'`))[0].phone_verified,true);
    await require('./draft-submission.cjs')({db,ids,actor,rows,sql});
    console.log('PASS '+(upgrade?'upgrade from representative historical 001–011':'fresh chain with data before 011')+' — role surface, defaults, visibility, inquiry, booking and review authorization');
  } finally {await db.close();}
}
(async()=>{
  await run('colleges-clean');
  await run('colleges-populated');
  await run('colleges-applied');
  if (process.argv.includes('--college-preservation')) return;
  await run('empty'); await run('populated'); await run('upgrade');
})().catch(e=>{console.error(e.message,e.code);process.exitCode=1;});
