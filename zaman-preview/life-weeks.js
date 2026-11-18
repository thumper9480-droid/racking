'use strict';

const LIFE_WEEKS_TITLE='هفته‌های باقی‌مانده عمرتان';
const LIFE_DAY_MS=86400000;
const emptyLifeWeeksForm={years:'',birthYear:'',birthMonth:'',birthDay:''};

function lifeCalendarDay(date){
 return Date.UTC(date.getFullYear(),date.getMonth(),date.getDate())/LIFE_DAY_MS;
}

function calculateLifeWeeks(values,today=new Date()){
 const digits=value=>asciiDigits(value??'').trim();
 const raw=[values.years,values.birthYear,values.birthMonth,values.birthDay].map(digits);
 if(raw.some(value=>!/^\d+$/.test(value)))return {error:'تاریخ تولد شمسی و تعداد سال را با عدد وارد کنید.'};
 const [years,year,month,day]=raw.map(Number);
 if(years<1||years>130)return {error:'تعداد سال باید بین ۱ و ۱۳۰ باشد.'};
 const birth=persianToLocal(year,month,day,1200);
 if(!birth||lifeCalendarDay(birth)>lifeCalendarDay(today))return {error:'تاریخ تولد شمسی معتبر وارد کنید. تاریخ تولد نمی‌تواند در آینده باشد.'};
 // When the birth date was leap day, use the final day of Esfand in a non-leap target year.
 const target=persianToLocal(year+years,month,day,1200)
  ||(month===12&&day===30?persianToLocal(year+years,12,29,1200):null);
 if(!target)return {error:'تاریخ پایان بازه از این ورودی‌ها قابل محاسبه نیست.'};
 const total=Math.floor((lifeCalendarDay(target)-lifeCalendarDay(birth))/7);
 const elapsed=Math.floor((lifeCalendarDay(today)-lifeCalendarDay(birth))/7);
 return {total,elapsed,remaining:Math.max(0,total-elapsed)};
}

function lifeWeekNumber(value){
 return value.toLocaleString('fa-IR');
}

function lifeWeekPercent(count,total){
 return (count/total).toLocaleString('fa-IR',{style:'percent',maximumFractionDigits:1});
}

function lifeWeeksResults(result){
 if(!result)return '';
 const {total,elapsed,remaining}=result;
 const rows=[];
 for(let start=0;start<total;start+=52){
  const squares=Array.from({length:Math.min(52,total-start)},(_,i)=>
   '<span class="life-week '+(start+i<elapsed?'life-week-past':'life-week-future')+'"></span>').join('');
  rows.push('<div class="life-week-row"><span class="life-row-label">'+lifeWeekNumber(start+1)+'</span><div class="life-week-cells">'+squares+'</div></div>');
 }
 const metrics=[['کل هفته‌ها',total,''],['هفته‌های گذشته',elapsed,'past'],['هفته‌های باقی‌مانده',remaining,'future']];
 const summary=metrics.map(([label,n,kind])=>'<div class="life-metric '+kind+'"><span>'+label+'</span><strong>'+lifeWeekNumber(n)+'</strong><small class="life-metric-percent">'+lifeWeekPercent(n,total)+'</small></div>').join('');
 return '<div class="life-metrics">'+summary+'</div>'
  +(elapsed>=total?'<p class="life-explainer">تعداد هفته‌های سپری‌شده به بازهٔ واردشده رسیده یا از آن گذشته است.</p>':'')
  +'<ul class="life-week-legend" aria-label="راهنمای رنگ‌ها"><li><i class="life-week-past" aria-hidden="true"></i>هفته‌های گذشته</li><li><i class="life-week-future" aria-hidden="true"></i>هفته‌های باقی‌مانده</li></ul>'
  +'<div class="life-week-scroll" role="region" tabindex="0" aria-label="جدول هفته‌های عمر. هر خانه یک هفته است. شماره‌های کنار جدول، آغاز ردیف‌ها را نشان می‌دهند."><div class="life-week-grid" style="--life-row-count:'+rows.length+'" aria-hidden="true">'+rows.join('')+'</div></div>';
}

function lifeWeeksPage(){
 const stored=state.lifeWeeks;
 const estimate=stored?calculateLifeWeeks(stored):null;
 const values=estimate&&!estimate.error?stored:emptyLifeWeeksForm;
 const field=(name,label,limit)=>'<label>'+label+'<input type="text" inputmode="numeric" name="'+name+'" maxlength="'+limit+'" value="'+esc(values[name])+'" required></label>';
 return '<section class="card life-weeks-page" aria-labelledby="life-weeks-title">'
  +'<h2 id="life-weeks-title">'+LIFE_WEEKS_TITLE+'</h2>'
  +'<form id="life-weeks-form" class="life-weeks-form">'
  +'<fieldset><legend>میانگین عمر یک انسان</legend>'+field('years','تعداد سال',3)+'</fieldset>'
  +'<fieldset><legend>تاریخ تولد شمسی</legend><div class="life-birth">'+field('birthDay','روز',2)+field('birthMonth','ماه',2)+field('birthYear','سال',4)+'</div></fieldset>'
  +'<button type="submit" class="primary">نمایش هفته‌ها</button>'
  +'</form><p id="life-weeks-error" class="life-weeks-error" role="alert" hidden></p>'
  +'<p class="life-explainer">این یک برآورد بر اساس تعداد سالی است که وارد می‌کنید. هر خانه یک هفتهٔ کامل است.</p>'
  +'<div id="life-weeks-results" aria-live="polite">'+lifeWeeksResults(estimate&&!estimate.error?estimate:null)+'</div></section>';
}

document.addEventListener('submit',event=>{
 if(event.target.id!=='life-weeks-form')return;
 event.preventDefault();
 const entries=new FormData(event.target);
 const values=Object.fromEntries(Object.keys(emptyLifeWeeksForm).map(name=>[name,asciiDigits(String(entries.get(name)||'')).trim()]));
 const calculated=calculateLifeWeeks(values),error=document.querySelector('#life-weeks-error');
 error.textContent=calculated.error||'';
 error.hidden=!calculated.error;
 if(!calculated.error){
  state.lifeWeeks=values;
  save();
 }
 document.querySelector('#life-weeks-results').innerHTML=lifeWeeksResults(calculated.error?null:calculated);
});
