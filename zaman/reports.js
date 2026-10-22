'use strict';
// Reports use their own selected period; daily history navigation remains independent.
let reportMode='day',reportAnchor=null,reportLastUpdate=0;
const reportPeriodLabels={day:'روزانه',week:'هفتگی',month:'ماهانه',year:'سالانه'};
function reportLocalDay(value){const d=new Date(value);d.setHours(0,0,0,0);return d;}
function reportJalaliParts(value){const d=new Date(value);return jalaliParts(new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())));}
function reportPersianStart(year,month){const d=persianToLocal(year,month,1);if(!d)return null;d.setHours(0,0,0,0);return d;}
function reportRange(mode=reportMode,anchor=reportAnchor??Date.now()){
 let start=reportLocalDay(anchor),end;
 if(mode==='week'){start.setDate(start.getDate()-(start.getDay()+1)%7);end=new Date(start);end.setDate(end.getDate()+7);}
 else if(mode==='month'||mode==='year'){const parts=reportJalaliParts(start),month=mode==='year'?1:parts.month;start=reportPersianStart(parts.year,month);end=mode==='year'?reportPersianStart(parts.year+1,1):reportPersianStart(parts.year+(month===12?1:0),month===12?1:month+1);}
 else{end=new Date(start);end.setDate(end.getDate()+1);}
 if(!start||!end)return null;return {start:start.getTime(),end:end.getTime()};
}
function reportData(range=reportRange(),now=Date.now()){
 const groups=new Map();let total=0,intervals=0;
 function add(name,start,end){const duration=Math.max(0,Math.min(end,range.end,now)-Math.max(start,range.start));if(!duration)return;const key=normalizeActivity(name),item=groups.get(key)||{name,duration:0,count:0};item.duration+=duration;item.count++;groups.set(key,item);total+=duration;intervals++;}
 if(range){for(const h of state.history){if(h.durationOnly){if(h.start>=range.start&&h.start<range.end&&h.start<=now){const key=normalizeActivity(h.name),item=groups.get(key)||{name:h.name,duration:0,count:0};item.duration+=h.durationMs;item.count++;groups.set(key,item);total+=h.durationMs;intervals++;}}else add(h.name,h.start,h.end);}const pending=state.pendingSegment;if(pending)add('در انتظار ثبت',pending.start,pending.end);if(state.day&&!(pending?.ending&&!pending.detached))add('فعالیت جاری',state.day.segment,journalLiveEnd(now));}
 const entries=[...groups.values()].sort((a,b)=>b.duration-a.duration||a.name.localeCompare(b.name,'fa'));return {entries,total,intervals};
}
function reportDate(value){return new Date(value).toLocaleDateString('fa-IR',{year:'numeric',month:'2-digit',day:'2-digit'});}
function reportPeriodTitle(range){if(!range)return '';if(reportMode==='day')return new Date(range.start).toLocaleDateString('fa-IR',{weekday:'long',year:'numeric',month:'long',day:'numeric'});if(reportMode==='year')return 'سال '+fa(reportJalaliParts(range.start).year);if(reportMode==='month'){const parts=reportJalaliParts(range.start);return monthNames[parts.month-1]+' '+fa(parts.year);}return `${reportDate(range.start)} تا ${reportDate(range.end-1)}`;}
function reportResults(range=reportRange(),now=Date.now()){
 const data=reportData(range,now);return `<div class="report-summary"><div><span>جمع زمان فعالیت‌ها</span><strong id="report-total">${data.total?activityDuration(data.total):'۰۰:۰۰'}</strong></div><div><span>تعداد فعالیت‌ها</span><strong>${fa(data.entries.length)}</strong></div><div><span>بازه‌های ثبت‌شده</span><strong>${fa(data.intervals)}</strong></div></div>${data.entries.length?`<div class="report-table-scroll"><table class="report-table"><thead><tr><th scope="col">فعالیت</th><th scope="col">مدت</th><th scope="col">سهم</th><th scope="col">تعداد</th></tr></thead><tbody>${data.entries.map(item=>{const percent=item.duration/data.total*100;return `<tr data-report-name="${esc(item.name)}" data-duration="${item.duration}" data-percent="${percent}"><td><b>${esc(item.name)}</b><span class="report-bar" aria-hidden="true"><i style="width:${percent}%;background:${activityColor(item.name)}"></i></span></td><td class="report-duration">${activityDuration(item.duration)}</td><td>${fa(percent.toLocaleString('en-US',{maximumFractionDigits:1}))}٪</td><td>${fa(item.count)}</td></tr>`;}).join('')}</tbody></table></div>`:'<p class="report-empty">فعالیتی برای این بازه ثبت نشده است.</p>'}`;
}
function reportsPage(){
 const range=reportRange(),current=reportRange(reportMode,Date.now());return `<div class="row reports-heading"><h2>گزارش‌های فعالیت</h2><button type="button" class="small" data-report-back>← فعالیت‌ها</button></div><div class="report-period-tabs" role="group" aria-label="دورهٔ گزارش">${Object.entries(reportPeriodLabels).map(([mode,label])=>`<button type="button" data-report-mode="${mode}" aria-pressed="${mode===reportMode}" class="${mode===reportMode?'selected':''}">${label}</button>`).join('')}</div><article class="card reports-card"><div class="report-period-nav"><button type="button" class="small" data-report-step="-1" aria-label="بازهٔ قبل">→</button><div><h3 id="report-period-title">${reportPeriodTitle(range)}</h3><button type="button" class="report-current" data-report-current>بازهٔ جاری</button></div><button type="button" class="small" data-report-step="1" aria-label="بازهٔ بعد" ${!range||range.start>=current.start?'disabled':''}>←</button></div><p class="report-note">${reportMode==='week'?'هفته از شنبه تا جمعه محاسبه می‌شود.':reportMode==='month'||reportMode==='year'?'بازه بر اساس تقویم شمسی محاسبه می‌شود.':'زمان هر فعالیت در همین روز محاسبه می‌شود.'} مدت‌ها به صورت ساعت:دقیقه هستند.</p><div id="report-results">${reportResults(range)}</div></article>`;
}
function handleReportClick(button){
 if(button.hasAttribute('data-report-back')){tab='activities';render();return true;}
 if(button.dataset.reportMode){const mode=button.dataset.reportMode;if(!(mode in reportPeriodLabels))return true;reportMode=mode;render();return true;}
 if(button.hasAttribute('data-report-current')){reportAnchor=null;render();return true;}
 if(button.dataset.reportStep){const step=Number(button.dataset.reportStep);if(![-1,1].includes(step))return true;const range=reportRange(),current=reportRange(reportMode,Date.now());if(!range||step>0&&range.start>=current.start)return true;let anchor;
  if(reportMode==='day'||reportMode==='week'){anchor=new Date(range.start);anchor.setDate(anchor.getDate()+step*(reportMode==='week'?7:1));}
  else{const parts=reportJalaliParts(range.start);let year=parts.year,month=parts.month;if(reportMode==='year')year+=step;else{month+=step;if(month===0){month=12;year--;}if(month===13){month=1;year++;}}anchor=reportPersianStart(year,month);}
  if(!anchor){toast('بازهٔ انتخابی خارج از محدودهٔ تقویم است.');return true;}reportAnchor=anchor.getTime();render();return true;}
 return false;
}
function tickReports(now=Date.now()){const results=document.querySelector('#report-results');if(!results||now-reportLastUpdate<1000)return;reportLastUpdate=now;const scrollTop=results.querySelector('.report-table-scroll')?.scrollTop||0;results.innerHTML=reportResults(reportRange(),now);const table=results.querySelector('.report-table-scroll');if(table)table.scrollTop=scrollTop;}
