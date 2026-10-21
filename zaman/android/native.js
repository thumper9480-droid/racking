'use strict';
// Loaded only inside the offline APK. Native scheduling survives WebView suspension.
const originalSave=save,originalRender=render;
function nativeSync(){AndroidZaman.sync(JSON.stringify(state));}
function updateNativeStatus(){try{const status=JSON.parse(AndroidZaman.status());const el=document.querySelector('#native-status');if(el)el.innerHTML=`زنگ اندروید • اعلان: ${status.notifications?'فعال':'نیاز به مجوز'} • زنگ دقیق: ${status.exact?'فعال':'نیاز به مجوز'} <button class="small" data-action="permission">مجوزهای زنگ</button> <button class="small" id="native-test">آزمایش صدا</button> <button class="small" id="native-stop">قطع زنگ</button>`;}catch{}}
render=function(){originalRender();const info=document.querySelector('#view .info');if(tab==='alarms'&&info)info.innerHTML='یادآورها با زنگ سیستم اندروید اجرا می‌شوند. برای زمان دقیق، مجوز زنگ دقیق و اعلان را فعال کنید. <button class="small" data-action="permission">مجوزهای زنگ</button>';updateNativeStatus();};
save=function(){nativeSync();originalSave();};
ring=function(title){document.querySelector('#ring-title').textContent=title;document.querySelector('#ring').hidden=false;};
const originalSilence=document.querySelector('#silence').onclick;
document.querySelector('#silence').onclick=()=>{AndroidZaman.stopAlarm();originalSilence();};
actions.permission=()=>AndroidZaman.permissions();
document.querySelector('#export').onclick=()=>AndroidZaman.export(JSON.stringify(state,null,2));
const statusBox=document.createElement('div');statusBox.id='native-status';statusBox.className='info';document.querySelector('#settings-dialog').append(statusBox);
document.addEventListener('click',e=>{if(e.target.closest('#native-test'))AndroidZaman.testAlarm();if(e.target.closest('#native-stop'))AndroidZaman.stopAlarm();});
nativeSync();render();
