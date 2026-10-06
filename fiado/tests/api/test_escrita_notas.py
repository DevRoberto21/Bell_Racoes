import re
from decimal import Decimal

import pytest

from fiado.api.urls import urlpatterns
from fiado.models import CorrecaoNota, ItemNota, Nota, Pagamento
from fiado.servicos.notas import adicionar_item, criar_nota
from fiado.servicos.pagamentos import registrar_pagamento
from fiado.tests.fabrica import nota_continua_aberta, nota_unica_fechada

pytestmark = pytest.mark.django_db

JSON = "application/json"


def _rascunho(cliente, usuario):
    return criar_nota(cliente=cliente, tipo=Nota.Tipo.UNICA, usuario=usuario)


def _item(nota, usuario, descricao="Ração 15kg", quantidade="1", preco="100.00"):
    return adicionar_item(
        nota=nota, versao=nota.versao, descricao=descricao,
        quantidade=Decimal(quantidade), preco_unitario=Decimal(preco), usuario=usuario,
    )


def _pagar(nota, usuario, valor):
    return registrar_pagamento(
        nota=nota, versao=nota.versao, valor=Decimal(valor), forma="PIX", usuario=usuario
    ).nota


def _versao_no_banco(nota):
    return Nota.objects.get(pk=nota.pk).versao


def test_adicionar_item(logado, cliente, usuario):
    nota = _rascunho(cliente, usuario)
    resposta = logado.post(
        "/api/notas/1-1/itens",
        data={"versao": nota.versao, "descricao": " Ração 15kg ", "quantidade": "2", "preco_unitario": "50.00"},
        content_type=JSON,
    )
    assert resposta.status_code == 200
    corpo = resposta.json()
    assert corpo["total"] == "100.00"
    assert corpo["versao"] == nota.versao + 1
    assert corpo["codigo"] == "01-01"
    assert corpo["itens"] == [
        {
            "id": nota.itens.get().id,
            "descricao": "Ração 15kg",
            "quantidade": "2.000",
            "preco_unitario": "50.00",
            "subtotal": "100.00",
        }
    ]
    assert corpo["acoes"]["finalizar"] is True


def test_adicionar_item_com_preco_invalido(logado, cliente, usuario):
    nota = _rascunho(cliente, usuario)
    resposta = logado.post(
        "/api/notas/1-1/itens",
        data={"versao": nota.versao, "descricao": "Ração", "quantidade": "1", "preco_unitario": "abc"},
        content_type=JSON,
    )
    assert resposta.status_code == 400
    assert resposta.json()["campos"] == {"preco_unitario": "Informe um número válido."}
    assert ItemNota.objects.count() == 0
    assert _versao_no_banco(nota) == nota.versao


def test_adicionar_item_com_valor_zero(logado, cliente, usuario):
    nota = _rascunho(cliente, usuario)
    resposta = logado.post(
        "/api/notas/1-1/itens",
        data={"versao": nota.versao, "descricao": "Ração", "quantidade": "0.001", "preco_unitario": "0.01"},
        content_type=JSON,
    )
    assert resposta.status_code == 400
    assert resposta.json() == {"erro": "O valor do item não pode ser zero.", "campos": {}}
    assert ItemNota.objects.count() == 0


def test_adicionar_item_respeita_limites_de_campo(logado, cliente, usuario):
    nota = _rascunho(cliente, usuario)
    base = {"versao": nota.versao, "descricao": "Ração", "quantidade": "1", "preco_unitario": "1.00"}
    longa = logado.post("/api/notas/1-1/itens", data=base | {"descricao": "x" * 121}, content_type=JSON)
    assert longa.json()["campos"] == {"descricao": "Use no máximo 120 caracteres."}
    quatro_casas = logado.post("/api/notas/1-1/itens", data=base | {"quantidade": "1.0001"}, content_type=JSON)
    assert quatro_casas.json()["campos"] == {"quantidade": "Informe um número válido."}
    tres_casas_preco = logado.post("/api/notas/1-1/itens", data=base | {"preco_unitario": "1.001"}, content_type=JSON)
    assert tres_casas_preco.json()["campos"] == {"preco_unitario": "Informe um número válido."}
    assert ItemNota.objects.count() == 0


def test_remover_item_de_rascunho(logado, cliente, usuario):
    nota = _item(_rascunho(cliente, usuario), usuario)
    item = nota.itens.get()
    resposta = logado.delete(
        f"/api/notas/1-1/itens/{item.id}", data={"versao": nota.versao}, content_type=JSON
    )
    assert resposta.status_code == 200
    corpo = resposta.json()
    assert corpo["itens"] == []
    assert corpo["total"] == "0.00"
    assert corpo["versao"] == nota.versao + 1


