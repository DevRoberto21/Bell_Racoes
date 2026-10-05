import pytest

from fiado.busca import buscar, filtrar_clientes
from fiado.servicos.clientes import criar_cliente
from fiado.servicos.pagamentos import registrar_pagamento
from fiado.tests.fabrica import nota_unica_fechada

pytestmark = pytest.mark.django_db


def test_numero_sozinho_abre_o_cliente(cliente):
    resultado = buscar("1")
    assert (resultado.tipo, resultado.objeto) == ("cliente", cliente)
    assert buscar(" 01 ").objeto == cliente


def test_codigo_completo_abre_a_nota(cliente, usuario):
    nota = nota_unica_fechada(cliente, usuario)
    for texto in ["1-1", "01-01", " 01 - 01 "]:
        resultado = buscar(texto)
        assert (resultado.tipo, resultado.objeto) == ("nota", nota)


def test_nota_quitada_abre_pelo_codigo(cliente, usuario):
    nota = nota_unica_fechada(cliente, usuario, "10.00")
    registrar_pagamento(nota=nota, versao=nota.versao, valor=nota.saldo, forma="PIX", usuario=usuario)
    assert buscar("01-01").objeto == nota


def test_codigo_inexistente_avisa(cliente):
    cliente_inexistente = buscar("99")
    assert cliente_inexistente.tipo == "nao_encontrado"
    assert "99" in cliente_inexistente.mensagem
    assert cliente_inexistente.termo == "99"
    nota_inexistente = buscar("01-07")
    assert nota_inexistente.tipo == "nao_encontrado"
    assert "01-07" in nota_inexistente.mensagem


def test_texto_vira_lista_filtrada(cliente):
    resultado = buscar("maria")
    assert (resultado.tipo, resultado.termo) == ("lista", "maria")
    assert buscar("").tipo == "lista"


def test_filtro_por_nome_ou_apelido_sem_acento_nem_caixa():
    jose = criar_cliente(nome="José Pereira", apelido="Zé do Gás")
    criar_cliente(nome="Ana")
    assert list(filtrar_clientes("jose")) == [jose]
    assert list(filtrar_clientes("ZÉ DO")) == [jose]
    assert filtrar_clientes("").count() == 2


def test_digito_nao_ascii_vira_lista():
    assert buscar("²").tipo == "lista"


def test_numero_gigante_vira_texto(cliente):
    assert buscar("9" * 5000).tipo == "lista"
    assert buscar("1-" + "9" * 5000).tipo == "lista"
    assert buscar("9" * 5000 + "-1").tipo == "lista"


def test_e_numero():
    from fiado.busca import e_numero

    assert e_numero("123456789")
    assert not e_numero("1234567890")
    assert not e_numero("")
    assert not e_numero("١٢٣")
