/* Optional local model. This module receives typed math messages only, not accounting records. */
(function(root){'use strict';
const api=()=>root.Capacitor?.Plugins?.FqLocalMath;
const escapeMarkers=s=>String(s??'').replace(/<\|[^>]{0,80}\|>|<\/?think>/gi,' ');
function prompt(question,history=[],date=''){
 const system='شما دستیار حل مسئله ریاضی و مالی آفلاین هستید. فقط از اعداد و توضیحات پیام استفاده کنید. به حسابداری، انبار، اشخاص یا اینترنت دسترسی ندارید. متن فارسی محاوره ای و غلط تایپی را تفسیر کنید. دقیق و کوتاه به فارسی پاسخ دهید. محاسبات را مرحله ای نشان دهید؛ اگر عدد یا فرض مبهم است یک سوال روشن بپرسید. برای تاریخ شمسی ماه ها را در همان تقویم حساب کنید. تاریخ امروز: '+escapeMarkers(date);
 let turns=[],size=0;
 for(let i=history.length-1;i>=0&&turns.length<6;i--){let m=history[i];if(!['user','assistant'].includes(m.role))continue;let t=escapeMarkers(m.text);if(size+t.length>2400)break;size+=t.length;turns.unshift([m.role,t]);}
 while(turns[0]?.[0]==='assistant')turns.shift();
 const frame=(role,message)=>'<|im_start|>'+role+'\n'+message+'<|im_end|>\n';
 return frame('system',system)+turns.map(x=>frame(...x)).join('')+frame('user',escapeMarkers(question).slice(0,4000)+' /no_think')+'<|im_start|>assistant\n<think>\n\n</think>\n\n';
}
async function status(){const p=api();if(!p)return {phase:'unsupported',ready:false};return await p.status();}
async function action(name){const p=api();if(!p||!['download','importModel','cancelDownload','test','stop'].includes(name))throw Error('موتور بومی در این دستگاه موجود نیست.');return p[name]();}
async function solve(question,history,date){const p=api();if(!p)throw Error('موتور بومی در دسترس نیست.');const r=await p.solve({prompt:prompt(question,history,date)});let answer=String(r.text||'').replace(/<think>[\s\S]*?<\/think>/g,'').trim();if(!answer||answer.includes('<think>'))throw Error('پاسخ کامل مدل دریافت نشد.');
 const truncated=answer.endsWith('[output limit]');if(truncated)answer=answer.replace(/\[output limit\]$/,'\n[پاسخ به سقف طول رسید؛ نتیجه را بررسی کنید.]');
 return {text:answer,ctx:{},actions:[],details:['زمان اجرای مدل: '+(Number(r.ms||0)/1000).toFixed(1)+' ثانیه','پاسخ آزمایشی مدل؛ محاسبات هنوز مستقلاً تأیید نشده‌اند.'],source:'مدل زبانی محلی؛ بدون دسترسی به داده‌های حسابداری'};
}
const service={prompt,status,action,solve};root.FQLocalMath=service;if(typeof module!=='undefined'&&module.exports)module.exports=service;
})(typeof window!=='undefined'?window:globalThis);
