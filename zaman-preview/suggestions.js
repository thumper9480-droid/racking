'use strict';
(() => {
 const recipient='09131693134';
 const dialog=document.querySelector('#suggestion-dialog');
 const field=document.querySelector('#suggestion-text');
 const status=document.querySelector('#suggestion-status');
 document.querySelector('#suggestion-open').onclick=()=>{
  status.hidden=true;
  dialog.showModal();
 };
 document.querySelector('#suggestion-cancel').onclick=()=>dialog.close();
 document.querySelector('#suggestion-form').onsubmit=event=>{
  event.preventDefault();
  const suggestion=field.value.trim();
  if(!suggestion){
   status.textContent='متن پیشنهاد را بنویسید.';
   status.hidden=false;
   field.focus();
   return;
  }
  const message='پیشنهاد برای مدیریت زمان علی میرزا\nنسخهٔ برنامه: '+APP_VERSION+'\n\n'+suggestion;
  if(typeof window.AndroidZaman?.composeSuggestion==='function'){
   AndroidZaman.composeSuggestion(recipient,message);
  }else{
   const delimiter=/iPhone|iPad|iPod/i.test(navigator.userAgent)?'&':'?';
   location.href='sms:'+recipient+delimiter+'body='+encodeURIComponent(message);
  }
 };
})();