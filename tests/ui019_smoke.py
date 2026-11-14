from pathlib import Path
from playwright.sync_api import sync_playwright
import re,os
ROOT=Path(__file__).resolve().parent.parent/'www'
html=(ROOT/'index.html').read_text();js=re.findall(r'<script src="([^"]+)"></script>',html)
css='\n'.join((ROOT/n).read_text() for n in ['app.css','ui2.css'])
html=re.sub(r'<script src="[^"]+"></script>','',html);html=re.sub(r'<link[^>]+>','',html).replace('</head>','<style>'+css+'</style></head>')
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);pg=b.new_page(viewport={'width':int(os.getenv('FQ_WIDTH','390')),'height':740},is_mobile=True,has_touch=True);errors=[];pg.on('pageerror',lambda e:errors.append(str(e)))
 pg.set_content(html);pg.evaluate('''() => { const m=new Map();Object.defineProperty(window,'localStorage',{value:{get length(){return m.size},getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k),key:i=>Array.from(m.keys())[i]},configurable:true}); }''')
 for name in js:pg.add_script_tag(content=(ROOT/name).read_text())
 pg.evaluate('''() => { document.querySelector('#splash').remove(); S=Core.emptyState(); S.settings.unit='toman';S.settings.theme='light';S.settings.fontScale=1.3;applySettings(S.settings);Core.addPerson(S,{name:'علی رضایی'});save=async()=>true;location.hash='#/more';render(); }''');pg.wait_for_timeout(150)
 assert pg.locator('#main .menu019-group').count()==6
 assert pg.locator('#main .menu019-group[open]').count()==0
 assert pg.locator('#main [data-h="#/invoices"]').count()==0
 assert pg.locator('.nav [data-h="#/invoices"]').is_visible()
 pg.locator('#main .menu019-group').first.locator('summary').click();assert pg.locator('[data-h="#/cheques"]').is_visible();pg.locator('#main .menu019-group').first.locator('summary').click()
 pg.screenshot(path='/mnt/data/fq019-more.png')
 pg.locator('#main [data-h="#/settings/backup"]').click();pg.wait_for_timeout(200)
 assert pg.locator('.backup019-page').count()==1
 for a in ['saveLocal','backup','restore','autoRestore']:assert pg.locator('#main [data-act="'+a+'"]').is_visible(),a
 assert pg.locator('#restore-file').count()==1;assert pg.locator('[data-act=wipe]').count()==0
 pg.screenshot(path='/mnt/data/fq019-backup.png')
 pg.evaluate("location.hash='#/settings';render()");pg.wait_for_timeout(150);pg.locator('[data-settings-group=advanced] summary').click();assert pg.locator('#ai-source-settings').is_visible();assert pg.locator('#ui2-settings').is_visible()
 pg.locator('#ai-source-settings [name=modelUrl]').fill('https://example.org/qwen.gguf');pg.locator('#ai-source-settings [type=submit]').click();pg.wait_for_timeout(100);assert pg.evaluate('S.settings.aiModelUrl')=='https://example.org/qwen.gguf'
 pg.evaluate('render()');assert pg.locator('#ai-source-settings').is_visible();assert pg.locator('[data-settings-group=backup]').get_attribute('open') is None
 pg.evaluate("location.hash='#/more';render()");pg.wait_for_timeout(200);pg.locator('#main [data-act=helpAll]').click();assert pg.locator('.help019-item').count()==71;assert pg.locator('.help019-group[open]').count()==0
 search=pg.locator('#help019-search');search.fill('سود مرکب');assert pg.locator('[data-help-key=interestCompound]').is_visible();pg.locator('[data-help-key=interestCompound] summary').click();assert '۵۷۸٬۸۱۲٬۵۰۰' in pg.locator('[data-help-key=interestCompound]').inner_text()
 pg.wait_for_timeout(2300);pg.screenshot(path='/mnt/data/fq019-help.png');search.fill('zzzzzz');assert pg.locator('#help019-empty').is_visible();search.fill('');assert pg.locator('.help019-group[open]').count()==0
 pg.evaluate('sheetStack.at(-1).close(true)');pg.wait_for_timeout(150)
 pg.evaluate("CUR={admin:false,user:'staff',perms:{}};location.hash='#/settings';render()");pg.wait_for_timeout(150);assert pg.locator('[data-settings-group=backup]').count()==0;assert pg.locator('#ai-source-settings').count()==0;assert pg.locator('[data-settings-group=danger]').count()==0
 pg.evaluate("location.hash='#/more';render()");pg.wait_for_timeout(150);assert pg.locator('#main [data-h="#/settings/backup"]').count()==0;assert pg.locator('#main [data-act=helpAll]').is_visible()
 pg.locator('#main [data-act=helpAll]').click();assert pg.locator('[data-guide]').count()==0
 assert not errors,errors;print('PASS compact More, six folders, backup direct entry and four actions, admin settings persistence, search / examples / empty state, no privilege leaks; no real backup overwrite or native model execution')
 b.close()
