const {chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 const p=await browser.newPage(),errors=[],requests=[];
 p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>{if(/release\.json|\.apk(?:\?|$)/.test(r.url()))requests.push(r.url());});
 await p.clock.install();
 await p.addInitScript(()=>{
  window.nativeCalls={store:0,check:0,download:0,install:0};
  window.AndroidZaman={distributionChannel:()=> 'bazaar',openStore(){nativeCalls.store++;return JSON.stringify({ok:true});},checkForUpdate(){nativeCalls.check++;},downloadUpdate(){nativeCalls.download++;throw Error('Direct download forbidden');},installDownloadedUpdate(){nativeCalls.install++;throw Error('Direct install forbidden');},fireDue(){}};
  localStorage.setItem('ali-mirza-update-v1',JSON.stringify({ok:true,versionCode:999,versionName:'9.0.0',apkUrl:'https://raw.githubusercontent.com/thumper9480-droid/racking/gh-pages/downloads/zaman-android-9.0.0.apk',sha256:'a'.repeat(64)}));
 });
 await p.goto('http://127.0.0.1:4173/zaman/');
 assert(await p.locator('#update-banner').isHidden());assert.equal(await p.evaluate(()=>localStorage.getItem(UPDATE_CACHE_KEY)),null);
 await p.clock.fastForward(601000);await p.evaluate(()=>{window.dispatchEvent(new Event('focus'));window.dispatchEvent(new Event('online'));});
 assert.deepEqual(await p.evaluate(()=>nativeCalls),{store:0,check:0,download:0,install:0},'no store launch or external updater on startup/timers/resume');
 await p.locator('[data-tab=projects]').click();await p.locator('[data-action=project]').click();await p.locator('[name=name]').fill('پروژه محفوظ');await p.locator('#form button[type=submit]').click();
 await p.locator('#settings').click();await p.locator('[data-check-update]').click();assert.equal(await p.evaluate(()=>nativeCalls.store),1);assert.match(await p.locator('#update-status').innerText(),/بازار/);
 await p.evaluate(()=>onNativeUpdate({ok:true,versionCode:999,versionName:'9.0.0',apkUrl:'https://raw.githubusercontent.com/thumper9480-droid/racking/gh-pages/downloads/zaman-android-9.0.0.apk',sha256:'a'.repeat(64)}));
 await p.locator('#settings-close').click();await p.locator('[data-tab=today]').click();assert(await p.locator('#update-banner').isHidden(),'stale direct callbacks cannot create an APK banner');
 await p.evaluate(()=>{downloadUpdate();installUpdate();});assert.equal(await p.evaluate(()=>nativeCalls.store),3);
 assert.equal(await p.evaluate(()=>state.projects[0].name),'پروژه محفوظ');assert.equal(await p.evaluate(()=>nativeCalls.download+nativeCalls.install+nativeCalls.check),0);
 assert.deepEqual(requests,[],'Bazaar never fetches the direct APK or release manifest');assert.deepEqual(errors,[]);
 await browser.close();console.log('PASS Bazaar: user-only store link, no APK download/install/manifest, stale cache/callback isolation and preserved project data');
})().catch(e=>{console.error(e);process.exit(1)});
