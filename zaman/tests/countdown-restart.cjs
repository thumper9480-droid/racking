const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:390,height:844},timezoneId:'Asia/Tehran'}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));await page.clock.install({time:new Date('2026-10-21T10:30:00+03:30')});await page.clock.pauseAt(new Date('2026-10-21T10:30:01+03:30'));
 await page.goto('http://127.0.0.1:4173/zaman/');
 await page.evaluate(()=>{const now=Date.now();state.day={start:now-3600000,segment:now-60000,activity:'فعالیت جاری'};state.history=[{name:'مطالعه',start:now-3600000,end:now-60000}];state.countdown={remaining:120000,duration:120000,end:null};save();render();});
 const before=await page.evaluate(()=>({day:state.day,history:state.history}));
 assert.equal(await page.locator('#count-unit').innerText(),'دقیقه');
 for(let round=0;round<2;round++){
  if(round===0)await page.locator('[data-action=play]').click();
  assert.equal(await page.locator('#count-unit').isVisible(),false);assert.equal(await page.locator('#count-unit').textContent(),'');
  assert.match(await page.locator('#count-clock').innerText(),/^[۰-۹]+:[۰-۹]{2}$/);
  await page.clock.fastForward(120250);
  assert(await page.locator('#ring').isVisible());assert(await page.locator('#restart-countdown').isVisible());
  const stop=page.locator('#silence'),restart=page.locator('#restart-countdown');assert((await stop.boundingBox()).height>=44);assert((await restart.boundingBox()).height>=44);
  await restart.click();const started=await page.evaluate(()=>({end:state.countdown.end,remaining:state.countdown.remaining,now:Date.now()}));assert.equal(started.remaining,120000);assert.equal(started.end-started.now,120000);assert.equal(await page.locator('#ring').isVisible(),false);
 }
 assert.deepEqual(await page.evaluate(()=>({day:state.day,history:state.history})),before,'restart changes no daily records');
 // Stopping pauses the alarm only; it must not silently begin another countdown.
 await page.clock.fastForward(120250);await page.locator('#silence').click();assert.equal(await page.evaluate(()=>state.countdown.end),null);assert.equal(await page.evaluate(()=>state.countdown.remaining),0);assert.equal(await page.locator('#restart-countdown').isVisible(),false);
 // Reminder-only expiry has no countdown restart. A simultaneous expiry keeps it.
 await page.evaluate(()=>{state.alarms=[{id:'only-reminder',title:'یادآور مستقل',at:Date.now()+1000,repeat:'none',enabled:true}];save();});await page.clock.fastForward(1250);assert.match(await page.locator('#ring-title').innerText(),/یادآور مستقل/);assert.equal(await page.locator('#restart-countdown').isVisible(),false);await page.locator('#silence').click();
 await page.evaluate(()=>{const end=Date.now()+60000;state.countdown={remaining:60000,duration:60000,end};state.alarms=[{id:'same-time',title:'یادآور هم‌زمان',at:end,repeat:'none',enabled:true}];save();render();});await page.clock.fastForward(60250);assert.match(await page.locator('#ring-title').innerText(),/تایمر معکوس.*یادآور هم‌زمان/);assert(await page.locator('#restart-countdown').isVisible());await page.screenshot({path:'/tmp/ali-mirza-countdown-expired.png',fullPage:true});await page.locator('#restart-countdown').click();assert.equal(await page.evaluate(()=>state.countdown.end-Date.now()),60000);
 // Header/education remain accessible throughout the application; the date stays Today-only.
 for(const tab of ['today','projects','alarms','activities','reports']){await page.evaluate(target=>{tab=target;render();},tab);assert(await page.locator('#today-header').isVisible());assert(await page.locator('#today-brand').isVisible());assert(await page.locator('#education-button').isVisible());assert.equal(await page.locator('#date').isVisible(),true);}
 await page.locator('#settings').click();assert.equal(await page.locator('#settings-dialog [data-help],#settings-dialog [data-guide-pdf]').count(),0);assert(await page.locator('#settings-dialog [data-action=about]').isVisible());await page.locator('#settings-close').click();
 // Android's adapter uses the same expired-countdown action and native audio stop/sync.
 const native=await browser.newPage({viewport:{width:390,height:844}});native.on('pageerror',e=>errors.push(e.message));await native.clock.install();
 await native.addInitScript(()=>{window.nativeCalls={stop:0,sync:[],fire:0};window.AndroidZaman={sync:s=>nativeCalls.sync.push(JSON.parse(s)),status:()=>JSON.stringify({exact:true,notifications:true}),stopAlarm:()=>nativeCalls.stop++,fireDue:()=>nativeCalls.fire++,permissions(){},testAlarm(){},export(){}};});
 await native.route('**/zaman/',route=>route.fulfill({contentType:'text/html',body:fs.readFileSync('zaman/index.html','utf8').replace(/(<script defer src="app\.js\?v=[^"]+"><\/script>)/,'$1<script defer src="android/native.js"></script>')}));await native.goto('http://127.0.0.1:4173/zaman/');
 await native.evaluate(()=>{state.countdown={remaining:60000,duration:60000,end:Date.now()+1000};save();render();});await native.clock.fastForward(1250);assert(await native.locator('#restart-countdown').isVisible());await native.locator('#restart-countdown').click();assert.equal(await native.evaluate(()=>nativeCalls.stop),1);const last=await native.evaluate(()=>nativeCalls.sync.at(-1));assert(last.countdown.end>0);assert.equal(last.countdown.remaining,60000);assert.equal(await native.locator('#ring').isVisible(),false);
 assert.deepEqual(errors,[]);await browser.close();console.log('PASS countdown stop/restart repeats, configured duration, simultaneous/reminder-only expiry, unit-free active readout, unchanged daily records, header/settings and native stop/scheduling');
})().catch(error=>{console.error(error);process.exit(1)});
