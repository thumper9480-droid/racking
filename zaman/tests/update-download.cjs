const {chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];
 page.on('pageerror',error=>errors.push(error.message));await page.clock.install();
 await page.addInitScript(()=>{
  const release={ok:true,versionCode:18,versionName:'1.13.0',apkUrl:'https://raw.githubusercontent.com/thumper9480-droid/racking/gh-pages/downloads/zaman-android-1.13.0.apk',sha256:'a'.repeat(64)};
  window.AndroidZaman={fireDue(){},checkForUpdate(){setTimeout(()=>onNativeUpdate(release),0);},downloadStatus(){return localStorage.getItem('native-test-download')||JSON.stringify({status:'idle'});},downloadUpdate(){localStorage.setItem('native-test-starts',String(Number(localStorage.getItem('native-test-starts')||0)+1));const result={ok:true,status:'downloading',message:'دریافت فایل نصب شروع شد…',sha256:release.sha256};localStorage.setItem('native-test-download',JSON.stringify(result));return JSON.stringify(result);},installDownloadedUpdate(){localStorage.setItem('native-test-install','yes');return JSON.stringify({ok:true,scheduled:true});}};
 });
 await page.goto('http://127.0.0.1:4173/zaman/');await page.locator('#update-banner [data-download-update]').click();
 assert(await page.locator('#update-banner button').isDisabled(),'prevent duplicate download taps');
 assert.match(await page.locator('#update-banner-status').innerText(),/دریافت/);assert.equal(await page.locator('#settings-dialog').isVisible(),false);
 await page.evaluate(()=>localStorage.setItem('native-test-download',JSON.stringify({status:'downloading',progress:42,sha256:'a'.repeat(64)})));await page.clock.fastForward(1600);
 assert.match(await page.locator('#update-banner-status').innerText(),/۴۲٪/,'progress visible on Today');
 await page.reload();await page.locator('#update-banner').waitFor({state:'visible'});assert.match(await page.locator('#update-banner-status').innerText(),/۴۲٪/,'download tracking resumes after reload');assert(await page.locator('#update-banner button').isDisabled());
 await page.evaluate(()=>localStorage.setItem('native-test-download',JSON.stringify({status:'failed',message:'فضای گوشی کافی نیست.'})));await page.clock.fastForward(1600);
 assert.match(await page.locator('#update-banner-status').innerText(),/فضای/);assert(await page.locator('#update-banner [data-download-update]').isEnabled());
 await page.locator('#update-banner [data-download-update]').click();assert.equal(await page.evaluate(()=>localStorage.getItem('native-test-starts')),'2');
 await page.evaluate(()=>localStorage.setItem('native-test-download',JSON.stringify({status:'verified',sha256:'a'.repeat(64)})));await page.clock.fastForward(1600);
 assert(await page.locator('#update-banner [data-install-update]').isVisible());assert.equal(await page.evaluate(()=>downloadPoll),null,'verified download stops polling');
 await page.locator('#update-banner [data-install-update]').click();assert.equal(await page.evaluate(()=>localStorage.getItem('native-test-install')),'yes');
 await page.reload();await page.locator('#update-banner [data-install-update]').waitFor({state:'visible'});assert.equal(await page.evaluate(()=>downloadPoll),null);
 await page.evaluate(()=>{availableUpdate.sha256='b'.repeat(64);restoreUpdateDownload();});assert.equal(await page.locator('[data-install-update]').count(),0,'old APK is never offered as the new release');assert(await page.locator('#update-banner [data-download-update]').isEnabled());
 for(const width of [320,360,390,768,1280]){await page.setViewportSize({width,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'update status fits '+width);}
 assert.deepEqual(errors,[]);await browser.close();console.log('PASS native download UI: visible progress/error, retry, duplicate-tap guard, reload recovery, verified install and stale-file rejection');
})().catch(error=>{console.error(error);process.exit(1)});
