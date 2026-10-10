# -*- mode: python ; coding: utf-8 -*-
# Receita do PyInstaller. Rode na raiz do projeto, depois de gerar frontend/dist:
#     uv run --group build pyinstaller empacotamento/BellRacoes.spec --noconfirm
import os
import sys
from pathlib import Path

from PyInstaller.utils.hooks import collect_data_files, collect_submodules

RAIZ = Path(SPECPATH).parent
sys.path.insert(0, str(RAIZ))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "bellracoes.settings")

TELAS = RAIZ / "frontend" / "dist"
if not (TELAS / "index.html").is_file():
    raise SystemExit("frontend/dist não existe. Rode: npm --prefix frontend ci && npm --prefix frontend run build")


def _sem_testes(nome):
    return ".tests" not in nome


# Migrations e comandos são carregados por nome, então o PyInstaller não os acha sozinho.
ESCONDIDOS = (
    collect_submodules("fiado", filter=_sem_testes)
    + collect_submodules("bellracoes")
    + ["waitress", "whitenoise", "whitenoise.middleware", "tzdata"]
)

DADOS = [
    (str(TELAS), "frontend/dist"),
    (str(RAIZ / "fiado" / "templates"), "fiado/templates"),
] + collect_data_files("tzdata")

a = Analysis(
    [str(RAIZ / "iniciar.py")],
    pathex=[str(RAIZ)],
    binaries=[],
    datas=DADOS,
    hiddenimports=ESCONDIDOS,
    hookspath=[],
    runtime_hooks=[],
    excludes=["pytest", "playwright", "fiado.tests", "e2e"],
    noarchive=False,
)
pyz = PYZ(a.pure)
exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="BellRacoes",
    console=True,
    icon=str(RAIZ / "empacotamento" / "bell.ico"),
)
coll = COLLECT(exe, a.binaries, a.datas, name="BellRacoes")
