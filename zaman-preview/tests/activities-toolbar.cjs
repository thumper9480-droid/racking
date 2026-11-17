const{chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{
 const b=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});const p=await b.newPage({viewport:{width:390,height:844},timezoneId:'Asia/Tehran'}),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto('http://127.0.0.1:4173/zaman-preview/');
 await p.evaluate(()=>{for(let i=0;i<40;i++){rememberActivity('فعالیت '+i);upsertDayPlan(planDayKey(),'فعالیت '+i,1,5);}save();render();});
 await p.locator('[data-tab=activities]').click();const texts=['＋ فعالیت جدید','پلان‌ریزی فعالیت‌ها','گزارش فعالیت‌های پلاندار','گزارش کل فعالیت‌ها'];
 for(const width of[320,390,768]){
  await p.setViewportSize({width,height:844});await p.evaluate(()=>scrollTo(0,0));let base;
  for(const route of['activities','planning','progress','reports','overview']){
   if(route==='activities')await p.locator('[data-tab=activities]').click();if(route==='planning')await p.locator('.activities-toolbar [data-open-planning]').click();if(route==='progress')await p.locator('.activities-toolbar [data-plan-progress]').click();if(route==='reports')await p.locator('.activities-toolbar [data-action=reports]').click();if(route==='overview'){await p.locator('.activities-toolbar [data-open-planning]').click();await p.locator('[data-plan-overview]').click();}
   await p.evaluate(()=>scrollTo(0,0));assert.deepEqual(await p.locator('.activities-toolbar button').allTextContents(),texts);assert.equal(await p.locator('.activities-toolbar').count(),1);const box=await p.locator('.activities-toolbar').boundingBox();if(!base)base=box;assert.equal(Math.round(box.height),Math.round(base.height));assert.equal(Math.round(box.x),Math.round(base.x));assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   if(route==='activities'||route==='progress'){await p.evaluate(()=>scrollTo(0,1000));assert((await p.locator('.activities-toolbar').boundingBox()).y<=1,'toolbar pins at top while scrolling '+route);}
  }
 }
 await p.locator('.activities-toolbar [data-action=add-activity]').click();await p.locator('[name=name]').fill('از منوی ثابت');await p.locator('#form [type=submit]').click();assert(await p.evaluate(()=>activityCatalog().some(a=>a.name==='از منوی ثابت')));await p.locator('[data-tab=today]').click();assert.equal(await p.locator('.activities-toolbar').count(),0,'toolbar belongs to Activities and its subpages');assert.deepEqual(errors,[]);await b.close();console.log('PASS same four actions across activity list/calendar/plan report/all report/whole plan; sticky scroll, responsive sizing and add action');
})().catch(e=>{console.error(e);process.exit(1)});
