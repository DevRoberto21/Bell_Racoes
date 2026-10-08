from datetime import timedelta
from decimal import Decimal

import pytest
from django.utils import timezone

from fiado.models import Cliente, Nota, Pagamento
from fiado.servicos.notas import criar_nota
from fiado.tests.fabrica import nota_continua_aberta, nota_unica_fechada

pytestmark = pytest.mark.django_db

JSON = "application/json"


def _ha(dias):
    return timezone.now() - timedelta(days=dias)


def test_criar_cliente(logado):
    resposta = logado.post(
        "/api/clientes",
        data={"nome": " Ana Souza ", "apelido": "Aninha", "telefone": "85988880000"},
        content_type=JSON,
    )
    assert resposta.status_code == 200
    corpo = resposta.json()
    assert corpo["codigo"] == 1
    assert (corpo["nome"], corpo["apelido"], corpo["telefone"]) == ("Ana Souza", "Aninha", "(85)98888-0000")
    assert corpo["divida"] == "0.00"
    assert corpo["pode_excluir"] is True
    assert Cliente.objects.get(codigo=1).nome == "Ana Souza"


def test_criar_cliente_com_nome_em_branco(logado):
    resposta = logado.post("/api/clientes", data={"nome": "   "}, content_type=JSON)
    assert resposta.status_code == 400
    assert resposta.json() == {
        "erro": "Confira os campos destacados.",
        "campos": {"nome": "Preencha este campo."},
    }
    assert Cliente.objects.count() == 0


def test_criar_cliente_respeita_limites(logado):
    resposta = logado.post(
        "/api/clientes", data={"nome": "x" * 121}, content_type=JSON
    )
    assert resposta.json()["campos"] == {"nome": "Use no máximo 120 caracteres."}
    resposta = logado.post(
        "/api/clientes", data={"nome": "Ana", "apelido": "x" * 61}, content_type=JSON
    )
    assert resposta.json()["campos"] == {"apelido": "Use no máximo 60 caracteres."}
    resposta = logado.post(
        "/api/clientes", data={"nome": "Ana", "telefone": "9" * 21}, content_type=JSON
    )
    assert resposta.json()["campos"] == {"telefone": "Use no máximo 20 caracteres."}
    assert Cliente.objects.count() == 0


def test_editar_cliente_mantem_numero_de_notas(logado, cliente, usuario):
    nota_unica_fechada(cliente, usuario, "10.00")
    resposta = logado.patch(
        "/api/clientes/1",
        data={"nome": "Maria Souza", "apelido": "", "telefone": "85911112222"},
        content_type=JSON,
    )
    assert resposta.status_code == 200
    corpo = resposta.json()
    assert (corpo["nome"], corpo["apelido"], corpo["telefone"]) == ("Maria Souza", "", "(85)91111-2222")
    assert corpo["divida"] == "10.00"
    cliente.refresh_from_db()
    assert cliente.nome == "Maria Souza"
    assert cliente.ultimo_numero_nota == 1


def test_editar_cliente_com_nome_em_branco(logado, cliente):
    resposta = logado.patch("/api/clientes/1", data={"nome": ""}, content_type=JSON)
    assert resposta.status_code == 400
    assert resposta.json()["campos"] == {"nome": "Preencha este campo."}
    cliente.refresh_from_db()
    assert cliente.nome == "Maria da Silva"


def test_excluir_cliente_sem_nota(logado, cliente):
    resposta = logado.delete("/api/clientes/1")
    assert resposta.status_code == 200
    assert resposta.json() == {}
    assert not Cliente.objects.filter(codigo=1).exists()


def test_excluir_cliente_com_nota(logado, cliente, usuario):
    criar_nota(cliente=cliente, tipo=Nota.Tipo.UNICA, usuario=usuario)
    resposta = logado.delete("/api/clientes/1")
    assert resposta.status_code == 400
    assert resposta.json() == {"erro": "Cliente com nota não pode ser excluído.", "campos": {}}
    assert Cliente.objects.filter(codigo=1).exists()


def test_criar_nota_unica(logado, cliente):
    resposta = logado.post("/api/clientes/1/notas", data={"tipo": "UNICA"}, content_type=JSON)
    assert resposta.status_code == 200
    corpo = resposta.json()
    assert (corpo["situacao"], corpo["codigo"], corpo["tipo"]) == ("RASCUNHO", "01-01", "UNICA")
    assert corpo["itens"] == []
    assert corpo["acoes"]["adicionar_item"] is True


def test_segunda_nota_continua_aberta_e_recusada(logado, cliente, usuario):
    nota_continua_aberta(cliente, usuario)
    resposta = logado.post("/api/clientes/1/notas", data={"tipo": "CONTINUA"}, content_type=JSON)
    assert resposta.status_code == 400
    assert resposta.json() == {
        "erro": "Este cliente já tem uma nota contínua aberta.",
        "campos": {},
    }
    assert cliente.notas.count() == 1


def test_criar_nota_com_tipo_invalido(logado, cliente):
    resposta = logado.post("/api/clientes/1/notas", data={"tipo": "OUTRA"}, content_type=JSON)
    assert resposta.status_code == 400
    assert resposta.json()["campos"] == {"tipo": "Opção inválida."}
    assert cliente.notas.count() == 0


def _duas_notas(cliente, usuario):
    nota_unica_fechada(cliente, usuario, "50.00", criada_em=_ha(10))
    nota_unica_fechada(cliente, usuario, "80.00", criada_em=_ha(2))


