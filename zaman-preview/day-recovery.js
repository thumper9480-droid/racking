'use strict';
// Duration-only rows have no invented start/end; unknown rows never earn plan credit.
function validateRecoveryData(value){
 if(value.day?.resumed!==undefined&&typeof value.day.resumed!=='boolean')throw Error('resume metadata');
 for(const h of value.history)for(const key of ['unknown','approximate','recovered'])if(h[key]!==undefined&&typeof h[key]!=='boolean')throw Error('time metadata');
 for(const s of value.sleeps||[])for(const key of ['approximate','durationOnly'])if(s[key]!==undefined&&typeof s[key]!=='boolean')throw Error('sleep metadata');
}
function recoveryTotal(day,value=state,now=Date.now()){
 let total=value.history.reduce((sum,h)=>sum+journalDuration(h,day),0)+sleepStats(day,now,value).total;
 const pending=value.pendingSegment;if(pending)total+=Math.max(0,Math.min(pending.end,day.end)-Math.max(pending.start,day.start));
 if(value.day&&!(pending?.ending&&!pending.detached))total+=Math.max(0,Math.min(now,day.end,journalBounds(value.day.segment).end)-Math.max(day.start,value.day.segment));return total;
}
function recoveryGaps(day,value=state,now=Date.now()){
 const limit=Math.min(day.end,now),ranges=[...value.history.filter(h=>!h.durationOnly),...sleepRanges(value,now)];
 if(value.pendingSegment)ranges.push(value.pendingSegment);if(value.day&&!(value.pendingSegment?.ending&&!value.pendingSegment.detached))ranges.push({start:value.day.segment,end:Math.min(now,journalBounds(value.day.segment).end)});
 let cursor=day.start;const gaps=[];for(const r of ranges.filter(r=>r.end>day.start&&r.start<limit).sort((a,b)=>a.start-b.start)){if(r.start>cursor)gaps.push({start:cursor,end:Math.min(r.start,limit)});cursor=Math.max(cursor,r.end);}if(cursor<limit)gaps.push({start:cursor,end:limit});return gaps;
}
function recoveryClaimGaps(value,start,end){value.unassigned=(value.unassigned||[]).flatMap(g=>{if(g.end<=start||g.start>=end)return[g];const parts=[];if(g.start<start)parts.push({...g,end:start});if(g.end>end)parts.push({...g,id:uid(),start:end});return parts;});}
function recoveryClaimUnknown(rows,start,end){return rows.flatMap(h=>{if(!h.unknown||h.durationOnly||h.end<=start||h.start>=end)return[h];const parts=[];if(h.start<start)parts.push({...h,end:start});if(h.end>end)parts.push({...h,start:end});return parts;});}
function recoveryUnknown(start,end,durationOnly=false){return durationOnly?{name:'نامشخص',start,end:start,durationOnly:true,durationMs:end-start,unknown:true,manual:true,recovered:true}:{name:'نامشخص',start,end,unknown:true,manual:true,recovered:true};}
function recoveryFillUnknown(value,day,until=Date.now()){
 const remaining=Math.max(0,Math.min(until,day.end)-day.start-recoveryTotal(day,value,until));if(remaining<1){recoveryClaimGaps(value,day.start,Math.min(until,day.end));return;}
 const summaries=[...value.history,...(value.sleeps||[])].some(h=>h.durationOnly&&h.start>=day.start&&h.start<day.end);
 if(summaries)value.history.push(recoveryUnknown(day.start,day.start+remaining,true));else for(const gap of recoveryGaps(day,value,until))value.history.push(recoveryUnknown(gap.start,gap.end));
 recoveryClaimGaps(value,day.start,Math.min(until,day.end));
}
function recoverySummary(now=Date.now()){
 const day=journalBounds(now),unknown=state.history.filter(h=>h.unknown).reduce((sum,h)=>sum+journalDuration(h,day),0),sleep=sleepStats(day,now).total,total=recoveryTotal(day,state,now);
 return{day,unknown,sleep,missing:Math.max(0,now-day.start-total)};
}
function todayPlannedActivities(){const day=planDayKey(),plans=(state.dailyPlans||[]).filter(p=>p.day===day);if(!plans.length)return'';return `<article class="card today-plan-card"><div class="row"><h2>فعالیت‌های روتین امروز</h2><button type="button" class="small" data-today-plan-report>گزارش</button></div>${plans.map(p=>{const data=planProgress(p);return `<div class="today-plan-item ${data.complete?'is-complete':''}" data-today-plan="${esc(p.id)}"><span class="today-plan-check" role="checkbox" aria-checked="${data.complete}" aria-label="تکمیل ${esc(p.name)}">${data.complete?'✓':'○'}</span><div><b>${esc(p.name)}</b><small>${fa(p.count)} نوبت × ${fa(p.minutes)} دقیقه · ${planMinutes(data.assigned)} از ${planMinutes(data.target)} دقیقه</small><progress value="${data.assigned}" max="${data.target}" aria-label="پیشرفت ${esc(p.name)}"></progress></div></div>`;}).join('')}</article>`;}
function activityToolbar(){
 const daily=tab==='planning'&&!planningProgressView;
 const routineReport=tab==='planning'&&planningProgressView;
 const active=on=>on?'class="is-current" aria-current="page"':'';
 return `<div class="activities-toolbar activity-cards" role="group" aria-label="منوی فعالیت‌های روتین">
  <button type="button" data-action="add-activity">${planActionIcon('add')}<span>فعالیت روتین جدید</span></button>
  <button type="button" data-plan-month-bulk aria-haspopup="dialog">${planActionIcon('month')}<span>پلان‌ریزی ماهانه</span></button>
  <button type="button" ${active(daily)} data-plan-daily>${planActionIcon('day')}<span>پلان‌ریزی روزانه</span></button>
  <button type="button" ${active(routineReport)} data-plan-progress>${planActionIcon('routineReport')}<span>گزارش فعالیت‌های روتین</span></button>
  <button type="button" ${active(tab==='reports')} data-action="reports">${planActionIcon('allReport')}<span>گزارش کل فعالیت‌ها</span></button>
 </div>`;
}
function recoveryResume(){
 if(state.sleepStart!==undefined){sleepForm(null,true,true);return;}if(state.pendingSegment){namePendingSegment();return;}if(state.day)return;
 const data=recoverySummary();if(data.missing<1){if(startLiveDay(Date.now())){state.day.resumed=true;state.lastQuickWakeDay=planDayKey();recoveryClaimGaps(state,data.day.start,Date.now());save();render();}return;}pastTimeForm({resumeAfter:true});
}
function pastTimeForm(options={}){
 const index=options.index??null,old=index===null?null:state.history[index],oldSleep=options.sleepId?(state.sleeps||[]).find(s=>s.id===options.sleepId):null,pending=options.pending;
 if(pending&&state.pendingSegment!==pending)return;
 const initialDay=journalBounds(old?.start??oldSleep?.start??options.selectedDay?.start??pending?.start??Date.now()),gap=options.chosenGap||recoveryGaps(initialDay)[0]||{start:Math.min(initialDay.end,Date.now()),end:Math.min(initialDay.end,Date.now())},source=old||oldSleep||pending||gap;
 const from=source.start,to=source.durationOnly?gap.end:source.end,mode=source.durationOnly?'duration':'range',kind=oldSleep?'sleep':old?.unknown?'unknown':'activity',duration=source.durationOnly?source.durationMs/60000:Math.max(1,Math.round((to-from)/60000)),resume=!!options.resumeAfter;
 const dateFields=pending?`<p class="recovery-window">${date(from)} تا ${localTime(to)}</p>`:journalDateFields(initialDay.start);
 const fields=`${resume?'<p class="recovery-lead">از آخرین ثبت تا الان حدوداً چه کار کردید؟ بخش فراموش‌شده می‌تواند نامشخص بماند.</p>':''}${dateFields}<div id="recovery-activity-fields">${activityInput(oldSleep?'خواب':old?.name||'')}</div><div class="journal-mode" role="group" aria-label="روش ثبت زمان"><label><input type="radio" name="entryMode" value="range" ${mode==='range'?'checked':''}>از ساعت تا ساعت</label><label><input type="radio" name="entryMode" value="duration" ${mode==='duration'?'checked':''}>فقط مدت</label></div><div id="journal-range"><div class="journal-time-fields"><label>از ساعت<input type="time" name="fromTime" value="${journalTime(from)}"></label><label>تا ساعت<input type="time" name="toTime" value="${journalTime(to)}"></label></div><label class="check"><input type="checkbox" name="endOfDay" ${to===initialDay.end?'checked':''}>تا پایان روز (۲۴:۰۰)</label></div><div id="journal-duration"><div class="recovery-duration-fields"><label>مدت به دقیقه<input type="number" name="durationMinutes" min="1" max="1500" step="1" value="${duration}"></label><label>انتخاب ساعت و دقیقه<input type="time" name="durationClock" value="${String(Math.min(23,Math.floor(duration/60))).padStart(2,'0')}:${String(duration%60).padStart(2,'0')}"></label></div><small>در «فقط مدت»، ساعت شروع و پایان فرضی ساخته نمی‌شود.</small></div><label class="check recovery-approx"><input type="checkbox" name="approximate" ${source.approximate?'checked':''}>زمان تقریبی است</label>${resume?'<label class="check recovery-resume"><input type="checkbox" name="resumeNow" checked>باقی زمان نامشخص؛ ادامه از همین الان</label><button type="button" class="small" data-recovery-unknown-now>یادم نیست؛ شروع از همین الان</button>':''}<p id="recovery-error" role="alert" hidden></p>${old?`<button type="button" class="small danger" data-delete-history="${index}">حذف ثبت</button>`:''}`;
 let skipToNow=false;
 const opened=modal(pending?'تا الان حدوداً چه کار کردید؟':oldSleep?'ویرایش مدت خواب':old?'ویرایش ثبت فعالیت':resume?'ادامه از همین الان':'ثبت زمان گذشته',fields,f=>{
  const fail=message=>{const error=$('#recovery-error');error.textContent=message;error.hidden=false;error.scrollIntoView({block:'nearest'});return false;};
  if(skipToNow){skipToNow=false;const now=Date.now(),day=journalBounds(now);if(state.day||state.pendingSegment||state.sleepStart!==undefined)return fail('ابتدا خواب یا فعالیت جاری را تمام کنید.');const next={...state,history:state.history.map(h=>({...h})),unassigned:(state.unassigned||[]).map(g=>({...g}))};recoveryFillUnknown(next,day,now);next.day={start:now,segment:now,activity:'فعالیت جاری',resumed:true};next.lastQuickWakeDay=planDayKey(now);try{validate(next);}catch{return fail('اطلاعات روز با هم سازگار نیست؛ ثبت‌های قبلی را بررسی کنید.');}state=next;historyOffset=0;return true;}
  if(pending&&state.pendingSegment!==pending)return fail('فعالیت جاری تغییر کرده است؛ پنجره را دوباره باز کنید.');
  if(old&&state.history[index]!==old||oldSleep&&!(state.sleeps||[]).includes(oldSleep))return fail('این ثبت تغییر کرده است؛ پنجره را دوباره باز کنید.');
  const chosen=pending?new Date(initialDay.start):persianToLocal(f.get('jyear'),f.get('jmonth'),f.get('jday')),now=Date.now();if(!chosen)return fail('تاریخ معتبر انتخاب کنید.');const day=journalBounds(chosen);
  if(day.start>now)return fail('ثبت زمان برای آینده ممکن نیست.');if(resume&&day.start!==journalBounds(now).start)return fail('برای ادامه از همین الان، تاریخ امروز را انتخاب کنید.');
  const rawName=String(f.get('name')||'').replace(/\s+/g,' ').trim(),type=recoveryKindForName(rawName),name=type==='unknown'?'نامشخص':type==='sleep'?'خواب':rawName;if(!name)return fail('نام فعالیت را انتخاب یا وارد کنید.');
  const durationOnly=f.get('entryMode')==='duration',approximate=!!f.get('approximate');let start,end,ms;
  if(durationOnly){const minutes=Number(asciiDigits(f.get('durationMinutes')));if(!Number.isInteger(minutes)||minutes<1||minutes>1500)return fail('مدت باید تعداد دقیقهٔ صحیح و مثبت باشد.');ms=minutes*60000;start=pending?pending.start:day.start;end=start;}
  else{start=journalParseTime(f.get('fromTime'),day);end=f.get('endOfDay')?day.end:journalParseTime(f.get('toTime'),day);if((old||oldSleep||pending)&&day.start===initialDay.start&&f.get('fromTime')===journalTime(from))start=from;if((old||oldSleep||pending)&&day.start===initialDay.start&&Boolean(f.get('endOfDay'))===(to===initialDay.end)&&(f.get('endOfDay')||f.get('toTime')===journalTime(to)))end=to;if(start===null||end===null||end<=start||end>now)return fail('بازهٔ گذشته و معتبر انتخاب کنید؛ پایان باید پس از شروع باشد.');ms=end-start;}
  if(pending&&(day.start!==initialDay.start||durationOnly&&ms>pending.end-pending.start||!durationOnly&&(start<pending.start||end>pending.end)))return fail('ثبت باید داخل زمان همین فعالیت جاری باشد.');
  const next={...state,history:state.history.map(h=>({...h})),sleeps:(state.sleeps||[]).map(s=>({...s})),unassigned:(state.unassigned||[]).map(g=>({...g})),day:state.day?{...state.day}:null};
  if(old)next.history.splice(index,1);if(oldSleep)next.sleeps=next.sleeps.filter(s=>s.id!==oldSleep.id);
  if(pending){delete next.pendingSegment;if(pending.ending&&!pending.detached)next.day=null;}
  if(old?.unknown&&type!=='unknown'){
   const oldMs=old.durationOnly?old.durationMs:old.end-old.start;if(ms>oldMs)return fail('مدت جایگزین از زمان نامشخص انتخاب‌شده بیشتر است.');
   if(old.durationOnly||durationOnly){if(oldMs>ms)next.history.push(recoveryUnknown(old.start,old.start+oldMs-ms,true));}
   else {if(start<old.start||end>old.end)return fail('بازه باید داخل ثبت نامشخص انتخاب‌شده باشد.');next.history.push({...old});}
  }
  if(!durationOnly){
   if(next.history.some(h=>!h.durationOnly&&!h.unknown&&h.start<end&&h.end>start)||sleepOverlap(start,end,next)||next.pendingSegment&&next.pendingSegment.start<end&&next.pendingSegment.end>start)return fail('این بازه با فعالیت یا خواب دیگری هم‌پوشانی دارد؛ همان ثبت را ویرایش کنید.');
   next.history=recoveryClaimUnknown(next.history,start,end);
   if(next.day&&end>next.day.segment&&start<Math.min(now,journalBounds(next.day.segment).end)){
    if(next.day.segment<start)next.unassigned.push({id:uid(),start:next.day.segment,end:start});next.day.segment=end;
   }
   recoveryClaimGaps(next,start,end);
  }
  if(type==='sleep')next.sleeps.push({id:oldSleep?.id||uid(),start,end,createdAt:oldSleep?.createdAt||now,approximate,...(durationOnly?{durationOnly:true,durationMs:ms}:{})});
  else next.history.push({name,start,end,manual:true,recovered:true,approximate,...(type==='unknown'?{unknown:true}:{}),...(durationOnly?{durationOnly:true,durationMs:ms}:{})});
  if(pending&&ms<pending.end-pending.start){if(durationOnly)next.history.push(recoveryUnknown(pending.start,pending.start+(pending.end-pending.start-ms),true));else{if(pending.start<start)next.history.push(recoveryUnknown(pending.start,start));if(end<pending.end)next.history.push(recoveryUnknown(end,pending.end));}}
  if(Math.abs(recoveryTotal(day,next,now)-(Math.min(day.end,now)-day.start))<1)recoveryClaimGaps(next,day.start,Math.min(day.end,now));
  if(recoveryTotal(day,next,now)>Math.min(day.end,now)-day.start+1)return fail('جمع خواب، فعالیت و زمان نامشخص از زمان سپری‌شدهٔ روز بیشتر می‌شود. ثبت نامشخص را برای جایگزین‌کردن ویرایش کنید.');
  if(resume&&f.get('resumeNow')){
   if(next.sleepStart!==undefined||next.day||next.pendingSegment)return fail('ابتدا خواب یا فعالیت جاری را تمام کنید.');recoveryFillUnknown(next,day,now);next.day={start:now,segment:now,activity:'فعالیت جاری',resumed:true};next.lastQuickWakeDay=planDayKey(now);
  }
  try{validate(next);}catch{return fail('این ثبت با اطلاعات روز سازگار نیست؛ زمان‌ها را بررسی کنید.');}
  state=next;if(type==='activity')rememberActivity(name);historyOffset=Math.round((day.start-journalBounds(now).start)/86400000);return true;
 },{cancel:pending?()=>rollbackPending(pending):null});
 if(!opened)return;
 const form=$('#form');form.noValidate=true;$('#dialog').classList.add('recovery-dialog');
 function refresh(event){
  const duration=form.elements.entryMode.value==='duration';
  form.elements.name.required=true;
  $('#journal-range').hidden=duration;$('#journal-duration').hidden=!duration;
  $('#journal-range').querySelectorAll('input,button').forEach(e=>e.disabled=duration);form.elements.toTime.disabled=duration||form.elements.endOfDay.checked;
  $('#journal-duration').querySelectorAll('input,button').forEach(e=>e.disabled=!duration);
  if(event?.target===form.elements.durationClock){const match=/^(\d{2}):(\d{2})$/.exec(form.elements.durationClock.value);if(match)form.elements.durationMinutes.value=+match[1]*60+(+match[2]);}
  if(event?.target===form.elements.durationMinutes){const value=Number(form.elements.durationMinutes.value);if(Number.isFinite(value)&&value>=0&&value<1440)form.elements.durationClock.value=String(Math.floor(value/60)).padStart(2,'0')+':'+String(value%60).padStart(2,'0');}
  $('#recovery-error').hidden=true;
 }
 form.oninput=refresh;form.onchange=refresh;form.querySelector('[data-recovery-unknown-now]')?.addEventListener('click',()=>{skipToNow=true;form.requestSubmit();});
 refresh();if(!pending)updatePersianDate();if(resume)$('#form button[type=submit]').textContent='ثبت و ادامه';if(kind==='activity'&&!resume)focusActivityInput();
}
function handleRecoveryClick(b){if(b.hasAttribute('data-today-plan-report')){planReportMode='day';planReportAnchor=Date.now();planningProgressView=true;tab='planning';render();window.scrollTo(0,0);return true;}if(b.hasAttribute('data-recover-past')){pastTimeForm();return true;}return false;}

function recoveryKindForName(name){const key=normalizeActivity(name);return ['خواب','خوابیدن'].includes(key)?'sleep':['نامشخص','یادم نیست','فراموش کردم'].includes(key)?'unknown':'activity';}
