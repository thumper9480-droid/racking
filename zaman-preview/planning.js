'use strict';
let planningMonth=null,planningSelected=null,planningProgressView=false;
let planningDailyOpen=location.hash==='#planning';
const PLAN_WEEKDAYS=['شنبه','یکشنبه','دوشنبه','سه‌شنبه','چهارشنبه','پنجشنبه','جمعه'];
function planDayKey(value=Date.now()){const d=new Date(value);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
function planDayIsOpen(day){return day>=planDayKey();}
function planBounds(key){const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(key));if(!m)return null;const d=new Date(+m[1],+m[2]-1,+m[3]);if(d.getFullYear()!==+m[1]||d.getMonth()!==+m[2]-1||d.getDate()!==+m[3])return null;const end=new Date(d);end.setDate(end.getDate()+1);return{start:d.getTime(),end:end.getTime()};}
function planJalali(value=Date.now()){const d=new Date(value);return jalaliParts(new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())));}
function planMonthDays(y,m){return m<=6?31:m<=11?30:persianToLocal(y,12,30)?30:29;}
function planHoliday(y,m,d){const list=IRAN_HOLIDAYS.years[y];return list?list.find(h=>h.date===`${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`):IRAN_HOLIDAYS.fixed.find(h=>h.month===m&&h.day===d);}
function validatePlanning(value){validateMonthSelections(value);validatePlannedWakes(value);if(value.dailyPlans!==undefined&&!Array.isArray(value.dailyPlans))throw Error('plans');const ids=new Set(),days=new Set();for(const p of value.dailyPlans||[]){const range=planBounds(p?.day),key=p?.day+'|'+normalizeActivity(p?.name||'');if(!p||!range||typeof p.id!=='string'||!p.id||ids.has(p.id)||typeof p.name!=='string'||!p.name.trim()||days.has(key)||!Number.isInteger(p.count)||p.count<1||p.count>1000||!Number.isInteger(p.minutes)||p.minutes<1||p.minutes>1440||p.minutes*p.count>(range.end-range.start)/60000)throw Error('plan');ids.add(p.id);days.add(key);}}
function planGroup(name){return(state.dailyPlans||[]).filter(p=>normalizeActivity(p.name)===normalizeActivity(name)).sort((a,b)=>a.day.localeCompare(b.day));}
function planAllocation(name,now=Date.now(),value=state){const plans=(value.dailyPlans||[]).filter(p=>normalizeActivity(p.name)===normalizeActivity(name)).sort((a,b)=>a.day.localeCompare(b.day)),allocations=new Map();if(!plans.length)return allocations;const start=planBounds(plans[0].day).start;let total=0;const records=[...value.history,...(normalizeActivity(name)==='خواب'?(value.sleeps||[]).map(s=>({...s,name:'خواب'})):[])];for(const h of records){if(h.unknown||normalizeActivity(h.name)!==normalizeActivity(name))continue;if(h.durationOnly){if(h.start>=start&&h.start<=now)total+=h.durationMs;}else total+=Math.max(0,Math.min(h.end,now)-Math.max(h.start,start));}let remaining=total;for(const p of plans){const target=p.minutes*p.count*60000,assigned=Math.min(remaining,target),done=Math.min(p.count,Math.floor(assigned/(p.minutes*60000)));allocations.set(p.id,{assigned,target,done,complete:done===p.count,total,partial:assigned%(p.minutes*60000)});remaining-=assigned;}return allocations;}
function planProgress(p){return planAllocation(p.name).get(p.id);}
const planMinutes=ms=>fa((ms/60000).toLocaleString('en-US',{maximumFractionDigits:1}));
function planSlots(p,data){return `<div class="plan-slots">${Array.from({length:Math.min(p.count,12)},(_,i)=>`<span class="plan-slot ${i<data.done?'done':i===data.done&&data.partial?'partial':''}" aria-label="نوبت ${fa(i+1)}: ${i<data.done?'انجام شده':'انجام نشده'}">${i<data.done?'✓':i===data.done&&data.partial?planMinutes(data.partial)+'/'+fa(p.minutes):fa(i+1)}</span>`).join('')}${p.count>12?`<small>و ${fa(p.count-12)} نوبت دیگر</small>`:''}</div>`;}
function planCard(p){const data=planProgress(p);return `<article class="plan-card ${data.complete?'is-complete':''}" data-plan-card="${esc(p.id)}"><div class="row"><h3>${data.complete?'✓ ':''}${esc(p.name)}</h3><button type="button" class="small" data-edit-day-plan="${esc(p.id)}" ${planDayIsOpen(p.day)?'':'disabled'}>ویرایش</button></div><p class="plan-target">${fa(p.count)} نوبتِ ${fa(p.minutes)} دقیقه‌ای <b>جمع ${fa(p.count*p.minutes)} دقیقه</b></p>${planSlots(p,data)}<progress value="${data.assigned}" max="${data.target}" aria-label="تکمیل سهم این روز"></progress><p class="plan-foot">${planMinutes(data.assigned)} از ${planMinutes(data.target)} دقیقه · ${fa(data.done)} از ${fa(p.count)} نوبت${data.complete&&p.day>planDayKey()?' · پیشاپیش تکمیل شده':''}</p></article>`;}
function selectedDayPanel(){const day=planningSelected||planDayKey(),range=planBounds(day),plans=(state.dailyPlans||[]).filter(p=>p.day===day),target=plans.reduce((s,p)=>s+p.count*p.minutes,0),editable=planDayIsOpen(day);return `<section class="selected-plan-day"><div class="row"><h3>${new Date(range.start).toLocaleDateString('fa-IR',{weekday:'long',month:'long',day:'numeric'})}</h3><button type="button" class="primary small" data-add-day-plan ${editable?'':'disabled'}>＋ فعالیت این روز</button></div><p class="selected-day-total">جمع برنامهٔ این روز: <b>${fa(target)} دقیقه</b></p>${plans.map(planCard).join('')||(editable?'<p class="plan-empty">این روز را انتخاب کرده‌اید؛ فعالیت، تعداد نوبت و دقیقهٔ هر نوبت را مشخص کنید.</p>':'<p class="plan-empty">تعیین فعالیت روتین برای روزهای گذشته بسته است.</p>')}</section>`;}
function planActionIcon(kind){
 const paths={
  add:'M12 5v14M5 12h14',
  month:'M7 3v4m10-4v4M3 9h18M7 13h2m3 0h2m3 0h1M7 17h2m3 0h2m3 0h1',
  day:'M7 3v4m10-4v4M3 9h18m-11 5 2-1v5',
  routineReport:'M7 3v4m10-4v4M3 9h18m-13 6 2 2 5-5',
  allReport:'M3 20h18M7 17v-4m5 4V8m5 9V4'
 };
 const calendar=['allReport','add'].includes(kind)?'':'<rect x="3" y="5" width="18" height="16" rx="2"/>';
 return `<svg class="planning-control-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${calendar}<path d="${paths[kind]}"/></svg>`;
}
function planningPage(){
 if(!planningProgressView)return activitiesPage();
 return planningProgressPage();
}
function activitySelect(name=''){return `<label>فعالیت<select name="planActivity" required><option value="">فعالیت را انتخاب کنید</option>${activityCatalog().map(a=>`<option value="${esc(a.name)}" ${normalizeActivity(a.name)===normalizeActivity(name)?'selected':''}>${esc(a.name)}</option>`).join('')}</select></label>`;}
function upsertDayPlan(day,name,count,minutes){if(!planDayIsOpen(day))return;state.dailyPlans??=[];const old=state.dailyPlans.find(p=>p.day===day&&normalizeActivity(p.name)===normalizeActivity(name));const p={id:old?.id||uid(),day,name:rememberActivity(name),count,minutes};if(old)Object.assign(old,p);else state.dailyPlans.push(p);return p;}
function validDayQuota(day,count,minutes){const range=planBounds(day);return range&&Number.isInteger(count)&&count>=1&&count<=1000&&Number.isInteger(minutes)&&minutes>=1&&minutes<=1440&&count*minutes<=(range.end-range.start)/60000;}
function handlePlanningClick(b){
 if(b.dataset.planReportMode){if(['day','week','month'].includes(b.dataset.planReportMode)){planReportMode=b.dataset.planReportMode;render();}return true;}

 if(b.dataset.planReportStep){const range=reportRange(planReportMode,planReportAnchor??Date.now()),step=Number(b.dataset.planReportStep);planReportAnchor=step<0?reportRange(planReportMode,range.start-1).start:range.end;render();return true;}
 
 if(b.hasAttribute('data-plan-progress')){planningProgressView=true;tab='planning';render();window.scrollTo(0,0);return true;}
 if(b.hasAttribute('data-plan-month-bulk')){monthlyPlanForm();return true;}
 return false;
}
function tickPlanning(){}
function planProgressPercent(assigned,target){return target?Math.min(100,Math.floor(assigned/target*1000)/10):0;}
function planRing(assigned,target,label){
 const percent=planProgressPercent(assigned,target);
 return `<div class="progress-ring ${target&&assigned>=target?'complete':''}" style="--ring-progress:${percent}%" role="progressbar" aria-label="${esc(label)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percent}"><span>${fa(percent)}٪</span></div>`;
}

