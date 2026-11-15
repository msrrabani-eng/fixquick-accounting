/* A single layout controller for all search inputs, including modal pickers. */
'use strict';
(function(){
 let timer=0, active=null;
 const searchSelector='input[data-search-field],input[type=search],.sbox input,input[id$="-q"],input[id$="-search"],#rep-pq,#pk-s,input[placeholder*="جستجو"]';
 function sync(){
  const v=window.visualViewport, el=document.activeElement;
  const input=el&&el.matches&&el.matches(searchSelector)?el:null;
  const keyboard=!!input&&v&&v.height>0&&(window.innerHeight-v.height>100 || document.documentElement.clientHeight-v.height>100);
  const body=document.body;
  if(!body)return;
  active=input;
  body.classList.toggle('fq-search-focus',!!input);
  body.classList.toggle('fq-search-keyboard',!!keyboard);
  if(input&&v){body.style.setProperty('--fq-search-height',Math.round(v.height)+'px');body.style.setProperty('--fq-search-top',Math.max(0,Math.round(v.offsetTop))+'px');}
  else {body.style.removeProperty('--fq-search-height');body.style.removeProperty('--fq-search-top');}
  const main=document.querySelector('#main'), sheet=input?.closest('.sheet-wrap');
  if(main)main.classList.toggle('fq-search-active',!!input&&!sheet&&main.contains(input));
  document.querySelectorAll('.sheet-wrap').forEach(w=>w.classList.toggle('fq-search-active',w===sheet));
  if(input){const box=input.closest('.sbox,.gs,.ui2-search-row')||input;
   const scroll=sheet?.querySelector('.sheet-b')||main;
   if(scroll){const a=box.getBoundingClientRect(),b=scroll.getBoundingClientRect();if(a.top<b.top||a.bottom>b.bottom)scroll.scrollTop+=a.top-b.top-6;}
  }
 }
 function schedule(){clearTimeout(timer);timer=setTimeout(sync,40);}
 window.refreshSearchViewport=sync;
 document.addEventListener('focusin',sync);
 document.addEventListener('focusout',schedule);
 document.addEventListener('input',e=>{if(e.target.matches?.(searchSelector))schedule();});
 window.addEventListener('resize',schedule);window.addEventListener('hashchange',schedule);
 window.visualViewport?.addEventListener('resize',schedule);window.visualViewport?.addEventListener('scroll',schedule);
})();
