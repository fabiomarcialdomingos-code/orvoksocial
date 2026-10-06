"""Teste de navegador: quem já está logado nunca vê o pedido para criar conta nos fluxos de convite.
Cobre: conta sem nome no perfil (o nome é perguntado uma vez e guardado), a mesma conta de novo (não pergunta),
conta com nome (não pergunta) e visitante (continua vendo o convite para criar conta).
Uso: servidor local no ar em UI_BASE (padrão http://localhost:3100) e: python3 scripts/teste-ui-conta-logada.py
"""
import os
import time
from playwright.sync_api import sync_playwright
B=os.environ.get('UI_BASE','http://localhost:3100'); SENHA='Sim#Senha2026x'; h={'Origin':B,'Content-Type':'application/json'}
def entrar(ctx, email):
    ctx.request.post(B+'/api/v1/auth/register',headers=h,data='{"email":"%s","password":"%s"}'%(email,SENHA))
    return ctx.request.post(B+'/api/v1/auth/login',headers=h,data='{"email":"%s","password":"%s"}'%(email,SENHA)).status
def fluxo(pg):
    pg.goto(B+'/comecar'); pg.wait_for_timeout(3000); pg.locator('main button').first.click(); pg.wait_for_timeout(2500)
    pediu = pg.locator('#nome-desafio').count() > 0
    if pediu: pg.fill('#nome-desafio','Fabio'); pg.locator('main button:not([disabled])').last.click(); pg.wait_for_timeout(1500)
    for _ in range(12):
        r=pg.locator('main [role=radio]')
        if not r.count(): break
        try: r.first.click(timeout=3000)
        except Exception: break
        pg.wait_for_timeout(600)
    pg.wait_for_timeout(2000)
    pg.locator('button:has-text("Convidar alguém")').click(); pg.wait_for_timeout(1200)
    campo=pg.locator('main input[type=text], main input:not([type])').first
    if campo.count(): campo.fill('Maria')
    cb=pg.locator('main input[type=checkbox]')
    if cb.count(): cb.first.check()
    pg.locator('button:has-text("Copiar link"), button:has-text("Enviar pelo WhatsApp")').first.click(); pg.wait_for_timeout(3000)
    return pediu, pg.inner_text('main')
def pede_conta(t): return 'Crie sua conta' in t or 'Continuar com Google' in t
with sync_playwright() as p:
    b=p.chromium.launch(); novo=lambda: (lambda c: (c, c.new_page()))(b.new_context(viewport={'width':430,'height':900}))
    ctx,pg=novo(); pg.set_default_timeout(8000); entrar(ctx,f'ui-a-{int(time.time())}@orvok.test')
    pediu,fim=fluxo(pg); nome=(ctx.request.get(B+'/api/v1/social/profile').json().get('profile') or {}).get('displayName')
    print('A) conta sem nome  | pediu o nome:',pediu,'| pede para criar conta:',pede_conta(fim),'| "Acompanhe em Meu retrato":','Acompanhe em Meu retrato' in fim,'| nome guardado no perfil:',nome)
    pg.screenshot(path='/home/claude/conta_depois.png', full_page=True)
    pediu2,fim2=fluxo(pg); print('B) mesma conta     | pediu o nome de novo:',pediu2,'| pede para criar conta:',pede_conta(fim2))
    ctx2,pg2=novo(); pg2.set_default_timeout(8000); entrar(ctx2,f'ui-c-{int(time.time())}@orvok.test'); ctx2.request.post(B+'/api/v1/social/profile',headers=h,data='{"displayName":"Carla Teste"}')
    pediu3,fim3=fluxo(pg2); print('C) conta com nome  | pediu o nome:',pediu3,'| pede para criar conta:',pede_conta(fim3),'| "Acompanhe em Meu retrato":','Acompanhe em Meu retrato' in fim3)
    ctx3,pg3=novo(); pg3.set_default_timeout(8000)
    pediu4,fim4=fluxo(pg3); print('D) visitante       | pediu o nome:',pediu4,'| mostra o convite para criar conta:',pede_conta(fim4))
