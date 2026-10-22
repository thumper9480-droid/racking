'use strict';
const APP_VERSION='1.12.1',APP_VERSION_CODE=15,MEMORIAL_KEY='ali-mirza-memorial-v1',MEMORIAL_INTERVAL=30*86400000;
let memorialRecord=null,availableUpdate=null,checkingUpdate=false,downloadPoll=null,updateDownloaded=false,downloadBusy=false,updateMessage='',wipeStage=0,wipeBusy=false;
function memorialDue(now=Date.now()){return !!memorialRecord&&now>=memorialRecord.nextAt;}
function readMemorial(){let saved;try{saved=JSON.parse(localStorage.getItem(MEMORIAL_KEY)||'null');}catch{}const now=Date.now();memorialRecord=saved&&Number.isFinite(saved.startedAt)&&Number.isFinite(saved.nextAt)&&saved.nextAt>=saved.startedAt?saved:{startedAt:now,nextAt:now+MEMORIAL_INTERVAL};try{localStorage.setItem(MEMORIAL_KEY,JSON.stringify(memorialRecord));}catch{}}
function tickMemorial(){if(!memorialDue())return;const dialog=document.querySelector('#memorial-dialog');if(!dialog||dialog.open)return;cancelEndHold();cancelDeleteHold();dialog.showModal();document.querySelector('#memorial-confirm').focus();}
function confirmMemorial(){if(!memorialRecord)return;memorialRecord.lastConfirmedAt=Date.now();memorialRecord.nextAt=memorialRecord.lastConfirmedAt+MEMORIAL_INTERVAL;try{localStorage.setItem(MEMORIAL_KEY,JSON.stringify(memorialRecord));}catch{}document.querySelector('#memorial-dialog').close();if(state.pendingSegment&&!document.querySelector('#dialog').open&&!document.querySelector('#settings-dialog').open&&!document.querySelector('#about-dialog').open)namePendingSegment();}
function showAbout(){document.querySelector('#about-dialog').showModal();}
function showHelp(section=''){const allowed=['today','journey','timers','projects','reports','settings','updates','answers'];section=allowed.includes(section)?section:'';if(window.AndroidZaman){if(section&&typeof AndroidZaman.openHelpSection==='function')AndroidZaman.openHelpSection(section);else if(typeof AndroidZaman.openHelp==='function')AndroidZaman.openHelp();}else location.href='help.html'+(section?'#'+section:'');}
function showEducation(){const topics=[['today','صفحهٔ امروز و ثبت فعالیت'],['journey','مسیر روز و نمودار زمان'],['timers','تایمر معکوس و یادآورها'],['projects','پروژه‌ها و کارها'],['reports','گزارش‌های فعالیت'],['settings','تنظیمات، صدا و پشتیبان'],['updates','آپدیت و دربارهٔ نرم‌افزار'],['answers','پرسش‌های کاربردی']];const images=[['today','صفحهٔ امروز'],['today-compact','بخش‌های جمع‌شده و پایان روز'],['segment','ثبت فعالیت'],['journey','جدول مسیر روز'],['manual-history','ثبت دستی زمان و مدت'],['chart','نمودار فعالیت‌ها'],['countdown','تایمر معکوس'],['reminders','یادآورها'],['projects','پروژه‌ها'],['reports','گزارش‌ها'],['settings','تنظیمات'],['reset-time','شروع روز از ساعت دلخواه'],['wipe-confirmation','پاک‌کردن اطلاعات با سه تأیید'],['update-banner','اعلان آپدیت جدید']];document.querySelector('#education-contents').innerHTML=`<p class="education-lead">راهنماها و فایل‌های آموزشی برنامه را از این بخش باز کنید.</p><div class="education-files"><button type="button" class="primary" data-help>راهنمای کاربردی کامل</button><button type="button" data-guide-pdf>دریافت جزوهٔ کامل PDF</button></div><h3>آموزش هر بخش</h3><div class="education-topics">${topics.map(([id,label])=>`<button type="button" data-help-section="${id}">${label}<span aria-hidden="true">‹</span></button>`).join('')}</div><details class="education-gallery"><summary>تصاویر آموزشی بخش‌ها</summary>${images.map(([id,label])=>`<figure><img loading="lazy" src="guide-assets/${id}.png" alt="${label}"><figcaption>${label}</figcaption></figure>`).join('')}</details>`;document.querySelector('#education-dialog').showModal();}

