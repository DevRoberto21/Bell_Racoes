import pytest
from django.core.management import call_command

pytestmark = pytest.mark.django_db


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


def test_todas_as_rotas_do_servidor_exigem_login(client):
    from uuid import UUID

    from django.urls import reverse

    from fiado.urls import urlpatterns

    argumentos = {"uuid": UUID("00000000-0000-0000-0000-000000000001")}
    protegidas = [padrao for padrao in urlpatterns if padrao.name != "spa"]
    assert [padrao.name for padrao in protegidas] == ["imprimir_nota", "recibo", "recibo_lote"]
    for padrao in protegidas:
        kwargs = {
            nome: argumentos.get(conversor.__class__.__name__.replace("Converter", "").lower(), 1)
            for nome, conversor in padrao.pattern.converters.items()
        }
        caminho = reverse(padrao.name, kwargs=kwargs)
        resposta = client.get(caminho)
        assert resposta.status_code == 302, caminho
        assert resposta["Location"] == f"/entrar?next={caminho}", caminho


def test_criar_caixas_recusa_senha_em_branco(django_user_model):
    from django.core.management.base import CommandError

    with pytest.raises(CommandError, match="A senha não pode ficar em branco."):
        call_command("criar_caixas", senha1="senha-forte-1", senha2="   ")
    assert not django_user_model.objects.filter(username="caixa2").exists()


def _digitar(monkeypatch, *respostas):
    fila = iter(respostas)
    monkeypatch.setattr("getpass.getpass", lambda pergunta: next(fila))


def _criar_caixas_digitando(monkeypatch, *respostas):
    from io import StringIO

    _digitar(monkeypatch, *respostas)
    saida = StringIO()
    call_command("criar_caixas", stdout=saida)
    return saida.getvalue()


def test_criar_caixas_pede_cada_senha_duas_vezes_e_avisa_que_nao_aparece(
    monkeypatch, django_user_model
):
    saida = _criar_caixas_digitando(monkeypatch, "senha-1", "senha-1", "senha-2", "senha-2")
    assert django_user_model.objects.get(username="caixa1").check_password("senha-1")
    assert django_user_model.objects.get(username="caixa2").check_password("senha-2")
    assert "nada aparece na tela" in saida


def test_criar_caixas_com_confirmacao_diferente_pede_de_novo(monkeypatch, django_user_model):
    saida = _criar_caixas_digitando(
        monkeypatch, "senha-1", "senha-x", "senha-1", "senha-1", "senha-2", "senha-2"
    )
    assert "As senhas não são iguais. Tente de novo." in saida
    assert django_user_model.objects.get(username="caixa1").check_password("senha-1")


def test_criar_caixas_digitando_em_branco_pede_de_novo(monkeypatch, django_user_model):
    saida = _criar_caixas_digitando(
        monkeypatch, "   ", "senha-1", "senha-1", "senha-2", "senha-2"
    )
    assert "A senha não pode ficar em branco." in saida
    assert django_user_model.objects.get(username="caixa1").check_password("senha-1")


def test_criar_caixas_com_senhas_por_argumento_nao_pergunta(monkeypatch, django_user_model):
    def nao_pode_perguntar(pergunta):
        raise AssertionError("não devia perguntar")

    monkeypatch.setattr("getpass.getpass", nao_pode_perguntar)
    call_command("criar_caixas", senha1="senha-forte-1", senha2="senha-forte-2")
    assert django_user_model.objects.count() == 2
