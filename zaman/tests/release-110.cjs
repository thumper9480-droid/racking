const {chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:390,height:844},timezoneId:'Asia/Tehran'}),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/release.json*',route=>route.fulfill({json:{versionCode:12,versionName:'1.10.0',apkUrl:'https://raw.githubusercontent.com/thumper9480-droid/racking/gh-pages/downloads/zaman-android-1.10.0.apk',sha256:'a'.repeat(64)}}));
 await page.goto('http://127.0.0.1:4173/zaman/');await page.evaluate(()=>document.fonts.ready);
 const reset=page.locator('[data-action=reset-day]');
 for(const [width,height] of [[320,640],[360,740],[390,844],[768,900],[1280,900]]){
  await page.setViewportSize({width,height});await page.evaluate(()=>window.scrollTo(0,0));
  const box=await reset.boundingBox(),date=await page.locator('#date').boundingBox(),hero=await page.locator('.hero').boundingBox();
  const analog=await page.locator('#analog-clock').boundingBox(),circle=await page.locator('.circle-action').boundingBox(),gregorian=await page.locator('#gregorian-date').boundingBox();
  assert(box&&box.y>=gregorian.y+gregorian.height-1&&box.y+box.height<=date.y+date.height&&box.y+box.height<=hero.y+1,'reset sits below dates inside the date card');
  assert(analog.width>=circle.width-1&&Math.abs(analog.width-analog.height)<1,'header clock stays large and circular');
  const brand=await page.locator('#today-brand').boundingBox();assert(analog.x>brand.x+brand.width-1,'clock is to the right of the logo');assert.equal(await page.locator('#analog-clock-time').count(),0,'no duplicate digital clock');
  assert(date.y>=analog.y+analog.height-1,'dates fit below the clock/logo in the masthead');
  assert(await page.locator('#date .date-line').evaluate(el=>parseFloat(getComputedStyle(el).fontSize))>=14,'Persian date is larger');
  assert(await page.locator('#gregorian-date').evaluate(el=>parseFloat(getComputedStyle(el).fontSize))>=12,'Gregorian date is larger');
  assert(box.y>=0&&box.y+box.height<height,'reset visible without scrolling '+width+'x'+height);
  assert(box.height>=38,'reset is easy to touch');assert.match(await reset.innerText(),/شروع دوباره.*امروز.*ساعت دلخواه/);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'no horizontal overflow '+width);
 }
 await page.setViewportSize({width:390,height:844});await page.evaluate(()=>document.fonts.ready);await page.screenshot({path:'/tmp/ali-mirza-aligned-1.11.png',fullPage:true});
 // Opening this new, visible entry must retain the existing confirmation barrier.
 const before=await page.evaluate(()=>localStorage.getItem(KEY));await reset.click();
 assert(await page.locator('[name=confirmReset]').isVisible());assert(await page.locator('[data-reset-time-now]').isVisible());
 await page.locator('#cancel').click();assert.equal(await page.evaluate(()=>localStorage.getItem(KEY)),before);
 const rgb=value=>value.match(/[\d.]+/g).slice(0,3).map(Number);
 const neutral=values=>Math.max(...values)-Math.min(...values)<=18;
 const warm=values=>values[0]>values[1]&&values[1]>values[2];
 assert(neutral(rgb(await page.locator('.due-project-tasks .section-toggle').evaluate(el=>getComputedStyle(el).color))),'Today task heading is gray');
 for(const selector of ['.journey .section-toggle','.day-chart .section-toggle'])assert(warm(rgb(await page.locator(selector).evaluate(el=>getComputedStyle(el).color))),'daily summaries have warm brown headings');
 for(const tab of ['today','alarms','projects','activities']){
  await page.locator(`[data-tab=${tab}]`).click();
  assert(await page.locator('#today-header').isVisible(),'masthead remains on '+tab);assert(await page.locator('#today-brand').isVisible(),'logo remains on '+tab);
  assert(await page.locator('#today-brand img').evaluate(img=>img.complete&&img.naturalWidth>0),'logo loads on '+tab);
  assert.equal(await page.locator('#date').isVisible(),tab==='today');
  await page.locator('#education-button').click();assert(await page.locator('#education-dialog [data-help]').isVisible());assert(await page.locator('#education-dialog [data-guide-pdf]').isVisible());await page.locator('[data-close-education]').click();
  if(tab==='projects')assert(neutral(rgb(await page.locator('.projects-heading h2').evaluate(el=>getComputedStyle(el).color))),'project heading matches gray task theme');
 }
 await page.locator('[data-action=reports]').click();assert(await page.locator('#today-brand').isVisible(),'reports retain logo');assert(await page.locator('#education-button').isVisible(),'reports retain education');assert.equal(await page.locator('#date').isVisible(),false);
 await page.locator('#settings').click();assert.equal(await page.locator('#settings-dialog [data-help]').count(),0);assert.equal(await page.locator('#settings-dialog [data-guide-pdf]').count(),0);assert(await page.locator('#settings-dialog [data-action=about]').isVisible(),'About retained in settings');assert(await page.locator('#export').isVisible(),'backup retained in settings');await page.locator('#settings-close').click();
 assert.deepEqual(errors,[]);await browser.close();console.log('PASS aligned date card: readable clock right of logo, larger dates and reset inside masthead, safe cancellation, gray projects/Today tasks, brown summaries, logo and education on all tabs/reports, settings duplicate help removed with backup/About retained');
})().catch(error=>{console.error(error);process.exit(1)});
