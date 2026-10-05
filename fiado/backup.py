import os
import re
import sqlite3
import threading
import uuid
from contextlib import closing
from pathlib import Path

from django.conf import settings
from django.utils import timezone

NOME_DIARIO = re.compile(r"^bellracoes-\d{4}-\d{2}-\d{2}\.sqlite3$")
_trava = threading.Lock()


def _nome(dia):
    return f"bellracoes-{dia:%Y-%m-%d}.sqlite3"


def fazer_backup(origem, pasta, dia):
    """Copia o banco com a API de backup do SQLite, segura com o sistema em uso.

    Grava num arquivo temporário, confere a integridade e só então dá o nome final.
    """
    origem = Path(origem)
    if not origem.is_file():
        raise FileNotFoundError(f"Banco de origem não encontrado: {origem}")
    pasta = Path(pasta)
    pasta.mkdir(parents=True, exist_ok=True)
    destino = pasta / _nome(dia)
    temporario = pasta / f"{destino.name}.{uuid.uuid4().hex}.tmp"
    try:
        with closing(sqlite3.connect(origem)) as fonte, closing(sqlite3.connect(temporario)) as copia:
            fonte.backup(copia)
            resultado = copia.execute("PRAGMA integrity_check").fetchone()[0]
        if resultado != "ok":
            raise sqlite3.DatabaseError(f"Cópia de segurança corrompida: {resultado}")
        os.replace(temporario, destino)
    finally:
        temporario.unlink(missing_ok=True)
    return destino


def limpar_antigos(pasta, manter):
    arquivos = sorted(p for p in Path(pasta).iterdir() if NOME_DIARIO.match(p.name))
    for arquivo in arquivos[: max(len(arquivos) - manter, 0)]:
        arquivo.unlink()


def backup_do_dia(origem=None, dia=None):
    if not settings.BACKUP_ATIVO:
        return None
    dia = dia or timezone.localdate()
    pasta = Path(settings.BACKUP_DIR)
    with _trava:
        if (pasta / _nome(dia)).exists():
            return None
        destino = fazer_backup(origem or settings.DATABASES["default"]["NAME"], pasta, dia)
        limpar_antigos(pasta, settings.BACKUP_MANTER)
    return destino


def copia_de_hoje_existe(dia=None):
    dia = dia or timezone.localdate()
    return (Path(settings.BACKUP_DIR) / _nome(dia)).exists()
