'use strict';
// Run from the repository root after starting python3 -m http.server 4173.
// Requires Playwright and an installed Chromium; no remote asset/network dependency.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),base=process.env.ZAMAN_GUIDE_BASE||'http://127.0.0.1:4173/zaman/';
(async()=>{
 fs.mkdirSync(path.join(root,'guide-assets'),{recursive:true});
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox','--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream']});
 const context=await browser.newContext({viewport:{width:390,height:880},deviceScaleFactor:1.5,timezoneId:'Asia/Tehran',permissions:['microphone']}),p=await context.newPage(),errors=[],failed=[];
 p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.status()>=400)failed.push(`${r.status()} ${r.url()}`);});
 await p.route('**/release.json?*',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({versionName:'1.12.3',versionCode:17,apkUrl:'https://raw.githubusercontent.com/thumper9480-droid/racking/gh-pages/downloads/zaman-android-1.12.3.apk',sha256:'0'.repeat(64)})}));
 if(!process.argv.includes('--pdf-only')){
  await p.clock.install({time:new Date('2026-10-22T13:30:00+03:30')});await p.clock.pauseAt(new Date('2026-10-22T13:30:01+03:30'));
  await p.goto(base);await p.evaluate(()=>document.fonts.ready);
  await p.evaluate(()=>{
   const midnight=new Date();midnight.setHours(0,0,0,0);const d=midnight.getTime(),m=60000;
   state.history=[{name:'صبحانه',start:d+7*60*m,end:d+7.5*60*m},{name:'مطالعه',start:d+7.5*60*m,end:d+9*60*m},{name:'ورزش',start:d+9*60*m,end:d+9.5*60*m},{name:'کار پروژه',start:d+9.5*60*m,end:d+11.5*60*m}];
   for(let i=1;i<=6;i++)state.history.push({name:i%2?'مطالعه':'کار پروژه',start:d-i*86400000+8*60*m,end:d-i*86400000+(i%2?10:11)*60*m});
   state.day={start:d+7*60*m,segment:d+11.5*60*m,activity:'فعالیت جاری'};
   state.countdown={remaining:10*m,duration:10*m,end:null};
   state.activities=[{id:'reading',name:'مطالعه'},{id:'exercise',name:'ورزش'},{id:'breakfast',name:'صبحانه'},{id:'work',name:'کار پروژه'}];
   state.projects=[{id:'house',name:'خانه بالا',ideas:[],tasks:[{id:'iron',title:'خرید آهن\nهماهنگی با فروشنده و گرفتن قیمت',done:false,dueAt:d+14*60*m,dueRepeat:'none'},{id:'plan',title:'بررسی نقشه',done:false},{id:'visit',title:'بازدید محل',done:true,completedAt:d+10*60*m,statusHistory:[{done:true,at:d+10*60*m}]}]},{id:'learn',name:'یادگیری زبان',ideas:[],tasks:[{id:'words',title:'مرور واژه‌ها',done:false}]}];
   state.alarms=[{id:'iron-alarm',title:'خرید آهن',at:d+14*60*m,repeat:'none',enabled:true,projectId:'house',itemKind:'task',itemId:'iron'},{id:'call',title:'تماس با استاد',at:d+86400000+10*60*m,repeat:'weekly',enabled:true,projectId:''}];
   state.collapsedSections={'project-tasks':true,journey:true,chart:true};state.todayPanelsLayout=1;tab='today';save();render();
  });
  async function image(name,selector){const el=p.locator(selector);await el.waitFor({state:'visible'});await el.screenshot({path:path.join(root,'guide-assets',name+'.png'),animations:'disabled'});}
  const masthead=await p.locator('#today-header').boundingBox(),hero=await p.locator('.hero').boundingBox();
  if(masthead&&hero)await p.screenshot({path:path.join(root,'guide-assets','today.png'),clip:{x:hero.x,y:masthead.y,width:hero.width,height:hero.y+hero.height-masthead.y},animations:'disabled'});else await image('today','.hero');
  // Preserve the compact task/journey/share rows and end-day control; reset is now above the activity card.
  await p.locator('#today-project-tasks').scrollIntoViewIfNeeded();
  const compactTop=await p.locator('#today-project-tasks').boundingBox(),compactBottom=await p.locator('[data-hold-end]').boundingBox();
  if(compactTop&&compactBottom)await p.screenshot({path:path.join(root,'guide-assets','today-compact.png'),clip:{x:compactTop.x,y:compactTop.y,width:compactTop.width,height:compactBottom.y+compactBottom.height-compactTop.y},animations:'disabled'});
  for(const id of ['project-tasks','journey','chart']){const button=p.locator(`[data-toggle-section="${id}"]`);if(await button.getAttribute('aria-expanded')==='false')await button.click();}
  await image('journey','.journey');await image('chart','.day-chart');
  await p.locator('[data-action=manual-history]').click();await p.locator('[name=name]').fill('مطالعه');await image('manual-history','#dialog');await p.locator('#cancel').click();
  await p.locator('[data-action=reset-day]').click();await p.locator('[data-reset-wheel-toggle]').click();await image('reset-time','#dialog');await p.locator('#cancel').click();
  await p.locator('[data-action=segment]').click();await p.locator('#activity-input').fill('مطالعه');await image('segment','#dialog');await p.locator('#cancel').click();
  await p.locator('[data-action=duration]').click();await image('countdown','#dialog');await p.locator('#cancel').click();
  await p.locator('[data-tab=alarms]').click();await image('reminders','#view');
  await p.locator('[data-tab=projects]').click();await p.locator('[data-project=house]').click();await image('projects','#view');
  await p.clock.resume();await p.locator('[data-action=task]').click();await p.locator('[name=title]').fill('پیگیری خرید آهن');await p.locator('[data-audio-record]').click();await p.waitForFunction(()=>taskAudioDraft?.status==='recording');await p.waitForTimeout(700);await p.locator('[data-audio-stop]').click();await p.waitForFunction(()=>taskAudioDraft?.status==='idle'&&taskAudioDraft.notes.length===1);await image('audio','#dialog');await p.locator('#cancel').click();await p.clock.pauseAt(new Date('2026-10-22T13:30:10+03:30'));
  await p.locator('[data-tab=activities]').click();await p.locator('[data-action=reports]').click();await p.locator('[data-report-mode=week]').click();await image('reports','#view');
  await p.locator('#settings[data-action=settings]').click();await image('settings','#settings-dialog');
  await p.locator('[data-wipe-all]').click();await image('wipe-confirmation','#wipe-dialog');await p.locator('[data-wipe-cancel]').click();await p.locator('#settings-close').click();
  await p.locator('[data-tab=today]').click();
  await p.evaluate(()=>applyUpdateResult({ok:true,versionCode:APP_VERSION_CODE+1,versionName:'1.13.0',apkUrl:'https://raw.githubusercontent.com/thumper9480-droid/racking/gh-pages/downloads/zaman-android-1.13.0.apk',sha256:'0'.repeat(64)}));
  await image('update-banner','#update-banner');
 }
 const guide=await context.newPage();guide.on('pageerror',e=>errors.push(e.message));guide.on('response',r=>{if(r.status()>=400)failed.push(`${r.status()} ${r.url()}`);});
 await guide.setViewportSize({width:1000,height:1200});await guide.goto(new URL('help.html',base).href);await guide.evaluate(()=>document.fonts.ready);
 await guide.locator('.screen img').evaluateAll(images=>Promise.all(images.map(image=>image.decode())));
 assert.equal(await guide.locator('.guide-page').count(),10);
 await guide.evaluate(()=>document.querySelectorAll('details').forEach(el=>el.open=true));
 await guide.pdf({path:path.join(root,'user-guide.pdf'),format:'A4',printBackground:true,preferCSSPageSize:true,displayHeaderFooter:false,tagged:true,outline:true});
 assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
 await guide.setViewportSize({width:390,height:844});assert(await guide.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'HTML guide must fit mobile');
 await browser.close();console.log('PASS actual-app demo screenshots, offline linked HTML guide, ten instructional sections, mobile layout and generated Persian PDF');
})().catch(e=>{console.error(e);process.exit(1)});
