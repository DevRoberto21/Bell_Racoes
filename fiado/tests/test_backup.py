import sqlite3
import threading
from contextlib import closing
from datetime import date

import pytest

from fiado import backup, middleware


@pytest.fixture
def banco(tmp_path):
    caminho = tmp_path / "origem.sqlite3"
    with closing(sqlite3.connect(caminho)) as conexao:
        conexao.execute("CREATE TABLE divida (valor TEXT)")
        conexao.execute("INSERT INTO divida VALUES ('100.00')")
        conexao.commit()
    return caminho


def test_fazer_backup_copia_o_conteudo(banco, tmp_path):
    destino = backup.fazer_backup(banco, tmp_path / "copias", date(2026, 10, 5))
    assert destino.name == "bellracoes-2026-10-05.sqlite3"
    with closing(sqlite3.connect(destino)) as conexao:
        assert conexao.execute("SELECT valor FROM divida").fetchall() == [("100.00",)]


def test_limpar_antigos_mantem_as_mais_recentes(tmp_path):
    for dia in range(1, 6):
        (tmp_path / f"bellracoes-2026-10-0{dia}.sqlite3").write_text("x")
    (tmp_path / "outro-arquivo.txt").write_text("x")
    backup.limpar_antigos(tmp_path, manter=2)
    assert sorted(p.name for p in tmp_path.iterdir()) == [
        "bellracoes-2026-10-04.sqlite3",
        "bellracoes-2026-10-05.sqlite3",
        "outro-arquivo.txt",
    ]


def test_backup_do_dia_faz_uma_copia_por_dia(banco, tmp_path, settings):
    settings.BACKUP_ATIVO = True
    settings.BACKUP_DIR = tmp_path / "copias"
    settings.BACKUP_MANTER = 30
    primeira = backup.backup_do_dia(origem=banco, dia=date(2026, 10, 5))
    assert primeira.exists()
    assert backup.backup_do_dia(origem=banco, dia=date(2026, 10, 5)) is None
    assert backup.backup_do_dia(origem=banco, dia=date(2026, 10, 6)).exists()
    assert len(list(settings.BACKUP_DIR.iterdir())) == 2


def test_backup_do_dia_respeita_o_limite_de_copias(banco, tmp_path, settings):
    settings.BACKUP_ATIVO = True
    settings.BACKUP_DIR = tmp_path / "copias"
    settings.BACKUP_MANTER = 2
    for dia in (5, 6, 7):
        backup.backup_do_dia(origem=banco, dia=date(2026, 10, dia))
    assert sorted(p.name for p in settings.BACKUP_DIR.iterdir()) == [
        "bellracoes-2026-10-06.sqlite3",
        "bellracoes-2026-10-07.sqlite3",
    ]


def test_backup_desligado_nao_copia(banco, tmp_path, settings):
    settings.BACKUP_ATIVO = False
    settings.BACKUP_DIR = tmp_path / "copias"
    assert backup.backup_do_dia(origem=banco, dia=date(2026, 10, 5)) is None
    assert not settings.BACKUP_DIR.exists()


@pytest.mark.django_db
def test_middleware_chama_o_backup_uma_vez_por_dia(logado, monkeypatch):
    chamadas = []
    monkeypatch.setattr(middleware, "backup_do_dia", lambda: chamadas.append(1))
    monkeypatch.setattr(middleware.BackupDiarioMiddleware, "ultimo_dia", None)
    logado.get("/")
    logado.get("/")
    assert chamadas == [1]


@pytest.mark.django_db
def test_falha_no_backup_nao_derruba_a_tela(logado, monkeypatch):
    def falha():
        raise OSError("pasta inacessível")

    monkeypatch.setattr(middleware, "backup_do_dia", falha)
    monkeypatch.setattr(middleware.BackupDiarioMiddleware, "ultimo_dia", None)
    assert logado.get("/").status_code == 200
    assert middleware.BackupDiarioMiddleware.ultimo_dia is None


def test_falha_no_meio_da_copia_nao_deixa_arquivo_e_permite_nova_tentativa(banco, tmp_path, settings, monkeypatch):
    settings.BACKUP_ATIVO = True
    settings.BACKUP_DIR = tmp_path / "copias"
    settings.BACKUP_MANTER = 30

    def raise_error(*args, **kwargs):
        raise OSError("disco cheio")

    monkeypatch.setattr(backup.os, "replace", raise_error)
    with pytest.raises(OSError, match="disco cheio"):
        backup.backup_do_dia(origem=banco, dia=date(2026, 10, 5))
    assert list(settings.BACKUP_DIR.glob("*")) == []
    monkeypatch.undo()
    resultado = backup.backup_do_dia(origem=banco, dia=date(2026, 10, 5))
    assert resultado.exists()


def test_copia_passa_por_arquivo_temporario(banco, tmp_path, monkeypatch):
    chamadas = []
    original_replace = backup.os.replace

    def wrapper_replace(src, dst):
        chamadas.append((str(src), str(dst)))
        return original_replace(src, dst)

    monkeypatch.setattr(backup.os, "replace", wrapper_replace)
    resultado = backup.fazer_backup(banco, tmp_path / "copias", date(2026, 10, 5))
    assert len(chamadas) == 1
    src, dst = chamadas[0]
    assert src.endswith(".tmp")
    assert dst.endswith("bellracoes-2026-10-05.sqlite3")
    assert list((tmp_path / "copias").iterdir()) == [resultado]


def test_origem_inexistente_e_erro_e_nao_cria_banco_vazio(tmp_path):
    with pytest.raises(FileNotFoundError):
        backup.fazer_backup(tmp_path / "nao-existe.sqlite3", tmp_path / "copias", date(2026, 10, 5))
    assert not (tmp_path / "nao-existe.sqlite3").exists()
    copias_dir = tmp_path / "copias"
    if copias_dir.exists():
        assert list(copias_dir.iterdir()) == []


def test_limpar_antigos_ignora_arquivos_fora_do_padrao_de_data(tmp_path):
    (tmp_path / "bellracoes-2026-10-01.sqlite3").write_text("x")
    (tmp_path / "bellracoes-2026-10-02.sqlite3").write_text("x")
    (tmp_path / "bellracoes-2026-10-03.sqlite3").write_text("x")
    (tmp_path / "bellracoes-antes-da-migracao.sqlite3").write_text("x")
    (tmp_path / "bellracoes-2026-10-03.sqlite3.abc.tmp").write_text("x")
    backup.limpar_antigos(tmp_path, manter=2)
    nomes_restantes = sorted(p.name for p in tmp_path.iterdir())
    assert nomes_restantes == [
        "bellracoes-2026-10-02.sqlite3",
        "bellracoes-2026-10-03.sqlite3",
        "bellracoes-2026-10-03.sqlite3.abc.tmp",
        "bellracoes-antes-da-migracao.sqlite3",
    ]


def test_duas_threads_no_mesmo_dia_fazem_uma_copia_so(banco, tmp_path, settings):
    settings.BACKUP_ATIVO = True
    settings.BACKUP_DIR = tmp_path / "copias"
    settings.BACKUP_MANTER = 30
    resultados = []

    def executar_backup():
        try:
            resultado = backup.backup_do_dia(origem=banco, dia=date(2026, 10, 5))
            resultados.append(resultado)
        except Exception as e:
            resultados.append(e)

    threads = [threading.Thread(target=executar_backup) for _ in range(4)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    assert all(not isinstance(r, Exception) for r in resultados)
    caminhos = [r for r in resultados if r is not None]
    assert len(caminhos) == 1
    assert len(list(settings.BACKUP_DIR.iterdir())) == 1
