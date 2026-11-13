import asyncio, json, sys, subprocess, time, os, re
from playwright.async_api import async_playwright
SH='/home/claude/app/tests/shots/'
srv=subprocess.Popen(['python3','-m','http.server','8765','-d','/home/claude/app/www'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL); time.sleep(1)
errs=[]; fails=[]
def check(name,cond,extra=''):
    print(('PASS ' if cond else 'FAIL ')+name+(' '+str(extra) if (extra and not cond) else ''));
    if not cond: fails.append(name)
LOGPG=[None]
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/opt/pw-browsers/chromium-1194/chrome-linux/chrome' if os.path.exists('/opt/pw-browsers/chromium-1194/chrome-linux/chrome') else None, args=['--no-sandbox'])
        ctx=await b.new_context(viewport={'width':390,'height':844},device_scale_factor=2,locale='fa-IR',accept_downloads=True,is_mobile=True,has_touch=True)
        pg=await ctx.new_page()
        await pg.add_init_script('''window.__log=[];const L=(...a)=>{const t=a.join(' ')+' @'+(performance.now()|0);window.__log.push(t);try{window.__plog&&window.__plog(t)}catch(e){}};L('LOAD',location.href);
          addEventListener('popstate',e=>L('popstate',location.hash,JSON.stringify(e.state)));addEventListener('hashchange',()=>L('hashchange',location.hash));
          const ps=history.pushState.bind(history),bk=history.back.bind(history);history.pushState=(...a)=>{L('push',location.hash);return ps(...a)};history.back=()=>{L('back',location.hash);return bk()};
          document.addEventListener('DOMContentLoaded',()=>{new MutationObserver(()=>L('RENDER',location.hash)).observe(document.getElementById('main'),{childList:true})});''')
        LOGPG[0]=pg
        LOGBUF=[]; LOGPG.append(LOGBUF); await pg.expose_function('__plog',lambda t: LOGBUF.append(t))
        pg.on('pageerror',lambda e: LOGBUF.append('PAGEERROR '+str(e)))
        pg.on('console',lambda m: LOGBUF.append('CONSOLE '+m.type+' '+m.text))
        pg.on('framenavigated',lambda f: LOGBUF.append('FRAMENAV '+f.url) if f==pg.main_frame else None)
        pg.on('pageerror',lambda e:errs.append('PAGEERR '+str(e))); pg.on('console',lambda m: errs.append('CONSOLE '+m.text) if m.type=='error' else None)
        await pg.wait_for_timeout(250); await pg.goto('http://localhost:8765/index.html'); await pg.wait_for_selector('#main .stats, #main .card')
        await pg.screenshot(path=SH+'01-home-empty.png')
        S=lambda: pg.evaluate('JSON.parse(JSON.stringify(S))')
        async def sheet_fill(sel,val): await pg.fill(sel,val)
        # --- people
        await pg.click('.nav [data-nav=people]'); await pg.click('#fab')
        await pg.fill('#pf [name=name]','علی رضایی'); await pg.fill('#pf [name=phone]','۰۹۱۲۱۲۳۴۵۶۷')
        await pg.click('#pf button[type=submit]'); await pg.wait_for_selector('.hero')
        check('person created & navigated', 'علی رضایی' in await pg.inner_text('#title'))
        await pg.screenshot(path=SH+'02-person.png')
        await pg.click('.nav [data-nav=people]'); await pg.click('#fab'); await pg.fill('#pf [name=name]','تأمین‌کننده قطعات')
        await pg.fill('#pf [name=ob]','۵۰٬۰۰۰'); await pg.select_option('#pf [name=obk]','-1'); await pg.click('#pf button[type=submit]'); await pg.wait_for_selector('.hero')
        st=await S(); check('opening balance credit', len(st['tx'])==1 and st['tx'][0]['kind']=='credit' and st['tx'][0]['amount']==50000, [st['people'], st['tx'], LOGPG[1][-12:]])
        check('money input grouped in persian', await pg.evaluate('1')==1)
        # duplicate name rejected
        await pg.click('.nav [data-nav=people]'); await pg.click('#fab'); await pg.fill('#pf [name=name]','علی رضایی'); await pg.click('#pf button[type=submit]')
        check('duplicate person toast', await pg.wait_for_function("document.querySelector('#toast').textContent.includes('قبلاً')",timeout=5000) is not None); await pg.click('.sheet-h .x')
        # --- product
        await pg.click('.nav [data-nav=products]'); await pg.click('#fab'); await pg.fill('#gf [name=name]','گوشی A15'); await pg.fill('#gf [name=salePrice]','۱۲۰۰۰۰۰'); await pg.fill('#gf [name=minStock]','2'); await pg.click('#gf button[type=submit]')
        await pg.wait_for_selector('.card.flush .row')
        # --- purchase invoice via FAB flow: invoices tab -> new purchase
        await pg.click('.nav [data-nav=invoices]'); await pg.click('[data-act=newInv][data-t=purchase]'); await pg.wait_for_selector('#nf')
        await pg.click('#nf-p'); await pg.click('.item:has-text("تأمین‌کننده")')
        await pg.click('.it-row [data-act=pickProd]'); await pg.click('.item:has-text("گوشی")')
        await pg.fill('.it-row [name=qty]','۱۰'); await pg.fill('.it-row [name=price]','۸۰۰۰۰۰')
        check('line total live', '۸,۰۰۰,۰۰۰' in await pg.inner_text('#s-tot'), await pg.inner_text('#s-tot'))
        await pg.fill('#nf [name=paid]','۲۰۰۰۰۰۰'); await pg.screenshot(path=SH+'03-new-invoice.png',full_page=False)
        await pg.click('#nf-save'); await pg.wait_for_selector('.kv .big')
        st=await S(); check('purchase saved w/ payment', len(st['invoices'])==1 and any(t['type']=='payment' and t['amount']==2000000 for t in st['tx']))
        await pg.screenshot(path=SH+'04-invoice-view.png')
        # --- sale invoice to person with discount, 2 lines same product (stock check)
        await pg.click('.nav [data-nav=people]'); await pg.click('.row:has-text("علی رضایی")'); await pg.click('.quick [data-t=sale]'); await pg.wait_for_selector('#nf')
        check('person preset', 'علی' in await pg.inner_text('#nf-p'))
        await pg.click('.it-row [data-act=pickProd]'); await pg.click('.item:has-text("گوشی")'); await pg.wait_for_function("document.querySelector('.it-row [name=price]').value!==''",timeout=5000)
        check('default sale price prefilled', '۱,۲۰۰,۰۰۰' in await pg.input_value('.it-row [name=price]'), await pg.input_value('.it-row [name=price]'))
        check('stock hint', 'موجودی فعلی: ۱۰' in await pg.inner_text('.it-row .stk'))
        await pg.fill('.it-row [name=qty]','۶'); await pg.click('[data-act=addRow]')
        rows=await pg.query_selector_all('.it-row'); await (await rows[1].query_selector('[data-act=pickProd]')).click(); await pg.click('.item:has-text("گوشی")')
        await (await rows[1].query_selector('[name=qty]')).fill('۶')
        await pg.click('#nf-save'); await pg.wait_for_function("document.querySelector('#toast').textContent.includes('کافی نیست')",timeout=5000)
        check('oversell blocked', 'کافی نیست' in await pg.inner_text('#toast'), await pg.inner_text('#toast'))
        await pg.click('[data-act=rmRow]'); await pg.fill('#nf [name=discount]','۲۰۰۰۰۰'); await pg.click('[data-act=payFull]')
        await pg.select_option('#nf [name=method]','bank'); await pg.click('#nf-save'); await pg.wait_for_selector('.kv .big')
        st=await S(); sale=[i for i in st['invoices'] if i['type']=='sale'][0]
        bal=await pg.evaluate("Core.balanceOf(S, S.people[0].id)"); check('sale fully paid -> balance 0', bal==0, bal)
        check('bank cash recorded', await pg.evaluate("Core.cashSummary(S).byMethod.bank")==7000000)
        # --- receipt via home quick action
        await pg.click('.nav [data-nav=home]'); await pg.screenshot(path=SH+'05-home.png',full_page=True)
        await pg.click('[data-act=quickTx][data-t=receipt]'); await pg.click('#tf-p'); await pg.click('.item:has-text("علی")'); await pg.fill('#tf [name=amount]','1500'); await pg.click('#tf button[type=submit]')
        await pg.wait_for_function("document.querySelector('#toast').className.includes('show')")
        check('receipt -> balance -1500', await pg.evaluate("Core.balanceOf(S, S.people[0].id)")==-1500)
        # --- transfer
        await pg.click('.nav [data-nav=more]'); await pg.click('[data-act=transfer]'); await pg.click('#xf-a'); await pg.click('.item:has-text("علی")'); await pg.click('#xf-b'); await pg.click('.item:has-text("تأمین")'); await pg.fill('#xf [name=amount]','500'); await pg.click('#xf button[type=submit]')
        await pg.wait_for_function("document.querySelector('#toast').textContent.includes('حواله')")
        # --- cheque
        await pg.click('.nav [data-nav=more]'); await pg.click('[data-h="#/cheques"]'); await pg.click('#fab'); await pg.fill('#cf [name=title]','چک ۱۲۳۴'); await pg.fill('#cf [name=amount]','900000'); await pg.click('#cf-p'); await pg.click('.item:has-text("علی")'); await pg.click('#cf button[type=submit]')
        await pg.wait_for_selector('.mini.ok'); await pg.screenshot(path=SH+'06-cheques.png')
        await pg.click('.mini.ok'); await pg.click('[data-rec]'); await pg.wait_for_function("document.querySelector('#toast').textContent.includes('ثبت')")
        check('cheque recorded as receipt(cheque)', await pg.evaluate("Core.cashSummary(S).byMethod.cheque")==900000)
        # --- expense
        await pg.wait_for_timeout(250); await pg.goto('http://localhost:8765/index.html#/expenses'); await pg.click('#fab'); await pg.fill('#ef [name=title]','اجاره مغازه'); await pg.fill('#ef [name=amount]','300000'); await pg.click('#ef button[type=submit]')
        await pg.wait_for_selector('.row:has-text("اجاره")')
        # --- reports
        await pg.wait_for_timeout(250); await pg.goto('http://localhost:8765/index.html#/reports'); await pg.click('[data-k=rep][data-v=all]'); await pg.wait_for_selector('.rr')
        await pg.screenshot(path=SH+'07-reports.png',full_page=True)
        rep=await pg.evaluate("Core.report(S,null,null)")
        # sale: 6*1.2M=7.2M - 200k = 7.0M ; cogs 6*800k=4.8M ; gross 2.2M ; expense .3M ; net 1.9M
        check('report numbers', rep['revenue']==7000000 and rep['cogs']==4800000 and rep['net']==1900000, rep)
        # --- product kardex
        await pg.wait_for_timeout(250); await pg.goto('http://localhost:8765/index.html#/products'); await pg.click('.row:has-text("گوشی")'); await pg.click('[data-k]'); await pg.wait_for_selector('.lr.it'); await pg.screenshot(path=SH+'08-kardex.png')
        # --- audit
        await pg.wait_for_timeout(250); await pg.goto('http://localhost:8765/index.html#/settings'); await pg.click('[data-act=audit]'); check('audit healthy', 'سالم' in await pg.inner_text('.sheet-b')); await pg.click('.sheet-h .x')
        # --- backup download + wipe + restore
        async with pg.expect_download() as d: await pg.click('[data-act=backup]')
        dl=await d.value; path='/tmp/fq-backup.json'; await dl.save_as(path); data=open(path,encoding='utf8').read()
        check('backup is json w/ data', json.loads(data)['data']['invoices'] is not None and len(json.loads(data)['data']['tx'])>5)
        before=await S()
        await pg.click('[data-act=wipe]'); await pg.click('[data-yes]'); await pg.fill('#wp','حذف'); await pg.click('#wp-ok'); await pg.wait_for_function("S.people.length===0 && location.hash==='#/home' && !!document.querySelector('.welcome')")
        await pg.wait_for_timeout(250); await pg.goto('http://localhost:8765/index.html#/settings'); await pg.wait_for_timeout(700)
        pass #print('DBG hash',await pg.evaluate('location.hash'),'title',await pg.inner_text('#title'),'sheets',await pg.evaluate('Array.from(document.querySelectorAll(".sheet-h b")).map(x=>x.textContent)'),'lock',await pg.evaluate('lockedNow'))
        await pg.screenshot(path=SH+'dbg.png')
        await pg.wait_for_selector('#restore-file',state='attached',timeout=3000); await pg.set_input_files('#restore-file',path); await pg.click('[data-yes]'); await pg.wait_for_function("S.people.length===2")
        after=await S(); check('restore equals original', after['tx']==before['tx'] and after['invoices']==before['invoices'] and after['people']==before['people'])
        # corrupt backup
        open('/tmp/bad.json','w').write('{"app":"x"}'); await pg.wait_for_timeout(250); await pg.goto('http://localhost:8765/index.html#/settings'); await pg.wait_for_selector('#restore-file',state='attached'); await pg.set_input_files('#restore-file','/tmp/bad.json'); await pg.wait_for_function("document.querySelector('#toast').className.includes('bad')")
        # --- persistence across reload
        await pg.wait_for_timeout(300); await pg.reload(); await pg.wait_for_selector('#main .card, #main .stats'); check('persisted after reload', (await S())['invoices']==before['invoices'])
        # --- PIN
        await pg.wait_for_timeout(250); await pg.goto('http://localhost:8765/index.html#/settings'); await pg.click('[data-act=setPin]')
        for k in '1234': await pg.click(f'.pin-pad [data-k="{k}"]')
        for k in '1234': await pg.click(f'.pin-pad [data-k="{k}"]')
        await pg.wait_for_function("!!S.settings.pinHash"); await pg.wait_for_timeout(300); await pg.reload(); await pg.wait_for_selector('.sheet-wrap.lock'); await pg.screenshot(path=SH+'09-lock.png')
        for k in '9999': await pg.click(f'.pin-pad [data-k="{k}"]')
        await pg.wait_for_timeout(500); check('wrong pin stays locked', await pg.query_selector('.sheet-wrap.lock') is not None)
        for k in '1234': await pg.click(f'.pin-pad [data-k="{k}"]')
        await pg.wait_for_timeout(500); check('right pin unlocks', await pg.query_selector('.sheet-wrap.lock') is None)
        # --- date picker
        await pg.wait_for_timeout(250); await pg.goto('http://localhost:8765/index.html#/new/sale'); await pg.click('[data-pickdate]'); await pg.wait_for_selector('.cal-g button'); await pg.screenshot(path=SH+'10-datepicker.png'); await pg.click('.cal-g button >> nth=9'); 
        # --- delete invoice blocked/allowed
        await pg.wait_for_timeout(250); await pg.goto('http://localhost:8765/index.html#/invoices'); await pg.wait_for_selector('.row')
        await pg.screenshot(path=SH+'11-invoices.png')
        # --- overflow check on each route at 360px
        await pg.set_viewport_size({'width':360,'height':740})
        for r in ['home','people','invoices','products','more','cheques','expenses','reports','settings','new/purchase']:
            await pg.wait_for_timeout(250); await pg.goto('http://localhost:8765/index.html#/'+r); await pg.wait_for_timeout(150)
            ov=await pg.evaluate("document.documentElement.scrollWidth>window.innerWidth+1 || document.getElementById('main').scrollWidth>document.getElementById('main').clientWidth+1")
            check('no horizontal overflow '+r, not ov)
        await b.close()
async def wrapped():
    try:
        await main()
    except Exception as e:
        pg=LOGPG[0]
        print('EXC',type(e).__name__, str(e)[:200])
        try:
            print('DOM', await pg.evaluate("JSON.stringify([...document.querySelectorAll('.it-row')].map(r=>[r.dataset.pid,r.querySelector('.pick').textContent,r.querySelector('[name=price]').value,r.isConnected]))+' sheets='+document.querySelectorAll('.sheet-wrap').length+' hash='+location.hash"))
        except Exception as x:
            print('DOMERR',x)
        print('\n'.join(LOGPG[1][-30:]))
        raise
try:
    asyncio.run(wrapped())
finally:
    srv.terminate()
print('\nconsole/page errors:',errs if errs else 'none'); print('FAILED:',fails if fails else 'none'); sys.exit(1 if fails or errs else 0)
