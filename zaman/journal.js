'use strict';
// Calendar-day accounting. Duration-only entries deliberately have no invented times.
function journalBounds(value=Date.now()){const d=new Date(value);d.setHours(0,0,0,0);const end=new Date(d);end.setDate(end.getDate()+1);return {start:d.getTime(),end:end.getTime()};}
function journalDuration(entry,range){if(entry.durationOnly)return entry.start>=range.start&&entry.start<range.end?entry.durationMs:0;return Math.max(0,Math.min(entry.end,range.end)-Math.max(entry.start,range.start));}
function journalAddGap(start,end){
 if(end<=start)return;state.unassigned??=[];let parts=[{start,end}];
 for(const occupied of [...state.history.filter(h=>!h.durationOnly),...state.unassigned])parts=parts.flatMap(p=>{if(occupied.end<=p.start||occupied.start>=p.end)return [p];const next=[];if(p.start<occupied.start)next.push({start:p.start,end:occupied.start});if(p.end>occupied.end)next.push({start:occupied.end,end:p.end});return next;});
 for(const part of parts)state.unassigned.push({id:uid(),...part});
}
function journalClaimRange(start,end){state.unassigned=(state.unassigned||[]).flatMap(g=>{if(g.end<=start||g.start>=end)return [g];const parts=[];if(g.start<start)parts.push({...g,end:start});if(g.end>end)parts.push({...g,id:uid(),start:end});return parts;});}
function closeExpiredDay(now=Date.now()){
 if(!state.day)return false;const today=journalBounds(now);if(state.day.start>=today.start&&state.day.segment>=today.start)return false;
 const boundary=journalBounds(Math.min(state.day.segment,today.start-1)).end,pending=state.pendingSegment;
 if(!pending?.ending)journalAddGap(state.day.segment,boundary);
 if(pending)pending.detached=true;
 state.day=null;state.lastDayClosedAt=boundary;save();return true;
}
function journalGapsMarkup(day){const gaps=(state.unassigned||[]).filter(g=>g.end>day.start&&g.start<day.end);return gaps.length?`<div class="journal-gaps">${gaps.map(g=>`<button type="button" class="small" data-fill-gap="${esc(g.id)}">ثبت فعالیت ${localTime(Math.max(g.start,day.start))} تا ${Math.min(g.end,day.end)===day.end?'۲۴:۰۰':localTime(g.end)}</button>`).join('')}</div>`:'';}
function journalLiveEnd(now=Date.now()){return state.day?Math.min(now,journalBounds(state.day.segment).end):now;}
function journalOccupied(day,except=-1,now=Date.now()){
 const ranges=state.history.flatMap((h,i)=>i!==except&&!h.durationOnly&&h.end>day.start&&h.start<day.end?[{start:Math.max(h.start,day.start),end:Math.min(h.end,day.end)}]:[]);
 if(state.day&&!state.pendingSegment?.ending&&state.day.segment<day.end&&journalLiveEnd(now)>day.start)ranges.push({start:Math.max(day.start,state.day.segment),end:Math.min(day.end,journalLiveEnd(now))});
 const pending=state.pendingSegment;if(pending&&pending.start<day.end&&pending.end>day.start)ranges.push({start:Math.max(day.start,pending.start),end:Math.min(day.end,pending.end)});
 return ranges;
}
function journalFirstGap(day,now=Date.now()){
 const limit=Math.min(day.end,now),saved=(state.unassigned||[]).find(g=>g.end>day.start&&g.start<limit);if(saved)return {start:Math.max(day.start,saved.start),end:Math.min(limit,saved.end)};
 let cursor=day.start;for(const range of journalOccupied(day,-1,now).sort((a,b)=>a.start-b.start)){if(range.start>cursor)return {start:cursor,end:Math.min(range.start,limit)};cursor=Math.max(cursor,range.end);}
 return {start:Math.min(cursor,limit),end:limit};
}
function journalTime(value){const d=new Date(value);return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;}
function journalParseTime(value,day){const match=/^(\d{2}):(\d{2})$/.exec(String(value));if(!match||+match[1]>23||+match[2]>59)return null;const d=new Date(day.start);d.setHours(+match[1],+match[2],0,0);return d.getHours()===+match[1]&&d.getMinutes()===+match[2]?d.getTime():null;}
function journalDateFields(value){const d=new Date(value),p=jalaliParts(new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())));return `<div class="persian-date"><label>روز<select name="jday">${Array.from({length:31},(_,i)=>`<option value="${i+1}" ${p.day===i+1?'selected':''}>${fa(i+1)}</option>`).join('')}</select></label><label>ماه<select name="jmonth">${monthNames.map((m,i)=>`<option value="${i+1}" ${p.month===i+1?'selected':''}>${m}</option>`).join('')}</select></label><label>سال<input name="jyear" required inputmode="numeric" maxlength="4" value="${fa(p.year)}"></label></div><p id="weekday-preview" class="weekday-preview"></p>`;}
function journalUpdateMode(){const form=$('#form'),duration=form.elements.entryMode?.value==='duration';if(!form.elements.entryMode)return;$('#journal-range').hidden=duration;$('#journal-duration').hidden=!duration;for(const input of $('#journal-range').querySelectorAll('input'))input.disabled=duration;form.elements.durationMinutes.disabled=!duration;form.elements.durationMinutes.required=duration;form.elements.toTime.disabled=duration||form.elements.endOfDay.checked;}
document.addEventListener('change',event=>{if(['entryMode','endOfDay'].includes(event.target.name))journalUpdateMode();});
function journalTotal(day,except,now){let total=state.history.reduce((sum,h,i)=>sum+(i===except?0:journalDuration(h,day)),0);const pending=state.pendingSegment;if(pending)total+=Math.max(0,Math.min(pending.end,day.end)-Math.max(pending.start,day.start));if(state.day&&!(pending?.ending&&!pending.detached))total+=Math.max(0,Math.min(journalLiveEnd(now),day.end)-Math.max(state.day.segment,day.start));return total;}
function manualHistoryForm(index=null,selectedDay=null,chosenGap=null){
 const old=index===null?null:state.history[index];if(index!==null&&!old)return;
 const initialDay=old?journalBounds(old.start):selectedDay||historyDay(),gap=chosenGap||journalFirstGap(initialDay),from=old&&!old.durationOnly?old.start:gap.start,to=old&&!old.durationOnly?old.end:gap.end;
 const mode=old?.durationOnly?'duration':'range',endOfDay=to===initialDay.end;
 const fields=`${journalDateFields(initialDay.start)}${activityInput(old?.name||'')}<div class="journal-mode" role="group" aria-label="روش ثبت زمان"><label><input type="radio" name="entryMode" value="range" ${mode==='range'?'checked':''}>از ساعت تا ساعت</label><label><input type="radio" name="entryMode" value="duration" ${mode==='duration'?'checked':''}>فقط مدت</label></div><div id="journal-range"><div class="journal-time-fields"><label>از ساعت<input type="time" name="fromTime" required value="${journalTime(from)}"></label><label>تا ساعت<input type="time" name="toTime" required value="${journalTime(to)}"></label></div><label class="check"><input type="checkbox" name="endOfDay" ${endOfDay?'checked':''}>تا پایان روز (۲۴:۰۰)</label></div><div id="journal-duration"><label>مدت به دقیقه<input type="number" name="durationMinutes" min="1" max="1500" step="1" inputmode="numeric" value="${old?.durationOnly?old.durationMs/60000:40}"></label></div>${old?`<button type="button" class="small danger" data-delete-history="${index}">حذف ثبت</button>`:''}`;
 const opened=modal(old?'ویرایش ثبت فعالیت':'ثبت دستی فعالیت',fields,f=>{
  const chosen=persianToLocal(f.get('jyear'),f.get('jmonth'),f.get('jday')),now=Date.now();if(!chosen){toast('تاریخ معتبر وارد کنید.');return false;}
  const day=journalBounds(chosen);if(day.start>now){toast('ثبت فعالیت برای روز آینده ممکن نیست.');return false;}
  const name=String(f.get('name')||'').trim();if(!name)return false;const durationOnly=f.get('entryMode')==='duration';let entry;
  if(durationOnly){const minutes=Number(asciiDigits(f.get('durationMinutes')));if(!Number.isInteger(minutes)||minutes<1||minutes>1500){toast('مدت معتبر به دقیقه وارد کنید.');return false;}const durationMs=minutes*60000;if(journalTotal(day,index,now)+durationMs>Math.min(day.end,now)-day.start+1){toast('مدت ثبت‌ها از زمان سپری‌شدهٔ این روز بیشتر می‌شود.');return false;}entry={name,start:day.start,end:day.start,durationOnly:true,durationMs,manual:true};}
  else{
   let start=journalParseTime(f.get('fromTime'),day),end=f.get('endOfDay')?day.end:journalParseTime(f.get('toTime'),day);
   const unchanged=old&&!old.durationOnly&&day.start===initialDay.start&&f.get('fromTime')===journalTime(old.start)&&Boolean(f.get('endOfDay'))===(old.end===initialDay.end)&&(f.get('endOfDay')||f.get('toTime')===journalTime(old.end));
   if(unchanged){start=old.start;end=old.end;}
   if(start===null||end===null||end<=start||end>now){toast('بازهٔ گذشته و معتبر وارد کنید؛ پایان باید پس از شروع باشد.');return false;}
   if(!unchanged){
    if(state.history.some((h,i)=>i!==index&&!h.durationOnly&&h.end>start&&h.start<end)||state.pendingSegment&&state.pendingSegment.end>start&&state.pendingSegment.start<end){toast('این بازه با ثبت دیگری هم‌پوشانی دارد؛ همان سطر را ویرایش کنید.');return false;}
    const live=state.day&&!state.pendingSegment?.ending&&end>state.day.segment&&start<journalLiveEnd(now),removedLive=live?Math.max(0,Math.min(journalLiveEnd(now),end)-state.day.segment):0;
    if(journalTotal(day,index,now)-removedLive+end-start>Math.min(day.end,now)-day.start+1){toast('مدت ثبت‌ها از زمان سپری‌شدهٔ این روز بیشتر می‌شود.');return false;}
    if(live){journalAddGap(state.day.segment,Math.max(state.day.segment,start));state.day.segment=end;}
    journalClaimRange(start,end);
   }
   entry={name,start,end,...(old?.manual?{manual:true}:{})};if(!old)entry.manual=true;
  }
  entry.name=rememberActivity(name);if(old){for(const key of ['durationOnly','durationMs'])delete old[key];Object.assign(old,entry);}else state.history.push(entry);
  const today=journalBounds(now);historyOffset=Math.round((day.start-today.start)/86400000);return true;
 });
 if(opened){updatePersianDate();journalUpdateMode();focusActivityInput();}
}
function startLiveDay(start){
 const now=Date.now();closeExpiredDay(now);const day=journalBounds(now);if(state.day||state.pendingSegment){toast('ابتدا فعالیت جاری را ثبت یا پایان دهید.');return false;}
 if(!Number.isFinite(start)||start<day.start||start>now){toast('ساعت شروع باید امروز و پیش از زمان فعلی باشد.');return false;}
 if(state.history.some(h=>!h.durationOnly&&h.end>start&&h.start<now)){toast('این زمان با فعالیت ثبت‌شده هم‌پوشانی دارد؛ زمان پس از آن را انتخاب کنید.');return false;}
 const summaries=state.history.filter(h=>h.durationOnly&&h.start>=day.start&&h.start<day.end).reduce((sum,h)=>sum+h.durationMs,0),before=state.history.filter(h=>!h.durationOnly).reduce((sum,h)=>sum+Math.max(0,Math.min(h.end,start)-Math.max(h.start,day.start)),0);
 if(summaries>start-day.start-before+1){toast('برای حفظ مدت‌های ثبت‌شده، زمان شروع دیرتری انتخاب کنید.');return false;}
 journalClaimRange(start,now);state.day={start,segment:start,activity:'فعالیت جاری'};return true;
}
function startDayForm(){const day=journalBounds(),opened=modal('شروع روز از ساعت دلخواه',resetTimeFields(new Date()),f=>{if(journalBounds().start!==day.start){toast('روز عوض شده؛ دوباره انتخاب کنید.');return false;}const chosen=readResetTime(f),start=chosen.useNow?Date.now():journalParseTime(chosen.value,day);return startLiveDay(start);});if(opened)setupResetTime();}
function journalStartControls(){return state.day?'':`<div class="journal-start-controls"><button type="button" class="small" data-action="start-day">شروع از ساعت دلخواه</button><button type="button" class="small" data-action="manual-today">ثبت زمان گذشته</button></div>`;}
function handleJournalClick(button){
 if(button.dataset.fillGap){const gap=state.unassigned?.find(g=>g.id===button.dataset.fillGap);if(gap)manualHistoryForm(null,historyDay(),{start:Math.max(gap.start,historyDay().start),end:Math.min(gap.end,historyDay().end)});return true;}
 if(button.dataset.deleteHistory!==undefined){const index=Number(button.dataset.deleteHistory);if(Number.isInteger(index)&&state.history[index]&&confirm('این ثبت حذف شود؟')){dismissModal();state.history.splice(index,1);save();render();}return true;}
 return false;
}
