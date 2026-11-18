'use strict';
// Local wall time, in 24-hour HH:MM. Stopwatches keep their own seconds.
const wallDigitSegments=['abcdef','bc','abdeg','abcdg','bcfg','acdfg','acdefg','abc','abcdefg','abcdfg'];
function sevenSegmentMarkup(text,id){
 const shapes={a:'7,2 33,2 38,7 33,12 7,12 2,7',b:'34,13 39,8 39,32 34,37 29,32 29,18',c:'34,39 39,44 39,68 34,73 29,68 29,44',d:'7,66 27,66 32,71 27,76 7,76 2,71',e:'1,44 6,39 11,44 11,62 6,67 1,62',f:'1,14 6,9 11,14 11,32 6,37 1,32',g:'7,34 27,34 32,39 27,44 7,44 2,39'};
 const digit=x=>`<g class="wall-digit" transform="translate(${x} 0)">${Object.entries(shapes).map(([name,points])=>`<polygon data-segment="${name}" points="${points}"/>`).join('')}</g>`;
 let x=0;
 const parts=Array.from(text,char=>{
  if(char===':'){
   const colon=`<g class="wall-colon"><circle cx="${x+6}" cy="24" r="4"/><circle cx="${x+6}" cy="55" r="4"/></g>`;
   x+=19;
   return colon;
  }
  const segment=digit(x);
  x+=45;
  return segment;
 });
 return `<svg id="${id}" viewBox="0 0 ${x-5} 78" width="${x-5}" height="78" aria-hidden="true" focusable="false">${parts.join('')}</svg>`;
}
function paintSevenSegment(host,text,id,label){
 if(host.dataset.time===text)return;
 if(!host.querySelector('#'+id)||host.dataset.time?.length!==text.length){
  host.innerHTML=sevenSegmentMarkup(text,id);
  host.classList.add('has-segment-clock');
 }
 const values=text.replaceAll(':','');
 host.querySelectorAll('.wall-digit').forEach((digit,i)=>{
  const active=wallDigitSegments[Number(values[i])];
  digit.querySelectorAll('[data-segment]').forEach(segment=>segment.classList.toggle('lit',active.includes(segment.dataset.segment)));
 });
 host.dataset.time=text;
 const localized=text.replace(/\d/g,n=>'۰۱۲۳۴۵۶۷۸۹'[n]);
 host.setAttribute('aria-label',label+'، '+localized);
}
function updateWallClock(value=Date.now()){
 const host=document.querySelector('#wall-clock');
 if(!host)return;
 const d=value instanceof Date?value:new Date(value);
 const text=String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');
 paintSevenSegment(host,text,'seven-segment-clock','ساعت دستگاه');
 host.setAttribute('title',text);
 host.setAttribute('datetime',d.toISOString());
}
function updateCurrentSegmentClock(ms){
 const host=document.querySelector('#day-clock');
 if(!host)return;
 const seconds=Math.floor(Math.max(0,ms)/1000);
 const text=[Math.floor(seconds/3600),Math.floor(seconds/60)%60,seconds%60].map(value=>String(value).padStart(2,'0')).join(':');
 paintSevenSegment(host,text,'seven-segment-activity-clock',host.dataset.clockLabel||'زمان فعالیت جاری');
}