def test_remover_item_de_nota_fechada(logado, cliente, usuario):
    nota = nota_unica_fechada(cliente, usuario, "100.00")
    item = nota.itens.get()
    resposta = logado.delete(
        f"/api/notas/1-1/itens/{item.id}", data={"versao": nota.versao}, content_type=JSON
    )
    assert resposta.status_code == 400
    assert resposta.json() == {
        "erro": "Para remover um item desta nota, use o botão de correção.",
        "campos": {},
    }
    assert nota.itens.count() == 1


def test_finalizar_nota(logado, cliente, usuario):
    nota = _item(_rascunho(cliente, usuario), usuario)
    resposta = logado.post("/api/notas/1-1/finalizar", data={"versao": nota.versao}, content_type=JSON)
    assert resposta.status_code == 200
    corpo = resposta.json()
    assert corpo["situacao"] == "FECHADA"
    assert corpo["acoes"]["receber"] is True
    assert corpo["versao"] == nota.versao + 1


def test_finalizar_sem_item(logado, cliente, usuario):
    nota = _rascunho(cliente, usuario)
    resposta = logado.post("/api/notas/1-1/finalizar", data={"versao": nota.versao}, content_type=JSON)
    assert resposta.status_code == 400
    assert resposta.json() == {"erro": "A nota precisa de pelo menos um item.", "campos": {}}
    assert Nota.objects.get(pk=nota.pk).situacao == "RASCUNHO"


def test_fechar_nota_continua(logado, cliente, usuario):
    nota = nota_continua_aberta(cliente, usuario, "70.00")
    resposta = logado.post("/api/notas/1-1/fechar", data={"versao": nota.versao}, content_type=JSON)
    assert resposta.status_code == 200
    corpo = resposta.json()
    assert (corpo["situacao"], corpo["saldo"]) == ("FECHADA", "70.00")


def test_descartar_rascunho(logado, cliente, usuario):
    nota = _rascunho(cliente, usuario)
    resposta = logado.delete("/api/notas/1-1", data={"versao": nota.versao}, content_type=JSON)
    assert resposta.status_code == 200
    assert resposta.json() == {}
    assert not Nota.objects.filter(pk=nota.pk).exists()


def test_descartar_nota_fechada(logado, cliente, usuario):
    nota = nota_unica_fechada(cliente, usuario)
    resposta = logado.delete("/api/notas/1-1", data={"versao": nota.versao}, content_type=JSON)
    assert resposta.status_code == 400
    assert resposta.json() == {
        "erro": "Só rascunho ou nota contínua vazia pode ser descartada.",
        "campos": {},
    }
    assert Nota.objects.filter(pk=nota.pk).exists()


def _receber(logado, nota, **corpo):
    return logado.post(
        "/api/notas/1-1/pagamentos",
        data={"versao": nota.versao} | corpo,
        content_type=JSON,
    )


def test_pagamento_parcial(logado, cliente, usuario):
    nota = nota_unica_fechada(cliente, usuario, "100.00")
    resposta = _receber(logado, nota, valor="40.00", forma="PIX")
    assert resposta.status_code == 200
    corpo = resposta.json()
    pagamento = Pagamento.objects.get()
    assert corpo["recibo_url"] == f"/recibos/{pagamento.id}/"
    assert corpo["nota"]["saldo"] == "60.00"
    assert corpo["nota"]["total_pago"] == "40.00"
    assert corpo["nota"]["situacao"] == "FECHADA"
    assert corpo["nota"]["versao"] == nota.versao + 1


def test_pagamento_total_quita_a_nota(logado, cliente, usuario):
    nota = nota_unica_fechada(cliente, usuario, "100.00")
    corpo = _receber(logado, nota, valor="100.00", forma="DINHEIRO").json()
    assert corpo["nota"]["situacao"] == "QUITADA"
    assert corpo["nota"]["acoes"]["receber"] is False
    assert corpo["nota"]["saldo"] == "0.00"


def test_pagamento_acima_do_saldo(logado, cliente, usuario):
    nota = nota_unica_fechada(cliente, usuario, "100.00")
    resposta = _receber(logado, nota, valor="100.01", forma="PIX")
    assert resposta.status_code == 400
    assert resposta.json()["erro"] == "O valor do pagamento é maior que o saldo da nota."
    assert Pagamento.objects.count() == 0


def test_pagamento_com_forma_invalida(logado, cliente, usuario):
    nota = nota_unica_fechada(cliente, usuario, "100.00")
    resposta = _receber(logado, nota, valor="10.00", forma="CHEQUE")
    assert resposta.status_code == 400
    assert resposta.json()["campos"] == {"forma": "Opção inválida."}
    assert Pagamento.objects.count() == 0


