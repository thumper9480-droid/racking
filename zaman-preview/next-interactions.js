'use strict';

function addTimePickerConfirm(root, onConfirm){
 for(const picker of root.querySelectorAll('.shared-time-picker')){
  const control=picker.parentElement;
  const input=control.querySelector('input');
  const toggle=control.querySelector('.time-wheel-toggle');
  const confirm=document.createElement('button');
  confirm.type='button';
  confirm.className='small time-wheel-confirm';
  confirm.textContent='تأیید';
  picker.append(confirm);
  confirm.onclick=()=>{
   if(onConfirm&&onConfirm(input.value)===false)return;
   if(!picker.isConnected)return;
   toggle.click();
   toggle.focus();
  };
 }
}

function journalEditAllowed(item,start,end,now){
 return !state.history.some(h=>h!==item&&!h.durationOnly&&start<h.end&&end>h.start)
  && !sleepRanges(state,now).some(s=>(!item||s.start!==item.start||s.end!==item.end||s.id!==item.id)&&start<s.end&&end>s.start)
  && !(state.pendingSegment&&start<state.pendingSegment.end&&end>state.pendingSegment.start)
  && !(state.day&&end>state.day.segment&&start<journalLiveEnd(now));
}

let closeJournalEditor=null;

function showJournalEditor(button,editor,label,{alignStart=false}={}){
 const listeners=new AbortController(),options={signal:listeners.signal};
 editor.setAttribute('role','dialog');
 editor.setAttribute('aria-label',label);
 button.setAttribute('aria-expanded','true');
 document.body.append(editor);
 function close(restoreFocus=true){
  listeners.abort();
  editor.remove();
  button.removeAttribute('aria-expanded');
  closeJournalEditor=null;
  if(restoreFocus&&button.isConnected)button.focus({preventScroll:true});
 }
 closeJournalEditor=close;
 function position(){
  if(!button.isConnected){close(false);return;}
  const bounds=button.getBoundingClientRect(),viewport=window.visualViewport;
  const top=viewport?.offsetTop||0,left=viewport?.offsetLeft||0;
  const bottom=top+(viewport?.height||innerHeight),right=left+(viewport?.width||innerWidth),gutter=8;
  if(bounds.bottom<0||bounds.top>innerHeight){close(false);return;}
  editor.style.maxHeight=Math.max(72,bottom-top-2*gutter)+'px';
  editor.style.maxWidth=Math.max(0,right-left-2*gutter)+'px';
  const width=editor.offsetWidth,height=editor.offsetHeight;
  const x=alignStart?bounds.left:bounds.right-width;
  editor.style.left=Math.max(left+gutter,Math.min(right-width-gutter,x))+'px';
  const below=bounds.bottom+gutter,above=bounds.top-gutter-height;
  editor.style.top=(below+height<=bottom-gutter?Math.max(top+gutter,below):Math.max(top+gutter,above))+'px';
 }
 window.addEventListener('resize',position,options);
 window.addEventListener('scroll',event=>{if(!(event.target instanceof Node)||!editor.contains(event.target))position();},{...options,capture:true});
 window.visualViewport?.addEventListener('resize',position,options);
 window.visualViewport?.addEventListener('scroll',position,options);
 document.addEventListener('pointerdown',event=>{
  if(!editor.contains(event.target)&&!button.contains(event.target))close(false);
 },options);
 editor.addEventListener('keydown',event=>{
  if(event.key==='Escape'){
   event.preventDefault();
   event.stopPropagation();
   close();
  }
 },options);
 position();
 return {close,position};
}

function showJournalTimeEditor(button,editor,input,confirm){
 editor.classList.add('journal-time-float');
 const label=button.dataset.historyField==='start'?'از ساعت':'تا ساعت';
 const {close,position}=showJournalEditor(button,editor,label);
 input.click();
 position();
 editor.querySelector('.shared-time-wheel').focus({preventScroll:true});
 editor.querySelector('.journal-edit-cancel').onclick=()=>close();
 editor.addEventListener('keydown',event=>{
  if(event.target.closest('.shared-time-wheel')&&['Enter','Escape'].includes(event.key)){
   event.preventDefault();
   event.stopImmediatePropagation();
   if(event.key==='Enter')confirm.click();
   else close();
  }
 },true);
}

