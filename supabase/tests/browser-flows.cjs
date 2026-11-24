// Browser smoke tests use synthetic sessions. All browser requests are intercepted.
const {chromium}=require(process.env.PLAYWRIGHT_CORE || 'playwright-core');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const fixture=`window.supabase={createClient:()=>{
const state=()=>JSON.parse(localStorage.getItem('fixture')||'null');
const session=()=>state()?{user:{id:'test-user',user_metadata:{}}}:null;
return {auth:{signUp:async()=>({data:{user:{id:'test-user',identities:[{}]},session:null},error:null}),
signInWithPassword:async()=>{localStorage.setItem('fixture',JSON.stringify({role:'student',selected:true}));return {data:{session:session(),user:session().user},error:null};},
getSession:async()=>({data:{session:session()}}),onAuthStateChange:()=>({data:{subscription:{}}}),signOut:async()=>{localStorage.removeItem('fixture');return {error:null};}},
storage:{from:()=>({upload:async()=>{if(sessionStorage.getItem('failUpload')){sessionStorage.removeItem('failUpload');return {error:{code:'network'}};}return {error:null};},createSignedUrl:async()=>({data:{signedUrl:'http://localhost:8117/fixture-photo.png'}})})},
from(table){let single=false,count=false,operation='read',input;const filters=[];
const accommodation={id:'near-kit',title:'Near KIT fixture',area:'KIT area',owner_id:'fixture-owner',type:'room',rent:5000,rent_period:'month',deposit:1000,distance_km:1.1,available:true,college_id:'kit',verification_status:'verified',listing_status:'published',gender:'any',property_media:[],property_facilities:[{facility_id:'wifi',facilities:{label:'Wi-Fi',icon:''}}],property_rules:[{rule_text:'Fixture quiet hours',display_order:0}],reviews:[{rating:4,review_text:'A fixture review'}]};
const q=new Proxy({}, {get:(obj,key)=>{
if(key==='then')return (resolve)=>{const st=state()||{};let data=table==='profiles' && single ? {id:'test-user',full_name:'Test User',preferences:{onboarding:{role_selected:st.selected,student_complete:true}},role:st.role,owner_applications:st.status?{status:st.status}:null}:table==='owner_applications' && single && st.status ? {status:st.status,relationship:'owner',full_name:'Test User'}:single?null:[];
if(st.inventory && table==='properties'){
  const all=[accommodation,{...accommodation,id:'far-kit',title:'Far fixture',distance_km:5.2},{...accommodation,id:'pending-kit',title:'Under review fixture',listing_status:'pending'}];
  const matches=all.filter(row=>filters.every(([field,value])=>row[field]===value));data=single?matches[0]:matches;
}
if(table==='favorites' && !count){
 const saved=JSON.parse(sessionStorage.getItem('fixture-favorites')||'[]');
 if(operation==='insert')saved.push(input.property_id);
 if(operation==='delete')saved.splice(saved.indexOf(filters.find(f=>f[0]==='property_id')[1]),1);
 sessionStorage.setItem('fixture-favorites',JSON.stringify(saved));data=saved.map(property_id=>({property_id}));
}
if(table==='inquiries' && operation==='insert')sessionStorage.setItem('fixture-enquiry',JSON.stringify(input));
if(st.queue && table==='properties' && !single && !count) data=[{...accommodation,listing_status:'pending',updated_at:'2026-01-01T00:00:00Z'}];
if(st.queue && table==='reports' && !single && !count)data=[{id:'fixture-report',reason:'Fixture support request',status:'new',updated_at:'2026-01-01T00:00:00Z'}];
if(st.ownEnquiry && table==='inquiries'){
 if(operation==='update'){sessionStorage.setItem('fixture-enquiry-status',input.status);data={id:'fixture-enquiry'};}
 else data=[{id:'fixture-enquiry',properties:{title:'Owner fixture'},message:'A private student question',created_at:'2026-01-01',status:'new'}];
}
if(st.queue && table==='owner_applications' && !single && !count)data=[{applicant_id:'fixture-applicant',full_name:'Fixture Applicant',status:'pending',revision:3}];
if(table==='listing_drafts' && single) data=JSON.parse(sessionStorage.getItem('fixture-draft')||'null');
if(table==='facilities' && !single)data=[{id:'wifi',label:'Wi-Fi',icon:''}];
return resolve({data,error:null,count:count?0:null});};
return (...args)=>{if(key==='eq')filters.push(args);if(['delete','insert','update'].includes(key)){operation=key;input=args[0];}if(['maybeSingle','single'].includes(key))single=true;if(key==='select'&&args[1]?.head)count=true;return q;};}});return q;},
rpc:async(name,args)=>{
if(name==='moderate_record')sessionStorage.setItem('fixture-moderation',JSON.stringify(args));
if(name==='review_owner_application')sessionStorage.setItem('fixture-decision',JSON.stringify(args));
if(name==='save_listing_draft'){
  const revision=args.p_revision+1;
  sessionStorage.setItem('fixture-draft',JSON.stringify({payload:args.p_payload,revision,submitted_at:null}));
  return {data:revision,error:null};
}
if(name==='submit_listing_draft'){sessionStorage.setItem('fixture-submission',args.p_id);return {data:args.p_id,error:null};}
if(name==='save_owner_application'){const st=state();st.status=args.p_submit?'pending':'draft';localStorage.setItem('fixture',JSON.stringify(st));}return {data:null,error:null};}
};}};`;
(async()=>{
  const browser=await chromium.launch({executablePath:process.env.CHROME_BINARY,headless:true,args:['--disable-background-networking']});
  try{
    const context=await browser.newContext({serviceWorkers:'block'});
    await context.route('**/*',async route=>{
      const url=new URL(route.request().url());
      if(url.hostname==='cdn.jsdelivr.net' && url.pathname.includes('supabase-js'))return route.fulfill({contentType:'text/javascript',body:fixture,headers:{'access-control-allow-origin':'*'}});
      if(url.origin!=='http://localhost:8117')return route.abort();
      if(url.pathname==='/js/runtime-config.js')return route.fulfill({contentType:'text/javascript',body:"window.CAMPUSSTAY_RUNTIME_CONFIG={supabaseUrl:'https://fixture.supabase.co',supabaseAnonKey:'sb_publishable_synthetic_browser_fixture'}"});
      const file=path.resolve(root,'.'+decodeURIComponent(url.pathname));
      if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile())return route.fulfill({status:404,body:''});
      if (file.endsWith('.html')) {
        // Intercepted pages use the mock SDK. The real-SDK suite checks the shipped integrity hash.
        const fixtureHash = require('node:crypto').createHash('sha384').update(fixture).digest('base64');
        const html = fs.readFileSync(file, 'utf8').replace(/(supabase-js@[^"]+" integrity=")sha384-[^"]+/, '$1sha384-'+fixtureHash);
        return route.fulfill({contentType:'text/html',body:html});
      }
      return route.fulfill({path:file});
    });
    const p=await context.newPage(); const errors=[]; p.on('pageerror',e=>errors.push(e.message));
    await p.goto('http://localhost:8117/owner-landing.html');
    await p.getByRole('button',{name:'Reject non-essential'}).click();
    const nav=async(page,state)=>{await p.evaluate(s=>localStorage.setItem('fixture',JSON.stringify(s)),state);await p.goto('http://localhost:8117/'+page);};
    await nav('owner-application.html',null);await p.waitForURL('**/auth.html?next=*');
    await nav('role-onboarding.html',{role:'student',selected:false});
    await p.getByRole('button',{name:/Property Owner/}).click();await p.waitForURL('**/owner-application.html');
    await p.locator('[name=property_address]').fill('Fixture address near KIT');await p.locator('[name=authority_evidence]').fill('Independently checkable test reference');
    await p.getByRole('button',{name:'Submit for review'}).click();await p.getByText('Your owner application is under review.').waitFor();
    await nav('owner-dashboard.html',{role:'student',status:'pending',selected:true});await p.waitForURL('**/owner-application.html');
    await nav('owner-application.html',{role:'owner',status:'approved',selected:true});await p.waitForURL('**/owner-dashboard.html');
    await nav('owner-onboarding.html?new=1',{role:'owner',status:'approved',selected:true});await p.getByRole('button',{name:'Save draft'}).waitFor();
    await p.locator('#wizard-next').click();await p.getByText('Add your occupation or property role.').waitFor();
    await p.locator('#owner-occupation').fill('Property manager');
    await p.locator('#wizard-next').click();
    const png=await p.evaluate(()=>{const canvas=document.createElement('canvas');canvas.width=750;canvas.height=500;return canvas.toDataURL('image/png').split(',')[1];});
    await p.locator('#owner-photo-input').setInputFiles({name:'test.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});
    await p.getByText('Primary image',{exact:true}).waitFor();await p.locator('#wizard-next').click();
    await p.locator('#property-type').selectOption('room');await p.locator('#property-title').fill('Fixture student room');
    await p.locator('#property-description').fill('A private room for testing the complete submission process.');
    await p.locator('#property-rent').fill('5000');await p.locator('#property-distance').fill('1.0');await p.locator('#wizard-next').click();
    await p.locator('#property-area').fill('KIT area');await p.locator('#wizard-next').click();await p.locator('#property-rules').fill('Quiet hours after 10 pm');
    await p.evaluate(()=>sessionStorage.setItem('failUpload','1'));
    await p.locator('#wizard-save').click();await p.getByText(/Save could not be confirmed/).waitFor();
    assert.equal(await p.locator('#property-rules').inputValue(),'Quiet hours after 10 pm');
    await p.locator('#wizard-save').click();await p.getByText('Draft saved. Resume from your dashboard.').waitFor();
    await p.reload();await p.locator('#property-rules').waitFor();assert.equal(await p.locator('#property-rules').inputValue(),'Quiet hours after 10 pm');
    await p.locator('#wizard-next').click();await p.getByText('Fixture student room',{exact:true}).waitFor();
    await p.locator('#wizard-next').click();await p.locator('#wizard-next').click();await p.waitForURL('**/owner-dashboard.html');
    assert.ok(await p.evaluate(()=>sessionStorage.getItem('fixture-submission')));
    await nav('owner-application.html',{role:'admin',selected:true});await p.waitForURL('**/admin-dashboard.html');await p.getByText('No records in this queue.').waitFor();
    await nav('admin-dashboard.html',{role:'admin',selected:true,queue:true});
    const handleDialog=dialog=>dialog.accept(dialog.type()==='prompt'?'Fixture authority checked':undefined);
    p.on('dialog',handleDialog);
    await p.getByRole('button',{name:'approved',exact:true}).click();
    await p.waitForFunction(()=>sessionStorage.getItem('fixture-decision'));
    assert.equal(await p.evaluate(()=>JSON.parse(sessionStorage.getItem('fixture-decision')).p_revision),3);
    await p.locator('#queue').selectOption('properties');
    await p.getByRole('button',{name:'Return for corrections'}).click();
    await p.waitForFunction(()=>JSON.parse(sessionStorage.getItem('fixture-moderation'))?.p_state==='rejected');
    await p.locator('#queue').selectOption('reports');await p.getByRole('button',{name:'resolved'}).click();
    await p.waitForFunction(()=>JSON.parse(sessionStorage.getItem('fixture-moderation'))?.p_state==='resolved');
    p.off('dialog',handleDialog);
    await nav('inquiries.html',{role:'owner',status:'approved',selected:true,ownEnquiry:true});
    await p.getByText('A private student question',{exact:true}).click();await p.locator('#modal-status-select').selectOption('contacted');
    await p.locator('#modal-update-status').click();
    await p.waitForFunction(()=>sessionStorage.getItem('fixture-enquiry-status')==='contacted');
    await nav('admin-dashboard.html',{role:'student',selected:true});await p.waitForURL('**/index.html');
    await nav('role-onboarding.html',{role:'student',selected:false});
    for(const width of [390,768,1280]){
      await p.setViewportSize({width,height:860});
      for(const theme of ['dark','light']){
        await p.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
        const ok=await p.evaluate(()=>{const panel=document.querySelector('.role-onboarding');return document.documentElement.scrollWidth<=innerWidth+1 && Number(getComputedStyle(panel).opacity)===1;});
        assert.ok(ok,'Layout '+width+' '+theme);
      }
    }
    await p.getByRole('button',{name:/Student/}).click();await p.waitForURL('**/student-onboarding.html');
    await p.locator('[data-preference]').first().click();await p.locator('#save-preferences').click();await p.waitForURL('**/index.html');
    const searching={role:'student',selected:true,inventory:true};
    await nav('index.html',searching);await p.locator('#featured-grid').getByText('Near KIT fixture').waitFor();
    await nav('listings.html?college=kit',searching);await p.locator('#results-grid').getByText('Near KIT fixture').waitFor();
    assert.equal(await p.locator('#results-grid .listing-card').count(),1);
    await p.locator('[name=type][value=flat]').check();await p.getByText('Nothing matches those filters').waitFor();
    await p.locator('[name=type][value=flat]').uncheck();
    await p.locator('[data-wish]').click();await p.locator('.heart-btn.active').waitFor();
    await nav('saved.html',searching);await p.locator('#saved-root').getByText('Near KIT fixture').waitFor();
    await nav('property.html?id=near-kit',searching);await p.getByText('Fixture quiet hours',{exact:false}).waitFor();
    await p.getByText('4/5 A fixture review').waitFor();
    await p.getByLabel('Message the property owner').fill('Student enquiry fixture');
    await p.getByRole('button',{name:'Send enquiry'}).click();await p.getByText('Enquiry sent to the listing owner.').waitFor();
    assert.equal(await p.evaluate(()=>JSON.parse(sessionStorage.getItem('fixture-enquiry')).owner_id),'fixture-owner');
    await nav('listings.html',searching);await p.setViewportSize({width:390,height:844});
    await p.locator('.hamburger').click();assert.ok(await p.locator('.mobile-menu').isVisible());
    await p.locator('.hamburger').click();const theme=await p.evaluate(()=>document.documentElement.dataset.theme);
    await p.locator('[data-theme-toggle]').first().click();assert.notEqual(await p.evaluate(()=>document.documentElement.dataset.theme),theme);
    await nav('profile.html',searching);await p.locator('body.auth-ready').waitFor();
    await nav('auth.html',null);await p.locator('[data-mode=signup]').click();
    await p.locator('#signup-name').fill('Fixture User');await p.locator('#signup-email').fill('fixture@example.test');
    await p.locator('#signup-phone').fill('9999999999');await p.locator('#signup-password').fill('ExampleTest99!');
    await p.locator('#btn-signup').click();
    assert.equal(await p.locator('#auth-message').textContent(),'Check your email for the confirmation link, then sign in.',JSON.stringify({errors,fields:await p.locator('.auth-field-error:not([hidden])').allTextContents()}));
    await p.locator('[data-mode=signin]').click();await p.locator('#signin-email').fill('fixture@example.test');await p.locator('#signin-password').fill('ExampleTest99!');
    await p.locator('#btn-signin').click();await p.waitForURL('**/index.html');
    await nav('settings.html',{role:'student',selected:true});await p.locator('#btn-signout').evaluate(button=>button.click());await p.waitForURL('**/index.html');
    await p.goto('http://localhost:8117/privacy.html');await p.getByRole('heading',{name:'Privacy Policy',exact:true}).waitFor();
    await p.goto('http://localhost:8117/terms.html');await p.getByRole('heading',{name:'Terms of Service',exact:true}).waitFor();
    assert.deepEqual(errors,[]);
    console.log('PASS recoverable upload failure, administrative decision binding, KIT radius, type filter, property details, ratings, private enquiry, saved stays, student preferences, mobile navigation and theme control');
    console.log('PASS Chrome routing for guest/student/applicant/verified owner/admin, application submission UI, student selection, draft save/resume/photo/submission, signup confirmation, login, logout, public legal pages, and role panel at three widths in two themes (synthetic services)');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