function downloadGuide(){if(window.AndroidZaman&&typeof AndroidZaman.openGuide==='function')AndroidZaman.openGuide();else{const a=document.createElement('a');a.href='user-guide.pdf';a.download='ali-mirza-user-guide.pdf';a.click();}}
function validRelease(data){if(!data||!Number.isInteger(data.versionCode)||data.versionCode<1||!/^[0-9]+\.[0-9]+\.[0-9]+$/.test(data.versionName)||!/^[a-f0-9]{64}$/i.test(data.sha256))return false;try{const url=new URL(data.apkUrl);return url.protocol==='https:'&&url.hostname==='raw.githubusercontent.com'&&!url.username&&!url.password&&!url.search&&!url.hash&&/^\/thumper9480-droid\/racking\/gh-pages\/downloads\/zaman-android-[0-9]+\.[0-9]+\.[0-9]+\.apk$/.test(url.pathname);}catch{return false;}}
function setUpdateStatus(message){updateMessage=message;for(const id of ['#update-status','#update-banner-status']){const status=document.querySelector(id);if(status&&status.textContent!==message)status.textContent=message;}}
function updateBannerVisibility(){
 const banner=document.querySelector('#update-banner');if(!banner)return;banner.hidden=!availableUpdate||tab!=='today';
 if(availableUpdate)banner.innerHTML=`<span><b>آپدیت جدید ${fa(availableUpdate.versionName)} آماده است</b><small id="update-banner-status" role="status">${esc(updateMessage||(updateDownloaded?'فایل نصب بررسی شد؛ نصب را تأیید کنید.':'برای دریافت نسخهٔ جدید، دکمه را بزنید.'))}</small></span><button type="button" class="primary" ${downloadBusy?'disabled':updateDownloaded?'data-install-update':'data-download-update'}>${downloadBusy?'در حال دریافت…':updateDownloaded?'نصب آپدیت':'دریافت آپدیت'}</button>`;
}
function setDownloadBusy(value){const changed=downloadBusy!==value;downloadBusy=value;if(changed)updateBannerVisibility();}
function stopDownloadPoll(){clearInterval(downloadPoll);downloadPoll=null;}
function ensureDownloadPoll(){if(!downloadBusy||downloadPoll||typeof window.AndroidZaman?.downloadStatus!=='function')return;downloadPoll=setInterval(()=>{try{showDownloadState(JSON.parse(AndroidZaman.downloadStatus()));}catch{stopDownloadPoll();setDownloadBusy(false);setUpdateStatus('وضعیت دانلود خوانده نشد؛ دوباره دریافت کنید.');}},1500);}
function restoreUpdateDownload(){if(!availableUpdate||typeof window.AndroidZaman?.downloadStatus!=='function')return;try{const result=JSON.parse(AndroidZaman.downloadStatus());if(result.status&&result.status!=='idle'){showDownloadState(result);ensureDownloadPoll();}}catch{}}
function applyUpdateResult(result){checkingUpdate=false;if(!result?.ok||!validRelease(result)){setUpdateStatus(result?.error||'بررسی نسخه انجام نشد؛ اتصال اینترنت را بررسی کنید.');return;}availableUpdate=result.versionCode>APP_VERSION_CODE?result:null;setUpdateStatus(availableUpdate?'نسخهٔ جدید '+fa(result.versionName)+' آمادهٔ دانلود است.':'نسخهٔ '+fa(APP_VERSION)+' به‌روز است.');updateBannerVisibility();restoreUpdateDownload();}
window.onNativeUpdate=applyUpdateResult;
async function checkForUpdate(manual=false){if(checkingUpdate)return;checkingUpdate=true;if(manual)setUpdateStatus('در حال بررسی نسخهٔ جدید…');if(window.AndroidZaman){if(typeof AndroidZaman.checkForUpdate==='function')AndroidZaman.checkForUpdate();else checkingUpdate=false;return;}const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),12000);try{const response=await fetch('release.json?v='+Date.now(),{cache:'no-store',signal:controller.signal});if(!response.ok)throw Error();applyUpdateResult({...(await response.json()),ok:true});}catch{applyUpdateResult({ok:false,error:'بررسی نسخه انجام نشد؛ اتصال اینترنت را بررسی کنید.'});}finally{clearTimeout(timeout);}}
function showDownloadState(result){
 if(result?.permissionPending){setDownloadBusy(true);setUpdateStatus('مجوز ذخیرهٔ فایل را در پیام گوشی تأیید کنید.');return;}
 if(result?.ok===false||result?.status==='failed'){stopDownloadPoll();setDownloadBusy(false);updateDownloaded=false;document.querySelector('.update-file-actions')?.remove();setUpdateStatus(result.error||result.message||'دانلود انجام نشد؛ دوباره دریافت کنید.');updateBannerVisibility();return;}
 if(result?.status==='idle'){stopDownloadPoll();setDownloadBusy(false);return;}
 if(result?.status==='verified'){
  stopDownloadPoll();setDownloadBusy(false);
  if(result.sha256&&availableUpdate&&result.sha256.toLowerCase()!==availableUpdate.sha256.toLowerCase()){updateDownloaded=false;document.querySelector('.update-file-actions')?.remove();setUpdateStatus('فایل موجود مربوط به نسخهٔ قبلی است؛ دریافت آپدیت را بزنید.');updateBannerVisibility();return;}
  updateDownloaded=true;setUpdateStatus('فایل نصب دانلود و بررسی شد؛ «نصب آپدیت» را بزنید.');updateBannerVisibility();
  const status=document.querySelector('#update-status');if(status&&!document.querySelector('.update-file-actions')){const box=document.createElement('div');box.className='actions update-file-actions';box.innerHTML='<button type="button" class="primary small" data-install-update>نصب آپدیت</button><button type="button" class="small" data-open-downloads>بازکردن دانلودها</button>';status.after(box);}return;
 }
 setDownloadBusy(true);setUpdateStatus(Number.isFinite(result?.progress)?'در حال دریافت فایل نصب: '+fa(result.progress)+'٪':result?.message||'در حال دریافت فایل نصب در پوشهٔ دانلودها…');
}
window.onNativeDownload=result=>{showDownloadState(result);if(!result?.permissionPending)ensureDownloadPoll();};
function downloadUpdate(){
 if(!availableUpdate||downloadBusy)return;
 if(window.AndroidZaman){
  if(typeof AndroidZaman.downloadUpdate!=='function'){setUpdateStatus('دریافت آپدیت در این نسخه در دسترس نیست؛ فایل نصب را از لینک انتشار دریافت کنید.');return;}
  updateDownloaded=false;document.querySelector('.update-file-actions')?.remove();setDownloadBusy(true);setUpdateStatus('در حال آغاز دریافت فایل نصب…');
  try{window.onNativeDownload(JSON.parse(AndroidZaman.downloadUpdate(availableUpdate.apkUrl,availableUpdate.sha256)));}catch{stopDownloadPoll();setDownloadBusy(false);setUpdateStatus('دانلود شروع نشد؛ اتصال اینترنت و مجوزهای گوشی را بررسی کنید.');}
 }else{const a=document.createElement('a');a.href=availableUpdate.apkUrl;a.download='ali-mirza-'+availableUpdate.versionName+'.apk';document.body.append(a);a.click();a.remove();setUpdateStatus('فایل نصب را از دانلودهای مرورگر باز و نصب را تأیید کنید.');}
}
window.onNativeInstall=result=>{setUpdateStatus(result?.message||result?.error||(result?.ok?'نصب‌کننده باز می‌شود؛ نصب را در پیام اندروید تأیید کنید.':'بازکردن نصب‌کننده انجام نشد.'));if(result?.permissionPending)toast('مجوز نصب این برنامه را در تنظیمات اندروید تأیید کنید.');};
function installUpdate(){if(typeof window.AndroidZaman?.installDownloadedUpdate==='function'){try{window.onNativeInstall(JSON.parse(AndroidZaman.installDownloadedUpdate()));}catch{setUpdateStatus('نصب‌کننده باز نشد؛ فایل نصب را از دانلودها باز کنید.');}}else if(typeof window.AndroidZaman?.openDownloads==='function')AndroidZaman.openDownloads();else toast('فایل نصب را از دانلودهای مرورگر باز کنید.');}

