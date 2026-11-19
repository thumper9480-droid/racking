'use strict';
(()=>{
 const button=document.querySelector('#replay-brand-intro'),panel=document.querySelector('#brand-intro');
 const tile=document.querySelector('#brand-weeks-tile'),mark=document.querySelector('#today-brand > img');
 if(!button||!panel||!tile)return;
 if(mark)mark.hidden=true;
 tile.hidden=false;
 const scenes=[...panel.querySelectorAll('[data-logo-scene]')];
 const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
 let active=false;
 button.onclick=async()=>{
  if(active)return;
  active=true;
  const focused=document.activeElement===button;
  button.style.visibility='hidden';
  panel.hidden=false;
  for(const [index,scene] of scenes.entries()){
   await wait(index===0?430:25);
   scene.classList.add('visible');
   await wait(index===0?1500:1800);
   scene.classList.add('leaving');scene.classList.remove('visible');
   await wait(430);scene.classList.remove('leaving');
  }
  panel.hidden=true;
  button.style.visibility='';
  if(focused&&document.activeElement===document.body)button.focus({preventScroll:true});
  active=false;
 };
 button.click();
})();
