const {chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:390,height:844},timezoneId:'Asia/Tehran'});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 await page.clock.install({time:new Date('2026-10-21T10:20:00+03:30')});
 await page.goto('http://127.0.0.1:4173/zaman/');
 await page.evaluate(()=>{const today=new Date();today.setHours(0,0,0,0);const midnight=today.getTime();state.history=[{name:'دیروز',start:midnight-7200000,end:midnight-3600000},{name:'بازه شبانه',start:midnight-1800000,end:midnight+1800000},{name:'صبحانه',start:midnight+8*3600000,end:midnight+8.5*3600000}];state.countdown={remaining:90*60000,duration:90*60000,end:null};save();render();});
 await page.evaluate(()=>document.fonts.ready);
 assert.equal(await page.evaluate(()=>document.fonts.check('16px Vazirmatn')),true);
 assert.match(await page.locator('#persian-date').innerText(),/۱۴۰۵/);
 assert.match(await page.locator('#gregorian-date').innerText(),/۲۰۲۶/);
 assert.equal(await page.locator('#weekday').innerText(),'چهارشنبه');
 assert.equal(await page.locator('#count-clock').innerText(),'۹۰');
 assert.equal(await page.locator('.countdown').innerText().then(s=>s.includes(':')),false);
 assert.equal(await page.locator('.activity-name').count(),2);
 assert.equal(await page.locator('.history-table tbody tr').first().locator('td').first().innerText(),'۰۰:۰۰');
 assert.equal(await page.locator('#history-total').innerText(),'۰۱:۰۰');
 assert.deepEqual(await page.locator('.history-table thead th').allInnerTexts(),['از ساعت','تا ساعت','مدت','فعالیت']);
 assert.doesNotMatch(await page.locator('main').innerText(),/شروع روز|مسیر روزت|مستقل از تایمر روز|اطلاعات روی همین مرورگر|دریافت پشتیبان/);
 await page.locator('[data-action=previous-day]').click();assert.equal(await page.locator('.activity-name').count(),2);
 assert.equal(await page.locator('#history-total').innerText(),'۰۱:۳۰');
 await page.locator('[data-action=history-today]').click();
 await page.locator('[data-action=wake]').click();
 assert.equal(await page.locator('#day-clock').innerText(),'۰۰:۰۰:۰۰');
 await page.locator('[data-action=play]').click();await page.clock.fastForward(61000);
 assert.equal(await page.locator('#count-clock').innerText(),'۸۸:۵۹');assert(await page.locator('.countdown').evaluate(el=>el.classList.contains('is-running')));
 await page.locator('[data-action=play]').click();await page.locator('[data-action=reset]').click();
 assert.equal(await page.locator('#count-clock').innerText(),'۹۰');
 assert.match(await page.locator('#view').innerText(),/مسیر روز/);
 // Confirm backup download and restore controls remain accessible through settings.
 await page.locator('[data-tab=activities]').click();await page.locator('#settings').click();const downloadPromise=page.waitForEvent('download');await page.locator('#export').click();const download=await downloadPromise;assert.equal(download.suggestedFilename(),'zaman-backup.json');
 assert(await page.locator('.import').isVisible());await page.locator('#settings-close').click();
 for(const width of [320,360,390,768,1280]){await page.setViewportSize({width,height:844});for(const tab of ['today','alarms','projects','activities']){await page.locator(`[data-tab=${tab}]`).click();assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${tab} overflows ${width}`);}}
 await page.setViewportSize({width:390,height:844});await page.locator('[data-tab=today]').click();await page.screenshot({path:'/tmp/zaman-layout-mobile.png',fullPage:true});
 assert.deepEqual(errors,[]);await browser.close();console.log('PASS redesigned layout: uploaded font, dual dates, minute-only countdown, daily table and totals, cross-midnight clipping, preserved previous days, settings backup, responsive widths');
})().catch(e=>{console.error(e);process.exit(1)});
