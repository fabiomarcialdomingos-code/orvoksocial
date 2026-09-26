"""
ORVOK · teste de interface ponta a ponta (navegador real).

Percorre a jornada clicando, como uma pessoa faria:
  1. Maria cria a conta pela tela, informa o nome, consente e responde o
     gabarito inteiro clicando nas opções.
  2. Maria gera o cartão de convite, troca o estilo, escolhe o tom e copia o link.
  3. João abre o link sem conta, cria a conta pelo convite, cai no gabarito e
     o pedido é enviado automaticamente para Maria.
  4. Maria aceita o pedido, lê o aviso, consente e o gabarito é reconfirmado.
  5. João responde o próprio gabarito, abre "Prever alguém" e registra as
     12 previsões usando a seleção e o controle de confiança.
  6. Maria abre "O encontro" e vê João no radar e na tabela por pergunta.
  7. Sem erros de console nem falhas de requisição em nenhuma etapa.

Requisitos: app rodando (BASE_URL), `pnpm db:seed:demo` aplicado e
`pip install playwright && playwright install chromium`.

    BASE_URL=http://localhost:3000 python3 scripts/ui-smoke.py
"""
import asyncio
import os
import re
import sys
import time

from playwright.async_api import async_playwright, expect

BASE = os.environ.get("BASE_URL", "http://localhost:3000")
RUN = os.environ.get("SIM_RUN", str(int(time.time()))[-6:])
PASSWORD = "Perspectiva#2026"
SHOTS = os.environ.get("UI_SHOTS", "")
results: list[tuple[str, bool, str]] = []


def check(name: str, ok: bool, detail: str = "") -> None:
    results.append((name, ok, detail))
    print(("✓ " if ok else "✗ ") + name + ("" if ok else f"  → {detail}"))


async def shot(page, name: str) -> None:
    if SHOTS:
        await page.screenshot(path=os.path.join(SHOTS, f"{name}.png"), full_page=False)


def watch(page, label: str, errors: list[str]) -> None:
    page.on("console", lambda m: errors.append(f"{label} console: {m.text}") if m.type == "error" else None)
    page.on("pageerror", lambda e: errors.append(f"{label} pageerror: {e}"))
    page.on("response", lambda r: errors.append(f"{label} {r.status} {r.url}")
            if r.status >= 500 else None)


async def settle(page) -> None:
    await page.wait_for_function("!document.querySelector('.skeleton,[aria-busy=true]')", timeout=60000)


async def register(page, email: str, name: str) -> None:
    await page.get_by_label("E-mail").fill(email)
    await page.get_by_label("Senha").fill(PASSWORD)
    await page.get_by_role("button", name="Criar conta").click()
    await page.wait_for_url(re.compile(r"/onboarding"), timeout=60000)
    await settle(page)
    await page.get_by_label("Seu nome").fill(name)
    await page.get_by_role("button", name="Continuar").click()
    await page.get_by_role("checkbox").check()
    await page.get_by_role("button", name="Concordar e começar").click()


async def answer_all(page, label: str, pick) -> None:
    for i in range(12):
        heading = page.locator("#q-title")
        await expect(heading).to_be_visible(timeout=30000)
        options = page.get_by_role("radio")
        await options.nth(pick(i)).click()
        if i < 11:
            await expect(page.get_by_text(f"Pergunta {i + 2} de 12")).to_be_visible(timeout=30000)
    await expect(page.get_by_text("Pronto. Agora é a vez de quem te conhece.")).to_be_visible(timeout=30000)
    check(f"{label}: respondeu as 12 perguntas clicando", True)


