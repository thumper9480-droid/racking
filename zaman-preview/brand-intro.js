'use strict';

(()=>{
 const root=document.querySelector('#brand-intro');
 if(!root||window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
 const stage=root.querySelector('.amd-stage'),brand=root.closest('#today-brand');
 const stars=root.querySelector('.amd-stars');
 let opened=false,finishTimer;

 function finish(){
  window.clearTimeout(finishTimer);
  root.hidden=true;
  brand.classList.remove('brand-intro-active');
 }

 async function start(){
  if(opened||document.hidden)return;
  opened=true;
  document.removeEventListener('visibilitychange',start);
  const images=[brand.querySelector(':scope > img'),root.querySelector('.amd-bloom img')];
  const imageReady=images.map(img=>typeof img.decode==='function'?img.decode():Promise.resolve());
  const fontsReady=document.fonts?[document.fonts.load('700 45px "Noto Nastaliq Urdu"','پدرم'),document.fonts.load('900 16px Vazirmatn','به یاد معدن معرفت')]:[];
  await Promise.race([
   Promise.allSettled([...imageReady,...fontsReady]),
   new Promise(resolve=>window.setTimeout(resolve,900))
  ]);
  const tones=['#c59734','#e0b957','#8ac7ac','#6da88e','#9474a0'];
  for(let i=0;i<36;i++){
   const star=document.createElement('i');
   star.className='amd-star';
   const props={x:`${3+(i*29)%94}%`,size:`${2+(i*3)%5}px`,color:tones[i%tones.length],
    delay:`${4.08+((i*13)%38)/100}s`,time:`${.56+((i*11)%26)/100}s`,
    drift:`${(i*17)%30-15}px`,drop:`${43+(i*47)%40}px`,turn:`${((i*67)%240)-120}deg`};
   for(const [name,value] of Object.entries(props))star.style.setProperty(`--star-${name}`,value);
   stars.append(star);
  }
  root.hidden=false;
  brand.classList.add('brand-intro-active');
  stage.classList.add('amd-playing');
  finishTimer=window.setTimeout(finish,6750);
 }

 stage.addEventListener('animationend',event=>{if(event.animationName==='amd-wordmark')finish();});
 document.addEventListener('visibilitychange',start);
 void start();
})();