function showWipeStage(){
 const titles=['پاک‌کردن همهٔ اطلاعات؟','از پاک‌کردن اطلاعات مطمئنید؟','تأیید نهایی پاک‌کردن'];
 const messages=['تمام فعالیت‌ها، مسیر روز، پروژه‌ها، یادآورها و تنظیمات این برنامه پاک می‌شوند. برای ادامه تأیید کنید.','این کار همهٔ روزها و پروژه‌های انجام‌شده و حذف‌شده را هم پاک می‌کند. برای نگهداری اطلاعات، انصراف دهید و پشتیبان بگیرید.','این سومین و آخرین تأیید است. با زدن دکمهٔ زیر، اطلاعات این برنامه پاک و برنامه از ابتدا شروع می‌شود.'];
 document.querySelector('#wipe-title').textContent=titles[wipeStage-1];
 document.querySelector('#wipe-stage').textContent='تأیید '+fa(wipeStage)+' از ۳';
 document.querySelector('#wipe-message').textContent=messages[wipeStage-1];
 document.querySelector('[data-wipe-confirm]').textContent=['ادامه','تأیید دوباره','تأیید نهایی و پاک‌کردن'][wipeStage-1];
 document.querySelector('[data-wipe-cancel]').focus();
}
function startWipeFlow(){if(wipeBusy||memorialDue())return;wipeStage=1;document.querySelector('#wipe-dialog').showModal();showWipeStage();}
function cancelWipeFlow(){if(wipeBusy)return;wipeStage=0;document.querySelector('#wipe-dialog').close();}
function confirmWipeStage(){
 if(wipeBusy||!wipeStage||!document.querySelector('#wipe-dialog').open)return;
 if(wipeStage<3){wipeStage++;showWipeStage();return;}
 wipeBusy=true;
 const previousState=localStorage.getItem(KEY),previousMemorial=localStorage.getItem(MEMORIAL_KEY);
 try{
  if(window.AndroidZaman){if(typeof AndroidZaman.clearAppData!=='function')throw Error('این نسخهٔ اندروید پاک‌کردن کامل را پشتیبانی نمی‌کند.');const result=JSON.parse(AndroidZaman.clearAppData());if(!result.ok)throw Error(result.error||'پاک‌کردن اطلاعات اندروید انجام نشد.');}
  const next=fresh(),now=Date.now(),nextMemorial={startedAt:now,nextAt:now+MEMORIAL_INTERVAL};
  localStorage.setItem(KEY,JSON.stringify(next));localStorage.setItem(MEMORIAL_KEY,JSON.stringify(nextMemorial));
  cancelEndHold();cancelDeleteHold();document.querySelector('#silence').click();
  stopDownloadPoll();downloadBusy=false;updateMessage='';updateDownloaded=false;document.querySelector('.update-file-actions')?.remove();
  state=next;memorialRecord=nextMemorial;tab='today';historyOffset=0;projectId=null;projectsMode='open';reportMode='day';reportAnchor=null;
  wipeStage=0;document.querySelector('#wipe-dialog').close();document.querySelector('#settings-dialog').close();
  save();render();if(typeof updateNativeSounds==='function')updateNativeSounds();toast('همهٔ اطلاعات برنامه پاک شد.');
 }catch(error){
  try{if(previousState===null)localStorage.removeItem(KEY);else localStorage.setItem(KEY,previousState);if(previousMemorial===null)localStorage.removeItem(MEMORIAL_KEY);else localStorage.setItem(MEMORIAL_KEY,previousMemorial);if(typeof nativeSync==='function')nativeSync();}catch{}
  toast(error.message||'پاک‌کردن کامل انجام نشد. دوباره تلاش کنید.');
 }finally{wipeBusy=false;}
}
function routeHash(){const target=location.hash.slice(1),allowed=['today','projects','alarms','activities','reports'];if(allowed.includes(target)){tab=target;render();}else if(target==='settings'){if(!memorialDue())document.querySelector('#settings-dialog').showModal();}}
function handleEnhancementClick(button){if(button.hasAttribute('data-wipe-all')){startWipeFlow();return true;}if(button.hasAttribute('data-wipe-cancel')){cancelWipeFlow();return true;}if(button.hasAttribute('data-wipe-confirm')){confirmWipeStage();return true;}if(button.hasAttribute('data-install-update')){installUpdate();return true;}if(button.hasAttribute('data-education')){showEducation();return true;}if(button.hasAttribute('data-close-education')){document.querySelector('#education-dialog').close();return true;}if(button.dataset.helpSection){showHelp(button.dataset.helpSection);return true;}if(button.hasAttribute('data-help')){showHelp();return true;}if(button.hasAttribute('data-guide-pdf')){downloadGuide();return true;}if(button.hasAttribute('data-close-about')){document.querySelector('#about-dialog').close();return true;}if(button.hasAttribute('data-check-update')){checkForUpdate(true);return true;}if(button.hasAttribute('data-download-update')){downloadUpdate();return true;}if(button.hasAttribute('data-open-downloads')){if(typeof window.AndroidZaman?.openDownloads==='function')AndroidZaman.openDownloads();return true;}return false;}
function initEnhancements(){readMemorial();document.addEventListener('visibilitychange',()=>{if(!document.hidden)restoreUpdateDownload();});document.querySelector('#wipe-dialog').addEventListener('cancel',e=>{e.preventDefault();cancelWipeFlow();});const dialog=document.querySelector('#memorial-dialog');dialog.addEventListener('cancel',e=>e.preventDefault());dialog.addEventListener('close',()=>{if(memorialDue())setTimeout(tickMemorial,0);});document.querySelector('#memorial-confirm').onclick=confirmMemorial;document.querySelector('#memorial-silence').onclick=()=>document.querySelector('#silence').click();document.addEventListener('click',e=>{if(memorialDue()&&!e.target.closest('#memorial-confirm,#memorial-silence,#silence')){e.preventDefault();e.stopImmediatePropagation();tickMemorial();}},true);window.addEventListener('hashchange',routeHash);setTimeout(()=>{routeHash();tickMemorial();checkForUpdate();},0);}
