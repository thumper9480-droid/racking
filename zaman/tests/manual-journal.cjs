const {chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:390,height:844},timezoneId:'Asia/Tehran'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.clock.install({time:new Date('2026-10-22T12:00:00+03:30')});await page.clock.pauseAt(new Date('2026-10-22T12:00:01+03:30'));
 await page.goto('http://127.0.0.1:4173/zaman/');
 const submit=()=>page.locator('#form button[type=submit]').click();
 async function openJourney(){if(await page.locator('[data-toggle-section=journey]').getAttribute('aria-expanded')==='false')await page.locator('[data-toggle-section=journey]').click();}
 async function range(name,from,to){await openJourney();await page.locator('[data-action=manual-history]').click();await page.locator('[name=name]').fill(name);await page.locator('[name=fromTime]').fill(from);await page.locator('[name=toTime]').fill(to);await submit();assert.equal(await page.locator('#dialog').isVisible(),false);}
 await range('خواب','00:00','08:00');await range('صبحانه','08:00','10:00');await range('مطالعه','10:00','12:00');
 assert.equal(await page.locator('#history-total').innerText(),'۱۲:۰۰');
 await page.locator('[data-action=start-day]').click();await page.locator('[name=startTime]').fill('12:00');await submit();
 assert.equal(await page.evaluate(()=>state.history.length),3);assert.equal(await page.evaluate(()=>new Date(state.day.start).getHours()),12);
 await page.clock.fastForward(3600000);assert.equal(await page.locator('#history-total').innerText(),'۱۳:۰۰');
 // A retrospective slice of the live period moves its boundary instead of double counting.
 await range('کار پروژه','12:00','12:30');assert.equal(await page.locator('#history-total').innerText(),'۱۳:۰۰');assert.equal(await page.evaluate(()=>new Date(state.day.segment).getMinutes()),30);
 await page.locator('[data-action=manual-history]').click();await page.locator('[name=name]').fill('هم‌پوشان');await page.locator('[name=fromTime]').fill('08:30');await page.locator('[name=toTime]').fill('09:30');await submit();assert(await page.locator('#dialog').isVisible());assert.match(await page.locator('#toast').innerText(),/هم‌پوشانی/);await page.locator('#cancel').click();
 // Duration-only entries retain real totals and expose no fabricated from/to times.
 await page.evaluate(()=>{state=fresh();save();render();});await openJourney();
 for(const [name,minutes] of [['درس',40],['ورزش',70]]){await page.locator('[data-action=manual-history]').click();await page.locator('[name=name]').fill(name);await page.locator('[name=entryMode][value=duration]').check();await page.locator('[name=durationMinutes]').fill(String(minutes));await submit();}
 assert.equal(await page.locator('#history-total').innerText(),'۰۱:۵۰');assert.deepEqual(await page.locator('.history-table tbody tr').first().locator('td').allInnerTexts(),['—','—','۰۰:۴۰','درس']);
 assert.equal(await page.evaluate(()=>reportData().total),110*60000);assert.equal(await page.evaluate(()=>dailyBreakdown().total),110*60000);
 await page.reload();await openJourney();assert.equal(await page.locator('#history-total').innerText(),'۰۱:۵۰');assert(await page.evaluate(()=>validate(JSON.parse(localStorage.getItem(KEY))).history.every(h=>h.durationOnly)));
 // Midnight closes the automatic session exactly once, including a suspended app.
 await page.evaluate(()=>{const day=journalBounds();state=fresh();state.day={start:day.start-3600000,segment:day.start-1800000,activity:'فعالیت جاری'};state.countdown={remaining:600000,duration:600000,end:Date.now()+600000};save();});
 await page.reload();assert.equal(await page.evaluate(()=>state.day),null);assert.equal(await page.evaluate(()=>state.unassigned.length),1);assert.equal(await page.evaluate(()=>state.unassigned[0].end-state.unassigned[0].start),1800000);assert(await page.evaluate(()=>state.countdown.end>Date.now()));
 await page.reload();assert.equal(await page.evaluate(()=>state.unassigned.length),1);assert.equal(await page.evaluate(()=>state.history.length),0);
 await page.locator('[data-action=previous-day]').click();await openJourney();await page.locator('[data-fill-gap]').click();await page.locator('[name=name]').fill('فعالیت آخر شب');await submit();assert.equal(await page.evaluate(()=>state.unassigned.length),0);assert.equal(await page.evaluate(()=>state.history[0].end-state.history[0].start),1800000);
 // A title being entered at midnight survives; cancellation leaves a recoverable gap.
 await page.clock.setSystemTime(new Date('2026-10-23T23:59:59+03:30'));
 await page.evaluate(()=>{state=fresh();state.day={start:Date.now()-120000,segment:Date.now()-60000,activity:'فعالیت جاری'};historyOffset=0;save();render();});
 await page.locator('[data-action=segment]').click();await page.locator('[name=name]').fill('پیش‌نویس');await page.clock.fastForward(2000);assert.equal(await page.locator('[name=name]').inputValue(),'پیش‌نویس');assert.equal(await page.evaluate(()=>state.day),null);assert(await page.evaluate(()=>state.pendingSegment.detached));await page.locator('#cancel').click();assert.equal(await page.evaluate(()=>state.pendingSegment),undefined);assert.equal(await page.evaluate(()=>state.history.length),0);assert.equal(await page.evaluate(()=>state.unassigned.reduce((n,g)=>n+g.end-g.start,0)),61000);
 for(const width of [320,360,390,768,1280]){await page.setViewportSize({width,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));}
 const dst=await browser.newPage({timezoneId:'Europe/Paris'});dst.on('pageerror',e=>errors.push(e.message));await dst.clock.install({time:new Date('2026-10-26T12:00:00+01:00')});await dst.goto('http://127.0.0.1:4173/zaman/');
 assert.equal(await dst.evaluate(()=>{const b=journalBounds(new Date('2026-10-25T12:00:00+01:00'));return b.end-b.start;}),25*3600000,'calendar boundary accounts for a 25hour day');
 await dst.evaluate(()=>{const b=journalBounds(new Date('2026-10-25T12:00:00+01:00'));state.day={start:b.start,segment:b.end-1800000,activity:'فعالیت جاری'};save();render();});assert.equal(await dst.evaluate(()=>state.unassigned[0].end),new Date('2026-10-26T00:00:00+01:00').getTime());
 assert.deepEqual(errors,[]);await browser.close();console.log('PASS manual ranges and duration-only totals/reports/reload, preserved morning on custom start, live slicing, overlap rejection, offline midnight close, idempotence and draft recovery');
})().catch(error=>{console.error(error);process.exit(1)});
