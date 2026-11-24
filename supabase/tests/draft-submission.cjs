const assert=require('node:assert/strict');
module.exports=async({db,ids,actor,rows,sql})=>{
  const [student,,owner,second,admin]=ids;
  const id='00000000-0000-4000-9000-000000000001';
  const file=owner+'/'+id+'/photo.webp';
  const payload={fields:{'property-title':'Fixture accommodation','property-type':'room','property-college':'kit','property-area':'KIT campus',
    'property-description':'A test listing for checking draft submission.','property-rent':'5000','owner-phone':'9999999999',
    'property-lat':'16.69455','property-lng':'74.23455','property-address':'Private fixture address','property-rules':'No smoking'},
    privacy:'area_only',amenities:['wifi'],photos:[{path:file}]};
  const save=rev=>db.query('SELECT save_listing_draft($1,$2,$3::jsonb) AS revision',[id,rev,JSON.stringify(payload)]);
  const submit=()=>db.query('SELECT submit_listing_draft($1,1)',[id]);
  await actor(student);await assert.rejects(save(0),e=>e.code==='42501');
  await actor(owner);assert.equal((await save(0)).rows[0].revision,1);
  assert.equal((await save(0)).rows[0].revision,1);
  await assert.rejects(db.query('SELECT save_listing_draft($1,0,$2::jsonb)',[id,JSON.stringify({fields:{}})]),e=>e.code==='23505');
  await assert.rejects(submit(),e=>e.message.includes('photo'));
  assert.equal((await rows(`SELECT id FROM properties WHERE id='${id}'`)).length,0);
  await actor(second);assert.equal((await rows('SELECT * FROM listing_drafts')).length,0);
  await assert.rejects(db.query("INSERT INTO storage.objects(bucket_id,name) VALUES ('property-media',$1)",[file]),e=>e.code==='42501');
  await actor(owner);await db.query("INSERT INTO storage.objects(bucket_id,name,metadata) VALUES ('property-media',$1,$2)",[file,{mimetype:'image/webp',size:600}]);
  await submit();await submit();
  await assert.rejects(db.query("INSERT INTO storage.objects(bucket_id,name) VALUES ('property-media',$1)",[file+'.new']),e=>e.code==='42501');
  assert.equal((await db.query("DELETE FROM storage.objects WHERE name=$1 RETURNING name",[file])).rows.length,0);
  const [saved]=await rows(`SELECT listing_status,lat,rent_period,owner_phone FROM properties WHERE id='${id}'`);
  assert.deepEqual(saved,{listing_status:'pending',lat:null,rent_period:'month',owner_phone:null});
  assert.equal((await rows(`SELECT * FROM property_locations WHERE property_id='${id}'`))[0].private_address,'Private fixture address');
  await actor(null,'anon');assert.equal((await rows(`SELECT * FROM storage.objects WHERE name='${file}'`)).length,0);
  await actor(admin);
  await assert.rejects(db.query("SELECT moderate_record('listing',$1,'published','Stale review',now()-interval '1 day')",[id]),e=>e.message.includes('changed'));
  await db.query("SELECT moderate_record('listing',$1,'published','Checked test property',(SELECT updated_at FROM properties WHERE id=$1))",[id]);
  await actor(null,'anon');assert.equal((await rows(`SELECT * FROM storage.objects WHERE name='${file}'`)).length,1);
  await actor(owner);await assert.rejects(db.query("INSERT INTO property_rules(property_id,rule_text) VALUES($1,'New rule')",[id]),e=>e.code==='42501');
  await assert.rejects(db.query("SELECT replace_listing_details($1,'rules',ARRAY['New rule'])",[id]),e=>e.code==='42501');
  await actor(admin);await db.query("SELECT moderate_record('listing',$1,'paused','Review requested',(SELECT updated_at FROM properties WHERE id=$1))",[id]);
  await actor(null,'anon');assert.equal((await rows(`SELECT * FROM storage.objects WHERE name='${file}'`)).length,0);
  await actor(owner); await db.query("SELECT replace_listing_details($1,'rules',ARRAY['Updated rule'])",[id]);
  await assert.rejects(db.query("SELECT replace_listing_details($1,'facilities',ARRAY['missing-id'])",[id]),e=>e.code==='23503');
  assert.equal((await db.query('SELECT facility_id FROM property_facilities WHERE property_id=$1',[id])).rows[0].facility_id,'wifi');
  await actor(second);await assert.rejects(db.query("SELECT replace_listing_details($1,'rules',ARRAY['No'])",[id]),e=>e.code==='42501');
  await actor(null,'anon');
  await actor(owner);
  await assert.rejects(db.query("INSERT INTO property_media(property_id,file_url,storage_path) VALUES($1,'',$2)",[id,second+'/'+id+'/some.webp']),e=>e.message.includes('uploaded'));
  await db.query("UPDATE properties SET listing_status='pending' WHERE id=$1",[id]);
  await actor(admin);await db.query("SELECT moderate_record('listing',$1,'rejected','Please update the description',(SELECT updated_at FROM properties WHERE id=$1))",[id]);
  await actor(owner);await db.query("UPDATE properties SET description='Corrected description after feedback',listing_status='pending' WHERE id=$1",[id]);
  await actor(admin);await db.query("SELECT moderate_record('listing',$1,'published','Corrections reviewed',(SELECT updated_at FROM properties WHERE id=$1))",[id]);
  console.log('PASS atomic edit rollback and listing ownership');
  console.log('PASS private draft, upload RLS, atomic rollback, idempotent submission, rent units, private address, material edit guard and publication/withdrawal');
};
