from decimal import Decimal

import pytest

from fiado.models import Nota
from fiado.servicos.notas import criar_nota
from fiado.servicos.pagamentos import registrar_pagamento
from fiado.tests.fabrica import nota_unica_fechada

pytestmark = pytest.mark.django_db


def _formulario(nota, linhas):
    dados = {
        "versao": nota.versao,
        "form-TOTAL_FORMS": str(len(linhas)),
        "form-INITIAL_FORMS": "0",
        "form-MIN_NUM_FORMS": "0",
        "form-MAX_NUM_FORMS": "1000",
    }
    for indice, linha in enumerate(linhas):
        for campo, valor in linha.items():
            dados[f"form-{indice}-{campo}"] = valor
    return dados


def _linha(descricao, preco, **extra):
    return {"descricao": descricao, "quantidade": "1", "preco_unitario": preco, **extra}


def test_botao_de_correcao_aparece_na_nota_fechada(logado, cliente, usuario):
    nota_unica_fechada(cliente, usuario)
    assert 'href="/notas/1-1/correcao/"' in logado.get("/notas/1-1/").content.decode()


def test_tela_de_correcao_vem_com_os_itens_atuais(logado, cliente, usuario):
    nota_unica_fechada(cliente, usuario, "100.00")
    html = logado.get("/notas/1-1/correcao/").content.decode()
    assert 'value="Ração 15kg"' in html
    assert 'value="100,00"' in html


def test_salvar_correcao_reimprime_com_marca_de_editado(logado, cliente, usuario):
    nota = nota_unica_fechada(cliente, usuario, "100.00")
    resposta = logado.post(
        "/notas/1-1/correcao/",
        _formulario(nota, [_linha("Ração 10kg", "70,00"), _linha("Coleira", "15,50")]),
    )
    assert resposta["Location"] == "/notas/1-1/imprimir/"
    nota.refresh_from_db()
    assert nota.editada is True
    assert nota.total == Decimal("85.50")
    assert nota.correcoes.count() == 1
    impressao = logado.get("/notas/1-1/imprimir/").content.decode()
    assert "EDITADO" in impressao
    assert "EDITADO" in logado.get("/notas/1-1/").content.decode()


def test_linha_marcada_para_remover_e_linha_vazia_sao_ignoradas(logado, cliente, usuario):
    nota = nota_unica_fechada(cliente, usuario, "100.00")
    logado.post(
        "/notas/1-1/correcao/",
        _formulario(
            nota,
            [
                _linha("Ração 15kg", "100,00", DELETE="on"),
                _linha("Ração 10kg", "70,00"),
                {"descricao": "", "quantidade": "", "preco_unitario": ""},
            ],
        ),
    )
    assert [i.descricao for i in nota.itens.all()] == ["Ração 10kg"]


def test_correcao_abaixo_do_pago_mostra_erro_e_mantem_a_tela(logado, cliente, usuario):
    nota = nota_unica_fechada(cliente, usuario, "100.00")
    nota = registrar_pagamento(
        nota=nota, versao=nota.versao, valor=Decimal("60.00"), forma="PIX", usuario=usuario
    ).nota
    resposta = logado.post("/notas/1-1/correcao/", _formulario(nota, [_linha("Ração", "50,00")]))
    assert resposta.status_code == 200
    html = resposta.content.decode()
    assert "abaixo do valor já pago" in html
    assert 'value="Ração"' in html
    nota.refresh_from_db()
    assert nota.editada is False


def test_correcao_com_campo_invalido_reexibe_o_formulario(logado, cliente, usuario):
    nota = nota_unica_fechada(cliente, usuario, "100.00")
    resposta = logado.post("/notas/1-1/correcao/", _formulario(nota, [_linha("Ração", "abc")]))
    assert resposta.status_code == 200
    nota.refresh_from_db()
    assert nota.editada is False


def test_correcao_com_versao_antiga_volta_para_a_nota(logado, cliente, usuario):
    nota = nota_unica_fechada(cliente, usuario, "100.00")
    dados = _formulario(nota, [_linha("Ração", "90,00")])
    registrar_pagamento(
        nota=nota, versao=nota.versao, valor=Decimal("10.00"), forma="PIX", usuario=usuario
    )
    resposta = logado.post("/notas/1-1/correcao/", dados, follow=True)
    assert resposta.request["PATH_INFO"] == "/notas/1-1/"
    assert "alterada no outro caixa" in resposta.content.decode()
    nota.refresh_from_db()
    assert nota.editada is False


def test_rascunho_e_quitada_nao_abrem_a_tela_de_correcao(logado, cliente, usuario):
    criar_nota(cliente=cliente, tipo=Nota.Tipo.UNICA, usuario=usuario)
    resposta = logado.get("/notas/1-1/correcao/", follow=True)
    assert "não pode ser corrigida" in resposta.content.decode()
    quitada = nota_unica_fechada(cliente, usuario, "10.00")
    registrar_pagamento(
        nota=quitada, versao=quitada.versao, valor=Decimal("10.00"), forma="PIX", usuario=usuario
    )
    html = logado.get("/notas/1-2/").content.decode()
    assert "/correcao/" not in html
