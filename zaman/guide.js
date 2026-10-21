'use strict';
document.querySelector('#guide-print')?.addEventListener('click',()=>window.print());
let guideOpenStates;
window.addEventListener('beforeprint',()=>{guideOpenStates=[...document.querySelectorAll('details')].map(el=>({el,open:el.open}));guideOpenStates.forEach(({el})=>el.open=true);});
window.addEventListener('afterprint',()=>{guideOpenStates?.forEach(({el,open})=>el.open=open);});

if(window.AndroidZaman?.openGuide){document.querySelector('#guide-download')?.addEventListener('click',event=>{event.preventDefault();AndroidZaman.openGuide();});document.querySelector('#guide-print')?.setAttribute('hidden','');}
