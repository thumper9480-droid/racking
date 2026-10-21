const {chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:390,height:844},timezoneId:'Asia/Tehran'}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 const future={versionCode:13,versionName:'1.11.0',apkUrl:'https://raw.githubusercontent.com/thumper9480-droid/racking/gh-pages/downloads/zaman-android-1.11.0.apk',sha256:'b'.repeat(64)};
 await page.route('**/release.json*',r=>r.fulfill({json:future}));
 await page.goto('http://127.0.0.1:4173/zaman/');
 await page.locator('#analog-clock').waitFor();
 assert.equal(await page.locator('#wall-clock .analog-tick').count(),60);
 assert.match(await page.locator('#wall-clock').getAttribute('aria-label'),/ساعت دستگاه/);
 assert.match(await page.locator('[data-toggle-section="project-tasks"]').innerText(),/لیست کارها \/ پروژه‌ها/);
 await page.locator('#update-banner').waitFor({state:'visible'});
 const banner=await page.locator('#update-banner').boundingBox(),date=await page.locator('#date').boundingBox();assert(banner.y<date.y);
 const red=await page.locator('#update-banner').evaluate(el=>getComputedStyle(el).borderTopColor.match(/\d+/g).map(Number));assert(red[0]>red[1]+30&&red[0]>red[2]+30,'update banner has a visibly red border');
 await page.evaluate(()=>{
  const now=Date.now();state.day={start:now-300000,segment:now-60000,activity:'فعالیت جاری'};
  state.history=[{name:'مطالعه',start:now-300000,end:now-60000}];state.activities=[{id:'a1',name:'مطالعه'}];
  state.projects=[{id:'p1',name:'پروژهٔ نگهداری',tasks:[{id:'t1',title:'کار نگهداری',done:false}],ideas:[]}];
  state.alarms=[{id:'alarm1',title:'هشدار نگهداری',at:now+3600000,repeat:'none',enabled:true}];
  state.countdown={remaining:600000,end:now+600000};save();render();
  localStorage.setItem('unrelated-app-data','keep me');
 });
 await page.locator('[data-tab=alarms]').click();
 const cross=page.locator('[data-delete-alarm="alarm1"]'),crossBox=await cross.boundingBox();assert(crossBox.width>=44&&crossBox.height>=44,'larger reminder delete target');assert(Number(await cross.evaluate(el=>parseFloat(getComputedStyle(el).fontSize)))>=24,'larger visible delete cross');
 await page.locator('[data-tab=today]').click();
 const before=await page.evaluate(()=>localStorage.getItem(KEY)),memorialBefore=await page.evaluate(()=>localStorage.getItem(MEMORIAL_KEY));
 async function openWipe(){await page.locator('#settings').click();await page.locator('[data-wipe-all]').click();await page.locator('#wipe-dialog').waitFor({state:'visible'});}
 async function confirmStage(){await page.locator('[data-wipe-confirm]').click();}
 // Cancellation at every stage, including native/Escape cancellation, must preserve records.
 for(let stage=1;stage<=3;stage++){
  await openWipe();for(let i=1;i<stage;i++)await confirmStage();
  assert.match(await page.locator('#wipe-stage').innerText(),new RegExp(String(stage)+'|'+['','۱','۲','۳'][stage]));
  if(stage===2)await page.keyboard.press('Escape');else await page.locator('[data-wipe-cancel]').click();
  assert.equal(await page.evaluate(()=>localStorage.getItem(KEY)),before);
  assert.equal(await page.evaluate(()=>localStorage.getItem(MEMORIAL_KEY)),memorialBefore);
  if(await page.locator('#settings-dialog').isVisible())await page.locator('#settings-close').click();
 }
 await page.evaluate(()=>{
  window.nativeCounts={clear:0,stop:0,install:0,fail:true};
  window.AndroidZaman={fireDue(){},stopAlarm(){nativeCounts.stop++;},clearAppData(){nativeCounts.clear++;return JSON.stringify(nativeCounts.fail?{ok:false,error:'پاک‌کردن آزمایشی انجام نشد.'}:{ok:true});},installDownloadedUpdate(){nativeCounts.install++;return JSON.stringify({ok:true,scheduled:true});}};
 });
 // Native cleanup failure must not erase browser data or report a successful reset.
 await openWipe();await confirmStage();await confirmStage();await confirmStage();
 assert.equal(await page.evaluate(()=>localStorage.getItem(KEY)),before);assert(await page.locator('#wipe-dialog').isVisible());assert.match(await page.locator('#toast').innerText(),/انجام نشد/);
 await page.locator('[data-wipe-cancel]').click();await page.locator('#settings-close').click();
 await page.evaluate(()=>{nativeCounts.clear=0;nativeCounts.fail=false;});
 await openWipe();await confirmStage();assert.equal(await page.evaluate(()=>nativeCounts.clear),0);await confirmStage();assert.equal(await page.evaluate(()=>nativeCounts.clear),0);await confirmStage();
 await page.locator('#wipe-dialog').waitFor({state:'hidden'});
 assert.equal(await page.evaluate(()=>nativeCounts.clear),1);
 const reset=await page.evaluate(()=>JSON.parse(localStorage.getItem(KEY)));
 for(const field of ['history','activities','alarms','projects'])assert.deepEqual(reset[field],[],field+' cleared');
 assert.equal(reset.day,null);assert.equal(reset.pendingSegment,undefined);assert.equal(reset.countdown.end,null);
 assert.equal(await page.evaluate(()=>localStorage.getItem('unrelated-app-data')),'keep me');
 assert.equal(await page.locator('#settings-dialog').isVisible(),false);
 // A verified Android download offers a deliberate installer action and preserves Android consent.
 await page.evaluate(()=>showDownloadState({ok:true,status:'verified'}));
 await page.locator('#settings').click();await page.locator('#settings-dialog [data-install-update]').click();assert.equal(await page.evaluate(()=>nativeCounts.install),1);
 await page.locator('#settings-close').click();
 await page.reload();assert.equal(await page.evaluate(()=>state.history.length),0);assert.equal(await page.evaluate(()=>state.projects.length),0);assert.equal(await page.evaluate(()=>localStorage.getItem('unrelated-app-data')),'keep me');
 for(const width of [320,360,390,768,1280]){await page.setViewportSize({width,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'no overflow '+width);}
 assert.deepEqual(errors,[]);await browser.close();console.log('PASS release1.9: analog integration, Today title, prominent red update, enlarged delete target, cancellation at all three wipe stages, native cleanup once, unrelated origin storage retained, verified installer action and reload');
})().catch(e=>{console.error(e);process.exit(1)});
