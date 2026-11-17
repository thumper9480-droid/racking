'use strict';

(()=>{
 const root=document.querySelector('#brand-intro');
 if(!root||window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
 const stage=root.querySelector('.amd-stage'),main=root.closest('main');
 const stars=root.querySelector('.amd-stars');
 let opened=false,finishTimer;

 function finish(){
  window.clearTimeout(finishTimer);
  root.hidden=true;
  main.classList.remove('brand-intro-active');
 }

 async function start(){
  if(opened||document.hidden)return;
  opened=true;
  document.removeEventListener('visibilitychange',start);
  const images=[main.querySelector('#today-brand img'),root.querySelector('.amd-bloom img')];
  const imageReady=images.map(img=>typeof img.decode==='function'?img.decode():Promise.resolve());
  const fontsReady=document.fonts?[document.fonts.load('700 45px "Noto Nastaliq Urdu"','پدرم'),document.fonts.load('900 16px Vazirmatn','به یاد معدنی از معرفت')]:[];
  await Promise.race([
   Promise.allSettled([...imageReady,...fontsReady]),
   new Promise(resolve=>window.setTimeout(resolve,900))
  ]);
  const tones=['#c59734','#e0b957','#8ac7ac','#6da88e','#9474a0'];
  for(let i=0;i<36;i++){
   const star=document.createElement('i');
   star.className='amd-star';
   const props={x:`${3+(i*29)%94}%`,size:`${4+(i*5)%10}px`,color:tones[i%tones.length],
    delay:`${3.86+((i*13)%40)/100}s`,time:`${.9+((i*11)%36)/100}s`,
    drift:`${(i*17)%82-41}px`,drop:`${105+(i*47)%175}px`,turn:`${((i*67)%240)-120}deg`};
   for(const [name,value] of Object.entries(props))star.style.setProperty(`--star-${name}`,value);
   stars.append(star);
  }
  root.hidden=false;
  main.classList.add('brand-intro-active');
  stage.classList.add('amd-playing');
  finishTimer=window.setTimeout(finish,6450);
 }

 stage.addEventListener('animationend',event=>{if(event.animationName==='amd-wordmark')finish();});
 document.addEventListener('visibilitychange',start);
 void start();
})();
