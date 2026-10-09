"""Gera empacotamento/bell.ico a partir da logo quadrada (frontend/public/favicon.svg).

Rode na raiz do projeto, só quando a logo mudar:
    uv run --with pillow python empacotamento/gerar_icone.py
"""
import base64
import io
from pathlib import Path

from PIL import Image
from playwright.sync_api import sync_playwright

RAIZ = Path(__file__).resolve().parent.parent
SVG = RAIZ / "frontend" / "public" / "favicon.svg"
ICO = RAIZ / "empacotamento" / "bell.ico"
TAMANHOS = [16, 32, 48, 64, 128, 256]
LADO = max(TAMANHOS)


def desenhar():
    logo = base64.b64encode(SVG.read_bytes()).decode()
    pagina_html = (
        '<body style="margin:0;background:transparent">'
        f'<img src="data:image/svg+xml;base64,{logo}" width="{LADO}" height="{LADO}">'
        "</body>"
    )
    with sync_playwright() as playwright:
        navegador = playwright.chromium.launch()
        pagina = navegador.new_page(viewport={"width": LADO, "height": LADO})
        pagina.set_content(pagina_html)
        png = pagina.screenshot(omit_background=True)
        navegador.close()
    return Image.open(io.BytesIO(png))


if __name__ == "__main__":
    desenhar().save(ICO, sizes=[(lado, lado) for lado in TAMANHOS])
    print(f"Gravado {ICO}")