function showJournalActivityEditor(button,editor,item,commit){
 editor.classList.add('journal-activity-float');
 editor.innerHTML='<strong class="journal-activity-title">ویرایش فعالیت</strong>'
  +'<div class="journal-activity-fields"><input type="text" maxlength="100" autocomplete="off" aria-label="نام فعالیت" placeholder="جست‌وجو یا تایپ نام فعالیت">'
  +'<div class="journal-activity-options" role="group" aria-label="فعالیت‌های ثبت‌شده"></div>'
  +'<div class="journal-activity-actions"><button type="button" class="primary" data-activity-confirm>تأیید</button><button type="button" class="small" data-activity-cancel>انصراف</button>'
  +(item?'<button type="button" class="small journal-delete-entry">حذف ردیف</button>':'')+'</div></div>';
 const input=editor.querySelector('input'),list=editor.querySelector('.journal-activity-options');
 const confirm=editor.querySelector('[data-activity-confirm]');
 const original=item&&!item.unknown?item.name:'';
 let selected=original;
 const catalog=activityCatalog().map(activity=>activity.name);
 const originalKey=normalizeActivity(original);
 const names=original?[original,...catalog.filter(name=>normalizeActivity(name)!==originalKey)]:catalog;
 const {close,position}=showJournalEditor(button,editor,'ویرایش فعالیت',{alignStart:true});

 function refresh(){
  const query=normalizeActivity(input.value);
  list.replaceChildren();
  for(const name of names){
   const key=normalizeActivity(name);
   if(query&&!key.includes(query))continue;
   const option=document.createElement('button');
   const active=key===normalizeActivity(selected);
   option.type='button';
   option.setAttribute('aria-pressed',String(active));
   option.textContent=name+(active?' ✓':'');
   option.onclick=()=>{
    selected=name;
    input.value=name;
    refresh();
    confirm.focus({preventScroll:true});
   };
   list.append(option);
  }
  if(!list.childElementCount){
   const empty=document.createElement('p');
   empty.textContent=query?'با تأیید، همین نام ثبت می‌شود.':'نام فعالیت را بنویسید.';
   list.append(empty);
  }
 }
 function apply(){
  const value=input.value.trim()||selected;
  if(!value){input.focus();return;}
  commit(value);
 }
 input.oninput=()=>{selected='';refresh();};
 input.onkeydown=event=>{
  if(event.key==='Enter'){event.preventDefault();apply();}
  else if(event.key==='ArrowDown'){event.preventDefault();list.querySelector('button')?.focus();}
 };
 confirm.onclick=apply;
 editor.querySelector('[data-activity-cancel]').onclick=()=>close();
 const remove=editor.querySelector('.journal-delete-entry');
 if(remove)remove.onclick=()=>{
  const fields=editor.querySelector('.journal-activity-fields');
  fields.hidden=true;
  const prompt=document.createElement('div');
  prompt.className='journal-delete-confirmation';
  prompt.innerHTML='<p>این ثبت از جدول و گزارش‌ها حذف شود؟</p><div class="journal-activity-actions"><button type="button" class="small journal-delete-entry">حذف ردیف</button><button type="button" class="small">بازگشت</button></div>';
  editor.append(prompt);
  const [accept,back]=prompt.querySelectorAll('button');
  back.onclick=()=>{prompt.remove();fields.hidden=false;position();remove.focus({preventScroll:true});};
  accept.onclick=()=>{
   const index=state.history.indexOf(item);
   if(index<0){close();return;}
   state.history.splice(index,1);
   save();
   render();
   toast('ردیف فعالیت حذف شد.');
  };
  position();
  back.focus({preventScroll:true});
 };
 refresh();
 position();
 editor.tabIndex=-1;
 editor.focus({preventScroll:true});
}