async def main() -> None:
    errors: list[str] = []
    async with async_playwright() as pw:
        browser = await pw.chromium.launch()
        maria_ctx = await browser.new_context(viewport={"width": 1440, "height": 900}, permissions=["clipboard-read", "clipboard-write"])
        joao_ctx = await browser.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True, device_scale_factor=2)
        maria = await maria_ctx.new_page()
        joao = await joao_ctx.new_page()
        watch(maria, "maria", errors)
        watch(joao, "joao", errors)

        # 1. Maria
        await maria.goto(BASE + "/")
        await expect(maria.get_by_role("heading", name="Veja-se pelos olhos de quem te conhece.")).to_be_visible()
        await maria.get_by_role("link", name="Começar pelo meu gabarito").click()
        await register(maria, f"maria.{RUN}@orvok.test", "Maria Clara")
        await answer_all(maria, "Maria", lambda i: (i * 3) % 4)
        await shot(maria, "ui-01-gabarito-completo")

        # 2. Invite studio
        await maria.goto(BASE + "/convites")
        await settle(maria)
        await maria.get_by_role("button", name="Aurora").click()
        await maria.get_by_label("Pergunta de isca (opcional)").select_option(index=2)
        await maria.get_by_role("button", name="Gerar meu convite").click()
        link_input = maria.get_by_label("Link do convite")
        await expect(link_input).to_have_value(re.compile(r"/c/[A-Za-z0-9]{10}$"), timeout=30000)
        url = await link_input.input_value()
        check("Maria gerou o cartão de convite", True)
        await maria.get_by_role("radio", name="Carinho").click()
        message = await maria.locator(".studio-message").inner_text()
        check("mensagem no tom escolhido contém o link", url in message and "conhece" in message, message)
        wa = await maria.get_by_role("link", name="WhatsApp").get_attribute("href")
        check("botão do WhatsApp leva a mensagem pronta", bool(wa) and wa.startswith("https://wa.me/?text=") and "%2Fc%2F" in wa, wa or "")
        fb = await maria.get_by_role("link", name="Facebook").get_attribute("href")
        check("botão do Facebook compartilha o link", bool(fb) and "sharer.php" in fb, fb or "")
        await maria.get_by_role("button", name="Copiar link").click()
        copied = await maria.evaluate("navigator.clipboard.readText()")
        check("link copiado para a área de transferência", copied == url, copied)
        await maria.get_by_role("tab", name="Stories").click()
        await expect(maria.locator(".invite-card-story")).to_be_visible()
        await shot(maria, "ui-02-estudio-convite")

        # 3. João opens the link without an account
        await joao.goto(url)
        await expect(joao.get_by_role("heading", name="Quanto você conhece Maria?")).to_be_visible()
        check("João vê a página pública do convite", True)
        await shot(joao, "ui-03-landing-convite-celular")
        await joao.get_by_role("link", name="Criar conta e aceitar").click()
        # The confirmation toast shows while the questionnaire opens; the
        # request itself is verified on Maria's side in the next step.
        await register(joao, f"joao.{RUN}@orvok.test", "João Pedro")

        # 4. Maria accepts and consents
        await maria.goto(BASE + "/convites")
        await settle(maria)
        row = maria.locator(".list > li", has_text="João Pedro")
        await expect(row.get_by_role("button", name="Aceitar pedido")).to_be_visible(timeout=30000)
        check("pedido do João chegou para Maria após o cadastro pelo link", True)
        await row.get_by_role("button", name="Aceitar pedido").click()
        await row.get_by_role("button", name="Ler aviso e consentir").click()
        await expect(maria.get_by_role("heading", name="Consentir que João Pedro preveja você")).to_be_visible()
        await maria.locator("#consent-title").locator("xpath=ancestor::section").get_by_role("checkbox").check()
        await maria.get_by_role("button", name="Consentir", exact=True).click()
        await expect(maria.get_by_text("João Pedro já pode te prever.")).to_be_visible(timeout=30000)
        await expect(row.get_by_role("button", name="Revogar")).to_be_visible()
        check("Maria aceitou, leu o aviso e consentiu", True)

        # 5. João answers and predicts
        await joao.goto(BASE + "/onboarding")
        await settle(joao)
        await answer_all(joao, "João", lambda i: (i + 1) % 4)
        await joao.goto(BASE + "/previsao")
        await settle(joao)
        await expect(joao.get_by_role("heading", name="Prever Maria Clara")).to_be_visible()
        for i in range(12):
            await joao.get_by_role("radio").nth((i * 3 + (1 if i % 4 == 0 else 0)) % 4).click()
            await joao.get_by_label("Confiança na previsão").fill("0.75")
            button = joao.get_by_role("button", name=re.compile("Registrar"))
            await button.click()
            if i < 11:
                await expect(joao.get_by_text(f"Pergunta {i + 2} de 12")).to_be_visible(timeout=30000)
        await expect(joao.get_by_text("12 de 12 previstas")).to_be_visible(timeout=30000)
        check("João registrou 12 previsões pela interface", True)
        await shot(joao, "ui-04-previsao-celular")

        # 6. Encounter
        await maria.goto(BASE + "/resultado")
        await settle(maria)
        await expect(maria.get_by_text("Quem mais te antecipa")).to_be_visible()
        await expect(maria.locator("text=João Pedro").first).to_be_visible()
        await shot(maria, "ui-05-encontro")
        await maria.get_by_role("tab", name="Por pergunta").click()
        hits = await maria.locator(".cell-hit").count()
        misses = await maria.locator(".cell-miss").count()
        check("encontro mostra as 12 comparações", hits + misses == 12, f"hits={hits} misses={misses}")

        # Command palette and navigation
        await maria.keyboard.press("Control+k")
        await maria.get_by_label("Buscar").fill("mundo")
        await maria.keyboard.press("Enter")
        await maria.wait_for_url(re.compile(r"/eventos"))
        check("busca de comandos (Ctrl+K) navega", True)

        await browser.close()

    relevant = [e for e in errors if "favicon" not in e]
    check("sem erros de console ou falhas 5xx", not relevant, "; ".join(relevant[:5]))
    failed = [r for r in results if not r[1]]
    print(f"\n{len(results) - len(failed)}/{len(results)} verificações de interface passaram.")
    sys.exit(1 if failed else 0)


asyncio.run(main())