def test_pagamento_com_valor_em_formato_invalido(logado, cliente, usuario):
    nota = nota_unica_fechada(cliente, usuario, "100.00")
    resposta = _receber(logado, nota, valor="10,00", forma="PIX")
    assert resposta.status_code == 400
    assert resposta.json()["campos"] == {"valor": "Informe um número válido."}
    assert Pagamento.objects.count() == 0


def _corrigir(logado, nota, itens):
    return logado.put(
        "/api/notas/1-1/itens",
        data={"versao": nota.versao, "itens": itens},
        content_type=JSON,
    )


def test_corrigir_nota_trocando_item(logado, cliente, usuario):
    nota = nota_unica_fechada(cliente, usuario, "100.00")
    resposta = _corrigir(
        logado, nota, [{"descricao": "Ração 5kg", "quantidade": "2", "preco_unitario": "30.00"}]
    )
    assert resposta.status_code == 200
    corpo = resposta.json()
    assert corpo["editada"] is True
    assert corpo["total"] == "60.00"
    assert [i["descricao"] for i in corpo["itens"]] == ["Ração 5kg"]
    assert corpo["versao"] == nota.versao + 1
    assert CorrecaoNota.objects.count() == 1


def test_corrigir_nota_ignora_item_em_branco(logado, cliente, usuario):
    nota = nota_unica_fechada(cliente, usuario, "100.00")
    resposta = _corrigir(
        logado,
        nota,
        [
            {"descricao": "Ração 5kg", "quantidade": "1", "preco_unitario": "30.00"},
            {"descricao": "  ", "quantidade": "", "preco_unitario": ""},
            {},
            {"descricao": "Areia", "quantidade": "1", "preco_unitario": "20.00"},
        ],
    )
    assert resposta.status_code == 200
    corpo = resposta.json()
    assert [i["descricao"] for i in corpo["itens"]] == ["Ração 5kg", "Areia"]
    assert corpo["total"] == "50.00"


def test_corrigir_nota_com_item_parcial(logado, cliente, usuario):
    nota = nota_unica_fechada(cliente, usuario, "100.00")
    resposta = _corrigir(logado, nota, [{"descricao": "Ração 5kg", "quantidade": "1", "preco_unitario": ""}])
    assert resposta.status_code == 400
    assert resposta.json() == {
        "erro": "Confira os campos destacados.",
        "campos": {"itens.0.preco_unitario": "Informe um número válido."},
    }
    assert CorrecaoNota.objects.count() == 0
    assert _versao_no_banco(nota) == nota.versao


def test_corrigir_nota_com_item_parcial_depois_de_um_valido(logado, cliente, usuario):
    nota = nota_unica_fechada(cliente, usuario, "100.00")
    resposta = _corrigir(
        logado,
        nota,
        [
            {"descricao": "Ração 5kg", "quantidade": "1", "preco_unitario": "30.00"},
            {"descricao": "", "quantidade": "1", "preco_unitario": "5.00"},
        ],
    )
    assert resposta.status_code == 400
    assert resposta.json()["campos"] == {"itens.1.descricao": "Preencha este campo."}


def test_corrigir_nota_sem_itens_validos(logado, cliente, usuario):
    nota = nota_unica_fechada(cliente, usuario, "100.00")
    resposta = _corrigir(logado, nota, [{"descricao": "", "quantidade": "", "preco_unitario": ""}])
    assert resposta.status_code == 400
    assert resposta.json() == {"erro": "A nota precisa de pelo menos um item.", "campos": {}}
    assert nota.itens.count() == 1


def test_corrigir_nota_com_itens_que_nao_sao_lista(logado, cliente, usuario):
    nota = nota_unica_fechada(cliente, usuario, "100.00")
    resposta = logado.put(
        "/api/notas/1-1/itens", data={"versao": nota.versao, "itens": "x"}, content_type=JSON
    )
    assert resposta.status_code == 400
    assert resposta.json()["campos"] == {"itens": "Lista inválida."}


def test_corrigir_nota_abaixo_do_valor_pago(logado, cliente, usuario):
    nota = _pagar(nota_unica_fechada(cliente, usuario, "100.00"), usuario, "40.00")
    resposta = _corrigir(
        logado, nota, [{"descricao": "Ração", "quantidade": "1", "preco_unitario": "30.00"}]
    )
    assert resposta.status_code == 400
    assert "abaixo do valor já pago" in resposta.json()["erro"]
    assert CorrecaoNota.objects.count() == 0
    assert nota.itens.get().preco_unitario == Decimal("100.00")
    assert _versao_no_banco(nota) == nota.versao


def test_corrigir_nota_sem_alteracao(logado, cliente, usuario):
    nota = nota_unica_fechada(cliente, usuario, "100.00")
    resposta = _corrigir(
        logado, nota, [{"descricao": "Ração 15kg", "quantidade": "1", "preco_unitario": "100.00"}]
    )
    assert resposta.status_code == 400
    assert "Nenhuma alteração" in resposta.json()["erro"]
    assert CorrecaoNota.objects.count() == 0


