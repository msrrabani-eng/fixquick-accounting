/* Shared search viewport controller: main lists and modal pickers. */
'use strict';
(function(){
 let timer=0, active=null, normalHeight=0, wasReduced=false, tap=null, tapTimer=0;
 const queued=new Map();
 const selector='input[data-search-field],input[type=search],input[inputmode=search],.sbox input,input[id$="-q"],input[id$="-search"],#rep-pq,#pk-s,input[placeholder*="جستجو"]';
 // Keep the search geometry and result DOM stable until a genuine pointer click
 // completes. Prevent the default focus transfer, never synthesize a financial action.
 function searchInput(el){return el?.matches?.(selector)?el:null;}
 function scope(el){return el?.closest?.('.sheet-wrap')||el?.closest?.('#main')||null;}
 const actionable='button,a[href],a[data-act],[role="button"],[data-act],[data-v]';
 function targetFor(el){const b=el?.closest?.(actionable);return b&&!b.disabled&&b.getAttribute('aria-disabled')!=='true'&&!b.closest('[inert]')?b:null;}
 function finishTap(){
  clearTimeout(tapTimer);tapTimer=0;
  if(!tap)return;
  tap=null;const work=[...queued.entries()];queued.clear();
  // Let existing click handlers navigate, close pickers and submit before redrawing.
  setTimeout(()=>{sync();for(const [key,fn] of work){if(key?.isConnected)fn();}},0);
 }
 function down(e){
  if(e.isPrimary===false||e.button!==0)return;
  const input=searchInput(document.activeElement),target=targetFor(e.target),area=scope(input);
  if(!input||!target||!area||scope(target)!==area||target.contains(input)||e.target?.closest?.('input,textarea,select,[contenteditable="true"]'))return;
  if(tap)finishTap();
  tap={id:e.pointerId,input,target,area,x:e.clientX,y:e.clientY,hash:location.hash};
  // Cancel only the focus-changing down event, not pointerup, click or scrolling.
  if(e.cancelable)e.preventDefault();
  tapTimer=setTimeout(finishTap,1500);
 }
 function move(e){if(tap&&e.pointerId===tap.id&&Math.hypot(e.clientX-tap.x,e.clientY-tap.y)>14)finishTap();}
 function up(e){if(!tap||e.pointerId!==tap.id)return;clearTimeout(tapTimer);tapTimer=setTimeout(finishTap,400);}
 function clicked(e){
  if(!tap)return;
  const t=tap,b=targetFor(e.target);
  if(b!==t.target){finishTap();return;}
  clearTimeout(tapTimer);
  tapTimer=setTimeout(()=>{
   // A picker may already be closed or a route changed. Never blur its new field.
   if(tap!==t)return;
   if(t.input.isConnected&&document.activeElement===t.input&&location.hash===t.hash&&t.target.dataset.act!=='clrQ')t.input.blur();
   finishTap();
  },0);
 }
 // Coalesce pending renders per input; stale callbacks must check their original DOM.
 window.afterSearchTap=(key,fn)=>{if(tap&&key&&scope(key)===tap.area){queued.set(key,fn);return;}if(key?.isConnected)fn();};
 document.addEventListener('pointerdown',down,{capture:true,passive:false});
 document.addEventListener('pointermove',move,true);
 document.addEventListener('pointerup',up,true);
 document.addEventListener('pointercancel',e=>{if(tap&&e.pointerId===tap.id)finishTap();},true);
 document.addEventListener('click',clicked,true);
 function sync(){
  if(tap){
   if(tap.input.isConnected&&tap.target.isConnected&&location.hash===tap.hash)return;
   finishTap();
  }
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
  if(input){const box=input.closest('.ui2-search-row')||input.closest('.sbox,.gs')||input,scroll=sheet?.querySelector('.sheet-b')||main;
   if(scroll){const a=box.getBoundingClientRect(),b=scroll.getBoundingClientRect();if(a.top<b.top+6)scroll.scrollTop+=a.top-b.top-6;else if(a.bottom>b.bottom-6)scroll.scrollTop+=a.bottom-b.bottom+6;}
  }
  // Ordinary data entry also needs viewport bounds, but must not inherit search filtering or Enter handling.
  const field=!input&&el?.matches?.('input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=button]):not([type=file]),textarea')?el:null;
  const fs=field?.closest('.sheet-wrap');
  body.classList.toggle('fq-form-focus',!!field);
  if(field){body.style.setProperty('--fq-form-height',Math.round(height)+'px');body.style.setProperty('--fq-form-top',Math.max(0,Math.round(v?.offsetTop||0))+'px');}
  else{body.style.removeProperty('--fq-form-height');body.style.removeProperty('--fq-form-top');}
  if(main)main.classList.toggle('fq-form-editing',!!field&&!fs&&main.contains(field));
  document.querySelectorAll('.sheet-wrap').forEach(w=>w.classList.toggle('fq-form-active',w===fs));
  const sc=fs?.querySelector('.sheet-b')||main;
  if(field&&sc&&sc.contains(field)){const a=field.getBoundingClientRect(),b=sc.getBoundingClientRect();if(a.top<b.top+6)sc.scrollTop+=a.top-b.top-6;else if(a.bottom>b.bottom-8)sc.scrollTop+=a.bottom-b.bottom+8;}
 }
 function schedule(){clearTimeout(timer);timer=setTimeout(sync,40);}
 window.refreshSearchViewport=sync;
 document.addEventListener('focusin',sync);
 document.addEventListener('focusout',schedule);
 document.addEventListener('input',e=>{if(e.target.matches?.(selector))schedule();});
 document.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.isComposing&&e.target.matches?.(selector)){e.preventDefault();e.target.blur();schedule();}});
 window.addEventListener('resize',schedule);window.addEventListener('hashchange',()=>{finishTap();schedule();});
 window.visualViewport?.addEventListener('resize',schedule);window.visualViewport?.addEventListener('scroll',schedule);
})();
