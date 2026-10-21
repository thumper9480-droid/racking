'use strict';
// Loaded only inside the offline APK. Native scheduling survives WebView suspension.
const originalSave=save,originalRender=render;
function nativeSync(){AndroidZaman.sync(JSON.stringify(state));}
function updateNativeStatus(){try{const status=JSON.parse(AndroidZaman.status());const el=document.querySelector('#native-status');if(el)el.innerHTML=`زنگ اندروید • اعلان: ${status.notifications?'فعال':'نیاز به مجوز'} • زنگ دقیق: ${status.exact?'فعال':'نیاز به مجوز'} <button class="small" data-action="permission">مجوزهای زنگ</button> <button class="small" id="native-test">آزمایش صدا</button> <button class="small" id="native-stop">قطع زنگ</button>`;}catch{}}
render=function(){originalRender();updateNativeStatus();};
save=function(){nativeSync();originalSave();};
ring=function(title,options={}){showRing(title,options);};
const originalSilence=document.querySelector('#silence').onclick;
document.querySelector('#silence').onclick=()=>{AndroidZaman.stopAlarm();originalSilence();};
actions.permission=()=>AndroidZaman.permissions();
document.querySelector('#export').onclick=()=>AndroidZaman.export(JSON.stringify(state,null,2));
const statusBox=document.createElement('div');statusBox.id='native-status';statusBox.className='info';document.querySelector('#settings-dialog').append(statusBox);
document.addEventListener('click',e=>{if(e.target.closest('#native-test'))AndroidZaman.testAlarm();if(e.target.closest('#native-stop'))AndroidZaman.stopAlarm();});
document.querySelector('#web-alarm-settings').hidden=true;
nativeSync();render();

// Device ringtone selection is available only in the installed Android app.
const soundsBox=document.createElement('section');soundsBox.id='native-sounds';soundsBox.className='native-sound-settings';document.querySelector('#settings-dialog').append(soundsBox);
function updateNativeSounds(){
 if(typeof AndroidZaman.soundStatus!=='function')return;
 try{const sounds=JSON.parse(AndroidZaman.soundStatus());soundsBox.innerHTML=`<h3>صدای زنگ‌ها</h3>${[['countdown','تایمر معکوس'],['reminder','همهٔ یادآورها']].map(([kind,label])=>`<div class="sound-setting-row"><div><b>${label}</b><small>${esc(sounds[kind]?.title||'صدای پیش‌فرض گوشی')}</small></div><button type="button" class="small" data-native-sound="${kind}">انتخاب صدا</button><button type="button" class="small" data-native-sound-test="${kind}">پخش</button></div>`).join('')}`;}catch{}
}
document.addEventListener('click',e=>{const choose=e.target.closest('[data-native-sound]'),test=e.target.closest('[data-native-sound-test]');if(choose&&typeof AndroidZaman.chooseSound==='function')AndroidZaman.chooseSound(choose.dataset.nativeSound);if(test&&typeof AndroidZaman.testSound==='function')AndroidZaman.testSound(test.dataset.nativeSoundTest);});
updateNativeSounds();
