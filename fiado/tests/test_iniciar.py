import socket

import pytest

import iniciar


def _registrar(monkeypatch, alvo, nome, chamadas):
    monkeypatch.setattr(alvo, nome, lambda *a, **k: chamadas.append((nome, a, k)))


def test_com_argumentos_repassa_ao_django(monkeypatch):
    chamadas = []
    monkeypatch.setattr(
        "django.core.management.execute_from_command_line",
        lambda argumentos: chamadas.append(argumentos),
    )
    assert iniciar.principal(["criar_caixas", "--senha1", "a"]) == 0
    assert chamadas == [["BellRacoes", "criar_caixas", "--senha1", "a"]]


def test_porta_ocupada_avisa_e_so_abre_o_navegador(monkeypatch, capsys):
    chamadas = []
    monkeypatch.setattr(iniciar, "porta_ocupada", lambda: True)
    for nome in ["abrir_navegador", "preparar", "servir"]:
        _registrar(monkeypatch, iniciar, nome, chamadas)
    assert iniciar.principal([]) == 0
    assert [nome for nome, _, _ in chamadas] == ["abrir_navegador"]
    assert "O sistema já está aberto." in capsys.readouterr().out


def test_sem_argumentos_prepara_e_depois_serve(monkeypatch):
    chamadas = []
    monkeypatch.setattr(iniciar, "porta_ocupada", lambda: False)
    for nome in ["abrir_navegador", "preparar", "servir"]:
        _registrar(monkeypatch, iniciar, nome, chamadas)
    assert iniciar.principal([]) == 0
    assert [nome for nome, _, _ in chamadas] == ["preparar", "servir"]


@pytest.mark.django_db
def test_preparar_cria_os_caixas_quando_nao_ha_usuario(monkeypatch):
    comandos = []
    monkeypatch.setattr(
        "django.core.management.call_command", lambda nome, **k: comandos.append(nome)
    )
    iniciar.preparar()
    assert comandos == ["migrate", "criar_caixas"]


@pytest.mark.django_db
def test_preparar_nao_pergunta_senha_quando_ja_ha_usuario(monkeypatch, usuario):
    comandos = []
    monkeypatch.setattr(
        "django.core.management.call_command", lambda nome, **k: comandos.append(nome)
    )
    iniciar.preparar()
    assert comandos == ["migrate"]


def test_porta_ocupada_enxerga_um_servidor_escutando():
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as servidor:
        servidor.bind(("127.0.0.1", 0))
        servidor.listen(1)
        porta = servidor.getsockname()[1]
        assert iniciar.porta_ocupada(porta)
    assert not iniciar.porta_ocupada(porta)


def test_caminho_do_chrome_procura_nas_pastas_padrao_do_windows(tmp_path):
    chrome = tmp_path / "x86" / "Google" / "Chrome" / "Application" / "chrome.exe"
    chrome.parent.mkdir(parents=True)
    chrome.write_text("")
    ambiente = {"PROGRAMFILES": str(tmp_path / "pf"), "PROGRAMFILES(X86)": str(tmp_path / "x86")}
    assert iniciar.caminho_do_chrome(ambiente) == chrome
    assert iniciar.caminho_do_chrome({"PROGRAMFILES": str(tmp_path / "pf")}) is None
    assert iniciar.caminho_do_chrome({}) is None


def test_abrir_navegador_usa_o_chrome_com_impressao_direta(monkeypatch, tmp_path):
    chamadas = []
    chrome = tmp_path / "chrome.exe"
    monkeypatch.delenv("BELL_ABRIR_NAVEGADOR", raising=False)
    monkeypatch.setattr(iniciar, "caminho_do_chrome", lambda: chrome)
    monkeypatch.setattr(iniciar.subprocess, "Popen", lambda comando: chamadas.append(comando))
    iniciar.abrir_navegador()
    assert chamadas == [[str(chrome), "--kiosk-printing", "http://localhost:8000"]]


def test_abrir_navegador_sem_chrome_usa_o_navegador_padrao(monkeypatch):
    chamadas = []
    monkeypatch.delenv("BELL_ABRIR_NAVEGADOR", raising=False)
    monkeypatch.setattr(iniciar, "caminho_do_chrome", lambda: None)
    monkeypatch.setattr(iniciar.webbrowser, "open", lambda endereco: chamadas.append(endereco))
    iniciar.abrir_navegador()
    assert chamadas == ["http://localhost:8000"]


def test_abrir_navegador_desligado_por_variavel(monkeypatch):
    def nao_pode(*a, **k):
        raise AssertionError("não devia abrir navegador")

    monkeypatch.setenv("BELL_ABRIR_NAVEGADOR", "0")
    monkeypatch.setattr(iniciar, "caminho_do_chrome", nao_pode)
    monkeypatch.setattr(iniciar.webbrowser, "open", nao_pode)
    iniciar.abrir_navegador()


def test_executar_mostra_o_erro_e_devolve_1(monkeypatch, capsys):
    def quebrar(argumentos):
        raise RuntimeError("banco travado")

    monkeypatch.setattr(iniciar, "principal", quebrar)
    assert iniciar.executar([]) == 1
    saida = capsys.readouterr()
    assert "banco travado" in saida.err
    assert "O sistema parou. Anote a mensagem acima" in saida.out


def test_executar_devolve_o_codigo_de_saida_do_django(monkeypatch):
    def sair(argumentos):
        raise SystemExit(2)

    monkeypatch.setattr(iniciar, "principal", sair)
    assert iniciar.executar(["comando_inexistente"]) == 2


def test_executar_trata_ctrl_c_como_saida_normal(monkeypatch):
    def interromper(argumentos):
        raise KeyboardInterrupt

    monkeypatch.setattr(iniciar, "principal", interromper)
    assert iniciar.executar([]) == 0
