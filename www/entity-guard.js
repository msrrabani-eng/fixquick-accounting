/* Fix Quick v015 — read-only, conservative duplicate entity warnings. */
(function(root){'use strict';const C=typeof module!=='undefined'&&module.exports?require('./core.js'):root.Core;
function makeEntityGuard(C) {
  const ascii=v=>C.toEn(String(v??'')).normalize('NFKC');
  const normalized=v=>C.norm(ascii(v).replace(/[\u0640\u064b-\u065f\u0670]/g,'')).replace(/[^\p{L}\p{N}]+/gu,' ').trim();
  const compact=v=>normalized(v).replace(/\s/g,'');
  function distance(a,b){let prev=Array.from({length:b.length+1},(_,i)=>i),older;for(let i=1;i<=a.length;i++){const row=[i];for(let j=1;j<=b.length;j++){row[j]=Math.min(row[j-1]+1,prev[j]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1));if(i>1&&j>1&&a[i-1]===b[j-2]&&a[i-2]===b[j-1])row[j]=Math.min(row[j],older[j-2]+1);}older=prev;prev=row;}return prev[b.length];}
  function signature(v){const n=normalized(v).replace(/ایفون|iphone/g,' iphone ').replace(/پرومکس|pro\s*max|پرو\s*مکس/g,' promax ').replace(/پرو|pro\b/g,' pro ').replace(/مینی|mini/g,' mini ').replace(/پلاس|plus/g,' plus ').replace(/گیگابایت|گیگ|gb/g,' gb ').replace(/ترابایت|tb/g,' tb ');return {nums:(n.match(/\d+(?:\.\d+)?/g)||[]).join('|'),variants:(n.match(/\b(?:promax|pro|mini|plus)\b/g)||[]).sort().join('|'),name:n.replace(/\s+/g,'').trim()};}
  function similarity(a,b,kind){
    let x=compact(a),y=compact(b); if(!x||!y)return 0;if(x===y)return 100;
    if(kind==='product'){const s=signature(a),t=signature(b);if(s.nums!==t.nums||s.variants!==t.variants)return 0;x=s.name;y=t.name;if(x===y)return 99;}
    const u=normalized(a).split(' ').sort().join(''),v=normalized(b).split(' ').sort().join('');if(u===v&&u.length>=5)return 98;
    const min=Math.min(x.length,y.length),max=Math.max(x.length,y.length);if(min<5||max-min>2||max>160)return 0;
    const d=distance(x,y);return d===1?94:d===2&&min>=9?85:0;
  }
  function phones(v){return [...new Set(ascii(v).split(/[,،;؛\/\n|]+/).map(s=>{s=s.replace(/[\s\u200b-\u200f\u202a-\u202e\u2066-\u2069().-]/g,'');if(!/^\+?\d{7,15}$/.test(s))return '';if(/^0098\d{10}$/.test(s))s='0'+s.slice(4);else if(/^\+98\d{10}$/.test(s))s='0'+s.slice(3);else if(/^98\d{10}$/.test(s))s='0'+s.slice(2);else if(/^9\d{9}$/.test(s))s='0'+s;else if(/^00\d{7,13}$/.test(s))s='+'+s.slice(2);return s;}).filter(Boolean))];}
  function find(st,kind,data,editId){const rows=kind==='person'?st.people||[]:kind==='product'?st.products||[]:[];const pp=kind==='person'?phones(data.phone):[];const matches=[];for(const r of rows){if(editId!=null&&String(r.id)===String(editId))continue;const score=similarity(data.name,r.name,kind),phone=pp.length>0&&phones(r.phone).some(x=>pp.includes(x));if(score||phone)matches.push({id:r.id,name:String(r.name||''),code:String((kind==='person'?r.code:r.sku)||''),archived:!!r.archived,score,phone:!!phone});}return matches.sort((a,b)=>Number(b.phone)-Number(a.phone)||b.score-a.score||Number(a.archived)-Number(b.archived));}
  function batch(st,kind,items){const pool={people:[...(st.people||[])],products:[...(st.products||[])]};const key=kind==='person'?'people':'products';const results=[];items.forEach((d,i)=>{const matches=find(pool,kind,d,null);if(matches.length)results.push({name:d.name,matches});pool[key].push({...d,id:'batch:'+i});});return results;}
  return {find,phones,similarity,batch};
}
C.entityGuard=makeEntityGuard(C);if(typeof module!=='undefined'&&module.exports)module.exports=C.entityGuard;
})(typeof window!=='undefined'?window:globalThis);
