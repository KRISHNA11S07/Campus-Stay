const assert = require('node:assert/strict');
module.exports = async ({sql,rows,actor,ids,db}) => {
  const [student,other,owner,second,admin,listing] = ids;
  const readLegacy=()=>db.query('SELECT id,owner_id,title,listing_status FROM properties WHERE id=$1',[listing]);
  const [original]=(await readLegacy()).rows;
  assert.equal(original.listing_status,'published');
  await actor(null,'anon');assert.equal((await readLegacy()).rows.length,0);
  await actor(owner);assert.equal((await readLegacy()).rows.length,0);
  await assert.rejects(db.query('SELECT save_listing_draft($1,0,$2::jsonb)',[listing,'{}']),e=>e.code==='42501');
  await actor(admin);
  const holdReason = 'Legacy listing requires independent review';
  await db.query("SELECT moderate_record('listing',$1,'paused',$2,(SELECT updated_at FROM properties WHERE id=$1))", [listing, holdReason]);
  const holdAudit = await db.query(
    "SELECT actor_id, previous_value, new_value, reason FROM platform_audit WHERE action='listing' AND subject_id=$1",
    [listing]
  );
  assert.deepEqual(holdAudit.rows, [{actor_id: admin, previous_value: 'published', new_value: 'paused', reason: holdReason}]);
  await sql('RESET ROLE');
  await sql(`UPDATE auth.users SET email_confirmed_at=NULL WHERE id='${other}'`);
  await actor(other);
  await assert.rejects(sql("SELECT save_owner_application('Test User','manager','Test address','Test authority reference',true)"),e=>e.message.includes('Confirm'));
  await actor(null,'anon');await sql('RESET ROLE');
  for (const id of [owner,second]) {
    await actor(id);
    assert.equal((await rows('SELECT get_my_role() AS role'))[0].role,'student');
    await sql("SELECT save_owner_application('Example Manager','manager','','',false)");
    assert.equal((await rows('SELECT status FROM owner_applications'))[0].status,'draft');
    await sql("SELECT save_owner_application('Example Manager','manager','KIT test address','Management reference held by the reviewer',true)");
    assert.equal((await rows('SELECT status FROM owner_applications'))[0].status,'pending');
    await assert.rejects(sql(`SELECT review_owner_application('${id}','approved','self',(SELECT revision FROM owner_applications WHERE applicant_id='${id}'))`),e=>e.code==='42501');
    await actor(student); assert.equal((await rows('SELECT * FROM owner_applications')).length,0);
    await actor(admin);
    await assert.rejects(db.query("SELECT review_owner_application($1,'approved','Stale evidence',0)",[id]),e=>e.message.includes('changed'));
    if(id===second){
      await db.query("SELECT review_owner_application($1,'rejected','Evidence needs correction',(SELECT revision FROM owner_applications WHERE applicant_id=$1))",[id]);
      await actor(id);
      await sql("SELECT save_owner_application('Example Manager','manager','KIT test address','Corrected management reference for review',true)");
      await actor(admin);
    }
    await db.query("SELECT review_owner_application($1,'approved','Verified independent management authority',(SELECT revision FROM owner_applications WHERE applicant_id=$1))",[id]);
    await actor(id); assert.equal((await rows('SELECT get_my_role() AS role'))[0].role,'owner');
  }
  await actor(null,'anon');await sql('RESET ROLE');
  await actor(null,'anon');assert.equal((await readLegacy()).rows.length,0);
  await actor(owner);
  assert.deepEqual((await readLegacy()).rows,[{...original,listing_status:'paused'}]);
  await db.query("UPDATE properties SET listing_status='pending' WHERE id=$1",[listing]);
  await sql('RESET ROLE');
  console.log('PASS legacy published row hidden before owner approval; audited hold survives approval and preserves its ID, owner and title');
  const photo=owner+'/'+listing+'/seed.webp';
  await db.query("INSERT INTO storage.objects(bucket_id,name,metadata) VALUES ('property-media',$1,$2)",[photo,{mimetype:'image/webp',size:600}]);
  await db.query("INSERT INTO property_media(property_id,file_url,storage_path,file_type) VALUES($1,'',$2,'image')",[listing,photo]);
  await actor(owner); await assert.rejects(sql(`UPDATE properties SET listing_status='published' WHERE id='${listing}'`),e=>e.code==='42501');
  await actor(admin); await sql(`SELECT moderate_record('listing','${listing}','published','Approved fixture',(SELECT updated_at FROM properties WHERE id='${listing}'))`);
  await actor(null,'anon'); assert.equal((await rows('SELECT id FROM properties')).length,1);
  await actor(admin); await sql(`SELECT review_owner_application('${owner}','suspended','Review authority again',(SELECT revision FROM owner_applications WHERE applicant_id='${owner}'))`);
  await actor(null,'anon'); assert.equal((await rows('SELECT id FROM properties')).length,0);
  await actor(owner); assert.equal((await rows('SELECT get_my_role() AS role'))[0].role,'student');
  await actor(admin); await sql(`SELECT review_owner_application('${owner}','clarification','Confirm management authority',(SELECT revision FROM owner_applications WHERE applicant_id='${owner}'))`);
  await actor(owner); await sql("SELECT save_owner_application('Example Manager','manager','KIT test address','Updated independent management reference',true)");
  await actor(admin); await sql(`SELECT review_owner_application('${owner}','approved','Confirmed again',(SELECT revision FROM owner_applications WHERE applicant_id='${owner}'))`);
  assert.ok((await rows('SELECT * FROM platform_audit')).length>=6);
  await actor(other); assert.equal((await rows('SELECT * FROM platform_audit')).length,0);
  await actor(null,'anon'); await sql('RESET ROLE');
  console.log('PASS owner verification, private applications, publication, suspension, re-review and admin audit');
};
