"""Teste de navegador do painel de compartilhar do convite (visitante, celular).
Uso: servidor local no ar em UI_BASE (padrão http://localhost:3100) e: python3 scripts/teste-ui-compartilhar.py
Simula navigator.share / canShare / clipboard para ver o que o painel entrega e confere cada canal e a medição."""
import os, json
from playwright.sync_api import sync_playwright
B = os.environ.get('UI_BASE', 'http://localhost:3100')
ok_geral = True
def ok(c, m):
    global ok_geral
    print(('ok - ' if c else 'FALHOU - ') + m); ok_geral = ok_geral and bool(c)
with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={'width': 430, 'height': 900}, permissions=['clipboard-read', 'clipboard-write'])
    pg = ctx.new_page(); pg.set_default_timeout(9000)
    medidos, abertos, partilhas = [], [], []
    pg.on('request', lambda r: medidos.append(json.loads(r.post_data or '{}').get('passo')) if r.url.endswith('/api/v1/medicao') and r.method == 'POST' else None)
    pg.add_init_script("""
      window.__shares = [];
      navigator.canShare = (d) => !!(d && d.files && d.files.length);
      navigator.share = async (d) => { window.__shares.push({text: d.text || null, url: d.url || null, arquivos: (d.files || []).map(f => f.name + ':' + f.type + ':' + f.size)}); };
      window.open = (u) => { window.__abertos = (window.__abertos || []).concat([u]); return null; };
    """)
    pg.goto(B + '/comecar'); pg.wait_for_timeout(2500); pg.locator('main button').first.click(); pg.wait_for_timeout(2000)
    if pg.locator('#nome-desafio').count(): pg.fill('#nome-desafio', 'Henrique'); pg.locator('main button:not([disabled])').last.click(); pg.wait_for_timeout(1200)
    for _ in range(12):
        r = pg.locator('main [role=radio]')
        if not r.count(): break
        r.first.click(); pg.wait_for_timeout(600)
    pg.wait_for_timeout(2000); pg.locator('button:has-text("Convidar alguém")').click(); pg.wait_for_timeout(1200)
    campo = pg.locator('main input[type=text], main input:not([type])').first
    if campo.count(): campo.fill('Maria')
    msg = pg.locator('main').inner_text()
    ok('Maria, gostaria' in msg or 'Maria, ' in msg, 'a mensagem na tela usa o nome e o texto da relação')
    pg.locator('main input[type=checkbox]').first.check()
    pg.locator('button:has-text("Enviar pelo WhatsApp")').click(); pg.wait_for_timeout(3500)
    pg.screenshot(path='/home/claude/painel_compartilhar.png', full_page=True)
    t = pg.inner_text('main')
    ok('Convide mais pessoas' in t, 'o painel aparece na tela de convite enviado')
    ok(all(x in t for x in ['WhatsApp', 'Facebook', 'Copiar', 'Instagram e outros apps', 'Stories do Instagram']), 'os cinco canais estão visíveis')
    ab = lambda: pg.evaluate('window.__abertos || []')
    ok(len(ab()) == 1 and ab()[0].startswith('https://wa.me/?text='), 'o clique no WhatsApp da tela anterior abriu o wa.me com texto e link')
    pg.locator('section button:has-text("Facebook")').click(); pg.wait_for_timeout(300)
    ok(any('facebook.com/sharer/sharer.php?u=' in u and '%2Fd%2F' in u for u in ab()), 'Facebook abre o sharer com o link do convite')
    pg.locator('section button:has-text("Instagram e outros apps")').click(); pg.wait_for_timeout(500)
    sh = pg.evaluate('window.__shares')
    ok(len(sh) == 1 and len(sh[0]['arquivos']) == 1 and sh[0]['arquivos'][0].startswith('convite-orvok.png:image/png:') and '/d/' in (sh[0]['text'] or ''), 'o menu do celular recebe o card (PNG) e a mensagem com o link: %s' % (sh[0]['arquivos'] if sh else sh))
    pg.locator('section button:has-text("Copiar")').click(); pg.wait_for_timeout(400)
    clip = pg.evaluate('navigator.clipboard.readText()')
    ok('/d/' in clip and 'anônim' in clip and clip.startswith('Maria,'), 'Copiar leva a mensagem (com o nome) e o link')
    pg.locator('section button:has-text("Stories do Instagram")').click(); pg.wait_for_timeout(300)
    ok(pg.locator('ol li').count() >= 3, 'os 3 passos dos Stories aparecem')
    with pg.expect_download(timeout=20000) as d:
        pg.locator('button:has-text("Baixar o card e copiar o link")').click()
    dl = d.value; dl.save_as('/home/claude/stories_baixado.png')
    from PIL import Image
    ok(dl.suggested_filename == 'convite-orvok-stories.png' and Image.open('/home/claude/stories_baixado.png').size == (1080, 1920), 'o card vertical 1080x1920 foi baixado')
    pg.wait_for_timeout(500)
    ok('/d/' in pg.evaluate('navigator.clipboard.readText()'), 'o link ficou copiado ao baixar o card dos Stories')
    pg.wait_for_timeout(1000)
    esperados = {'compartilhar_whatsapp', 'compartilhar_facebook', 'compartilhar_menu', 'compartilhar_copiar', 'compartilhar_stories'}
    ok(esperados <= set(medidos), 'cada canal foi medido: %s' % sorted(set(m for m in medidos if m)))
    b.close()
print('TODOS OS TESTES PASSARAM' if ok_geral else 'HOUVE FALHAS')
raise SystemExit(0 if ok_geral else 1)
