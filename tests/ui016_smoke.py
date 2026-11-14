from pathlib import Path
from playwright.sync_api import sync_playwright
import re, os
ROOT=Path(__file__).resolve().parent.parent/'www'
SHOTS=ROOT.parent/'ui016-shots'; SHOTS.mkdir(exist_ok=True)
WIDTH=int(os.getenv('FQ_TEST_WIDTH','390'))
SCALE=float(os.getenv('FQ_TEST_SCALE','1'))
html=(ROOT/'index.html').read_text()
js=re.findall(r'<script src="([^"]+)"></script>',html)
css='\n'.join((ROOT/n).read_text() for n in ['app.css','ui2.css'])
html=re.sub(r'<script src="[^"]+"></script>','',html)
html=re.sub(r'<link[^>]+>','',html).replace('</head>','<style>'+css+'</style></head>')
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);pg=b.new_page(viewport={'width':WIDTH,'height':740},is_mobile=True,has_touch=True)
 errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
 pg.set_content(html)
 pg.evaluate('''() => { const m=new Map();Object.defineProperty(window,'localStorage',{value:{get length(){return m.size},getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k),key:i=>Array.from(m.keys())[i]},configurable:true}); }''')
 for name in js:
  try:pg.add_script_tag(content=(ROOT/name).read_text())
  except Exception as e:print('script',name,str(e)[:180]);raise
 print('errors initial',errs)
 pg.evaluate('''() => { document.querySelector('#splash').remove(); S=Core.emptyState(); S.settings.unit='toman'; S.settings.theme='light'; applySettings(S.settings); Core.addPerson(S,{name:'علی رضایی',phone:'09121234567'}); Core.addProduct(S,{name:'کابل شارژ آیفون',buyPrice:3000000000,salePrice:3500000000}); }''')
 pg.evaluate('v=>{S.settings.fontScale=v;applySettings(S.settings)}',SCALE)
 def navigate(hash):
  pg.evaluate('h=>{location.hash=h;render()}',hash);pg.wait_for_timeout(150);print(hash,pg.locator('#title').inner_text(),pg.locator('#main').inner_text()[:100])
 navigate('#/home');pg.screenshot(path=str(SHOTS/'home.png'))
 navigate('#/people');pg.screenshot(path=str(SHOTS/'people.png'))
 navigate('#/products');pg.locator('.ui2-stock-menu summary').click();assert pg.locator('[data-act=bulkProducts]').is_visible();pg.screenshot(path=str(SHOTS/'stock.png'))
 pg.locator('#prod-q').fill('آیفون');pg.wait_for_timeout(600);assert pg.locator('#prod-q').input_value()=='آیفون';assert pg.locator('.ui2-search-all').count()==1;pg.locator('.ui2-search-all').click();pg.wait_for_timeout(300);assert pg.locator('#gs-q').input_value()=='آیفون'
 navigate('#/new/purchase');assert pg.locator('#nf').count()==1
 pg.evaluate('''() => { const f=$('#nf'); f.pid.value=S.people[0].id; $('#nf-p').textContent=S.people[0].name; for(let i=0;i<5;i++){if(i)addRow(); const r=$$('.it-row').at(-1);fillRowProduct(r,S.products[0]); $('[name=qty]',r).value='1'; $('[name=price]',r).value='300000000';}calcInvoice(); }''');
 for y in [0,100,450,10000]:
  pg.evaluate('y=>document.querySelector("#main").scrollTop=y',y);pg.wait_for_timeout(80);a=pg.locator('.ui2-invoice-bar').bounding_box();m=pg.locator('#main').bounding_box();print('bar',y,a,'main',m);assert a['y']+a['height']<=m['y']+m['height']+2 and a['y']>=m['y']-2
 pg.locator('.ui2-fold-btn').first.click();assert pg.locator('.it-row').first.evaluate("el=>el.classList.contains('ui2-folded')");assert pg.evaluate('readInvoice().items.length')==5;assert pg.evaluate('readInvoice().items[0].price')==3000000000;pg.locator('.ui2-fold-btn').first.click();assert not pg.locator('.it-row').first.evaluate("el=>el.classList.contains('ui2-folded')");print('fold test passed');
 print('total',pg.locator('#ui2-total').inner_text());assert pg.locator('#ui2-total').inner_text()==pg.locator('#s-tot').inner_text();pg.screenshot(path=str(SHOTS/'invoice.png'))
 navigate('#/settings');assert pg.locator('#ui2-settings input').count()==7
 pg.evaluate('save=async()=>true');pg.locator('#ui2-settings [name=sticky]').uncheck();pg.locator('#ui2-settings [type=submit]').click();pg.wait_for_timeout(200);assert pg.evaluate('S.settings.invoiceUI.sticky')==False
 navigate('#/new/purchase');assert not pg.locator('#nf').evaluate("el=>el.classList.contains('ui2-sticky')")
 navigate('#/settings');pg.locator('#ui2-reset').click();pg.wait_for_timeout(200);assert pg.evaluate('S.settings.invoiceUI.sticky')==True
 pg.evaluate("CUR={admin:false,user:'staff',perms:{}};");navigate('#/settings');assert pg.locator('#ui2-settings').count()==0;pg.evaluate("CUR={admin:true,user:'owner'};")
 navigate('#/assistant');pg.locator('#fq-chat-input').fill('فروش این ماه چقدر بوده؟');pg.locator('#fq-chat-form button').click();pg.wait_for_timeout(250);assert pg.locator('.fq-msg').count()==2;pg.screenshot(path=str(SHOTS/'chat.png'));print('ERRORS',errs);assert not errs
 b.close()
