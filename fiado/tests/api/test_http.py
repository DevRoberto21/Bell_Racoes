import json
from decimal import Decimal

import pytest
from django.http import Http404
from django.test import RequestFactory

from fiado.api.http import api
from fiado.api.validacao import DadosInvalidos, decimal, lista, opcao, texto
from fiado.erros import ConflitoDeVersao, ErroDeRegra

pytestmark = pytest.mark.django_db
fabrica = RequestFactory()


def _req(metodo="get", corpo=None, usuario=None):
    dados = json.dumps(corpo) if corpo is not None else ""
    req = getattr(fabrica, metodo)("/api/x", data=dados, content_type="application/json")
    req.user = usuario or type("Anonimo", (), {"is_authenticated": False})()
    return req


def _corpo(resposta):
    return json.loads(resposta.content)


def test_sem_login_devolve_401_em_json():
    @api("GET")
    def view(request):
        return {"ok": True}

    resposta = view(_req())
    assert resposta.status_code == 401
    assert _corpo(resposta) == {"erro": "Entre no sistema para continuar.", "campos": {}}


def test_login_false_dispensa_usuario():
    @api("GET", login=False)
    def view(request):
        return {"ok": True}

    assert _corpo(view(_req())) == {"ok": True}


def test_metodo_nao_permitido(usuario):
    @api("POST")
    def view(request):
        return {}

    assert view(_req("get", usuario=usuario)).status_code == 405


def test_corpo_json_fica_em_request_dados(usuario):
    @api("POST")
    def view(request):
        return {"eco": request.dados}

    assert _corpo(view(_req("post", {"a": 1}, usuario))) == {"eco": {"a": 1}}


def test_corpo_invalido_devolve_400(usuario):
    @api("POST")
    def view(request):
        return {}

    req = fabrica.post("/api/x", data="{nao-json", content_type="application/json")
    req.user = usuario
    resposta = view(req)
    assert resposta.status_code == 400
    assert _corpo(resposta)["erro"] == "Dados enviados em formato inválido."


@pytest.mark.parametrize(
    "excecao, status, mensagem",
    [
        (ErroDeRegra("Regra recusou."), 400, "Regra recusou."),
        (ConflitoDeVersao("Mudou no outro caixa."), 409, "Mudou no outro caixa."),
        (Http404(), 404, "Não encontrado."),
    ],
)
def test_excecoes_viram_respostas(usuario, excecao, status, mensagem):
    @api("GET")
    def view(request):
        raise excecao

    resposta = view(_req(usuario=usuario))
    assert resposta.status_code == status
    assert _corpo(resposta) == {"erro": mensagem, "campos": {}}


def test_dados_invalidos_levam_os_campos(usuario):
    @api("GET")
    def view(request):
        raise DadosInvalidos({"valor": "Informe um valor."})

    resposta = view(_req(usuario=usuario))
    assert resposta.status_code == 400
    assert _corpo(resposta) == {
        "erro": "Confira os campos destacados.",
        "campos": {"valor": "Informe um valor."},
    }


def test_decorador_marca_a_view_como_sem_redirecionamento_de_login():
    @api("GET")
    def view(request):
        return {}

    assert view.login_required is False


def test_texto():
    assert texto({"nome": "  Ana  "}, "nome", 10) == "Ana"
    assert texto({}, "apelido", 10, obrigatorio=False) == ""
    for dados in ({}, {"nome": "   "}, {"nome": 5}, {"nome": "x" * 11}):
        with pytest.raises(DadosInvalidos) as erro:
            texto(dados, "nome", 10)
        assert "nome" in erro.value.campos


def test_decimal_aceita_so_texto_com_ponto_e_casas_certas():
    assert decimal({"v": "96.40"}, "v", 2) == Decimal("96.40")
    assert decimal({"v": "1.5"}, "v", 3) == Decimal("1.5")
    for valor in (None, 96.4, 10, "abc", "1,50", "1.234", "NaN", "Infinity", "", "1e2"):
        with pytest.raises(DadosInvalidos) as erro:
            decimal({"v": valor}, "v", 2)
        assert "v" in erro.value.campos


def test_opcao_e_lista():
    assert opcao({"forma": "PIX"}, "forma", ["PIX", "DINHEIRO"]) == "PIX"
    with pytest.raises(DadosInvalidos):
        opcao({"forma": "CHEQUE"}, "forma", ["PIX"])
    assert lista({"itens": [1]}, "itens") == [1]
    with pytest.raises(DadosInvalidos):
        lista({"itens": "x"}, "itens")
