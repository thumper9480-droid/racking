/* Native Android integration; loaded before app.js, invoked after state initialization. */
let mobileLastSync='',mobilePromptOpen=false;
function mobileSync(){
 if(!window.AndroidNative)return;
 const alarms=[],now=Date.now();
 if(state.active?.deadline>now)alarms.push({id:1000,at:state.active.deadline,label:state.active.activity==='rest'?'استراحت تمام شد؛ آمادهٔ برگشت هستی؟':'بخش '+state.active.name+' تمام شد؛ استراحت یا بخش بعدی؟',wake:false});
 if(state.mobileWakeEnabled){
  const wake=Object.entries(state.plans).filter(([k,p])=>p.wake).map(([k,p])=>+new Date(k+'T'+p.wake+':00')).filter(t=>t>now).sort((a,b)=>a-b);
  wake.forEach((at,i)=>alarms.push({id:2000+i,at,label:'وقت بیدارشدن است',wake:true}));
 }
 state.tasks.filter(t=>!t.done&&!t.archived&&t.reminder!==false&&E.reminderTime(t)>now).forEach((t,i)=>alarms.push({id:3000+i,at:E.reminderTime(t),label:t.title,wake:false}));
 const payload=JSON.stringify({alarms,active:state.active||state.paused||null});
 if(payload!==mobileLastSync){AndroidNative.sync(payload);mobileLastSync=payload;}
}
function mobileDecorate(){
 if(!window.AndroidNative)return;
 if(tab==='today'){
  const capture=document.querySelector('.quick-capture');if(capture)capture.insertAdjacentHTML('afterbegin',`<div class="mobile-capture-actions">${button('☀ الان بیدار شدم','wake','','secondary')}${button('تا الان چه کار می‌کردم؟','mobileSince','','primary')}</div>`);
  document.querySelectorAll('[data-action=since]').forEach(el=>el.remove());
  if(capture)capture.querySelectorAll('[data-action=wake]').forEach((el,i)=>{if(i>0)el.remove();});
  const panel=document.querySelector('.focus-panel .focus-buttons');
  if(panel&&state.active)panel.insertAdjacentHTML('afterend',`<div class="actions mobile-interrupt">${button('⏸ کار پیش آمد؛ وقفه','mobileInterrupt','','secondary')}${state.paused?button('↩ برگشت به '+esc(state.paused.name),'resume','','primary'):''}</div>`);
  if(state.mobileAwaiting)document.querySelector('.focus-panel').insertAdjacentHTML('afterbegin',`<div class="notice">مرحله تمام شده؛ زمان تازه‌ای ثبت نمی‌شود.${button('انتخاب مرحلهٔ بعد','mobileStage','','primary')}</div>`);
 }
 if(tab==='settings'){
  const status=JSON.parse(AndroidNative.status());
  document.querySelector('#view').insertAdjacentHTML('afterbegin',card('زنگ و یادآوری اندروید',`<p>زنگ دقیق: ${status.exact?'فعال':'نیاز به مجوز'} • اعلان‌ها: ${status.notifications?'فعال':'نیاز به مجوز'}</p>${button('مجوز زنگ، اعلان و صفحهٔ قفل','mobilePermissions','','primary')}<label><input id="mobile-wake" type="checkbox" ${state.mobileWakeEnabled?'checked':''}> زنگ بیدارباش طبق ساعت هر روز در اکسل</label><label>استراحت بین بخش‌ها (دقیقه)<input id="mobile-rest" type="number" min="1" max="180" value="${state.mobileRestMinutes||10}"></label>${button('ذخیرهٔ تنظیمات گوشی','mobileSettings','','secondary')}<p class="muted">برای زنگ هنگام قفل بودن، مجوزهای بالا را فعال کن و محدودیت باتری برنامه را از تنظیمات گوشی بردار. پس از Force stop باید برنامه را دوباره باز کنی.</p>`));
  document.querySelector('#view').querySelectorAll('p.muted').forEach(p=>{if(p.textContent.includes('اعلان وب'))p.textContent='این نسخه برای زنگ مرحله‌ها و کارها از یادآوری اندروید استفاده می‌کند. زمان مرور کارهای ناتمام هنگام بازکردن برنامه بررسی می‌شود.'});
 }
 document.querySelectorAll('a[download]').forEach(a=>{a.onclick=e=>{e.preventDefault();AndroidNative.template();};});
}
function mobileTick(){
 const a=state.active;
 if(a?.deadline&&Date.now()>=a.deadline){
  AndroidNative.ringStage?.(a.activity==='rest'?'استراحت تمام شد':'بخش '+a.name+' تمام شد');
  state.mobileAwaiting={id:a.activity==='rest'?(state.mobileReturn?.id||''):a.activity,date:a.planDate||state.mobileReturn?.date||selected,wasRest:a.activity==='rest',name:a.name};
  E.settle(state,Date.now());state.series=null;state.paused=null;save();render();mobileStage();
 }else updateClock();
 mobileSync();
 if(state.mobileAwaiting&&!document.querySelector('#dialog').open)mobileStage();
 if(Date.now()-lastReviewCheck>60000){lastReviewCheck=Date.now();maybeReview();}
}
function mobileStage(){
 const stage=state.mobileAwaiting;if(!stage||document.querySelector('#dialog').open)return;
 mobilePromptOpen=true;
 const remaining=E.blocks(state,stage.date).filter(b=>b.id===stage.id&&!state.completions[b.key]);
 modal(stage.wasRest?'استراحت تمام شد':'این بخش تمام شد',`<div class="mobile-stage-icon">${stage.wasRest?'☕':'✓'}</div><p>${esc(stage.name)} ثبت شد. ${remaining.length?fa(remaining.length)+' بخش باقی مانده.':'برنامهٔ این فعالیت تکمیل شده.'}</p><div class="mobile-stage-choices">${!stage.wasRest?button('☕ '+fa(state.mobileRestMinutes||10)+' دقیقه استراحت','mobileChoice','rest','primary'):''}${remaining.length?button('▶ '+(stage.wasRest?'برگشت به کار':'شروع بخش بعدی')+' • '+fa(remaining[0].minutes)+' دقیقه','mobileChoice','next','primary'):''}${button('شروع زمان دلخواه','mobileChoice','custom','secondary')}${button('پایان فعالیت','mobileChoice','end','secondary')}</div>`,()=>{});
 document.querySelector('#form button[type=submit]').hidden=true;
}
function mobileChoice(choice){
 const stage=state.mobileAwaiting;if(!stage)return;
 AndroidNative.stopAlarm();closeModal();mobilePromptOpen=false;
 if(choice==='custom'){
  modal('مدت بخش بعدی',`<label>دقیقه<input class="field" name="minutes" type="number" min="1" max="720" value="10" required></label>`,f=>{const n=Number(f.get('minutes'));if(!Number.isInteger(n)||n<1||n>720)throw Error('زمان باید ۱ تا ۷۲۰ دقیقه باشد');delete state.mobileAwaiting;E.interrupt(state,stage.id||'outside');state.active.deadline=Date.now()+n*60000;state.active.series=true;state.active.target=n*60000;save();closeModal();render();});return;
 }
 delete state.mobileAwaiting;
 if(choice==='rest'){
  state.mobileReturn={id:stage.id,date:stage.date};E.interrupt(state,'rest');state.active.deadline=Date.now()+(state.mobileRestMinutes||10)*60000;state.active.series=true;state.active.target=(state.mobileRestMinutes||10)*60000;
 }else if(choice==='next'){
  const next=E.blocks(state,stage.date).find(b=>b.id===stage.id&&!state.completions[b.key]);if(next)E.startBlock(state,next);
 }
 save();render();
}
function mobileInterrupt(){
 modal('چه کاری پیش آمد؟',`<p>فعالیت قبلی متوقف می‌شود؛ مدت وقفه جدا ثبت می‌شود.</p><div class="mobile-stage-choices">${['phone','family','wc','rest','instagram','idle'].map(id=>button(esc(E.activity(state,id).name),'mobileReason',id,'secondary')).join('')}${button('کار دیگر / مورد جدید','mobileReason','other','secondary')}</div>`,()=>{});document.querySelector('#form button[type=submit]').hidden=true;
}
function mobileCommand(command){
 AndroidNative.stopAlarm();
 if(command==='wake'){state.woke=Date.now();save();render();return;}
 if(command==='stage'){tick();mobileStage();return;}
 if(command==='interrupt'){mobileInterrupt();return;}
 if(command==='pause'){E.pause(state);save();render();return;}
 if(command==='resume'){E.resume(state);save();render();}
}
document.addEventListener('click',e=>{const el=e.target.closest('[data-action]');if(!el)return;
 const action=el.dataset.action;
 if(!action.startsWith('mobile'))return;
 try{if(action==='mobileSince')mobileSince();if(action==='mobileInterrupt')mobileInterrupt();if(action==='mobileStage')mobileStage();if(action==='mobileChoice')mobileChoice(el.dataset.arg);if(action==='mobilePermissions')AndroidNative.permissions();if(action==='mobileReason'){const id=el.dataset.arg;closeModal();if(id==='other')activityDialog();else{E.interrupt(state,id,Date.now(),'وقفه');save();render();}}
 if(action==='mobileSettings'){const n=+document.querySelector('#mobile-rest').value;if(!Number.isInteger(n)||n<1||n>180)throw Error('استراحت باید ۱ تا ۱۸۰ دقیقه باشد');state.mobileWakeEnabled=document.querySelector('#mobile-wake').checked;state.mobileRestMinutes=n;save();toast('تنظیمات گوشی ذخیره شد');}
 }catch(error){toast(error.message);}
});

