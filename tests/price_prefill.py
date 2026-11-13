import asyncio,subprocess,time
from playwright.async_api import async_playwright
srv=subprocess.Popen(['python3','-m','http.server','8767','-d','www'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL); time.sleep(1)
async def m():
  async with async_playwright() as p:
    b=await p.chromium.launch(args=['--no-sandbox']); pg=await b.new_page(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
    await pg.goto('http://localhost:8767/index.html'); await pg.wait_for_selector('#main .card')
    await pg.evaluate("""(async()=>{Core.addPerson(S,{name:'علی'});Core.addPerson(S,{name:'رضا'});Core.addProduct(S,{name:'گوشی',salePrice:1200000});Core.addInvoice(S,{type:'purchase',personId:2,date:Core.todayISO(),items:[{productId:3,qty:10,price:5}]});await save();
      window.__renders=0; const o=window.render; })()""")
    await pg.add_init_script("")
    bad=0
    for i in range(30):
      await pg.goto('http://localhost:8767/index.html#/person/1'); await pg.wait_for_selector('.hero')
      await pg.evaluate("window.__r=0; const oldMain=document.getElementById('main'); new MutationObserver(()=>window.__r++).observe(oldMain,{childList:true})")
      await pg.click('.quick [data-t=sale]'); await pg.wait_for_selector('#nf')
      r0=await pg.evaluate('window.__r')
      await pg.click('.it-row [data-act=pickProd]'); await pg.click('.item:has-text("گوشی")'); await pg.wait_for_timeout(300)
      v=await pg.input_value('.it-row [name=price]'); r1=await pg.evaluate('window.__r'); lbl=await pg.inner_text('.it-row .pick')
      if not v: bad+=1; print('iter',i,'EMPTY price; renders before pick',r0,'after',r1,'label',lbl)
    print('bad',bad,'/30'); await b.close()
asyncio.run(m()); srv.terminate()
