'use strict';
let timePickerSerial=0;
// Keep HH:MM form values and existing validation; never open an AM/PM native picker.
function setupTimePickers(form){
 for(const input of form.querySelectorAll('input[type=time]')){
  if(input.dataset.timeWheelReady)continue;
  const label=input.closest('label')?.childNodes[0]?.textContent.trim()||'ساعت',id='time-picker-'+(++timePickerSerial);
  input.type='text';input.inputMode='none';input.pattern='(?:[01][0-9]|2[0-3]):[0-5][0-9]';input.maxLength=5;input.dir='ltr';input.dataset.timeWheelReady='true';input.setAttribute('aria-label',label);input.setAttribute('aria-controls',id);input.setAttribute('aria-expanded','false');
  const wrapper=document.createElement('span');wrapper.className='time-picker-control';input.before(wrapper);wrapper.append(input);
  const toggle=document.createElement('button');toggle.type='button';toggle.className='time-wheel-toggle';toggle.textContent='◷';toggle.setAttribute('aria-label','انتخاب چرخشی '+label);toggle.setAttribute('aria-controls',id);toggle.setAttribute('aria-expanded','false');wrapper.append(toggle);
  const picker=document.createElement('span');picker.className='shared-time-picker';picker.id=id;picker.hidden=true;
  picker.innerHTML=`<span class="shared-time-wheels" dir="ltr">${[['hour',24,'ساعت'],['minute',60,'دقیقه']].map(([kind,count,title])=>`<span class="shared-wheel-column"><span class="shared-wheel-label">${title}</span><span class="shared-wheel-frame"><span class="shared-time-wheel" tabindex="0" role="listbox" aria-label="${title} ${label}" data-time-kind="${kind}">${Array.from({length:count},(_,n)=>`<span role="option" id="${id}-${kind}-${n}" data-time-number="${n}" aria-selected="false">${fa(String(n).padStart(2,'0'))}</span>`).join('')}</span></span></span>`).join('<span class="shared-wheel-colon" aria-hidden="true">:</span>')}</span>`;
  wrapper.append(picker);
  const wheels=[...picker.querySelectorAll('.shared-time-wheel')];let selected=[0,0];
  const parse=()=>{if(/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(input.value))selected=input.value.split(':').map(Number);};
  function render(scroll){wheels.forEach((wheel,i)=>{wheel.querySelectorAll('[role=option]').forEach(option=>option.setAttribute('aria-selected',String(Number(option.dataset.timeNumber)===selected[i])));wheel.setAttribute('aria-activedescendant',`${id}-${i?'minute':'hour'}-${selected[i]}`);if(scroll)wheel.scrollTop=selected[i]*40;});}
  function open(next){if(input.disabled||input.matches(':disabled'))return;for(const other of form.querySelectorAll('.shared-time-picker'))if(other!==picker){other.hidden=true;other.parentElement.querySelector('input').setAttribute('aria-expanded','false');other.parentElement.querySelector('button').setAttribute('aria-expanded','false');}picker.hidden=!next;input.setAttribute('aria-expanded',String(next));toggle.setAttribute('aria-expanded',String(next));if(next){parse();render(true);}}
  function choose(i,n,scroll=true){selected[i]=Math.max(0,Math.min(i?59:23,n));input.value=selected.map(v=>String(v).padStart(2,'0')).join(':');render(scroll);input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));}
  input.addEventListener('click',()=>open(true));toggle.addEventListener('click',event=>{event.preventDefault();open(picker.hidden);});
  input.addEventListener('input',event=>{if(!event.isTrusted)return;parse();if(!picker.hidden)render(true);});
  input.addEventListener('keydown',event=>{if(event.key==='ArrowDown'){event.preventDefault();open(true);wheels[0].focus();}});
  wheels.forEach((wheel,i)=>{
   wheel.addEventListener('scroll',()=>{const n=Math.max(0,Math.min(i?59:23,Math.round(wheel.scrollTop/40)));if(n!==selected[i])choose(i,n,false);});
   wheel.addEventListener('click',event=>{const option=event.target.closest('[data-time-number]');if(option){event.preventDefault();choose(i,Number(option.dataset.timeNumber));}});
   wheel.addEventListener('keydown',event=>{const moves={ArrowUp:-1,ArrowDown:1,PageUp:-5,PageDown:5};if(event.key in moves){event.preventDefault();choose(i,selected[i]+moves[event.key]);}else if(event.key==='Home'||event.key==='End'){event.preventDefault();choose(i,event.key==='Home'?0:i?59:23);}else if(event.key==='Enter'||event.key==='Escape'){event.preventDefault();event.stopPropagation();open(false);toggle.focus();}else if(event.key==='ArrowRight'&&i===0){event.preventDefault();wheels[1].focus();}else if(event.key==='ArrowLeft'&&i===1){event.preventDefault();wheels[0].focus();}});
  });
  parse();render(false);
 }
}
