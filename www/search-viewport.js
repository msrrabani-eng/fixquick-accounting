/* Shared search viewport controller: main lists and modal pickers. */
'use strict';
(function(){
 let timer=0, active=null, normalHeight=0, wasReduced=false;
 const selector='input[data-search-field],input[type=search],input[inputmode=search],.sbox input,input[id$="-q"],input[id$="-search"],#rep-pq,#pk-s,input[placeholder*="جستجو"]';
 function sync(){
  const v=window.visualViewport, el=document.activeElement;
  const input=el&&el.matches&&el.matches(selector)?el:null;
  const body=document.body;if(!body)return;
  const height=v?.height||window.innerHeight;
  if(!input){normalHeight=height;wasReduced=false;}
  if(input!==active){if(!active)normalHeight=Math.max(normalHeight,height);wasReduced=false;active=input;}
  const reduced=!!input&&height>0&&(Math.max(normalHeight,window.innerHeight,document.documentElement.clientHeight)-height>100);
  // Android Back often closes the IME without blurring a text input.
  if(input&&wasReduced&&!reduced){wasReduced=false;input.blur();schedule();return;}
  wasReduced=reduced;
  body.classList.toggle('fq-search-focus',!!input);
  body.classList.toggle('fq-search-keyboard',reduced);
  if(input){body.style.setProperty('--fq-search-height',Math.round(height)+'px');body.style.setProperty('--fq-search-top',Math.max(0,Math.round(v?.offsetTop||0))+'px');}
  else{body.style.removeProperty('--fq-search-height');body.style.removeProperty('--fq-search-top');}
  const main=document.querySelector('#main'),sheet=input?.closest('.sheet-wrap');
  if(main)main.classList.toggle('fq-search-active',!!input&&!sheet&&main.contains(input));
  document.querySelectorAll('.sheet-wrap').forEach(w=>w.classList.toggle('fq-search-active',w===sheet));
  if(input){const box=input.closest('.sbox,.gs,.ui2-search-row')||input,scroll=sheet?.querySelector('.sheet-b')||main;
   if(scroll){const a=box.getBoundingClientRect(),b=scroll.getBoundingClientRect();if(a.top<b.top||a.bottom>b.bottom)scroll.scrollTop+=a.top-b.top-6;}
  }
 }
 function schedule(){clearTimeout(timer);timer=setTimeout(sync,40);}
 window.refreshSearchViewport=sync;
 document.addEventListener('focusin',sync);
 document.addEventListener('focusout',schedule);
 document.addEventListener('input',e=>{if(e.target.matches?.(selector))schedule();});
 document.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.isComposing&&e.target.matches?.(selector)){e.preventDefault();e.target.blur();schedule();}});
 window.addEventListener('resize',schedule);window.addEventListener('hashchange',schedule);
 window.visualViewport?.addEventListener('resize',schedule);window.visualViewport?.addEventListener('scroll',schedule);
})();
