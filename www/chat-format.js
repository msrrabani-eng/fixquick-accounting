/* Offline chat formatting and PDF generation. All input is a frozen conversation snapshot. */
(function(root){'use strict';
function stamp(at,core){const d=new Date(at);if(at==null||!Number.isFinite(d.getTime()))return '';return core.fmtDate(core.todayISO(d))+' · '+core.toFa(String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0'));}
function amount(n,unit,core){if(!Number.isSafeInteger(n))return '—';const a=unit==='toman'?Math.trunc(n/10):n,d=unit==='toman'?Math.abs(n%10):0;return core.toFa((a===0&&n<0?'-':'')+core.group(a)+(d?'.'+d:''));}
function tableRow(r,unit,core){return [(r.phase==='delay'?'تأخیر ':'قسط ')+core.toFa(r.month),...['opening','interest','payment','closing'].map(k=>amount(r[k],unit,core))];}
const headers=['مرحله','مانده اول','سود','پرداخت','مانده آخر'];
function copyText(m,core){const unit=m.unit||'rial';return [String(m.text||''),stamp(m.at,core),m.source||'',...(m.details||[]).map(t=>'• '+t),...(m.rows?.length?['جدول محاسبات ('+core.unitName(unit)+')',headers.join(' | '),...m.rows.map(r=>tableRow(r,unit,core).join(' | '))]:[])].filter(Boolean).join('\n');}
// Wrap both ordinary Persian paragraphs and long unbroken identifiers without losing characters.
function wrap(ctx,text,width){const lines=[];for(const para of String(text).split('\n')){let line='';for(const word of para.split(/\s+/).filter(Boolean)){const next=line?line+' '+word:word;if(ctx.measureText(next).width<=width){line=next;continue;}if(line){lines.push(line);line='';}for(const ch of word){if(line&&ctx.measureText(line+ch).width>width){lines.push(line);line='';}line+=ch;}}lines.push(line);}return lines;}
function pageLimit(view,expanded){const h=Math.max(100,Number(view)||600);return expanded?Math.max(54,h-66):Math.max(54,Math.min(300,Math.floor(h*.52),h-76));}
async function drawPdf(messages,env){
 const {core,createCanvas,encode,logo,valid}=env,W=1240,H=1754,M=70,R=W-M,LOW=H-105,BLUE='#1d4ed8',INK='#111827',MUT='#64748b',LINE='#d6dce4',FONT='Vazirmatn, Tahoma, "Noto Sans Arabic", "Noto Naskh Arabic", Arial, sans-serif';
 if(!Array.isArray(messages)||!messages.length)throw Error('گفت‌وگو خالی است.');if(!valid())throw Error('دسترسی گفتگو تغییر کرد.');const imgs=[];let cv,c,y;
 const font=(n,b=400)=>{c.font=b+' '+n+'px '+FONT;};
 const txt=(s,x,yy,color=INK,align='right')=>{c.textAlign=align;c.fillStyle=color;c.fillText(String(s),x,yy);};
 const flush=()=>{if(!cv)return;if(!valid())throw Error('دسترسی گفتگو تغییر کرد.');font(23);txt('حسابداری فیکس کوییک • صفحه '+core.toFa(imgs.length+1),W/2,H-47,MUT,'center');imgs.push({jpg:encode(cv),w:W,h:H});cv.width=1;cv.height=1;cv=null;};
 const page=()=>{flush();cv=createCanvas(W,H);c=cv.getContext('2d');c.direction='rtl';c.fillStyle='#fff';c.fillRect(0,0,W,H);if(logo){const lh=74,lw=Math.min(240,lh*logo.width/logo.height);c.drawImage(logo,M,M,lw,lh);}font(39,700);txt('گفت‌وگو با دستیار حسابداری',R,M+43,BLUE);font(23);txt('گزارش محلی؛ بدون تغییر اسناد مالی',R,M+78,MUT);c.fillStyle=BLUE;c.fillRect(M,M+99,R-M,3);y=M+128;};
 const need=h=>{if(y+h>LOW)page();};
 const paragraph=(t,size=30,color=INK,b=400)=>{font(size,b);const lines=wrap(c,t,R-M-24),step=size+15;for(const l of lines){need(step);font(size,b);txt(l,R-10,y+size,color);y+=step;}};
 const edges=[R,R-156,R-392,R-628,R-864,M];
 const drawRow=(cells,head=false)=>{const hh=52;c.fillStyle=head?'#edf2fa':'#fff';c.fillRect(M,y,R-M,hh);c.strokeStyle=LINE;c.lineWidth=1.4;c.strokeRect(M,y,R-M,hh);font(head?24:25,head?700:400);for(let j=0;j<5;j++){const x=(edges[j]+edges[j+1])/2,avail=edges[j]-edges[j+1]-14;c.save();let size=head?24:25;while(size>17&&c.measureText(cells[j]).width>avail){size--;font(size,head?700:400);}txt(cells[j],x,y+35,head?BLUE:INK,'center');c.restore();}y+=hh;};
 page();
 for(const m of messages){if(!valid())throw Error('دسترسی گفتگو تغییر کرد.');need(108);c.fillStyle=m.role==='user'?'#eef2f7':'#eaf1ff';c.fillRect(M,y,R-M,53);font(27,700);txt(m.role==='user'?'شما':'دستیار حسابداری',R-13,y+35,BLUE);font(23);txt(stamp(m.at,core),M+12,y+35,MUT,'left');y+=62;paragraph(m.text,31,INK,600);if(m.source)paragraph(m.source,24,MUT);for(const d of m.details||[])paragraph('• '+d,28);if(m.rows?.length){need(116);paragraph('جدول کامل محاسبات — '+core.unitName(m.unit||'rial'),27,BLUE,700);need(104);drawRow(headers,true);for(const r of m.rows){if(y+52>LOW){page();paragraph('ادامه جدول محاسبات — '+core.unitName(m.unit||'rial'),27,BLUE,700);drawRow(headers,true);}drawRow(tableRow(r,m.unit||'rial',core));}}y+=20;}
 flush();return imgs;
}
const api={stamp,amount,tableRow,copyText,wrap,pageLimit,drawPdf,headers};root.FQChatFormat=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
