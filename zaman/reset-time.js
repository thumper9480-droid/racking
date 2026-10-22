'use strict';
// The form keeps a normal time value; "now" remains a distinct choice until submit.
function resetTimePad(value){return String(value).padStart(2,'0');}
function resetTimeDigits(value){return typeof fa==='function'?fa(value):String(value).replace(/\d/g,d=>'۰۱۲۳۴۵۶۷۸۹'[d]);}
function resetTimeFields(initialDate=new Date()){
 const date=initialDate instanceof Date&&!Number.isNaN(initialDate.getTime())?initialDate:new Date();
 const hour=date.getHours(),minute=date.getMinutes(),value=resetTimePad(hour)+':'+resetTimePad(minute);
 const wheel=(kind,count,selected,label)=>`<div class="reset-wheel-column"><span class="reset-wheel-label">${label}</span><div class="reset-wheel-frame"><div id="reset-${kind}-wheel" class="reset-time-wheel" role="listbox" aria-label="انتخاب ${label} شروع روز" aria-activedescendant="reset-${kind}-${selected}" tabindex="0" data-reset-wheel="${kind}">${Array.from({length:count},(_,n)=>`<div id="reset-${kind}-${n}" role="option" aria-selected="${n===selected}" data-reset-value="${n}">${resetTimeDigits(resetTimePad(n))}</div>`).join('')}</div></div></div>`;
 return `<div id="reset-start-field" class="reset-time-field"><label for="reset-start-time">ساعت شروع امروز</label><div class="reset-time-row"><input id="reset-start-time" name="startTime" type="text" inputmode="none" pattern="(?:[01][0-9]|2[0-3]):[0-5][0-9]" required value="${value}" aria-describedby="reset-time-now-note"><button type="button" class="reset-now-button" data-reset-time-now aria-pressed="false">همین الان</button><button type="button" class="reset-wheel-toggle" data-reset-wheel-toggle aria-label="انتخاب چرخشی ساعت و دقیقه" aria-expanded="false" aria-controls="reset-time-picker"><svg viewBox="0 0 24 24" aria-hidden="true" width="21" height="21" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3 2"/></svg></button></div><input name="startMode" type="hidden" value="custom"><p id="reset-time-now-note" class="reset-now-note" hidden>شروع روز از لحظهٔ تأیید خواهد بود.</p><section id="reset-time-picker" class="reset-time-picker" aria-label="تنظیم ساعت شروع روز" hidden><div class="reset-time-wheels">${wheel('hour',24,hour,'ساعت')}<span class="reset-wheel-separator" aria-hidden="true">:</span>${wheel('minute',60,minute,'دقیقه')}</div><output id="reset-time-preview" class="reset-time-preview" aria-live="polite" dir="ltr">${resetTimeDigits(value)}</output><p class="reset-wheel-hint">عددها را بالا و پایین بکشید یا چرخ ماوس را بچرخانید.</p></section></div>`;
}
function readResetTime(formData){return {useNow:formData.get('startMode')==='now',value:String(formData.get('startTime')||'')};}
function setupResetTime(){
 const form=document.querySelector('#form'),input=form?.elements.startTime,mode=form?.elements.startMode,picker=document.querySelector('#reset-time-picker'),toggle=document.querySelector('[data-reset-wheel-toggle]'),nowButton=document.querySelector('[data-reset-time-now]'),note=document.querySelector('#reset-time-now-note'),preview=document.querySelector('#reset-time-preview');
 if(!input||!mode||!picker||!toggle||!nowButton||input.dataset.resetWheelReady==='true')return;
 input.dataset.resetWheelReady='true';
 const parse=value=>{const parts=String(value).split(':').map(Number);return parts.length===2&&parts.every(Number.isInteger)&&parts[0]>=0&&parts[0]<24&&parts[1]>=0&&parts[1]<60?{hour:parts[0],minute:parts[1]}:null;};
 let selected=parse(input.value)||{hour:0,minute:0};
 const wheels={hour:document.querySelector('#reset-hour-wheel'),minute:document.querySelector('#reset-minute-wheel')},limits={hour:24,minute:60};
 function markMode(next){mode.value=next;nowButton.setAttribute('aria-pressed',String(next==='now'));nowButton.classList.toggle('selected',next==='now');note.hidden=next!=='now';}
 function value(){return resetTimePad(selected.hour)+':'+resetTimePad(selected.minute);}
 function render(scroll=false){
  input.value=value();preview.value=resetTimeDigits(value());preview.textContent=resetTimeDigits(value());
  for(const kind of ['hour','minute']){const wheel=wheels[kind];wheel.querySelectorAll('[role=option]').forEach(option=>option.setAttribute('aria-selected',String(Number(option.dataset.resetValue)===selected[kind])));wheel.setAttribute('aria-activedescendant','reset-'+kind+'-'+selected[kind]);if(scroll&&!picker.hidden)wheel.scrollTop=selected[kind]*44;}
 }
 function choose(kind,n,scroll=true){n=Math.max(0,Math.min(limits[kind]-1,n));selected={...selected,[kind]:n};markMode('custom');render(scroll);}
 function open(next){picker.hidden=!next;toggle.setAttribute('aria-expanded',String(next));if(next)render(true);}
 toggle.addEventListener('click',()=>open(picker.hidden));input.addEventListener('click',()=>open(true));
 nowButton.addEventListener('click',()=>{const date=new Date();selected={hour:date.getHours(),minute:date.getMinutes()};markMode('now');render(true);});
 for(const event of ['input','change'])input.addEventListener(event,()=>{markMode('custom');const parsed=parse(input.value);if(parsed){selected=parsed;render(true);}});
 for(const kind of ['hour','minute']){
  const wheel=wheels[kind];
  wheel.addEventListener('scroll',()=>{const next=Math.max(0,Math.min(limits[kind]-1,Math.round(wheel.scrollTop/44)));if(next!==selected[kind])choose(kind,next,false);});
  wheel.addEventListener('click',event=>{const option=event.target.closest('[data-reset-value]');if(option)choose(kind,Number(option.dataset.resetValue));});
  wheel.addEventListener('keydown',event=>{const moves={ArrowUp:-1,ArrowDown:1,PageUp:-5,PageDown:5};if(event.key in moves){event.preventDefault();choose(kind,selected[kind]+moves[event.key]);}else if(event.key==='Home'||event.key==='End'){event.preventDefault();choose(kind,event.key==='Home'?0:limits[kind]-1);}else if(event.key==='Enter'||event.key==='Escape'){event.preventDefault();event.stopPropagation();open(false);toggle.focus();}else if(event.key===' '){event.preventDefault();}});
 }
 render(false);
}
