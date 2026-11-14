"""v021 state and diagnostics regression, simulated native bridge (not real inference)."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import re
ROOT=Path(__file__).resolve().parent.parent/'www'
html=(ROOT/'index.html').read_text(); scripts=re.findall(r'<script src="([^"\n]+)"></script>',html)
css='\n'.join((ROOT/n).read_text() for n in ['app.css','ui2.css'])
html=re.sub(r'<script src="[^"]+"></script>','',html);html=re.sub(r'<link[^>]+>','',html).replace('</head>','<style>'+css+'</style></head>')
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);pg=b.new_page(viewport={'width':390,'height':740},is_mobile=True,has_touch=True);pg.set_default_timeout(5000)
 errors=[];pg.on('pageerror',lambda e:errors.append(str(e)));pg.set_content(html)
 pg.evaluate('''() => { const m=new Map();Object.defineProperty(window,'localStorage',{value:{get length(){return m.size},getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k),key:i=>Array.from(m.keys())[i]},configurable:true}); }''')
 for name in scripts:pg.add_script_tag(content=(ROOT/name).read_text())
 pg.evaluate('''() => { document.querySelector('#splash')?.remove(); S=Core.emptyState();S.settings.unit='toman';S.settings.theme='light';S.settings.fontScale=1.3;applySettings(S.settings);Core.addPerson(S,{name:'علی رضایی'});setAdminSession();location.hash='#/home';render(); }''')
 def nav(h):
  pg.evaluate('h=>{location.hash=h;render()}',h);pg.wait_for_timeout(180)
 def locked():
  assert pg.locator('#fq-chat-form').count()==0;assert pg.locator('#fq-ai-mic').count()==0
 def close():
  pg.locator('.sheet').last.locator('[data-close]').first.click();pg.wait_for_timeout(200)
 def clickhome():
  pg.locator('#main [data-act=aiLaunch]').click();pg.wait_for_timeout(200)
 def rect(selector):return pg.locator(selector).bounding_box()
 def layout():
  main=rect('#main');sc=rect('.ui20-scroll');bar=rect('#fq-chat-form');navbox=rect('.nav');assert sc and bar and main
  assert sc['y']+sc['height']<=bar['y']+1,(sc,bar)
  assert bar['y']>=main['y'] and bar['y']+bar['height']<=min(navbox['y'],main['y']+main['height'])+1,(main,bar,navbox)
  assert pg.evaluate('document.querySelector("#main").scrollHeight<=document.querySelector("#main").clientHeight+1')
  assert pg.evaluate('document.querySelector("#main").scrollWidth<=document.querySelector("#main").clientWidth+1')
 assert pg.locator('[data-act=aiLaunch]').count()==1
 nav('#/assistant');locked();assert pg.locator('.ai20-locked').is_visible();nav('#/more');assert pg.locator('[data-h="#/assistant"]').count()==0;nav('#/home');clickhome();locked();assert pg.locator('#ai-download').is_disabled();assert 'در دسترس نیست' in pg.locator('#ai-state').inner_text();close()
 pg.evaluate('''() => {window.mock={status:'notInstalled',runtime:true,compatible:true,ram:8000000000,free:2000000000,bytes:0,total:2500000000,speech:true}; window.Capacitor={Plugins:{FixQuickAI:{status:async()=>({...mock}),download:async(args)=>{window.downloadArgs=args;mock.status='downloading';mock.bytes=1250000000;return mock},removeModel:async()=>{mock.status='notInstalled';return mock},listen:async()=>({text:'مانده حساب علی رضایی'}),speak:async()=>({}),generate:async({prompt})=>({text:JSON.stringify(prompt.includes('verified report evidence')?{kind:'answer',text:'طبق گزارش حساب علی رضایی.'}:{kind:'read',requests:[{metric:'balance',mode:'person',period:'current',person:'علی رضایی'}]})}),cancel:async()=>({}),stopListening:async()=>({}),stopSpeaking:async()=>({})}}};}''')
 # stale opt-in cannot unlock chat. Missing model and insufficient space.
 pg.evaluate('aiSetEnabled(true)');clickhome();locked();assert pg.locator('#ai-download').is_disabled();assert not pg.locator('#ai-enable').is_visible();pg.evaluate('mock.free=5000000000');pg.wait_for_timeout(1400);assert pg.locator('#ai-download').is_enabled()
 pg.locator('.ai20-install-details summary').click();pg.locator('#ai-speed').select_option('5');assert '۶۷' in pg.locator('#ai-est').inner_text();pg.locator('.ai20-install-details summary').click();pg.locator('.sheet-b').evaluate('e=>e.scrollTop=0');pg.screenshot(path='/mnt/data/fq021-install.png')
 pg.locator('#ai-download').click();pg.locator('.sheet').last.get_by_role('button',name='شروع دانلود').click();pg.wait_for_timeout(1400);locked();assert '۵۰' in pg.locator('#ai-state').inner_text();assert not pg.locator('#ai-enable').is_visible();assert pg.evaluate('downloadArgs.wifiOnly');assert not pg.locator('#ai-download').is_visible();assert not pg.locator('#ai-wifi-label').is_visible();assert pg.locator('#ai-remove').is_visible()
 pg.evaluate("mock.status='verifying';mock.bytes=mock.total");pg.wait_for_timeout(1400);assert not pg.locator('#ai-enable').is_visible();assert not pg.locator('#ai-download').is_visible();assert pg.locator('#ai-remove').is_disabled();locked()
 pg.evaluate("Object.assign(mock,{status:'ready',availableRam:1450000000,minAvailableRam:1610612736,memoryReady:false})");pg.wait_for_timeout(1400);assert not pg.locator('#ai-download').is_visible();assert not pg.locator('#ai-est').is_visible();assert not pg.locator('#ai-setup-specs').is_visible();assert not pg.locator('.ai20-install-details').is_visible();assert 'رم قابل استفاده' in pg.locator('#ai-state').inner_text();assert 'نیازی به دانلود دوباره نیست' in pg.locator('#ai-state').inner_text();pg.screenshot(path='/mnt/data/fq021-installed.png');pg.locator('#ai-enable').click();pg.wait_for_timeout(400);assert pg.locator('#fq-chat-form').is_visible();assert pg.evaluate('aiChatAllowed()');assert not pg.locator('.sheet-wrap').count();layout()
 pg.locator('.ui20-examples summary').click()
 for w,h in [(390,740),(320,480),(360,480),(390,320),(430,850)]:
  pg.set_viewport_size({'width':w,'height':h});pg.wait_for_timeout(80);layout();pg.locator('.ui20-scroll').evaluate('e=>e.scrollTop=e.scrollHeight');layout()
 pg.set_viewport_size({'width':390,'height':740});pg.locator('.ui20-scroll').evaluate('e=>e.scrollTop=0');pg.screenshot(path='/mnt/data/fq021-chat.png')
 pg.evaluate("() => {window.calls=0;Capacitor.Plugins.FixQuickAI.generate=async()=>{calls++;throw Error('رم قابل استفاده ناکافی است')}}");pg.locator('#fq-chat-input').fill('سلام');pg.locator('#fq-chat-form button[type=submit]').click();pg.wait_for_timeout(350);assert pg.evaluate('calls')==1;assert 'رم قابل استفاده ناکافی است' in pg.locator('#fq-chat-history').inner_text();assert 'هیچ پاسخ مالی جایگزین' in pg.locator('#fq-chat-history').inner_text();pg.evaluate("Capacitor.Plugins.FixQuickAI.generate=async({prompt})=>{calls++;return {text:JSON.stringify(prompt.includes('verified report evidence')?{kind:'answer',text:'طبق گزارش حساب علی رضایی.'}:{kind:'read',requests:[{metric:'balance',mode:'person',period:'current',person:'علی رضایی'}]})}};Object.assign(mock,{availableRam:2200000000,memoryReady:true})");pg.locator('#fq-ai-mic').click();pg.wait_for_timeout(180);assert pg.locator('#fq-chat-input').input_value()=='مانده حساب علی رضایی';snap=pg.evaluate('JSON.stringify(S)');pg.locator('#fq-chat-form button[type=submit]').click();pg.wait_for_timeout(400);assert 'علی رضایی' in pg.locator('#fq-chat-history').inner_text();assert pg.evaluate('calls')==3;assert pg.evaluate('JSON.stringify(S)')==snap;layout()

 # Model disappears while page is open -> next send locks before any ledger work.
 pg.evaluate("mock.status='notInstalled'");pg.locator('#fq-chat-input').fill('فروش این ماه');pg.locator('#fq-chat-form button[type=submit]').click();pg.wait_for_timeout(350);locked();assert pg.locator('.ai20-locked').is_visible();assert pg.evaluate('JSON.stringify(S)')==snap
 # Reopen already valid installation without redownload, then remove through model management.
 nav('#/home');pg.evaluate("mock.status='ready'");clickhome();assert pg.locator('#fq-chat-form').is_visible();pg.locator('#fq-ai-addon').click();pg.wait_for_timeout(200);assert not pg.locator('#ai-download').is_visible();assert pg.locator('#ai-remove').is_visible();assert pg.locator('#ai-enable').is_visible();assert 'افزونه نصب شده است' in pg.locator('#ai-intro-title').inner_text();pg.screenshot(path='/mnt/data/fq021-installed-ok.png');pg.locator('#ai-remove').click();pg.locator('.sheet').last.get_by_role('button',name='حذف افزونه').click();pg.wait_for_timeout(350);locked();assert pg.locator('#ai-download').is_visible();close()
 assert not errors,errors;print('PASS gated installation/missing runtime/low disk/stale opt-in/download/verification/activation/voice/read-only finance/reopening/removal; layout at five mobile sizes including keyboard-sized viewport; simulated native bridge only')
 b.close()
