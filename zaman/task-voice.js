'use strict';
let taskVoiceSession=null;
function taskVoiceStatus(text){const el=document.querySelector('#task-voice-status');if(el)el.textContent=text;}
function stopTaskVoice(){const old=taskVoiceSession;taskVoiceSession=null;if(old?.recognition)try{old.recognition.abort();}catch{}const button=document.querySelector('[data-task-voice]');if(button){button.disabled=false;button.classList.remove('listening');}}
function applyTaskVoiceResult(result){
 const session=taskVoiceSession;if(!session||session.id!==result?.requestId)return;
 const target=session.target;stopTaskVoice();
 if(!target.isConnected||!document.querySelector('#dialog')?.open||document.querySelector('#task-description')!==target)return;
 if(result.cancelled){taskVoiceStatus('');return;}
 if(result.error){taskVoiceStatus(result.error);return;}
 const text=String(result.text||'').trim();if(!text){taskVoiceStatus('گفتاری دریافت نشد؛ دوباره تلاش کنید.');return;}
 const combined=target.value+(target.value.trim()?'\n':'')+text,limit=target.maxLength>0?target.maxLength:5000;
 target.value=combined.slice(0,limit);target.dispatchEvent(new Event('input',{bubbles:true}));target.focus();target.setSelectionRange(target.value.length,target.value.length);
 taskVoiceStatus(combined.length>limit?'متن به سقف طول مجاز رسید؛ پیش از ذخیره بررسی کنید.':'');
}
window.onNativeTaskVoice=applyTaskVoiceResult;
function startTaskVoice(){
 if(taskVoiceSession)return;
 const target=document.querySelector('#task-description'),button=document.querySelector('[data-task-voice]');if(!target||!button)return;
 const id=crypto.randomUUID(),session={id,target};taskVoiceSession=session;button.disabled=true;button.classList.add('listening');taskVoiceStatus('در حال دریافت گفتار…');
 if(typeof window.AndroidZaman?.startTaskDictation==='function'){
  try{AndroidZaman.startTaskDictation(id);}catch{applyTaskVoiceResult({requestId:id,error:'تشخیص گفتار باز نشد؛ از میکروفن صفحه‌کلید گوشی استفاده کنید.'});}return;
 }
 const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;
 if(!Recognition){applyTaskVoiceResult({requestId:id,error:'تشخیص گفتار در این مرورگر در دسترس نیست؛ از میکروفن صفحه‌کلید یا نسخهٔ اندروید استفاده کنید.'});return;}
 try{
  const recognition=new Recognition();session.recognition=recognition;recognition.lang='fa-IR';recognition.continuous=false;recognition.interimResults=false;recognition.maxAlternatives=1;
  recognition.onresult=event=>{const text=Array.from(event.results).filter(result=>result.isFinal).map(result=>result[0].transcript).join(' ');applyTaskVoiceResult({requestId:id,text});};
  recognition.onerror=event=>applyTaskVoiceResult({requestId:id,cancelled:event.error==='aborted',error:event.error==='not-allowed'?'اجازهٔ میکروفن داده نشد؛ مجوز مرورگر را بررسی کنید.':'گفتار دریافت نشد؛ اتصال اینترنت و سرویس گفتار را بررسی کنید.'});
  recognition.onend=()=>{if(taskVoiceSession===session)applyTaskVoiceResult({requestId:id,cancelled:true});};recognition.start();
 }catch{applyTaskVoiceResult({requestId:id,error:'تشخیص گفتار باز نشد؛ از میکروفن صفحه‌کلید گوشی استفاده کنید.'});}
}
document.addEventListener('click',event=>{if(event.target.closest('[data-task-voice]'))startTaskVoice();});
