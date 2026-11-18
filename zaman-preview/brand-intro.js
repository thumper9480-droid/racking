'use strict';

(()=>{
 const root=document.querySelector('#brand-intro');
 if(!root)return;
 const stage=root.querySelector('.amd-stage'),brand=root.closest('#today-brand');
 const wordmark=brand.querySelector(':scope > img'),weeks=brand.querySelector('#brand-weeks-tile');
 const stars=root.querySelector('.amd-stars'),replay=brand.querySelector('#replay-brand-intro');
 if(!wordmark||!weeks||!replay)return;
 const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)');
 let initialStarted=false,running=false,restoreFocus=false,finishTimer;

 function finish(){
  window.clearTimeout(finishTimer);
  root.hidden=true;
  stage.classList.remove('amd-playing');
  brand.classList.remove('brand-intro-active');
  wordmark.hidden=true;
  weeks.hidden=false;
  running=false;
  if(restoreFocus&&document.activeElement===document.body)replay.focus({preventScroll:true});
  restoreFocus=false;
 }
 function startOnOpen(){
  if(initialStarted||document.hidden)return;
  initialStarted=true;
  document.removeEventListener('visibilitychange',startOnOpen);
  if(reducedMotion.matches)finish();
  else void play();
 }
 async function play(){
  if(running||document.hidden)return;
  if(reducedMotion.matches){
   replay.animate?.([{opacity:.55},{opacity:1}],{duration:180});
   return;
  }
  running=true;
  restoreFocus=document.activeElement===replay;
  weeks.hidden=true;
  wordmark.hidden=false;
  const images=[wordmark,root.querySelector('.amd-bloom img')];
  const imageReady=images.map(img=>typeof img.decode==='function'?img.decode():Promise.resolve());
  const fontsReady=document.fonts?[document.fonts.load('700 45px "Noto Nastaliq Urdu"','پدرم'),document.fonts.load('900 16px Vazirmatn','به یاد معدن معرفت')]:[];
  await Promise.race([
   Promise.allSettled([...imageReady,...fontsReady]),
   new Promise(resolve=>window.setTimeout(resolve,900))
  ]);
  const tones=['#c59734','#e0b957','#8ac7ac','#6da88e','#9474a0'];
  stars.replaceChildren();
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
 replay.addEventListener('click',()=>{void play();});
 document.addEventListener('visibilitychange',startOnOpen);
 startOnOpen();
})();