function editJournalCell(button){
 if(document.querySelector('.journal-inline-editor'))return;
 const field=button.dataset.historyField, day=historyDay();
 const gap=button.dataset.journalGap?{start:Number(button.dataset.journalGap),end:Number(button.dataset.journalGapEnd)}:null;
 const sleepId=button.dataset.inlineSleep;
 const item=sleepId?state.sleeps?.find(s=>s.id===sleepId):gap?null:state.history[Number(button.dataset.inlineIndex)];
 if(!item&&!gap)return;
 const editor=document.createElement('span');
 editor.className='journal-inline-editor';


 function commit(value){
  if(!editor.isConnected)return false;
  const interval=item||gap;
  const now=Date.now();
  let {start,end}=interval;
  let name=item?.name||'';
  if(field==='name'){
   name=value.trim();
   if(!name)return false;
   if(recoveryKindForName(name)!=='activity'){
    toast('برای ثبت خواب یا زمان نامشخص از ابزار ثبت زمان استفاده کنید.');
    return false;
   }
  }else{
   if(!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value))return false;
   const original=interval[field];
   if(value!==journalTime(original)){
    const [hours,minutes]=value.split(':').map(Number);
    const selected=new Date(day.start);
    selected.setHours(hours,minutes,0,0);
    const timestamp=field==='end'&&value==='00:00'?day.end:selected.getTime();
    if(field==='start')start=timestamp;
    else end=timestamp;
   }
  }
  if(!item?.durationOnly&&(end-start<60000||end>now||start>=end)){
   toast('بازه باید دست‌کم یک دقیقه باشد و در گذشته پایان یابد.');
   return false;
  }
  if(!item?.durationOnly&&!journalEditAllowed(item,start,end,now)){
   toast('این بازه با یک زمان ثبت‌شده یا فعالیت جاری تداخل دارد.');
   return false;
  }
  if(gap){state.history.push({start,end,name:rememberActivity(name),manual:true});}
  else{
   item.start=start;
   item.end=end;
   if(field==='name'){
    item.name=rememberActivity(name);
    delete item.unknown;
   }
  }
  if(!item?.durationOnly)recoveryClaimGaps(state,start,end);
  save();
  render();
  return true;
 }
 if(field==='name'){
  showJournalActivityEditor(button,editor,item,commit);
 }else{
  const title=field==='start'?'از ساعت':'تا ساعت';
  editor.innerHTML='<strong class="journal-time-title">'+title+'</strong><input type="time" readonly><button type="button" class="small journal-edit-cancel">انصراف</button>';
  const input=editor.querySelector('input');
  input.value=journalTime(item[field]);
  setupTimePickers(editor);
  const dismiss=editor.querySelector('.journal-edit-cancel');
  const picker=editor.querySelector('.shared-time-picker');
  addTimePickerConfirm(editor,commit);
  const confirm=picker.querySelector('.time-wheel-confirm');
  confirm.after(dismiss);
  showJournalTimeEditor(button,editor,input,confirm);
 }
}

function reportPeriodLabel(){
 const anchor=dashboardAnchor??Date.now();
 const options=dashboardPeriod==='day'?{day:'numeric',month:'long',year:'numeric'}:dashboardPeriod==='month'?{month:'long',year:'numeric'}:{year:'numeric'};
 return new Date(anchor).toLocaleDateString('fa-IR',options);
}

function dashboardDatePicker(){
 const mode=dashboardPeriod;
 const now=Date.now();
 const current=reportJalaliParts(now), selected=reportJalaliParts(dashboardAnchor??now);
 let earliest=Math.min(1300,current.year);
 for(const record of [...state.history,...(state.sleeps||[])]){
  if(Number.isFinite(record.start))earliest=Math.min(earliest,reportJalaliParts(record.start).year);
 }
 const options=(length,describe,first)=>Array.from({length},(_,i)=>'<option value="'+(i+first)+'">'+describe(i+first)+'</option>').join('');
 const dateDescription=({day:'روز',month:'ماه',year:'سال'})[mode];
 const controls='<div class="dashboard-date-controls">'
  +'<label>سال<select name="year">'+options(current.year-earliest+1,fa,earliest)+'</select></label>'
  +(mode!=='year'?'<label>ماه<select name="month"></select></label>':'')
  +(mode==='day'?'<label>روز<select name="day" size="5"></select></label>':'')+'</div>';
 if(!modal('انتخاب '+dateDescription+' خاص',controls,form=>{
  const date=persianToLocal(+form.get('year'),+(form.get('month')||1),+(form.get('day')||1));
  if(!date||date.getTime()>Date.now())return false;
  dashboardAnchor=date.getTime();
 }))return;
 const form=$('#form'), year=form.elements.year, month=form.elements.month, day=form.elements.day;
 form.querySelector('button[type=submit]').textContent='نمایش گزارش';
 function refreshDays(previous){
  if(!day)return;
  const y=Number(year.value),m=Number(month.value);
  const start=reportPersianStart(y,m),end=reportPersianStart(m===12?y+1:y,m===12?1:m+1);
  const count=y===current.year&&m===current.month?current.day:Math.round((end-start)/86400000);
  day.innerHTML=options(count,n=>fa(n),1);
  day.value=Math.min(previous||1,count);
  day.options[day.selectedIndex]?.scrollIntoView({block:'nearest'});
 }
 function refreshMonths(previousMonth,previousDay){
  if(!month)return;
  const count=Number(year.value)===current.year?current.month:12;
  month.innerHTML=options(count,n=>monthNames[n-1],1);
  month.value=Math.min(previousMonth||1,count);
  refreshDays(previousDay);
 }
 year.value=selected.year;
 refreshMonths(selected.month,selected.day);
 year.onchange=()=>refreshMonths(+month?.value,+day?.value);
 if(month)month.onchange=()=>refreshDays(+day?.value);
}
