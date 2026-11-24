// Runs the shipped browser application with a real Supabase SDK. Every HTTP request is intercepted.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const {execFileSync} = require('node:child_process');
const {chromium} = require(process.env.PLAYWRIGHT_CORE || 'playwright-core');
const root = path.resolve(__dirname,'../..');
const sdk = process.env.SUPABASE_BROWSER_SDK;
assert.ok(sdk && fs.existsSync(sdk),'Set SUPABASE_BROWSER_SDK to the local Supabase UMD file');
const project = 'https://auth-fixture.supabase.co';
const key = 'sb_publishable_synthetic_for_offline_use';
const product = fs.mkdtempSync(path.join(os.tmpdir(),'campusstay-pages-'));
const built = path.join(product,'dist');
const build = (destination,publicKey) => execFileSync(process.execPath,[path.join(root,'scripts/prepare-pages.cjs'),destination],{
  env:{...process.env,CAMPUSSTAY_SUPABASE_URL:project,CAMPUSSTAY_SUPABASE_PUBLISHABLE_KEY:publicKey},stdio:'pipe'});
const uid = '00000000-0000-4000-8000-000000000001';
const now = Math.floor(Date.now()/1000);
const token = [{alg:'HS256',typ:'JWT'},{sub:uid,role:'authenticated',aud:'authenticated',iat:now,exp:now+3600}].map(x=>Buffer.from(JSON.stringify(x)).toString('base64url')).join('.')+'.c3ludGhldGlj';
async function exercise(browser,base,site,mode,role='student',status=null) {
  const context = await browser.newContext({serviceWorkers:'block'});
  try {
    let authorization;
    const origin = new URL(base).origin;
    await context.route('**/*',async route=>{
      const url=new URL(route.request().url());
      if(url.hostname==='cdn.jsdelivr.net' && url.pathname.includes('/supabase-js@')) return mode==='no-sdk' ? route.abort() : route.fulfill({path:sdk,contentType:'text/javascript',headers:{'access-control-allow-origin':'*'}});
      if(url.origin===project){
        if(url.pathname==='/auth/v1/authorize'){
          authorization={provider:url.searchParams.get('provider'),redirect:url.searchParams.get('redirect_to')};
          return route.fulfill({contentType:'text/html',body:'<p>Isolated provider boundary</p>'});
        }
        if(url.pathname==='/auth/v1/user') return route.fulfill({json:{id:uid,aud:'authenticated',role:'authenticated',email:'user@example.test',user_metadata:{}}});
        if(url.pathname==='/rest/v1/profiles') return route.fulfill({json:{id:uid,full_name:'Test User',role,owner_applications:status?{status}:null,preferences:{onboarding:{role_selected:true,student_complete:true}}}});
        if(url.pathname.startsWith('/rest/v1/')) return route.fulfill({json:[]});
        return route.abort();
      }
      if(url.origin!==origin || !url.href.startsWith(base)) return route.abort();
      const relative=url.pathname.slice(new URL(base).pathname.length);
      if(relative==='js/runtime-config.js'){
        if(mode==='missing') return route.fulfill({status:404,body:''});
        if(mode==='invalid') return route.fulfill({contentType:'text/javascript',body:"window.CAMPUSSTAY_RUNTIME_CONFIG={supabaseUrl:'https://auth-fixture.supabase.co',supabaseAnonKey:'disallowed-test-key'}"});
        if(mode==='source' || site===built) return route.fulfill({path:path.join(site,relative)});
        return route.fulfill({contentType:'text/javascript',body:'window.CAMPUSSTAY_RUNTIME_CONFIG='+JSON.stringify({supabaseUrl:project,supabaseAnonKey:key})});
      }
      const file=path.resolve(site,relative);
      if(!file.startsWith(site+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()) return route.fulfill({status:404,body:''});
      return route.fulfill({path:file});
    });
    const page=await context.newPage();
    const messages=[]; page.on('pageerror',err=>messages.push(err.name));
    await page.goto(base+'auth.html');
    if(['missing','invalid','no-sdk'].includes(mode)) {
      assert.ok(await page.locator('#btn-google-login').isDisabled());
      assert.match(await page.locator('#auth-config-notice').innerText(),mode==='no-sdk'?/could not load/:mode==='missing'?/missing/:/valid public/);
    } else {
      assert.ok(await page.evaluate(()=>Boolean(getSupabase()?.auth)));
      assert.ok(await page.locator('#auth-config-notice').isHidden());
      if(mode==='oauth'){
        await page.locator('#btn-google-login').click();
        await page.waitForURL(project+'/auth/v1/authorize**');
        assert.deepEqual(authorization,{provider:'google',redirect:base+'auth.html?google_callback=1'});
        const fragment=new URLSearchParams({access_token:token,refresh_token:'fixture',token_type:'bearer',expires_in:'3600',expires_at:String(now+3600)});
        await page.goto(base+'auth.html?google_callback=1#'+fragment);
        const home=role==='admin'?'admin-dashboard.html':role==='owner'&&status==='approved'?'owner-dashboard.html':status?'owner-application.html':'index.html';
        await page.waitForURL(base+home);
        await page.reload();
        assert.ok(await page.evaluate(async()=>Boolean((await getSession())?.user?.id)));
      }
      if(mode==='errors'){
        await page.goto(base+'auth.html?google_callback=1#error=access_denied');
        await page.getByText(/Google sign-in was canceled/).waitFor();
        await page.goto(base+'auth.html?google_callback=1');await page.getByText(/session is missing or expired/).waitFor();
      }
    }
    assert.deepEqual(messages,[]);
  } finally { await context.close(); }
}
(async()=>{
  build(built,key);
  assert.throws(()=>build(path.join(product,'invalid'),'unsupported-test-key'));
  assert.ok(!fs.existsSync(path.join(built,'supabase'))&&!fs.existsSync(path.join(built,'backend')));
  const browser=await chromium.launch({executablePath:process.env.CHROME_BINARY,headless:true,args:['--disable-background-networking']});
  try {
    const local='http://localhost:8117/', pages='https://pages-fixture.invalid/Campus-Stay/';
    for(const mode of ['missing','invalid','no-sdk','errors']) await exercise(browser,local,root,mode);
    if(fs.existsSync(path.join(root,'js/runtime-config.js'))) await exercise(browser,local,root,'source');
    await exercise(browser,local,root,'oauth');
    for(const [role,status] of [['student',null],['student','pending'],['owner','approved'],['admin',null]])
      await exercise(browser,pages,built,'oauth',role,status);
    console.log('PASS real SDK initialization, invalid/missing config and library failure, cancellation and expired return, OAuth authorization URL, intercepted callback, restored session, four role destinations and Pages subdirectory packaging');
  } finally { await browser.close(); }
})().catch(e=>{console.error(e.message.replace(/(access_token|refresh_token)=[^&\s]+/g,'$1=[redacted]'));process.exitCode=1;});