function validatePlannedWakes(value){if(value.plannedWakes!==undefined&&!Array.isArray(value.plannedWakes))throw Error('wake plans');const days=new Set(),ids=new Set();for(const w of value.plannedWakes||[]){const range=planBounds(w?.day);if(!range||typeof w.id!=='string'||!w.id||ids.has(w.id)||days.has(w.day)||!Number.isFinite(w.at)||w.at<range.start||w.at>=range.end)throw Error('wake plan');days.add(w.day);ids.add(w.id);}}
function savePlannedWake(day,at){state.plannedWakes??=[];const old=state.plannedWakes.find(w=>w.day===day);if(at===null){if(old){state.plannedWakes=state.plannedWakes.filter(w=>w.id!==old.id);state.alarms=state.alarms.filter(a=>a.plannedWakeId!==old.id);}return;}const w=old||{id:uid(),day,at};w.at=at;if(!old)state.plannedWakes.push(w);const existing=state.alarms.find(a=>a.plannedWakeId===w.id);if(existing?.at===at)return;const alarm={id:existing?.id||uid(),plannedWakeId:w.id,title:'بیدارباش '+new Date(at).toLocaleDateString('fa-IR',{weekday:'long',month:'long',day:'numeric'}),at,repeat:'none',projectId:'',enabled:at>Date.now()};if(existing)Object.assign(existing,alarm);else state.alarms.push(alarm);}
// Persist deliberate unchecked dates; only new monthly templates start fully selected.
function validateMonthSelections(value){
 const formatter=new Intl.DateTimeFormat('en-US-u-ca-persian',{year:'numeric',month:'numeric'});
 for(const field of ['planMonthSelections','wakeMonthSelections']){
  if(value[field]===undefined)continue;if(!Array.isArray(value[field]))throw Error('month choices');const ids=new Set();
  for(const item of value[field]){
   const named=field==='planMonthSelections',match=/^(\d{4})-(0[1-9]|1[0-2])$/.exec(item?.month||'');
   if(!match||named&&(typeof item.name!=='string'||!item.name.trim())||!Array.isArray(item.days)||item.days.length>31)throw Error('month choice');
   const id=item.month+'|'+(named?normalizeActivity(item.name):'');if(ids.has(id))throw Error('duplicate month choice');ids.add(id);const dates=new Set();
   for(const day of item.days){const range=planBounds(day);if(!range||dates.has(day))throw Error('month day');const parts=formatter.formatToParts(new Date(range.start)),get=type=>Number(parts.find(p=>p.type===type).value);if(get('year')!==+match[1]||get('month')!==+match[2])throw Error('month day');dates.add(day);}
  }
 }
}
function storeMonthSelection(field,month,days,name){
 state[field]??=[];const old=state[field].find(x=>x.month===month&&(name===undefined||normalizeActivity(x.name)===normalizeActivity(name))),item={month,days};if(name!==undefined)item.name=name;if(old)Object.assign(old,item);else state[field].push(item);
}
function previousPlanDay(day){
 const date=new Date(planBounds(day).start);
 date.setDate(date.getDate()-1);
 return planDayKey(date);
}
function earlierWakeTime(time,offset){
 const match=/^([01]\d|2[0-3]):([0-5]\d)$/.exec(time||'');
 if(!match)return '';
 const total=Number(match[1])*60+Number(match[2])-offset;
 if(total<0)return '';
 return String(Math.floor(total/60)).padStart(2,'0')+':'+String(total%60).padStart(2,'0');
}
function monthlyPlanForm(){
 const current=planJalali(),currentYear=current.year;
 const year=planningMonth?.year>=currentYear?planningMonth.year:currentYear;
 const firstMonth=year===currentYear?current.month:1;
 const month=Math.max(firstMonth,planningMonth?.year===year?planningMonth.month:firstMonth);
 const monthKey=year+'-'+String(month).padStart(2,'0'),days=planMonthDays(year,month),drafts=new Map();
 let currentName='',unnamedDraft=null,dirtyRows=false;
 const monthPicker=`<div class="monthly-period-picker">
  <label>ماه<select name="monthlyPlanMonth">${monthNames.slice(firstMonth-1).map((name,index)=>{const value=firstMonth+index;return `<option value="${value}" ${value===month?'selected':''}>${name}</option>`;}).join('')}</select></label>
  <label>سال<select name="monthlyPlanYear">${Array.from({length:4},(_,i)=>currentYear+i).map(value=>`<option value="${value}" ${value===year?'selected':''}>${fa(value)}</option>`).join('')}</select></label>
 </div>`;
 const wakeChoice=(state.wakeMonthSelections||[]).find(x=>x.month===monthKey),monthWakes=(state.plannedWakes||[]).filter(w=>{const p=planJalali(planBounds(w.day).start);return p.year===year&&p.month===month;});
 const wakeOffsets=[5,10,15,30],knownWakeDays=new Set(monthWakes.map(w=>w.day)),editedWakeDays=new Set();
 const visibleDays=Array.from({length:days},(_,i)=>{
  const d=i+1,date=persianToLocal(year,month,d);
  return {d,date,day:planDayKey(date)};
 }).filter(({day})=>planDayIsOpen(day));
 const rows=visibleDays.map(({d,date,day},index)=>{
  const w=monthWakes.find(w=>w.day===day),holiday=planHoliday(year,month,d),on=wakeChoice?wakeChoice.days.includes(day):monthWakes.length?!!w:true;
  const previous=index>0;
  return `<div class="month-plan-row" data-month-day="${day}">
   <label class="check month-day-label ${holiday?'official-holiday':''}"><input type="checkbox" data-month-goal checked><span><b>${PLAN_WEEKDAYS[(date.getDay()+1)%7]}</b><small>${fa(d)} ${monthNames[month-1]} ماه</small></span></label>
   <output data-month-total>۰ دقیقه</output>
   <div class="month-wake"><div class="month-wake-fields">
    <label class="check"><input type="checkbox" data-month-wake ${on?'checked':''}>بیدارباش</label>
    <input type="time" name="wakeTime${d}" data-month-time aria-label="ساعت بیدارباش ${fa(d)} ${monthNames[month-1]}" aria-describedby="wake-saved-${d}" value="${journalTime(w?.at??new Date(planBounds(day).start).setHours(9,0,0,0))}" ${on?'':'disabled'}>
   </div><small class="month-wake-saved" id="wake-saved-${d}" data-month-wake-saved hidden>از قبل تنظیم شده</small></div>
   <div class="month-quota-inputs">
    <label>نوبت<input type="number" readonly inputmode="none" min="0" max="1000" value="0" data-month-count></label>
    <label>دقیقه<input type="number" readonly inputmode="none" min="0" max="1440" value="0" data-month-minutes></label>
   </div>
   ${previous?`<div class="month-wake-offsets" role="group" aria-label="بیدارباش زودتر از روز قبل">${wakeOffsets.map(offset=>`<button type="button" data-month-wake-offset="${offset}" aria-label="${fa(offset)} دقیقه زودتر از بیدارباش روز قبل">${fa(offset)}−</button>`).join('')}</div>`:''}
   <div class="month-quota-actions"><button type="button" data-month-step="1" aria-label="افزایش نوبت">+</button><button type="button" data-month-step="-1" aria-label="کاهش نوبت">−</button></div>
   ${previous?'<button type="button" class="month-copy-wake" data-month-wake-copy aria-label="کپی ساعت بیدارباش روز قبل">مثل روز قبل</button><button type="button" class="month-copy-quota" data-month-copy aria-label="کپی نوبت و دقیقهٔ روز قبل">مثل روز قبل</button>':''}
   <small class="month-wake-status" data-month-wake-status hidden></small><p class="month-row-error" data-month-error hidden></p>
  </div>`;
 }).join('');
 const opened=modal('پلان‌ریزی ماهانه برای '+monthNames[month-1]+' '+fa(year),`${monthPicker}${activitySelect().replace(' required','')}<details class="monthly-new-activity"><summary>+ فعالیت روتین جدید</summary><label>نام فعالیت<input type="text" maxlength="100" data-month-new-name></label><button type="button" class="small" data-month-new-activity>افزودن</button></details><p class="plan-help">روزهای ناخواسته را خاموش کنید. دکمه‌های کنار بیدارباش، ساعت را نسبت به بیدارباش روز قبل جلو می‌آورند. زنگ وب به بازبودن صفحه وابسته است.</p><p id="month-plan-error" class="month-form-error" role="alert" hidden></p><div class="month-total-heading"><span>جمع ماه برای فعالیت انتخاب‌شده</span><output id="month-plan-total">۰ دقیقه</output></div><div class="monthly-select-all"><input type="checkbox" id="month-select-all" aria-label="تیک همهٔ روزهای قابل برنامه‌ریزی"></div><div class="month-plan-scroll" role="region" aria-label="امروز و روزهای آیندهٔ ماه" tabindex="0">${rows||'<p class="plan-empty">در این ماه روزی برای برنامه‌ریزی باقی نمانده است.</p>'}</div>`,()=>{
  if(!rows)return false;
  clearErrors();capture();
  if(!select.value&&unnamedDraft?.some(x=>x.on&&planDayIsOpen(x.day)&&(x.count!==0||x.minutes!==0)))return fail('ابتدا فعالیت را از بالای پنجره انتخاب کنید.',null,select);
  const changes=[];
  for(const[name,items]of drafts)for(const item of items){
   if(!planDayIsOpen(item.day))continue;
   const hasQuota=item.count!==0||item.minutes!==0;
   if(item.on&&hasQuota&&!validDayQuota(item.day,item.count,item.minutes)){
    select.value=name;load(name);const row=form.querySelector(`[data-month-day="${item.day}"]`);return fail('تعداد نوبت و دقیقه باید عدد صحیح و مثبت باشند و جمع در یک روز جا شود.',row,row.querySelector('[data-month-count]'));
   }
   changes.push({...item,on:item.on&&hasQuota,name});
  }
  const wakes=[];
  for(const row of form.querySelectorAll('[data-month-day]')){
   const day=row.dataset.monthDay,on=row.querySelector('[data-month-wake]').checked;let at=null;
   if(!planDayIsOpen(day))continue;
   if(on){at=journalParseTime(row.querySelector('[data-month-time]').value,planBounds(day));if(at===null)return fail('ساعت بیدارباش را به صورت ۲۴ساعته انتخاب کنید.',row,row.querySelector('[data-month-time]'));}
   wakes.push({day,at});
  }
  for(const c of changes){if(c.on)upsertDayPlan(c.day,c.name,c.count,c.minutes);else state.dailyPlans=(state.dailyPlans||[]).filter(p=>!(p.day===c.day&&normalizeActivity(p.name)===normalizeActivity(c.name)));}
  for(const [name,items] of drafts){
   const previous=(state.planMonthSelections||[]).find(x=>x.month===monthKey&&normalizeActivity(x.name)===normalizeActivity(name));
   const past=previous?.days.filter(day=>!planDayIsOpen(day))??items.filter(x=>!planDayIsOpen(x.day)&&x.on).map(x=>x.day);
   storeMonthSelection('planMonthSelections',monthKey,[...past,...items.filter(x=>planDayIsOpen(x.day)&&x.on).map(x=>x.day)],name);
  }
  const pastWakes=(wakeChoice?.days??monthWakes.map(w=>w.day)).filter(day=>!planDayIsOpen(day));
  for(const w of wakes)savePlannedWake(w.day,w.at);
  storeMonthSelection('wakeMonthSelections',monthKey,[...pastWakes,...wakes.filter(w=>w.at!==null).map(w=>w.day)]);
  return true;
 });
 if(!opened)return;
 const dialog=document.querySelector('#dialog');dialog.classList.add('monthly-plan-dialog');const form=document.querySelector('#form'),select=form.querySelector('[name=planActivity]');form.noValidate=true;
 if(!rows)form.querySelector('[type=submit]').disabled=true;
 function clearErrors(){form.querySelector('#month-plan-error').hidden=true;form.querySelectorAll('[data-month-error]').forEach(e=>e.hidden=true);form.querySelectorAll('[aria-invalid]').forEach(e=>e.removeAttribute('aria-invalid'));}
 function fail(message,row,input){const error=form.querySelector('#month-plan-error');error.textContent=(row?row.querySelector('.month-day-label').innerText.replace(/\s+/g,' ')+': ':'')+message;error.hidden=false;if(row){const local=row.querySelector('[data-month-error]');local.textContent=message;local.hidden=false;row.scrollIntoView({block:'nearest'});}input?.setAttribute('aria-invalid','true');input?.focus({preventScroll:true});return false;}
 function capture(){const items=Array.from(form.querySelectorAll('[data-month-day]'),row=>({day:row.dataset.monthDay,on:row.querySelector('[data-month-goal]').checked,count:Number(row.querySelector('[data-month-count]').value),minutes:Number(row.querySelector('[data-month-minutes]').value)}));if(!currentName)unnamedDraft=items;else drafts.set(currentName,items);}
 function load(name){
  currentName=name;const cached=drafts.get(name),choice=(state.planMonthSelections||[]).find(x=>x.month===monthKey&&normalizeActivity(x.name)===normalizeActivity(name)),savedPlans=(state.dailyPlans||[]).filter(p=>normalizeActivity(p.name)===normalizeActivity(name)&&planJalali(planBounds(p.day).start).year===year&&planJalali(planBounds(p.day).start).month===month);
  for(const row of form.querySelectorAll('[data-month-day]')){
   const day=row.dataset.monthDay,old=cached?.find(x=>x.day===day),saved=savedPlans.find(p=>p.day===day),initial=!choice&&!savedPlans.length?unnamedDraft?.find(x=>x.day===day):null;
   const goal=row.querySelector('[data-month-goal]');
   goal.disabled=!planDayIsOpen(day);
   goal.checked=goal.disabled?!!saved:old?old.on:choice?choice.days.includes(day):savedPlans.length?!!saved:initial?initial.on:true;
   row.querySelector('[data-month-count]').value=old?.count??saved?.count??initial?.count??0;row.querySelector('[data-month-minutes]').value=old?.minutes??saved?.minutes??initial?.minutes??0;
  }
  refreshMonthlyForm();
 }
 const monthRows=new Map(Array.from(form.querySelectorAll('[data-month-day]'),row=>[row.dataset.monthDay,row]));
 function previousQuota(row){
  const day=previousPlanDay(row.dataset.monthDay),previous=monthRows.get(day);
  if(!previous?.querySelector('[data-month-goal]').checked)return null;
  const count=Number(previous.querySelector('[data-month-count]').value),minutes=Number(previous.querySelector('[data-month-minutes]').value);
  return validDayQuota(day,count,minutes)?{count,minutes}:null;
 }
 function previousWake(row){
  const previous=monthRows.get(previousPlanDay(row.dataset.monthDay));
  return previous?.querySelector('[data-month-wake]').checked?previous.querySelector('[data-month-time]').value:'';
 }
 function refreshMonthlyForm(){
  refreshMonthlyTotals();
  for(const row of monthRows.values()){
   const open=planDayIsOpen(row.dataset.monthDay),count=row.querySelector('[data-month-count]'),minutes=row.querySelector('[data-month-minutes]');
   const target=row.dataset.monthQuota==='minutes'?minutes:count;
   const label=target===minutes?'دقیقه':'نوبت';
   for(const button of row.querySelectorAll('[data-month-step]')){
    const up=Number(button.dataset.monthStep)>0;
    button.setAttribute('aria-label',(up?'افزایش ':'کاهش ')+label);
    button.disabled=!open||target.disabled||(up?Number(target.value)>=Number(target.max):Number(target.value)<=0);
   }
   const quotaCopy=row.querySelector('[data-month-copy]'),wakeCopy=row.querySelector('[data-month-wake-copy]');
   if(quotaCopy)quotaCopy.disabled=!open||!previousQuota(row);
   const wake=row.querySelector('[data-month-time]');
   const existing=knownWakeDays.has(row.dataset.monthDay)&&row.querySelector('[data-month-wake]').checked&&!!earlierWakeTime(wake.value,0);
   wake.classList.toggle('is-wake-preset',existing);
   row.querySelector('[data-month-wake-saved]').hidden=!existing;
   const time=previousWake(row);
   if(wakeCopy)wakeCopy.disabled=!open||!earlierWakeTime(time,0);
   for(const button of row.querySelectorAll('[data-month-wake-offset]')){
    button.disabled=!open||!earlierWakeTime(time,Number(button.dataset.monthWakeOffset));
   }
  }
 }
 const scroll=form.querySelector('.month-plan-scroll');
 scroll.addEventListener('focusin',event=>{
  const field=event.target;
  if(!field.matches('[data-month-count],[data-month-minutes]'))return;
  const row=field.closest('[data-month-day]');
  row.dataset.monthQuota=field.hasAttribute('data-month-minutes')?'minutes':'count';
  refreshMonthlyForm();
 });
 scroll.addEventListener('click',event=>{
  const button=event.target.closest('button[data-month-step],button[data-month-copy],button[data-month-wake-copy],button[data-month-wake-offset]');
  if(!button||button.disabled)return;
  const row=button.closest('[data-month-day]');
  if(!planDayIsOpen(row.dataset.monthDay))return;
  const count=row.querySelector('[data-month-count]'),minutes=row.querySelector('[data-month-minutes]');
  if(button.hasAttribute('data-month-step')){
   const target=row.dataset.monthQuota==='minutes'?minutes:count;
   target.value=Math.max(0,Math.min(Number(target.max),Number(target.value)+Number(button.dataset.monthStep)));
  }else if(button.hasAttribute('data-month-copy')){
   const previous=previousQuota(row);
   if(!previous)return;
   row.querySelector('[data-month-goal]').checked=true;
   count.value=previous.count;
   minutes.value=previous.minutes;
  }else{
   const time=earlierWakeTime(previousWake(row),Number(button.dataset.monthWakeOffset||0));
   if(!time)return;
   row.querySelector('[data-month-wake]').checked=true;
   const input=row.querySelector('[data-month-time]');
   input.value=time;
   input.dispatchEvent(new Event('input',{bubbles:true}));
  }
  dirtyRows=true;
  clearErrors();
  refreshMonthlyForm();
 });
 const monthSelect=form.elements.monthlyPlanMonth,yearSelect=form.elements.monthlyPlanYear;
 function changePeriod(event){
  const nextYear=Number(yearSelect.value),nextMonthFloor=nextYear===currentYear?current.month:1;
  const nextMonth=Math.max(nextMonthFloor,Number(monthSelect.value)),field=event.currentTarget.name;
  if(nextMonth===month&&nextYear===year)return;
  if(!Number.isInteger(nextMonth)||nextMonth<nextMonthFloor||nextMonth>12||!Number.isInteger(nextYear)||nextYear<currentYear||nextYear>currentYear+3){
   monthSelect.value=String(month);yearSelect.value=String(year);return;
  }
  if(dirtyRows&&!confirm('تغییرات این ماه هنوز ذخیره نشده‌اند. ماه را عوض کنیم؟')){
   monthSelect.value=String(month);yearSelect.value=String(year);return;
  }
  planningMonth={year:nextYear,month:nextMonth};
  planningSelected=planDayKey(persianToLocal(nextYear,nextMonth,1));
  dismissModal();render();monthlyPlanForm();
  document.querySelector('#dialog[open] #form')?.elements[field]?.focus({preventScroll:true});
 }
 monthSelect.onchange=changePeriod;yearSelect.onchange=changePeriod;
 form.querySelector('[data-month-new-activity]').onclick=()=>{
  const field=form.querySelector('[data-month-new-name]'),value=field.value.trim();
  if(!value){field.focus();return;}
  if(activityCatalog(true).some(item=>normalizeActivity(item.name)===normalizeActivity(value))){toast('این فعالیت از قبل وجود دارد.');return;}
  const name=rememberActivity(value);
  save();
  select.add(new Option(name,name));select.value=name;select.onchange();
  field.value='';form.querySelector('.monthly-new-activity').open=false;
 };
 const selectAll=form.querySelector('#month-select-all');
 selectAll.onchange=()=>{
  for(const toggle of form.querySelectorAll('[data-month-goal]:not(:disabled)'))toggle.checked=selectAll.checked;
  dirtyRows=true;clearErrors();refreshMonthlyForm();
 };
 select.onchange=()=>{
  capture();
  for(const day of editedWakeDays){
   const row=monthRows.get(day);
   if(row.querySelector('[data-month-wake]').checked&&earlierWakeTime(row.querySelector('[data-month-time]').value,0))knownWakeDays.add(day);
   else knownWakeDays.delete(day);
  }
  editedWakeDays.clear();
  clearErrors();
  load(select.value);
 };
 form.oninput=event=>{
  const row=event.target.closest('[data-month-day]');
  if(!row)return;
  if(event.target.matches('[data-month-time],[data-month-wake]'))editedWakeDays.add(row.dataset.monthDay);
  dirtyRows=true;
  clearErrors();
  refreshMonthlyForm();
 };
 // Time values remain on the row; expand only the active wheel, then restore the compact row.
 form.querySelectorAll('.shared-time-picker').forEach(picker=>{const close=document.createElement('button');close.type='button';close.className='month-time-done';close.textContent='تأیید ساعت';close.onclick=()=>{picker.hidden=true;picker.parentElement.querySelector('input').setAttribute('aria-expanded','false');picker.parentElement.querySelector('.time-wheel-toggle').setAttribute('aria-expanded','false');};picker.append(close);});load('');
}
function enableMonthNumberSwipe(field){
 let gesture=null,skipClick=false;
 field.addEventListener('pointerdown',event=>{
  skipClick=false;
  if(event.pointerType!=='touch'||field.disabled||!event.isPrimary)return;
  gesture={id:event.pointerId,x:event.clientX,y:event.clientY,value:Number(field.value)||0,moved:false};
 });
 field.addEventListener('pointermove',event=>{
  if(!gesture||event.pointerId!==gesture.id)return;
  const dy=gesture.y-event.clientY;
  if(!gesture.moved&&Math.abs(dy)<Math.max(12,Math.abs(event.clientX-gesture.x)))return;
  gesture.moved=true;event.preventDefault();
  const value=Math.max(0,Math.min(Number(field.max),gesture.value+Math.trunc(dy/12)));
  if(field.value!==String(value)){field.value=String(value);field.dispatchEvent(new Event('input',{bubbles:true}));}
 },{passive:false});
 field.addEventListener('pointerup',event=>{
  if(!gesture||event.pointerId!==gesture.id)return;
  skipClick=gesture.moved;gesture=null;
 });
 field.addEventListener('pointercancel',()=>{gesture=null;skipClick=false;});
 field.addEventListener('click',event=>{
  if(!skipClick)return;
  skipClick=false;event.preventDefault();
 },true);
}
function refreshMonthlyTotals(){
 let sum=0,eligible=0,checked=0;
 for(const row of document.querySelectorAll('[data-month-day]')){
  const goal=row.querySelector('[data-month-goal]'),on=goal.checked,count=row.querySelector('[data-month-count]'),minutes=row.querySelector('[data-month-minutes]');count.disabled=!on||goal.disabled;minutes.disabled=!on||goal.disabled;if(!goal.disabled){eligible++;if(on)checked++;}
  const total=on?Number(count.value)*Number(minutes.value):0;row.querySelector('[data-month-total]').textContent=fa(Number.isFinite(total)?total:0)+' دقیقه';sum+=Number.isFinite(total)?total:0;
  const wake=row.querySelector('[data-month-wake]').checked,input=row.querySelector('[data-month-time]');input.disabled=!wake;const control=row.querySelector('.time-picker-control');if(control)control.querySelectorAll('button').forEach(b=>b.disabled=!wake);
  const at=journalParseTime(input.value,planBounds(row.dataset.monthDay)),status=row.querySelector('[data-month-wake-status]');status.textContent=wake&&at!==null&&at<=Date.now()?'گذشته؛ زنگ خاموش':'';status.hidden=!status.textContent;
 }
 const output=document.querySelector('#month-plan-total');if(output)output.textContent=fa(sum)+' دقیقه';
 const master=document.querySelector('#month-select-all');if(master){master.disabled=eligible===0;master.checked=eligible>0&&checked===eligible;master.indeterminate=checked>0&&checked<eligible;}
}
let planReportMode='day',planReportAnchor=null;
function planPeriodTitle(range,mode=planReportMode){
 const j=planJalali(range.start);if(mode==='day')return new Date(range.start).toLocaleDateString('fa-IR',{weekday:'long',year:'numeric',month:'long',day:'numeric'});if(mode==='month')return monthNames[j.month-1]+' '+fa(j.year);
 return new Date(range.start).toLocaleDateString('fa-IR',{month:'long',day:'numeric'})+' تا '+new Date(range.end-1).toLocaleDateString('fa-IR',{month:'long',day:'numeric',year:'numeric'});
}
function planReportData(range){
 const groups=new Map(),allocations=new Map();let assigned=0,target=0;
 for(const p of state.dailyPlans||[]){const day=planBounds(p.day).start;if(day<range.start||day>=range.end)continue;const key=normalizeActivity(p.name);if(!allocations.has(key))allocations.set(key,planAllocation(p.name));const data=allocations.get(key).get(p.id),group=groups.get(key)||{name:p.name,assigned:0,target:0};group.assigned+=data.assigned;group.target+=data.target;groups.set(key,group);assigned+=data.assigned;target+=data.target;}
 return {groups:[...groups.values()],assigned,target};
}
function planReportPeriods(){
 const year=planJalali(planReportAnchor??Date.now()).year,nowYear=planJalali().year,firstYear=Math.min(nowYear-1,year),lastYear=Math.max(nowYear+3,year),items=[],start=reportPersianStart(firstYear,1),end=reportPersianStart(lastYear+1,1);let date=start;
 // Imported dates outside the usual calendar still get a bounded, scrollable selector.
 if(lastYear-firstYear>8){date=reportPersianStart(year-1,1);end.setTime(reportPersianStart(year+2,1).getTime());}
 let lastKey='';while(date<end){const range=reportRange(planReportMode,date),key=planDayKey(range.start);if(key!==lastKey){items.push({at:range.start,key,label:planPeriodTitle(range)});lastKey=key;}const next=new Date(date);if(planReportMode==='month')next.setTime(range.end);else next.setDate(next.getDate()+(planReportMode==='week'?7:1));date=next;}
 return items;
}
function setupPlanReportPeriod(){
 const select=document.querySelector('#plan-report-period');
 if(!select)return;
 select.onchange=()=>{
  planReportAnchor=Number(select.value);
  render();
  document.querySelector('#plan-report-period')?.focus({preventScroll:true});
 };
}

