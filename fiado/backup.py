import sqlite3
from contextlib import closing
from pathlib import Path

from django.conf import settings
from django.utils import timezone

PADRAO = "bellracoes-*.sqlite3"


def fazer_backup(origem, pasta, dia):
    """Copia o banco com a API de backup do SQLite, segura com o sistema em uso."""
    pasta = Path(pasta)
    pasta.mkdir(parents=True, exist_ok=True)
    destino = pasta / f"bellracoes-{dia:%Y-%m-%d}.sqlite3"
    with closing(sqlite3.connect(origem)) as fonte, closing(sqlite3.connect(destino)) as copia:
        fonte.backup(copia)
    return destino


def limpar_antigos(pasta, manter):
    arquivos = sorted(Path(pasta).glob(PADRAO))
    for arquivo in arquivos[: max(len(arquivos) - manter, 0)]:
        arquivo.unlink()


def backup_do_dia(origem=None, dia=None):
    if not settings.BACKUP_ATIVO:
        return None
    dia = dia or timezone.localdate()
    pasta = Path(settings.BACKUP_DIR)
    if (pasta / f"bellracoes-{dia:%Y-%m-%d}.sqlite3").exists():
        return None
    destino = fazer_backup(origem or settings.DATABASES["default"]["NAME"], pasta, dia)
    limpar_antigos(pasta, settings.BACKUP_MANTER)
    return destino