def _pagar_divida(logado, **corpo):
    return logado.post("/api/clientes/1/pagamentos", data=corpo, content_type=JSON)


def test_pagar_divida_total(logado, cliente, usuario):
    _duas_notas(cliente, usuario)
    resposta = _pagar_divida(logado, valor="70.00", forma="PIX", divida_esperada="130.00")
    assert resposta.status_code == 200
    corpo = resposta.json()
    assert corpo["recibo_url"].startswith("/recibos/lote/")
    pagamentos = list(Pagamento.objects.order_by("id"))
    assert [p.valor for p in pagamentos] == [Decimal("50.00"), Decimal("20.00")]
    assert corpo["recibo_url"] == f"/recibos/lote/{pagamentos[0].lote}/"
    assert corpo["cliente"]["divida"] == "60.00"
    assert [n["saldo"] for n in corpo["cliente"]["notas"]] == ["60.00"]


def test_pagar_divida_com_valor_desatualizado(logado, cliente, usuario):
    _duas_notas(cliente, usuario)
    resposta = _pagar_divida(logado, valor="70.00", forma="PIX", divida_esperada="50.00")
    assert resposta.status_code == 409
    assert "mudou no outro caixa" in resposta.json()["erro"]
    assert Pagamento.objects.count() == 0


def test_pagar_divida_acima_da_divida(logado, cliente, usuario):
    _duas_notas(cliente, usuario)
    resposta = _pagar_divida(logado, valor="130.01", forma="PIX", divida_esperada="130.00")
    assert resposta.status_code == 400
    assert resposta.json()["erro"] == "O valor é maior que a dívida do cliente."
    assert Pagamento.objects.count() == 0


def test_pagar_divida_com_valor_em_formato_invalido(logado, cliente, usuario):
    _duas_notas(cliente, usuario)
    virgula = _pagar_divida(logado, valor="70,00", forma="PIX", divida_esperada="130.00")
    assert virgula.status_code == 400
    assert virgula.json()["campos"] == {"valor": "Informe um número válido."}
    numerico = _pagar_divida(logado, valor=70, forma="PIX", divida_esperada="130.00")
    assert numerico.status_code == 400
    assert numerico.json()["campos"] == {"valor": "Informe um número válido."}
    assert Pagamento.objects.count() == 0


def test_pagar_divida_com_forma_e_divida_esperada_invalidas(logado, cliente, usuario):
    _duas_notas(cliente, usuario)
    forma = _pagar_divida(logado, valor="70.00", forma="CHEQUE", divida_esperada="130.00")
    assert forma.json()["campos"] == {"forma": "Opção inválida."}
    esperada = _pagar_divida(logado, valor="70.00", forma="PIX", divida_esperada="muito")
    assert esperada.json()["campos"] == {"divida_esperada": "Informe um número válido."}
    assert Pagamento.objects.count() == 0


ROTAS_DE_CLIENTE = [
    ("post", "/api/clientes", {"nome": "Ana"}),
    ("patch", "/api/clientes/{}", {"nome": "Ana"}),
    ("delete", "/api/clientes/{}", None),
    ("post", "/api/clientes/{}/notas", {"tipo": "UNICA"}),
    ("post", "/api/clientes/{}/pagamentos", {"valor": "1.00", "forma": "PIX", "divida_esperada": "0.00"}),
]


def _chamar(cliente_http, metodo, caminho, corpo):
    kwargs = {"content_type": JSON}
    if corpo is not None:
        kwargs["data"] = corpo
    return getattr(cliente_http, metodo)(caminho, **kwargs)


@pytest.mark.parametrize("metodo, caminho, corpo", ROTAS_DE_CLIENTE)
def test_escrita_de_cliente_exige_login(client, cliente, metodo, caminho, corpo):
    resposta = _chamar(client, metodo, caminho.format(1), corpo)
    assert resposta.status_code == 401
    assert Cliente.objects.count() == 1


@pytest.mark.parametrize("metodo, caminho, corpo", ROTAS_DE_CLIENTE[1:])
def test_escrita_de_cliente_inexistente(logado, metodo, caminho, corpo):
    resposta = _chamar(logado, metodo, caminho.format(99), corpo)
    assert resposta.status_code == 404
    assert resposta.json() == {"erro": "Não encontrado.", "campos": {}}


MENSAGEM_TELEFONE = "Telefone incompleto. Use (dd)9xxxx-xxxx."


def test_criar_cliente_com_telefone_invalido(logado):
    resposta = logado.post(
        "/api/clientes", data={"nome": "Ana", "telefone": "8533334444"}, content_type=JSON
    )
    assert resposta.status_code == 400
    assert resposta.json()["campos"] == {"telefone": MENSAGEM_TELEFONE}
    assert Cliente.objects.count() == 0


def test_editar_cliente_com_telefone_invalido(logado, cliente):
    resposta = logado.patch(
        "/api/clientes/1", data={"nome": "Maria", "telefone": "123"}, content_type=JSON
    )
    assert resposta.status_code == 400
    assert resposta.json()["campos"] == {"telefone": MENSAGEM_TELEFONE}
    cliente.refresh_from_db()
    assert cliente.telefone == "(85)99999-0000"


def test_criar_cliente_devolve_telefone_formatado(logado):
    resposta = logado.post(
        "/api/clientes", data={"nome": "Ana", "telefone": "11 91234-5678"}, content_type=JSON
    )
    assert resposta.status_code == 200
    assert resposta.json()["telefone"] == "(11)91234-5678"
