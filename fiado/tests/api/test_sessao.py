import pytest

pytestmark = pytest.mark.django_db
JSON = {"content_type": "application/json"}


def test_sessao_sem_login(client):
    resposta = client.get("/api/sessao")
    assert resposta.status_code == 200
    assert resposta.json() == {"usuario": None}
    assert "csrftoken" in resposta.cookies


def test_entrar_e_sessao(client, usuario):
    resposta = client.post("/api/entrar", {"usuario": "caixa1", "senha": "senha-forte-1"}, **JSON)
    assert resposta.status_code == 200
    assert resposta.json() == {"usuario": {"nome_de_usuario": "caixa1", "nome": "Flávia"}}
    assert client.get("/api/sessao").json()["usuario"]["nome_de_usuario"] == "caixa1"


def test_entrar_com_senha_errada(client, usuario):
    resposta = client.post("/api/entrar", {"usuario": "caixa1", "senha": "errada"}, **JSON)
    assert resposta.status_code == 400
    assert resposta.json()["erro"] == "Usuário ou senha incorretos."
    assert client.get("/api/sessao").json() == {"usuario": None}


def test_sair(logado):
    assert logado.post("/api/sair", **JSON).status_code == 200
    assert logado.get("/api/sessao").json() == {"usuario": None}


def test_escrita_sem_csrf_e_recusada(usuario):
    from django.test import Client

    cliente_http = Client(enforce_csrf_checks=True)
    cliente_http.force_login(usuario)
    assert cliente_http.post("/api/sair", **JSON).status_code == 403
    token = cliente_http.get("/api/sessao").cookies["csrftoken"].value
    assert cliente_http.post("/api/sair", HTTP_X_CSRFTOKEN=token, **JSON).status_code == 200
