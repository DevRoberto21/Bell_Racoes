import sys
from pathlib import Path

RAIZ_DO_PROJETO = Path(__file__).resolve().parent.parent


def empacotado():
    return getattr(sys, "frozen", False)


def pasta_do_programa():
    """Onde ficam os dados graváveis: ao lado do executável, ou a raiz do projeto."""
    if empacotado():
        return Path(sys.executable).resolve().parent
    return RAIZ_DO_PROJETO


def pasta_de_recursos():
    """Onde ficam os arquivos embutidos (telas e templates), somente leitura."""
    if empacotado():
        return Path(sys._MEIPASS)
    return RAIZ_DO_PROJETO
