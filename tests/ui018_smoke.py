from pathlib import Path
from playwright.sync_api import sync_playwright
import re
ROOT=Path(__file__).resolve().parent.parent/'www'
html=(ROOT/'index.html').read_text(); js=re.findall(r'<script src="([^"]+)"></script>',html)
css='\n'.join((ROOT/n).read_text() for n in ['app.css','ui2.css'])
html=re.sub(r'<script src="[^"]+"></script>','',html); html=re.sub(r'<link[^>]+>','',html).replace('</head>','<style>'+css+'</style></head>')
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);pg=browser.new_page(viewport={'width':390,'height':740},is_mobile=True,has_touch=True); errors=[];pg.on('pageerror',lambda e:errors.append(str(e)))
 pg.set_content(html)
 pg.evaluate('''() => { const m=new Map();Object.defineProperty(window,'localStorage',{value:{get length(){return m.size},getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k),key:i=>Array.from(m.keys())[i]},configurable:true}); }''')
 for name in js:pg.add_script_tag(content=(ROOT/name).read_text())
 pg.evaluate('''() => { document.querySelector('#splash').remove(); S=Core.emptyState(); S.settings.unit='toman'; S.settings.theme='light'; applySettings(S.settings);Core.addPerson(S,{name:'علی رضایی'});location.hash='#/assistant';render(); }''')
 # Verify admin settings, validation, reset and persistence failure with mocked save.
 pg.evaluate("location.hash='#/settings/advanced';render();save=async()=>true")
 pg.wait_for_timeout(150);form=pg.locator('#ai-source-settings');assert form.count()==1
 field=form.locator('[name=modelUrl]');official=field.input_value();mirror='https://cdn.example.org/models/qwen.gguf'
 field.fill(mirror);form.locator('button[type=submit]').click();pg.wait_for_timeout(100);assert pg.evaluate('S.settings.aiModelUrl')==mirror
 field.fill('http://example.org/model.gguf');form.locator('button[type=submit]').click();pg.wait_for_timeout(100);assert pg.evaluate('S.settings.aiModelUrl')==mirror
 form.locator('#ai-source-reset').click();pg.wait_for_timeout(100);assert pg.evaluate('S.settings.aiModelUrl')==official
 field.fill(mirror);form.locator('button[type=submit]').click();pg.wait_for_timeout(100)
 pg.evaluate('save=async()=>false');field.fill('https://example.org/fail.gguf');form.locator('button[type=submit]').click();pg.wait_for_timeout(100);assert pg.evaluate('S.settings.aiModelUrl')==mirror
 pg.evaluate("CUR={admin:false,user:'staff',perms:{}};render()")
 assert pg.locator('#ai-source-settings').count()==0;assert pg.evaluate('aiSourceSettingsCard()')==''
 pg.evaluate("setAdminSession();location.hash='#/assistant';render()")
 pg.wait_for_timeout(150);pg.locator('#fq-ai-mic').click();pg.wait_for_timeout(250);assert pg.locator('#ai-download').is_disabled();assert 'در دسترس نیست' in pg.locator('#ai-state').inner_text()
 pg.evaluate('''() => {window.mock={status:'notInstalled',runtime:true,compatible:true,ram:8000000000,free:2000000000,bytes:0,total:2500000000,speech:true}; window.Capacitor={Plugins:{FixQuickAI:{status:async()=>({...mock}),download:async(args)=>{window.downloadArgs=args;mock.status='downloading';mock.bytes=1250000000;return mock},removeModel:async()=>{mock.status='notInstalled';return mock},listen:async()=>({text:'مانده حساب علی رضایی'}),speak:async()=>({}),generate:async()=>({text:JSON.stringify({kind:'query',text:'مانده حساب علی رضایی'})}),cancel:async()=>({}),stopListening:async()=>({}),stopSpeaking:async()=>({})}}};}''')
 pg.wait_for_timeout(1400);assert pg.locator('#ai-download').is_disabled();pg.evaluate('mock.free=5000000000');pg.wait_for_timeout(1400);assert pg.locator('#ai-download').is_enabled();pg.locator('#ai-speed').select_option('5');assert '۶۷' in pg.locator('#ai-est').inner_text()
 pg.locator('#ai-download').click();pg.wait_for_timeout(200);print('confirm dialog',pg.locator('.sheet').last.inner_text()[:180]);pg.locator('.sheet').last.get_by_role('button',name='شروع دانلود').click();pg.wait_for_timeout(1400);assert '۵۰' in pg.locator('#ai-state').inner_text();assert pg.evaluate('downloadArgs.url')==mirror;pg.evaluate("mock.status='ready';mock.bytes=mock.total");pg.wait_for_timeout(1400);pg.locator('#ai-enable').click();assert pg.evaluate('aiEnabled()');pg.screenshot(path='/mnt/data/fq018-addon-mock.png');pg.evaluate('aiSheet.close()');pg.wait_for_timeout(150)
 pg.locator('#fq-ai-mic').click();pg.wait_for_timeout(200);assert pg.locator('#fq-chat-input').input_value()=='مانده حساب علی رضایی';pg.locator('#fq-chat-input').fill('سلام یک سؤال غیرقابل تشخیص');pg.locator('#fq-chat-form button[type=submit]').click();pg.wait_for_timeout(400);assert 'برداشت پیشنهادی مدل' in pg.locator('#fq-chat-history').inner_text();assert 'علی رضایی' in pg.locator('#fq-chat-history').inner_text()
 assert not errors,errors;print('PASS mock native bridge: unsupported device, free-space gate, estimate, confirmation, progress, activation, voice draft, LLM routing; NO real Android/download/model run')
 browser.close()