function mobileSeed(){
 const seed=window.RavalInitialPlan;if(!seed||state.mobileSeedVersion===seed.version)return;
 for(const a of seed.activities)if(!E.activity(state,a.id))state.activities.push(a);
 for(const [date,plan] of Object.entries(seed.plans)){
  if(!state.plans[date]||(!E.blocks(state,date).length&&Object.values(plan.blocks).some(parts=>parts.length)))E.setPlan(state,date,structuredClone(plan));
 }
 if(!source)state.startDate=seed.startDate;
 state.mobileSeedVersion=seed.version;
}
function mobileSince(){
 if(state.active)return toast('فعالیتی در حال ثبت است؛ ابتدا پایان و ثبت را بزن تا دوباره‌شماری نشود.');
 const now=Date.now(),midnight=E.interval(todayKey())[0],last=Math.max(midnight,state.woke||0,...state.entries.filter(e=>e.end<=now).map(e=>e.end));
 if(last<=midnight||last>=now){
  modal('از چه ساعتی بیدار بودی؟',`<p>برای اولین ثبت، ساعت بیدارشدن امروز را مشخص کن.</p><label>ساعت بیداری<input class="field" name="wake" type="time" required></label>`,f=>{const start=+new Date(todayKey()+'T'+f.get('wake')+':00');if(!Number.isFinite(start)||start>=Date.now())throw Error('ساعت بیداری باید قبل از الان باشد');state.woke=start;save();closeModal();mobileSince();});return;
 }
 const end=Date.now();
 modal('تا الان چه کار می‌کردی؟',`<div class="notice"><b>${time(last)} تا ${time(end)}</b> • ${fa(Math.floor((end-last)/60000))} دقیقه</div><p>فعالیت را انتخاب کن یا بنویس؛ زمان این بازه به همان فعالیت اضافه می‌شود.</p>${activityPicker()}<label>یادداشت (اختیاری)<input class="field" name="note" maxlength="200"></label>`,f=>{const activity=resolveTypedActivity(f);state.entries.push({activity:activity.id,name:activity.name,note:f.get('note')||'ثبت تا الان',start:last,end});save();closeModal();render();toast(fa(Math.floor((end-last)/60000))+' دقیقه '+activity.name+' ثبت شد؛ ثبت بعدی از همین ساعت آغاز می‌شود.');});
 updateActivityMatches();
}