function planReportActivityCard(item){
 const percent=planProgressPercent(item.assigned,item.target);
 return '<article class="routine-report-card" data-plan-report-name="'+esc(item.name)+'"><div class="routine-report-card-heading"><b>'+esc(item.name)+'</b><strong>'+fa(percent)+'٪</strong></div><small>'+planMinutes(item.assigned)+' از '+planMinutes(item.target)+' دقیقه</small><div class="routine-report-bar" role="progressbar" aria-label="'+esc(item.name)+'" aria-valuemin="0" aria-valuemax="100" aria-valuenow="'+percent+'"><span style="width:'+percent+'%"></span></div></article>';
}

function planningProgressPage(){
 const range=reportRange(planReportMode,planReportAnchor??Date.now());
 const data=planReportData(range);
 const periods=planReportPeriods();
 const modes={day:'روزانه',week:'هفتگی',month:'ماهانه'};
 const totalLabel={day:'پیشرفت روز',week:'پیشرفت هفته',month:'پیشرفت ماه'}[planReportMode];
 return '<section class="routine-report"><h2>گزارش فعالیت‌های روتین</h2><div class="plan-report-modes" role="group" aria-label="بازهٔ گزارش فعالیت‌های روتین">'+Object.entries(modes).map(([mode,label])=>'<button type="button" data-plan-report-mode="'+mode+'" aria-pressed="'+(planReportMode===mode)+'" class="'+(planReportMode===mode?'selected':'')+'">'+label+'</button>').join('')+'</div><div class="plan-period-picker"><button type="button" class="small" data-plan-report-step="-1" aria-label="بازهٔ قبل">›</button><span class="routine-period-select"><span aria-hidden="true">'+planActionIcon('month')+'</span><select id="plan-report-period" aria-label="انتخاب بازهٔ گزارش">'+periods.map(period=>'<option value="'+period.at+'" '+(period.at===range.start?'selected':'')+'>'+esc(period.label)+'</option>').join('')+'</select></span><button type="button" class="small" data-plan-report-step="1" aria-label="بازهٔ بعد">‹</button></div><section class="routine-report-summary" data-plan-range-start="'+planDayKey(range.start)+'" data-plan-range-end="'+planDayKey(range.end)+'">'+planRing(data.assigned,data.target,totalLabel)+'<div><b>'+totalLabel+'</b><small>'+planMinutes(data.assigned)+' از '+planMinutes(data.target)+' دقیقه</small></div></section><div class="routine-report-cards">'+(data.groups.length?data.groups.map(planReportActivityCard).join(''):'<p class="plan-empty">در این بازه پلانی ثبت نشده است.</p>')+'</div><p class="plan-help">زمان اضافهٔ هر فعالیت به سهم روزهای بعد همان فعالیت می‌رسد.</p></section>';
}
