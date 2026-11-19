'use strict';
let taskMediaDB,mediaView;
function mediaDB(){
 if(!taskMediaDB)taskMediaDB=new Promise((resolve,reject)=>{
  const request=indexedDB.open('ali-mirza-task-media-v1',1);
  request.onupgradeneeded=()=>request.result.createObjectStore('files',{keyPath:'id'}).createIndex('task','task');
  request.onsuccess=()=>resolve(request.result);
  request.onerror=()=>{taskMediaDB=null;reject(request.error);};
 });
 return taskMediaDB;
}
async function mediaTransaction(mode,perform){
 const db=await mediaDB();
 return new Promise((resolve,reject)=>{
  const tx=db.transaction('files',mode),request=perform(tx.objectStore('files'));
  tx.oncomplete=()=>resolve(request?.result);
  tx.onabort=tx.onerror=()=>reject(tx.error||Error('ذخیرهٔ پیوست انجام نشد.'));
 });
}
function closeTaskMedia(){
 if(!mediaView)return;
 for(const url of mediaView.urls)URL.revokeObjectURL(url);
 mediaView=null;
}
function deleteTaskMedia(projectId,taskId){
 const task=JSON.stringify([projectId,taskId]);
 return mediaTransaction('readwrite',store=>{
  const cursor=store.index('task').openCursor(task);
  cursor.onsuccess=()=>{if(cursor.result){cursor.result.delete();cursor.result.continue();}};
 });
}
function clearTaskMedia(){return mediaTransaction('readwrite',store=>store.clear());}
function setupTaskMedia(task,projectId){
 closeTaskMedia();
 const wrap=document.createElement('section');
 wrap.className='task-media';
 wrap.innerHTML='<h3>عکس و ویدئو</h3><div class="task-media-controls"><label class="small">عکس با دوربین<input type="file" accept="image/*" capture="environment" aria-label="عکس با دوربین"></label><label class="small">ویدئو با دوربین<input type="file" accept="video/*" capture="environment" aria-label="ویدئو با دوربین"></label><label class="small">گالری<input type="file" accept="image/*,video/*" aria-label="انتخاب عکس یا ویدئو از گالری"></label></div><p role="status"></p><div class="task-media-list"></div>';
 const form=document.querySelector('#form');
 form.querySelector('.actions').before(wrap);
 const view={urls:[],task:JSON.stringify([projectId,task.id])};
 mediaView=view;
 const status=wrap.querySelector('[role=status]'),list=wrap.querySelector('.task-media-list');
 function exists(){return state.projects.some(p=>p.id===projectId&&!p.deletedAt&&p.tasks.some(t=>t.id===task.id));}
 let renderSequence=0;
 async function show(){
  const sequence=++renderSequence;
  try{
   const files=await mediaTransaction('readonly',store=>store.index('task').getAll(view.task));
   if(view!==mediaView||sequence!==renderSequence)return;
   for(const url of view.urls)URL.revokeObjectURL(url);
   view.urls.length=0;
   list.replaceChildren();
   for(const record of files){
    const isVideo=record.file.type.startsWith('video/');
    const row=document.createElement('div'),preview=document.createElement(isVideo?'video':'img');
    const url=URL.createObjectURL(record.file);view.urls.push(url);
    if(isVideo){preview.controls=true;preview.preload='metadata';preview.playsInline=true;}
    else preview.alt=record.file.name||'تصویر پیوست';
    preview.src=url;
    const label=document.createElement('span');label.textContent=record.file.name||'پیوست';
    const remove=document.createElement('button');remove.type='button';remove.className='small';remove.textContent='حذف پیوست';
    remove.onclick=async()=>{try{await mediaTransaction('readwrite',store=>store.delete(record.id));await show();}catch{status.textContent='پیوست حذف نشد.';}};
    row.append(preview,label);if(isVideo)row.append(playbackSpeedButton(preview));row.append(remove);list.append(row);
   }
  }catch{if(view===mediaView)status.textContent='خواندن پیوست‌ها انجام نشد.';}
 }
 for(const input of wrap.querySelectorAll('input'))input.onchange=async()=>{
  const file=input.files[0];input.value='';
  if(!file||!exists())return;
  if(!/^(image|video)\//.test(file.type)){status.textContent='یک فایل عکس یا ویدئو انتخاب کنید.';return;}
  try{
   const id=uid();
   await mediaTransaction('readwrite',store=>store.put({id,task:view.task,file}));
   if(!exists())await mediaTransaction('readwrite',store=>store.delete(id));
   else if(view===mediaView){status.textContent='پیوست ذخیره شد.';await show();}
  }catch{status.textContent='ذخیرهٔ پیوست انجام نشد. فضای دستگاه را بررسی کنید.';}
 };
 void show();
}

function playbackSpeedButton(player){
 const speeds=[1,1.5,2];
 let index=0;
 const button=document.createElement('button');
 button.type='button';button.className='small playback-speed';button.textContent='۱×';
 button.setAttribute('aria-label','سرعت پخش ۱ برابر');
 button.onclick=()=>{
  index=(index+1)%speeds.length;
  const speed=speeds[index];
  player.defaultPlaybackRate=speed;
  player.playbackRate=speed;
  button.textContent=fa(speed)+'×';
  button.setAttribute('aria-label','سرعت پخش '+fa(speed)+' برابر');
 };
 player.addEventListener('loadedmetadata',()=>{player.playbackRate=speeds[index];});
 return button;
}
