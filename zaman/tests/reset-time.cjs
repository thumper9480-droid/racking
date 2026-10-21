const {chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:390,height:844},timezoneId:'Asia/Tehran'}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.clock.install({time:new Date('2026-10-21T10:30:23+03:30')});
 await page.clock.pauseAt(new Date('2026-10-21T10:30:23+03:30'));
 await page.setContent('<!doctype html><html lang="fa" dir="rtl"><meta name="viewport" content="width=device-width,initial-scale=1"><body><dialog open><form id="form"></form></dialog></body></html>');
 for(const file of ['style.css','reset-time.css'])await page.addStyleTag({path:'zaman/'+file});
 await page.addScriptTag({path:'zaman/reset-time.js'});
 await page.evaluate(()=>{document.querySelector('#form').innerHTML=resetTimeFields(new Date('2026-10-21T07:30:00+03:30'));setupResetTime();});
 const value=()=>page.locator('[name=startTime]').inputValue(),mode=()=>page.locator('[name=startMode]').inputValue();
 assert.equal(await value(),'07:30');assert(await page.locator('#reset-time-picker').isHidden());
 await page.locator('[data-reset-wheel-toggle]').click();assert.equal(await page.locator('[data-reset-wheel-toggle]').getAttribute('aria-expanded'),'true');
 assert.equal(await page.locator('#reset-hour-wheel [aria-selected=true]').getAttribute('data-reset-value'),'7');
 await page.locator('#reset-hour-6').click();assert.equal(await value(),'06:30');
 await page.locator('#reset-hour-wheel').focus();await page.keyboard.press('ArrowDown');assert.equal(await value(),'07:30');
 await page.keyboard.press('Home');assert.equal(await value(),'00:30');await page.keyboard.press('ArrowUp');assert.equal(await value(),'00:30');
 await page.keyboard.press('End');assert.equal(await value(),'23:30');await page.keyboard.press('ArrowDown');assert.equal(await value(),'23:30');
 await page.locator('#reset-minute-wheel').focus();await page.keyboard.press('End');assert.equal(await value(),'23:59');await page.keyboard.press('PageUp');assert.equal(await value(),'23:54');
 await page.locator('[data-reset-time-now]').click();assert.equal(await value(),'10:30');assert.equal(await mode(),'now');
 // Programmatic scrolling and opening the wheels must never turn "now" into a rounded custom time.
 await page.clock.runFor(1000);assert.equal(await mode(),'now');
 await page.locator('[data-reset-wheel-toggle]').click();await page.locator('[data-reset-wheel-toggle]').click();await page.clock.runFor(1000);assert.equal(await mode(),'now');
 assert.deepEqual(await page.evaluate(()=>readResetTime(new FormData(document.querySelector('#form')))),{useNow:true,value:'10:30'});
 // The next deliberate wheel action switches back to a custom minute.
 await page.locator('#reset-minute-wheel').focus();await page.keyboard.press('ArrowUp');assert.equal(await value(),'10:29');assert.equal(await mode(),'custom');
 await page.locator('[name=startTime]').fill('08:15');assert.equal(await mode(),'custom');assert.equal(await value(),'08:15');
 const wheel=await page.locator('#reset-minute-wheel').boundingBox();await page.mouse.move(wheel.x+wheel.width/2,wheel.y+wheel.height/2);await page.mouse.wheel(0,88);
 await page.clock.runFor(1000);await page.waitForFunction(()=>Number(document.querySelector('[name=startTime]').value.split(':')[1])>15);
 await page.locator('#reset-minute-wheel').focus();await page.keyboard.press('Escape');assert(await page.locator('#reset-time-picker').isHidden());
 for(const width of [320,360,390,768,1280]){await page.setViewportSize({width,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.locator('[data-reset-wheel-toggle]').click();assert(await page.locator('#reset-time-picker').isVisible());assert(await page.evaluate(()=>document.querySelector('dialog').scrollWidth<=document.querySelector('dialog').clientWidth+1));await page.locator('[data-reset-wheel-toggle]').click();}
 await page.setViewportSize({width:390,height:844});await page.locator('[data-reset-wheel-toggle]').click();await page.screenshot({path:'/tmp/ali-mirza-reset-time.png',fullPage:true});
 // A real touch gesture must scroll the same wheel on a phone viewport.
 const touch=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 await touch.setContent('<!doctype html><html lang="fa" dir="rtl"><meta name="viewport" content="width=device-width,initial-scale=1"><body><dialog open><form id="form"></form></dialog></body></html>');
 for(const file of ['style.css','reset-time.css'])await touch.addStyleTag({path:'zaman/'+file});await touch.addScriptTag({path:'zaman/reset-time.js'});
 await touch.evaluate(()=>{document.querySelector('#form').innerHTML=resetTimeFields(new Date(2026,9,21,7,30));setupResetTime();});
 await touch.locator('[data-reset-wheel-toggle]').tap();const box=await touch.locator('#reset-hour-wheel').boundingBox(),client=await touch.context().newCDPSession(touch),x=box.x+box.width/2,y=box.y+box.height/2;
 await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
 for(let step=1;step<=10;step++){await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y-step*8}]});await new Promise(resolve=>setTimeout(resolve,15));}
 await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await touch.waitForFunction(()=>Number(document.querySelector('[name=startTime]').value.split(':')[0])>7);
 // In the real app "now" is captured when the user confirms, with seconds intact.
 const app=await browser.newPage({viewport:{width:390,height:844},timezoneId:'Asia/Tehran'});app.on('pageerror',e=>errors.push(e.message));
 await app.clock.install({time:new Date('2026-10-21T10:30:23+03:30')});await app.clock.pauseAt(new Date('2026-10-21T10:30:23+03:30'));
 await app.goto('http://127.0.0.1:4173/zaman/');await app.locator('[data-action=reset-day]').click();await app.locator('[data-reset-time-now]').click();
 await app.clock.runFor(19000);await app.locator('[name=confirmReset]').check();await app.locator('#form button[type=submit]').click();
 let saved=await app.evaluate(()=>JSON.parse(localStorage.getItem('zaman-browser-v1')));
 assert.equal(saved.day.start,new Date('2026-10-21T10:30:42+03:30').getTime());assert.equal(saved.day.segment,saved.day.start);
 await app.locator('[data-action=reset-day]').click();await app.locator('[data-reset-time-now]').click();await app.locator('[name=startTime]').fill('08:45');
 await app.locator('[name=confirmReset]').check();await app.locator('#form button[type=submit]').click();saved=await app.evaluate(()=>JSON.parse(localStorage.getItem('zaman-browser-v1')));
 assert.equal(saved.day.start,new Date('2026-10-21T08:45:00+03:30').getTime());
 assert.deepEqual(errors,[]);await browser.close();console.log('PASS reset-time fields: exact second-preserving Here-now submission, manual override, click/keyboard/mouse/touch scrolling, bounds, accessible toggle, responsive fit');
})().catch(e=>{console.error(e);process.exit(1)});
