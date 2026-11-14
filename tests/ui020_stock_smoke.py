"""Mobile stock toolbar geometry and non-destructive routing regression."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import re
ROOT=Path(__file__).resolve().parent.parent/'www'
html=(ROOT/'index.html').read_text(); scripts=re.findall(r'<script src="([^"]+)"></script>',html)
css='\n'.join((ROOT/n).read_text() for n in ['app.css','ui2.css'])
html=re.sub(r'<script src="[^"]+"></script>','',html);html=re.sub(r'<link[^>]+>','',html).replace('</head>','<style>'+css+'</style></head>')
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);pg=b.new_page(viewport={'width':390,'height':740},is_mobile=True,has_touch=True);pg.set_default_timeout(5000)
 errors=[];pg.on('pageerror',lambda e:errors.append(str(e)));pg.set_content(html)
 pg.evaluate('''() => { const m=new Map();Object.defineProperty(window,'localStorage',{value:{get length(){return m.size},getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k),key:i=>Array.from(m.keys())[i]},configurable:true}); }''')
 for name in scripts:pg.add_script_tag(content=(ROOT/name).read_text())
 pg.evaluate('''() => {document.querySelector('#splash')?.remove();S=Core.emptyState(); S.settings.unit='rial';S.settings.theme='light';setAdminSession();Core.addPerson(S,{name:'علی رضایی'});Core.addProduct(S,{name:'آیفون ۱۷ پرو مکس ۲۵۶ گیگ',buyPrice:4000000000,salePrice:4500000000});applySettings(S.settings);}''')
 def nav(h):
  pg.evaluate('h=>{location.hash=h;render()}',h);pg.wait_for_timeout(120)
 def width_ok(selector):
  assert pg.locator(selector).evaluate('e=>e.scrollWidth<=e.clientWidth+2'),selector
 for w in (320,360,390,430):
  for scale in (1,1.3):
   pg.set_viewport_size({'width':w,'height':740});pg.evaluate('v=>{S.settings.fontScale=v;applySettings(S.settings)}',scale);nav('#/products')
   d=pg.locator('.ui2-stock-menu');menu=pg.locator('.ui2-menu-items');bar=pg.locator('.ui2-stock-toolbar');assert not menu.is_visible();d.locator('summary').click();assert menu.is_visible();assert abs(d.bounding_box()['width']-bar.bounding_box()['width'])<2
   assert menu.locator('button').count()==5
   for item in menu.locator('button').all():
    assert item.is_visible();r=item.bounding_box();assert r['height']>=44 and r['width']>=menu.bounding_box()['width']-20
    assert item.evaluate('e=>e.scrollWidth<=e.clientWidth+2');assert item.locator('.ui2-tool-label').evaluate('e=>e.scrollWidth<=e.clientWidth+2')
   width_ok('#main');width_ok('.ui2-menu-items')
   if w==390 and scale==1.3:pg.screenshot(path='/mnt/data/fq020-final-stock.png')
   d.locator('summary').click();assert not menu.is_visible();width_ok('#main')
   for h in ('#/home','#/people','#/invoices','#/more','#/settings/backup','#/settings','#/new/purchase'):
    nav(h);width_ok('#main')
    bad=pg.evaluate('''()=>[...document.querySelectorAll('#main .toolbar>.btn,#main .row2>.btn,#main .hsmall>.hq2')].filter(e=>e.getClientRects().length && e.scrollWidth>e.clientWidth+2).map(e=>e.textContent)''');assert not bad,(w,scale,h,bad)
 nav('#/products');d=pg.locator('.ui2-stock-menu');d.locator('summary').click();snapshot=pg.evaluate('JSON.stringify(S)');pg.locator('.ui2-menu-items [data-act=go]').click();pg.wait_for_timeout(200);assert pg.evaluate('location.hash')=='#/stock';assert pg.evaluate('JSON.stringify(S)')==snapshot
 assert not errors,errors
 print('PASS stock tools full width, 5 actions retained, 8 mobile width/font combinations, 7 related screens, navigation and no ledger mutation')
 b.close()
