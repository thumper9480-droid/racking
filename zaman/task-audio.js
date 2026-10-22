'use strict';
const VOICE_DB='ali-mirza-voice-notes-v1',VOICE_CLIP_LIMIT=8*1024*1024,VOICE_RECORD_LIMIT=300000,BACKUP_LIMIT=100*1024*1024;
let voiceDatabase=null,taskAudioDraft=null,taskAudioView=null,backupBusy=false;
function validVoiceMeta(note){return note&&typeof note.id==='string'&&/^[a-f0-9-]{36}$/i.test(note.id)&&Number.isInteger(note.size)&&note.size>0&&note.size<=VOICE_CLIP_LIMIT&&typeof note.mimeType==='string'&&/^audio\/(webm|ogg|mp4|aac|mpeg|x-m4a)(;[^<>]*)?$/.test(note.mimeType)&&Number.isFinite(note.createdAt)&&note.createdAt>=0&&Number.isFinite(note.durationMs)&&note.durationMs>=0&&note.durationMs<=VOICE_RECORD_LIMIT+5000;}
function voiceRefs(value=state){const refs=new Map();for(const project of value.projects||[])for(const task of project.tasks||[])for(const note of task.voiceNotes||[]){if(!validVoiceMeta(note))throw Error('اطلاعات ویس معتبر نیست.');const old=refs.get(note.id);if(old&&JSON.stringify(old)!==JSON.stringify(note))throw Error('شناسهٔ ویس تکراری است.');refs.set(note.id,note);}return refs;}
function openVoiceDatabase(){if(!voiceDatabase)voiceDatabase=new Promise((resolve,reject)=>{const request=indexedDB.open(VOICE_DB,1);request.onupgradeneeded=()=>request.result.createObjectStore('clips',{keyPath:'id'});request.onsuccess=()=>resolve(request.result);request.onerror=()=>{voiceDatabase=null;reject(request.error);};});return voiceDatabase;}
async function voiceStore(mode,operation){const db=await openVoiceDatabase();return new Promise((resolve,reject)=>{const tx=db.transaction('clips',mode),request=operation(tx.objectStore('clips'));let value;if(request)request.onsuccess=()=>value=request.result;tx.oncomplete=()=>resolve(value);tx.onerror=()=>reject(tx.error||Error('ذخیرهٔ صدا انجام نشد.'));tx.onabort=()=>reject(tx.error||Error('ذخیرهٔ صدا انجام نشد.'));});}
const getVoice=id=>voiceStore('readonly',store=>store.get(id));
const putVoice=(id,blob)=>voiceStore('readwrite',store=>store.put({id,blob}));
const deleteVoice=id=>voiceStore('readwrite',store=>store.delete(id));
async function pruneVoiceNotes(){const refs=voiceRefs(),db=await openVoiceDatabase();return new Promise((resolve,reject)=>{const tx=db.transaction('clips','readwrite'),request=tx.objectStore('clips').openCursor();request.onsuccess=()=>{const cursor=request.result;if(cursor){if(!refs.has(cursor.key)&&!taskAudioDraft?.notes.some(n=>n.id===cursor.key))cursor.delete();cursor.continue();}};tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});}
function taskAudioMarkup(editable=true){return `<section class="task-audio"><div class="task-audio-heading"><h3>صداهای کار</h3>${editable?'<button type="button" class="small" data-audio-record>🎙 ضبط ویس</button><button type="button" class="small audio-stop" data-audio-stop hidden>■ پایان ضبط</button>':''}</div><p id="task-audio-status" role="status" aria-live="polite"></p><div id="task-audio-list"></div></section>`;}
function audioStatus(text){const status=document.querySelector('#task-audio-status');if(status)status.textContent=text;}
function releaseAudioPlayers(){if(taskAudioView){for(const player of taskAudioView.players)player.pause();for(const url of taskAudioView.urls)URL.revokeObjectURL(url);}taskAudioView=null;}
function closeTaskAudio(){const draft=taskAudioDraft;taskAudioDraft=null;if(draft){draft.closed=true;clearTimeout(draft.timer);if(draft.nativeId)try{AndroidZaman.cancelVoiceRecording(draft.nativeId);}catch{}if(draft.recorder?.state==='recording')draft.recorder.stop();draft.stream?.getTracks().forEach(track=>track.stop());if(!draft.committed)for(const id of draft.created)deleteVoice(id).catch(()=>{});}releaseAudioPlayers();}
function setupTaskAudio(task,editable){closeTaskAudio();if(editable)taskAudioDraft={notes:(task?.voiceNotes||[]).map(n=>({...n})),created:new Set(),status:'idle',closed:false,committed:false};renderTaskAudio(task?.voiceNotes||[],editable);}
async function renderTaskAudio(notes=taskAudioDraft?.notes||[],editable=!!taskAudioDraft){
 releaseAudioPlayers();const list=document.querySelector('#task-audio-list');if(!list)return;
 const view={urls:[],players:[]};taskAudioView=view;list.replaceChildren();
 for(const [index,note] of notes.entries()){
  const row=document.createElement('div');row.className='task-audio-note';row.dataset.voiceId=note.id;
  const title=document.createElement('span');title.textContent='ویس '+fa(index+1)+' · '+fa(Math.max(1,Math.round(note.durationMs/1000)))+' ثانیه';row.append(title);
  const player=document.createElement('audio');player.controls=true;player.preload='metadata';player.setAttribute('aria-label','پخش ویس '+fa(index+1));row.append(player);view.players.push(player);
  if(editable){const remove=document.createElement('button');remove.type='button';remove.className='small danger';remove.dataset.audioDelete=note.id;remove.textContent='حذف';remove.setAttribute('aria-label','حذف ویس '+fa(index+1));row.append(remove);}
  list.append(row);
  try{const record=await getVoice(note.id);if(taskAudioView!==view)return;if(!record?.blob)throw Error();const url=URL.createObjectURL(record.blob);view.urls.push(url);player.src=url;}catch{if(taskAudioView===view){player.remove();const missing=document.createElement('small');missing.textContent='فایل صدا در دسترس نیست؛ پشتیبان کامل را بازیابی کنید.';row.append(missing);}}
 }
}
function updateAudioButtons(){const draft=taskAudioDraft,record=document.querySelector('[data-audio-record]'),stop=document.querySelector('[data-audio-stop]');if(!record||!stop)return;record.disabled=!!draft&&draft.status!=='idle';stop.hidden=draft?.status!=='recording';document.querySelectorAll('[data-audio-delete]').forEach(button=>button.disabled=draft?.status!=='idle');}
function taskAudioCanSave(){if(taskAudioDraft?.status!=='idle'&&taskAudioDraft){toast('ابتدا ضبط ویس را پایان دهید و تا آماده‌شدن صدا صبر کنید.');return false;}return true;}
function commitTaskAudio(task){if(!taskAudioDraft)return;const draft=taskAudioDraft;if(draft.notes.length)task.voiceNotes=draft.notes.map(n=>({...n}));else delete task.voiceNotes;draft.committed=true;setTimeout(()=>pruneVoiceNotes().catch(()=>{}),0);}
function stopAudioRecording(){const draft=taskAudioDraft;if(draft?.nativeId&&draft.status==='recording'){draft.status='saving';clearTimeout(draft.timer);updateAudioButtons();audioStatus('در حال آماده‌کردن ویس…');try{AndroidZaman.stopVoiceRecording(draft.nativeId);}catch{nativeAudioFailure(draft,'ارتباط ضبط صدا برقرار نشد؛ دوباره تلاش کنید.');}return;}if(draft?.recorder?.state==='recording'){draft.status='saving';clearTimeout(draft.timer);draft.recorder.stop();updateAudioButtons();audioStatus('در حال آماده‌کردن ویس…');}}
async function startAudioRecording(){
 const draft=taskAudioDraft;if(!draft||draft.status!=='idle')return;if(draft.notes.length>=1000){audioStatus('تعداد ویس‌های این کار به سقف مجاز رسیده است.');return;}
 if(typeof window.AndroidZaman?.startVoiceRecording==='function'){draft.nativeId=crypto.randomUUID();draft.nativeParts=[];draft.nativeBytes=0;draft.status='requesting';updateAudioButtons();audioStatus('در انتظار اجازهٔ میکروفن…');try{AndroidZaman.startVoiceRecording(draft.nativeId);}catch{nativeAudioFailure(draft,'شروع ضبط صدا انجام نشد؛ دوباره تلاش کنید.');}return;}
 if(typeof MediaRecorder==='undefined'||!navigator.mediaDevices?.getUserMedia){audioStatus('ضبط صدا در این مرورگر در دسترس نیست؛ از نسخهٔ اندروید یا Chrome به‌روز استفاده کنید.');return;}
 draft.status='requesting';updateAudioButtons();audioStatus('در انتظار اجازهٔ میکروفن…');
 try{
  const stream=await navigator.mediaDevices.getUserMedia({audio:true});if(draft.closed||taskAudioDraft!==draft){stream.getTracks().forEach(track=>track.stop());return;}draft.stream=stream;
  const mimeType=['audio/webm;codecs=opus','audio/mp4','audio/webm','audio/ogg;codecs=opus'].find(type=>MediaRecorder.isTypeSupported(type));
  const recorder=new MediaRecorder(stream,{...(mimeType?{mimeType}:{}),audioBitsPerSecond:48000}),chunks=[];draft.recorder=recorder;draft.startedAt=Date.now();draft.failed=false;
  recorder.ondataavailable=event=>{if(event.data.size)chunks.push(event.data);if(chunks.reduce((sum,chunk)=>sum+chunk.size,0)>VOICE_CLIP_LIMIT){draft.failed=true;stopAudioRecording();}};
  recorder.onerror=()=>{draft.failed=true;stopAudioRecording();};
  recorder.onstop=async()=>{
   clearTimeout(draft.timer);stream.getTracks().forEach(track=>track.stop());if(draft.closed||taskAudioDraft!==draft)return;draft.status='saving';updateAudioButtons();
   try{
    const blob=new Blob(chunks,{type:recorder.mimeType||chunks[0]?.type||'audio/webm'});if(draft.failed||!blob.size||blob.size>VOICE_CLIP_LIMIT)throw Error();
    const note={id:crypto.randomUUID(),size:blob.size,mimeType:blob.type,createdAt:Date.now(),durationMs:Math.min(VOICE_RECORD_LIMIT,Date.now()-draft.startedAt)};if(!validVoiceMeta(note))throw Error();
    await putVoice(note.id,blob);if(draft.closed||taskAudioDraft!==draft){await deleteVoice(note.id);return;}draft.created.add(note.id);draft.notes.push(note);await renderTaskAudio();audioStatus('');
   }catch{audioStatus('ذخیرهٔ ویس انجام نشد؛ فضای خالی و اجازهٔ میکروفن را بررسی کنید.');}
   finally{if(!draft.closed&&taskAudioDraft===draft){draft.status='idle';updateAudioButtons();}}
  };
  recorder.start(1000);draft.status='recording';draft.timer=setTimeout(stopAudioRecording,VOICE_RECORD_LIMIT);for(const track of stream.getAudioTracks())track.onended=stopAudioRecording;updateAudioButtons();audioStatus('در حال ضبط… برای ذخیرهٔ صدا «پایان ضبط» را بزنید.');
 }catch(error){draft.stream?.getTracks().forEach(track=>track.stop());if(taskAudioDraft===draft&&!draft.closed){draft.status='idle';updateAudioButtons();audioStatus(error?.name==='NotAllowedError'?'اجازهٔ میکروفن داده نشد؛ مجوز مرورگر را بررسی کنید.':error?.name==='NotReadableError'?'میکروفن در دسترس نیست؛ برنامهٔ ضبط دیگر و کلید میکروفن گوشی را بررسی کنید.':'شروع ضبط در این مرورگر انجام نشد؛ مرورگر را به‌روز کنید یا از نسخهٔ اندروید استفاده کنید.');}}
}
function nativeAudioFailure(draft,message){if(taskAudioDraft!==draft||draft.closed)return;clearTimeout(draft.timer);if(draft.nativeId)try{AndroidZaman.cancelVoiceRecording(draft.nativeId);}catch{}draft.nativeId=null;draft.nativeParts=[];draft.nativeBytes=0;draft.status='idle';updateAudioButtons();audioStatus(message);}
window.onNativeVoiceChunk=result=>{
 const draft=taskAudioDraft;if(!draft?.nativeId||draft.nativeId!==result?.requestId||draft.closed)return;
 try{if(!Number.isInteger(result.index)||result.index!==draft.nativeParts.length||typeof result.data!=='string'||result.data.length>32768)throw Error();const bytes=Uint8Array.from(atob(result.data),c=>c.charCodeAt(0));draft.nativeBytes+=bytes.length;if(draft.nativeBytes>VOICE_CLIP_LIMIT)throw Error();draft.nativeParts.push(bytes);}catch{nativeAudioFailure(draft,'فایل صدا ناقص دریافت شد؛ دوباره ضبط کنید.');}
};
window.onNativeVoiceResult=async result=>{
 const draft=taskAudioDraft;if(!draft?.nativeId||draft.nativeId!==result?.requestId||draft.closed){if(result?.status==='recording')try{AndroidZaman.cancelVoiceRecording(result.requestId);}catch{}return;}
 if(result.status==='error'){nativeAudioFailure(draft,result.error||'ضبط صدا انجام نشد؛ دوباره تلاش کنید.');return;}
 if(result.status==='recording'){draft.status='recording';draft.timer=setTimeout(stopAudioRecording,VOICE_RECORD_LIMIT);updateAudioButtons();audioStatus('در حال ضبط… برای ذخیرهٔ صدا «پایان ضبط» را بزنید.');return;}
 if(result.status==='saving'){draft.status='saving';clearTimeout(draft.timer);updateAudioButtons();audioStatus('در حال آماده‌کردن ویس…');return;}
 if(result.status!=='finished'||draft.finishingNative)return;
 draft.finishingNative=true;draft.status='saving';clearTimeout(draft.timer);updateAudioButtons();
 try{
  if(result.chunks!==draft.nativeParts.length||result.size!==draft.nativeBytes||result.mimeType!=='audio/mp4')throw Error();
  const blob=new Blob(draft.nativeParts,{type:result.mimeType}),note={id:crypto.randomUUID(),size:blob.size,mimeType:blob.type,createdAt:Date.now(),durationMs:result.durationMs};if(!validVoiceMeta(note))throw Error();
  await putVoice(note.id,blob);if(draft.closed||taskAudioDraft!==draft){await deleteVoice(note.id);return;}draft.created.add(note.id);draft.notes.push(note);await renderTaskAudio();audioStatus('');
 }catch{if(!draft.closed&&taskAudioDraft===draft)audioStatus('ذخیرهٔ فایل صدا انجام نشد؛ فضای خالی گوشی را بررسی کنید.');}
 finally{draft.nativeId=null;draft.nativeParts=[];draft.nativeBytes=0;draft.finishingNative=false;if(taskAudioDraft===draft&&!draft.closed){draft.status='idle';updateAudioButtons();}}
};
async function voiceBlobBase64(blob){const buffer=new Uint8Array(await blob.arrayBuffer());let text='';for(let i=0;i<buffer.length;i+=16384)text+=String.fromCharCode(...buffer.subarray(i,i+16384));return btoa(text);}
async function buildVoiceBackup(){const backup=JSON.parse(JSON.stringify(state)),refs=voiceRefs(backup);if(refs.size){backup.voiceAttachments=[];let size=0;for(const note of refs.values()){const record=await getVoice(note.id);if(!record?.blob||record.blob.size!==note.size)throw Error('یک ویس در دسترس نیست؛ ابتدا پشتیبان کامل آن را بازیابی کنید.');size+=record.blob.size;if(size>BACKUP_LIMIT*.7)throw Error('حجم ویس‌ها برای پشتیبان JSON بیش از حد است.');backup.voiceAttachments.push({id:note.id,data:await voiceBlobBase64(record.blob)});}}return backup;}
async function exportAppBackup(native=false){if(backupBusy)return;backupBusy=true;try{const backup=await buildVoiceBackup(),text=JSON.stringify(backup,null,2);if(new Blob([text]).size>BACKUP_LIMIT)throw Error('حجم پشتیبان بیش از ۱۰۰ مگابایت است.');if(native&&typeof window.AndroidZaman?.export==='function'){AndroidZaman.export(text);return;}const url=URL.createObjectURL(new Blob([text],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='zaman-backup.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch(error){toast(error.message||'دریافت پشتیبان انجام نشد.');}finally{backupBusy=false;}}
async function restoreVoiceBackup(backup){
 const next={...backup};delete next.voiceAttachments;validate(next);const refs=voiceRefs(next),attachments=backup.voiceAttachments||[];if(!Array.isArray(attachments)||attachments.length!==refs.size)throw Error('پشتیبان کامل ویس‌ها موجود نیست.');
 const records=[],seen=new Set();for(const item of attachments){const note=refs.get(item?.id);if(!note||seen.has(item.id)||typeof item.data!=='string'||item.data.length>Math.ceil(VOICE_CLIP_LIMIT/3)*4||/[^A-Za-z0-9+/=]/.test(item.data))throw Error('فایل ویس معتبر نیست.');seen.add(item.id);const bytes=Uint8Array.from(atob(item.data),c=>c.charCodeAt(0));if(bytes.length!==note.size)throw Error('فایل ویس ناقص است.');records.push({id:note.id,blob:new Blob([bytes],{type:note.mimeType})});}
 if(records.length)await voiceStore('readwrite',store=>{for(const record of records)store.put(record);});return next;
}
async function clearVoiceNotes(){closeTaskAudio();await voiceStore('readwrite',store=>store.clear());}
document.addEventListener('click',event=>{const button=event.target.closest('button');if(!button)return;if(button.hasAttribute('data-audio-record')){stopTaskVoice();startAudioRecording();}else if(button.hasAttribute('data-audio-stop'))stopAudioRecording();else if(button.dataset.audioDelete&&taskAudioDraft?.status==='idle'){taskAudioDraft.notes=taskAudioDraft.notes.filter(note=>note.id!==button.dataset.audioDelete);renderTaskAudio();}});
document.addEventListener('visibilitychange',()=>{if(document.hidden)stopAudioRecording();});
