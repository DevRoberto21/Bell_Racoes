import pytest
from django.core.management import call_command

pytestmark = pytest.mark.django_db


def test_painel_exige_login(client):
    resposta = client.get("/")
    assert resposta.status_code == 302
    assert resposta["Location"].startswith("/entrar/")


def test_login_leva_ao_painel(client, usuario):
    resposta = client.post(
        "/entrar/", {"username": "caixa1", "password": "senha-forte-1"}, follow=True
    )
    assert resposta.status_code == 200
    assert resposta.request["PATH_INFO"] == "/"
    assert "caixa1" in resposta.content.decode()


def test_login_com_senha_errada_nao_entra(client, usuario):
    resposta = client.post("/entrar/", {"username": "caixa1", "password": "errada"})
    assert resposta.status_code == 200
    assert "_auth_user_id" not in client.session


def test_criar_caixas_cria_os_dois_usuarios(django_user_model):
    call_command("criar_caixas", senha1="senha-forte-1", senha2="senha-forte-2")
    caixa1 = django_user_model.objects.get(username="caixa1")
    caixa2 = django_user_model.objects.get(username="caixa2")
    assert caixa1.first_name == "Flávia"
    assert caixa2.first_name == "Marcineide"
    assert caixa1.check_password("senha-forte-1")
    assert caixa2.check_password("senha-forte-2")


def test_criar_caixas_duas_vezes_troca_a_senha(django_user_model):
    call_command("criar_caixas", senha1="senha-forte-1", senha2="senha-forte-2")
    call_command("criar_caixas", senha1="outra-senha-1", senha2="outra-senha-2")
    assert django_user_model.objects.count() == 2
    assert django_user_model.objects.get(username="caixa1").check_password("outra-senha-1")
