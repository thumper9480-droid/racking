const {chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{
 const b=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 const p=await b.newPage({viewport:{width:390,height:844},timezoneId:'Asia/Tehran'}),errors=[];
 p.on('pageerror',e=>errors.push(e.message));await p.clock.install({time:new Date('2026-11-13T03:36:00+03:30')});await p.clock.pauseAt(new Date('2026-11-13T03:36:00+03:30'));await p.goto('http://127.0.0.1:4173/zaman/');await p.evaluate(()=>document.fonts.ready);
 const selectors=['#today-header','#today-brand','#header-clock','#date','#education-button','#header-reminders','nav','nav [data-tab=today]','nav [data-tab=projects]','nav [data-tab=activities]','nav [data-tab=reports]','nav #settings'];
 async function geometry(){return p.evaluate(selectors=>Object.fromEntries(selectors.map(selector=>{const e=document.querySelector(selector),r=e.getBoundingClientRect(),s=getComputedStyle(e);return [selector,{x:r.x,y:r.y,width:r.width,height:r.height,display:s.display,fontSize:s.fontSize,borderRadius:s.borderRadius}]})),selectors);}
 for(const width of [320,330,360,390,768,1280]){
  await p.setViewportSize({width,height:844});await p.locator('[data-tab=today]').click();await p.evaluate(()=>window.scrollTo(0,0));const reference=await geometry();
  for(const tab of ['alarms','projects','activities','reports','today']){
   await p.locator(`[data-tab=${tab}]`).click();await p.evaluate(()=>window.scrollTo(0,0));assert.deepEqual(await geometry(),reference,`same masthead/nav shapes and positions at ${width}px on ${tab}`);
   assert.equal(await p.locator('#today-header [data-tab=alarms]').count(),1);assert.equal(await p.locator('nav [data-tab=alarms]').count(),0);
   assert(await p.locator(`[data-tab=${tab}]`).evaluate(e=>e.classList.contains('selected')),'active route remains selected');
   assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  }
  assert(reference['#header-reminders'].y>=reference['#education-button'].y+reference['#education-button'].height-1);assert.equal(reference['#header-reminders'].x,reference['#education-button'].x);
 }
 await p.setViewportSize({width:330,height:760});await p.locator('#header-reminders').click();assert(await p.locator('.alarm-heading').isVisible());await p.locator('#education-button').click();assert(await p.locator('#education-dialog').isVisible());await p.locator('[data-close-education]').click();await p.locator('#settings').click();assert(await p.locator('#settings-dialog').isVisible());await p.locator('#settings-close').click();
 const nav=await p.locator('nav').boundingBox();await p.screenshot({path:'/tmp/ali-mirza-header-1.13.1.png',clip:{x:0,y:0,width:330,height:Math.ceil(nav.y+nav.height+4)}});
 assert.deepEqual(errors,[]);await b.close();console.log('PASS identical header/navigation geometry on five pages at six widths, reminder/education circles and settings remain operable; selected navigation retained');
})().catch(e=>{console.error(e);process.exit(1)});
