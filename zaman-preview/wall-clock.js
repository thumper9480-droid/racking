'use strict';
// Local wall time, in 24-hour HH:MM. Stopwatches keep their own seconds.
const wallDigitSegments=['abcdef','bc','abdeg','abcdg','bcfg','acdfg','acdefg','abc','abcdefg','abcdfg'];
function wallClockMarkup(){
 const shapes={a:'7,2 33,2 38,7 33,12 7,12 2,7',b:'34,13 39,8 39,32 34,37 29,32 29,18',c:'34,39 39,44 39,68 34,73 29,68 29,44',d:'7,66 27,66 32,71 27,76 7,76 2,71',e:'1,44 6,39 11,44 11,62 6,67 1,62',f:'1,14 6,9 11,14 11,32 6,37 1,32',g:'7,34 27,34 32,39 27,44 7,44 2,39'};
 const digit=x=>`<g class="wall-digit" transform="translate(${x} 0)">${Object.entries(shapes).map(([name,points])=>`<polygon data-segment="${name}" points="${points}"/>`).join('')}</g>`;
 return `<svg id="seven-segment-clock" viewBox="0 0 194 78" aria-hidden="true" focusable="false">${digit(0)}${digit(45)}<g class="wall-colon"><circle cx="96" cy="24" r="4"/><circle cx="96" cy="55" r="4"/></g>${digit(109)}${digit(154)}</svg>`;
}
function updateWallClock(value=Date.now()){
 const host=document.querySelector('#wall-clock');if(!host)return;
 if(!host.querySelector('#seven-segment-clock')){host.innerHTML=wallClockMarkup();host.classList.add('has-segment-clock');}
 const d=value instanceof Date?value:new Date(value),text=String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');
 if(host.dataset.time!==text){
  host.querySelectorAll('.wall-digit').forEach((digit,i)=>{const active=wallDigitSegments[Number(text.replace(':','')[i])];digit.querySelectorAll('[data-segment]').forEach(segment=>segment.classList.toggle('lit',active.includes(segment.dataset.segment)));});
  host.dataset.time=text;host.setAttribute('aria-label','ساعت دستگاه: '+text.replace(/\d/g,n=>'۰۱۲۳۴۵۶۷۸۹'[n]));host.setAttribute('title',text);
 }
 host.setAttribute('datetime',d.toISOString());
}
