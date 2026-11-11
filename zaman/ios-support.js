'use strict';
function appleDevice(){return !!window.IOSZaman||/iPhone|iPad|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);}
function initAppleSupport(){
 if('serviceWorker' in navigator&&!window.AndroidZaman&&!window.IOSZaman)navigator.serviceWorker.register('sw.js').catch(()=>{});
 if(!window.IOSZaman)return;
 const originalSave=save;save=function(){originalSave();try{IOSZaman.post('sync',{alarms:state.alarms,countdown:state.countdown,projects:state.projects.map(p=>({id:p.id,deletedAt:p.deletedAt,tasks:p.tasks.map(t=>({id:t.id,done:t.done}))}))});}catch{}};
 document.addEventListener('click',async event=>{const button=event.target.closest('button');if(!button)return;
  if(button.id==='export'){event.preventDefault();event.stopImmediatePropagation();try{const backup=await buildVoiceBackup(),text=JSON.stringify(backup);if(new Blob([text]).size>BACKUP_LIMIT)throw Error('حجم پشتیبان بیش از ۱۰۰ مگابایت است.');IOSZaman.post('export',{text});}catch(error){toast(error.message||'دریافت پشتیبان انجام نشد.');}}
  if(button.hasAttribute('data-guide-pdf')){event.preventDefault();event.stopImmediatePropagation();IOSZaman.post('guide',{});}
  if(button.dataset.action==='permission'){event.preventDefault();event.stopImmediatePropagation();IOSZaman.post('permissions',{});}
 },true);
 save();
}
document.addEventListener('DOMContentLoaded',initAppleSupport,{once:true});
