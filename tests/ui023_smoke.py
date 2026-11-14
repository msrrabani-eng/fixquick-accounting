"""Model-first UI integration exercising real ledger tools with a mocked native model. No actual Qwen inference."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import re
ROOT=Path(__file__).resolve().parent.parent/'www'
html=(ROOT/'index.html').read_text(); scripts=re.findall(r'<script src="([^"\n]+)"></script>',html)
css='\n'.join((ROOT/n).read_text() for n in ['app.css','ui2.css'])
html=re.sub(r'<script src="[^"]+"></script>','',html);html=re.sub(r'<link[^>]+>','',html).replace('</head>','<style>'+css+'</style></head>')
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);pg=b.new_page(viewport={'width':390,'height':740},is_mobile=True,has_touch=True);pg.set_default_timeout(6000)
 errors=[];pg.on('pageerror',lambda e:errors.append(str(e)));pg.set_content(html)
 pg.evaluate('''() => { const m=new Map();Object.defineProperty(window,'localStorage',{value:{get length(){return m.size},getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k),key:i=>Array.from(m.keys())[i]},configurable:true}); }''')
 for name in scripts:pg.add_script_tag(content=(ROOT/name).read_text())
 pg.evaluate('''() => { document.querySelector('#splash')?.remove(); S=Core.emptyState();S.settings.unit='rial';S.settings.theme='light';applySettings(S.settings);const a=Core.addPerson(S,{name:'علی رضایی'}).person;const t=today();S.cheques.push({id:100,kind:'cheque',cyc:1,direction:'receive',state:'box',amount:100000000,dueDate:Core.addDays(t,2),date:t,personId:a.id,done:false,title:'چک آزمایشی'},{id:101,kind:'cheque',cyc:1,direction:'pay',state:'issued',amount:200000000,dueDate:Core.addDays(t,2),date:t,personId:a.id,done:false});S.tx.push({id:130,personId:a.id,kind:'debit',type:'manual',date:t,amount:375000000});setAdminSession();location.hash='#/home';render();window.calls=0;window.prompts=[];window.responses=[];window.mock={status:'ready',runtime:true,compatible:true,memoryReady:true,free:9000000000};window.Capacitor={Plugins:{FixQuickAI:{status:async()=>({...mock}),generate:async({prompt})=>{calls++;prompts.push(prompt);const v=responses.shift();if(!v)throw Error('unexpected model call');if(v.error)throw Error(v.error);return {text:JSON.stringify(v)}},cancel:async()=>({}),stopListening:async()=>({}),stopSpeaking:async()=>({})}}};aiSetEnabled(true); }''')
 pg.locator('#main [data-act=aiLaunch]').click();pg.locator('#fq-chat-form').wait_for();snap=pg.evaluate('JSON.stringify(S)')
 def send(q):
  before=pg.locator('.fq-bot').count();pg.locator('#fq-chat-input').fill(q);pg.locator('#fq-chat-form button[type=submit]').click();pg.wait_for_function('n=>document.querySelectorAll(".fq-bot").length>n && !aiBusy',arg=before);return pg.locator('.fq-bot').last.inner_text()
 def queue(*rs):pg.evaluate('rs=>{responses=rs}',list(rs))
 answer={'kind':'answer','text':'این گزارش مربوط به همان فیلتر است.'}
 queue({'kind':'answer','text':'سلام! در خدمت شما هستم.'});a=send('سلام');assert 'سلام' in a and 'خوانده نشده' in a;assert pg.evaluate('calls')==1
 queue({'kind':'read','requests':[{'metric':'cheques','mode':'total','period':'exact','days':2,'direction':'receive','scope':'box','kindFilter':'cheque'}]},answer)
 a=send('۲ روزه دیگه چقدر چک در صندوق داریم که باید پاس بشود');assert 'دریافتی در صندوق' in a and '۱۰۰,۰۰۰,۰۰۰' in a,a;assert 'تفسیر Qwen' in a;assert pg.evaluate('prompts[2].includes("100000000")');assert pg.evaluate('calls')==3
 queue({'kind':'weighted'});a=send('اگر ۱۰ تا چک از مشتری بگیرم هر کدام عددش و تاریخش فرق کنه میتونی راس بگیری');assert 'مبلغ و تاریخ' in a and '۱۰' in a and 'سررسید گذشته' not in a,a;assert pg.evaluate('calls')==4
 pg.locator('#fq-chat-reset').click();queue({'kind':'weighted'});a=send('رأس گیری ۲ چک');assert 'مبلغ و تاریخ' in a
 a=send('۱۰۰ میلیون تومان | 2026-12-14\n۲۰۰ میلیون تومان | 2027-01-13');assert 'تایید' in a,a
 a=send('تایید');assert 'رأس ۲' in a and '۳,۰۰۰,۰۰۰,۰۰۰' in a,a;assert pg.evaluate('calls')==5
 queue({'kind':'read','requests':[{'metric':'balance','mode':'person','period':'current','person':'علی رضایی'}]},answer);a=send('مانده حساب علی چقدر است؟');assert '۳۷۵,۰۰۰,۰۰۰' in a and 'علی رضایی' in a,a
 queue({'kind':'answer','text':'موجودی نقدی را از تعهدات آینده جدا کنید.'});a=send('چطور برنامه ریزی مالی کنم؟');assert 'پاسخ مستقیم Qwen' in a
 queue({'error':'خطای اجرای مدل آزمایشی'});a=send('فروش این ماه چقدر بود؟');assert 'هیچ پاسخ مالی جایگزین' in a and 'خطای اجرای مدل آزمایشی' in a,a
 # The diagnostic is a real plugin invocation (mocked bridge here), not an installation flag.
 pg.locator('#fq-ai-addon').click();pg.locator('#ai-test').wait_for();assert not pg.locator('#ai-download').is_visible();queue({'kind':'answer','text':'آماده'});pg.locator('#ai-test').click();pg.wait_for_function('document.querySelector("#ai-test-result").textContent.includes("آزمون ساده تولید متن موفق")');assert pg.evaluate('prompts.at(-1).includes("آماده")');assert not pg.evaluate('prompts.at(-1).includes("375000000")');pg.locator('#ai-close').click()
 assert pg.evaluate('JSON.stringify(S)')==snap;assert not errors,errors
 print('PASS v023 mobile UI: model-first greeting, typed ledger + model analysis, weighted confirmation, actual balance, explicit inference failure and diagnostic (mock native bridge), ledger unchanged')
 b.close()
