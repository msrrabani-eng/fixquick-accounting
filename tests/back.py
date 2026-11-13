import asyncio,subprocess,time,sys
from playwright.async_api import async_playwright
srv=subprocess.Popen(['python3','-m','http.server','8771','-d','/home/claude/app/www'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL); time.sleep(1)
ok=True
def chk(n,c):
    global ok; print(('PASS ' if c else 'FAIL ')+n); ok=ok and c
async def m():
  async with async_playwright() as p:
    b=await p.chromium.launch(args=['--no-sandbox']); pg=await b.new_page(viewport={'width':390,'height':844})
    errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    U='http://localhost:8771/index.html'
    await pg.goto(U+'#/home'); await pg.wait_for_selector('#main .card')
    await pg.click('.nav [data-nav=people]'); await pg.wait_for_timeout(200)
    await pg.click('#fab'); await pg.wait_for_selector('.sheet')
    await pg.go_back(); await pg.wait_for_timeout(300)
    chk('back closes sheet', await pg.evaluate("document.querySelectorAll('.sheet-wrap').length")==0)
    chk('still on people page', await pg.evaluate("location.hash")=='#/people')
    # nested: invoice form -> person picker -> back closes picker only
    await pg.click('.nav [data-nav=invoices]'); await pg.click('[data-act=newInv][data-t=purchase]'); await pg.wait_for_selector('#nf')
    await pg.click('#nf-p'); await pg.wait_for_selector('.sheet'); await pg.click('#pk-new'); await pg.wait_for_selector('#pq')
    await pg.go_back(); await pg.wait_for_timeout(300)
    chk('back from nested closes it, form kept', await pg.evaluate("document.querySelectorAll('.sheet-wrap').length")==0 and await pg.query_selector('#nf') is not None)
    # close by X then back navigates pages normally
    await pg.click('#nf-p'); await pg.click('.sheet-h .x'); await pg.wait_for_timeout(200)
    await pg.go_back(); await pg.wait_for_timeout(300)
    chk('after X-close, back goes to previous page', await pg.evaluate("location.hash")=='#/invoices')
    # many open/close cycles keep history sane
    for i in range(8):
      await pg.click('.nav [data-nav=people]'); await pg.click('#fab'); await pg.wait_for_selector('.sheet'); await pg.click('.sheet-h .x'); await pg.wait_for_timeout(60)
    await pg.go_back(); await pg.wait_for_timeout(300)
    chk('history sane after cycles', await pg.evaluate("location.hash") in ('#/people','#/invoices','#/new/purchase'))
    chk('no page errors', not errs)
    await b.close()
asyncio.run(m()); srv.terminate(); sys.exit(0 if ok else 1)