def test_versao_antiga_em_adicionar_item(logado, cliente, usuario):
    nota = _rascunho(cliente, usuario)
    resposta = logado.post(
        "/api/notas/1-1/itens",
        data={"versao": nota.versao - 1, "descricao": "Ração", "quantidade": "1", "preco_unitario": "5.00"},
        content_type=JSON,
    )
    assert resposta.status_code == 409
    assert "alterada no outro caixa" in resposta.json()["erro"]
    assert ItemNota.objects.count() == 0


def test_versao_antiga_em_finalizar(logado, cliente, usuario):
    nota = _item(_rascunho(cliente, usuario), usuario)
    resposta = logado.post("/api/notas/1-1/finalizar", data={"versao": nota.versao - 1}, content_type=JSON)
    assert resposta.status_code == 409
    assert "alterada no outro caixa" in resposta.json()["erro"]
    assert Nota.objects.get(pk=nota.pk).situacao == "RASCUNHO"


def test_versao_antiga_em_pagamento(logado, cliente, usuario):
    nota = nota_unica_fechada(cliente, usuario, "100.00")
    resposta = logado.post(
        "/api/notas/1-1/pagamentos",
        data={"versao": nota.versao - 1, "valor": "10.00", "forma": "PIX"},
        content_type=JSON,
    )
    assert resposta.status_code == 409
    assert "alterada no outro caixa" in resposta.json()["erro"]
    assert Pagamento.objects.count() == 0


def test_versao_antiga_em_correcao(logado, cliente, usuario):
    nota = nota_unica_fechada(cliente, usuario, "100.00")
    resposta = logado.put(
        "/api/notas/1-1/itens",
        data={
            "versao": nota.versao - 1,
            "itens": [{"descricao": "Outra", "quantidade": "1", "preco_unitario": "5.00"}],
        },
        content_type=JSON,
    )
    assert resposta.status_code == 409
    assert "alterada no outro caixa" in resposta.json()["erro"]
    assert CorrecaoNota.objects.count() == 0
    assert nota.itens.get().descricao == "Ração 15kg"


def test_versao_ausente_e_conflito(logado, cliente, usuario):
    nota = nota_unica_fechada(cliente, usuario, "100.00")
    resposta = logado.post("/api/notas/1-1/pagamentos", data={"valor": "10.00", "forma": "PIX"}, content_type=JSON)
    assert resposta.status_code == 409
    assert Pagamento.objects.count() == 0
    resposta = logado.post("/api/notas/1-1/fechar", content_type=JSON)
    assert resposta.status_code == 409
    assert _versao_no_banco(nota) == nota.versao


ROTAS_DE_NOTA = [
    ("post", "/api/notas/{}/itens", {"versao": 0, "descricao": "a", "quantidade": "1", "preco_unitario": "1.00"}),
    ("put", "/api/notas/{}/itens", {"versao": 0, "itens": []}),
    ("delete", "/api/notas/{}/itens/1", {"versao": 0}),
    ("post", "/api/notas/{}/finalizar", {"versao": 0}),
    ("post", "/api/notas/{}/fechar", {"versao": 0}),
    ("delete", "/api/notas/{}", {"versao": 0}),
    ("post", "/api/notas/{}/pagamentos", {"versao": 0, "valor": "1.00", "forma": "PIX"}),
]


@pytest.mark.parametrize("metodo, caminho, corpo", ROTAS_DE_NOTA)
def test_escrita_de_nota_exige_login(client, cliente, usuario, metodo, caminho, corpo):
    nota = _rascunho(cliente, usuario)
    resposta = getattr(client, metodo)(caminho.format("1-1"), data=corpo, content_type=JSON)
    assert resposta.status_code == 401
    assert Nota.objects.filter(pk=nota.pk).exists()


@pytest.mark.parametrize("metodo, caminho, corpo", ROTAS_DE_NOTA)
def test_escrita_de_nota_inexistente(logado, cliente, metodo, caminho, corpo):
    resposta = getattr(logado, metodo)(caminho.format("1-9"), data=corpo, content_type=JSON)
    assert resposta.status_code == 404
    assert resposta.json() == {"erro": "Não encontrado.", "campos": {}}


def test_toda_rota_da_api_exige_login(client):
    anonimas = {"sessao", "entrar"}
    verificadas = 0
    for padrao in urlpatterns:
        rota = str(padrao.pattern)
        caminho = "/api/" + re.sub(r"<int:\w+>", "1", rota)
        resposta = client.get(caminho)
        if rota in anonimas:
            continue
        verificadas += 1
        assert resposta.status_code == 401, caminho
    assert verificadas == len(urlpatterns) - len(anonimas)
