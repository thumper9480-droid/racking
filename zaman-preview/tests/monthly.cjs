const{chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{
 const b=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 const p=await b.newPage({viewport:{width:390,height:844},timezoneId:'Asia/Tehran'}),errors=[];
 p.on('pageerror',e=>errors.push(e.message));
 await p.clock.install({time:new Date('2026-11-17T06:00:00+03:30')});await p.clock.pauseAt(new Date('2026-11-17T06:00:00+03:30'));
 await p.goto('http://127.0.0.1:4173/zaman-preview/#planning');
 await p.evaluate(()=>{rememberActivity('مطالعه');rememberActivity('ورزش');save();render();});
 await p.locator('[data-plan-month-bulk]').click();
 const rows=p.locator('[data-month-day]'),first=rows.nth(0),second=rows.nth(1);
 assert.equal(await rows.count(),30);assert.equal(await p.locator('[data-month-goal]:checked').count(),30);assert.equal(await p.locator('[data-month-wake]:checked').count(),30);
 assert(await p.locator('.month-plan-scroll').evaluate(e=>e.scrollHeight>e.clientHeight));
 assert.equal(await first.locator('.month-day-label small').innerText(),'۱ آبان ماه');assert(!/۱۴۰۵/.test(await first.locator('.month-day-label').innerText()));
 await p.locator('#form button[type=submit]').click();assert(await p.locator('#month-plan-error').isVisible());assert.match(await p.locator('#month-plan-error').innerText(),/فعالیت/);assert(await p.locator('#dialog').isVisible());
 await p.locator('[name=planActivity]').selectOption('مطالعه');
 async function selectOnly(selector,indices){await p.evaluate(({selector,indices})=>{document.querySelectorAll('[data-month-day]').forEach((row,i)=>{const c=row.querySelector(selector);c.checked=indices.includes(i);c.dispatchEvent(new Event('change',{bubbles:true}));});},{selector,indices});}
 await selectOnly('[data-month-goal]',[0,1]);await second.locator('[data-month-count]').fill('8');
 assert.equal(await p.locator('#month-plan-total').innerText(),'۶۵ دقیقه');
 await first.locator('[data-month-count]').fill('0');await p.locator('#form button[type=submit]').click();assert(await first.locator('[data-month-error]').isVisible());assert.equal(await p.evaluate(()=>state.dailyPlans?.length||0),0);
 await first.locator('[data-month-count]').fill('5');
 const today=await p.evaluate(()=>planDayKey()),tomorrow=await p.evaluate(()=>{const d=new Date();d.setDate(d.getDate()+1);return planDayKey(d)});
 const todayRow=p.locator(`[data-month-day="${today}"]`),tomorrowRow=p.locator(`[data-month-day="${tomorrow}"]`);
 await selectOnly('[data-month-wake]',[2,25,26]);
 await todayRow.locator('[data-month-time]').fill('09:00');await tomorrowRow.locator('[data-month-time]').fill('08:45');
 assert.match(await rows.nth(2).locator('[data-month-wake-status]').innerText(),/گذشته/);
 await todayRow.locator('[data-month-time]').fill('25:00');await p.locator('#form button[type=submit]').click();assert(await todayRow.locator('[data-month-error]').isVisible());assert.equal(await p.evaluate(()=>state.dailyPlans?.length||0),0);await todayRow.locator('[data-month-time]').fill('09:00');
 await todayRow.locator('[data-month-time]').click();assert(await todayRow.locator('.shared-time-picker').isVisible());await todayRow.locator('.month-time-done').click();assert(await todayRow.locator('.shared-time-picker').isHidden());
 await p.locator('[name=planActivity]').selectOption('ورزش');await selectOnly('[data-month-goal]',[2]);await p.locator('[name=planActivity]').selectOption('مطالعه');assert.equal(await p.locator('#month-plan-total').innerText(),'۶۵ دقیقه');assert.equal(await todayRow.locator('[data-month-time]').inputValue(),'09:00');
 for(const width of[320,390,768]){await p.setViewportSize({width,height:700});assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await rows.last().scrollIntoViewIfNeeded();assert(await p.locator('.month-plan-scroll').evaluate(e=>e.scrollTop>0));assert(await p.locator('#form button[type=submit]').isVisible());assert(await p.locator('#form h2').evaluate(e=>e.clientHeight>=e.scrollHeight-1));}
 await p.locator('#form button[type=submit]').click();assert(await p.locator('#dialog').isHidden());assert.equal(await p.evaluate(()=>state.dailyPlans.length),3);assert.equal(await p.evaluate(()=>state.plannedWakes.length),3);assert.equal(await p.evaluate(()=>state.alarms.filter(a=>a.plannedWakeId&&a.enabled).length),2,'past wake remains disabled without blocking plan save');
 await p.reload();assert.equal(await p.evaluate(()=>state.dailyPlans.length),3);assert.equal(await p.evaluate(()=>state.plannedWakes.length),3);
 await p.locator('[data-plan-month-bulk]').click();await p.locator('[name=planActivity]').selectOption('مطالعه');assert.equal(await p.locator('[data-month-goal]:checked').count(),2);assert.equal(await p.locator('[data-month-wake]:checked').count(),3);
 await selectOnly('[data-month-goal]',[]);await p.locator('#form button[type=submit]').click();await p.locator('[data-plan-month-bulk]').click();await p.locator('[name=planActivity]').selectOption('مطالعه');assert.equal(await p.locator('[data-month-goal]:checked').count(),0,'explicit all-off selection survives reopening');await p.locator('#cancel').click();
 await p.clock.fastForward(3*3600000+1000);assert(await p.locator('#ring').isVisible());assert.match(await p.locator('#ring-title').innerText(),/بیدارباش/);await p.locator('#silence').click();assert.equal(await p.evaluate(()=>state.alarms.filter(a=>a.plannedWakeId&&a.enabled).length),1);
 const backup=await p.evaluate(()=>buildVoiceBackup()),restored=await p.evaluate(v=>restoreVoiceBackup(v),backup);for(const key of['plannedWakes','planMonthSelections','wakeMonthSelections'])assert.deepEqual(restored[key],backup[key]);
 assert.deepEqual(errors,[]);await b.close();console.log('PASS default checked dates/wakes; compact dates and wheel; visible missing-activity/quota/time errors with atomic save; past wakes disabled; multi-activity drafts; unchecked choices persist; reload/backup and wake firing');
})().catch(e=>{console.error(e);process.exit(1)});
