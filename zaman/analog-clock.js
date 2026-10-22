'use strict';
// Wall-clock only. The activity stopwatch and countdown keep their digital readouts.
function analogClockAngles(value=Date.now()){
 const d=value instanceof Date?value:new Date(value),seconds=d.getSeconds()+d.getMilliseconds()/1000,minutes=d.getMinutes()+seconds/60;
 return {hour:(d.getHours()%12+minutes/60)*30,minute:minutes*6,second:seconds*6};
}
function analogClockMarkup(){
 const numerals=['۱۲','۱','۲','۳','۴','۵','۶','۷','۸','۹','۱۰','۱۱'];
 const ticks=Array.from({length:60},(_,i)=>`<line class="analog-tick ${i%5===0?'analog-hour-tick':''}" x1="56" y1="${i%5===0?10:11}" x2="56" y2="${i%5===0?15:13}" transform="rotate(${i*6} 56 56)"/>`).join('');
 const labels=numerals.map((text,i)=>{const angle=i*Math.PI/6,x=56+34.8*Math.sin(angle),y=56-34.8*Math.cos(angle);return `<text class="analog-number" x="${x.toFixed(2)}" y="${y.toFixed(2)}">${text}</text>`;}).join('');
 return `<span class="analog-clock-shell"><svg id="analog-clock" class="analog-clock" viewBox="3 3 106 106" aria-hidden="true" focusable="false"><circle class="analog-shadow" cx="56" cy="57" r="52"/><circle class="analog-bezel" cx="56" cy="56" r="51"/><circle class="analog-face" cx="56" cy="56" r="47.5"/>${ticks}${labels}<circle class="analog-inner-ring" cx="56" cy="56" r="25"/><path class="analog-hand analog-hour-hand" id="analog-hour-hand" d="M56 59 V34"/><path class="analog-hand analog-minute-hand" id="analog-minute-hand" d="M56 61 V23"/><path class="analog-second-hand" id="analog-second-hand" d="M56 65 V17"/><circle class="analog-hand-pin" cx="56" cy="56" r="3.6"/><circle class="analog-pin-highlight" cx="56" cy="56" r="1.3"/></svg></span>`;
}
function updateAnalogClock(value=Date.now()){
 const host=document.querySelector('#wall-clock');if(!host)return;
 if(!host.querySelector('#analog-clock')){host.innerHTML=analogClockMarkup();host.classList.add('has-analog-clock');}
 const d=value instanceof Date?value:new Date(value),angles=analogClockAngles(d),text=d.toLocaleTimeString('fa-IR',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false});
 for(const hand of ['hour','minute','second'])host.querySelector('#analog-'+hand+'-hand').setAttribute('transform',`rotate(${angles[hand]} 56 56)`);
 host.setAttribute('aria-label','ساعت دستگاه: '+text);host.setAttribute('datetime',d.toISOString());host.setAttribute('title',text);
}
