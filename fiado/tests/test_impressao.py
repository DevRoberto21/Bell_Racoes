from datetime import timedelta
from decimal import Decimal

import pytest
from django.utils import timezone

from fiado.models import Nota
from fiado.servicos.correcoes import corrigir_nota
from fiado.servicos.notas import criar_nota
from fiado.servicos.pagamentos import pagar_divida_total, registrar_pagamento
from fiado.tests.fabrica import nota_unica_fechada

pytestmark = pytest.mark.django_db

LOTE_INEXISTENTE = "00000000-0000-0000-0000-000000000000"


def _pagar(nota, usuario, valor, forma="DINHEIRO"):
    nota.refresh_from_db()
    return registrar_pagamento(
        nota=nota, versao=nota.versao, valor=Decimal(valor), forma=forma, usuario=usuario
    )


def _lote_de_duas_notas(cliente, usuario):
    agora = timezone.now()
    nota_unica_fechada(cliente, usuario, "50.00", criada_em=agora - timedelta(days=10))
    nota_unica_fechada(cliente, usuario, "80.00", criada_em=agora - timedelta(days=2))
    pagamentos = pagar_divida_total(
        cliente=cliente,
        usuario=usuario,
        valor=Decimal("70.00"),
        forma="PIX",
        divida_esperada=Decimal("130.00"),
    )
    return pagamentos[0].lote


def _hoje():
    return timezone.localdate().strftime("%d/%m/%Y")


def test_impressao_tem_duas_vias_codigo_e_assinatura(logado, cliente, usuario, settings):
    settings.LOJA_NOME = "Bell Rações"
    nota_unica_fechada(cliente, usuario, "100.00")
    html = logado.get("/notas/1-1/imprimir/").content.decode()
    assert "VIA DO CLIENTE" in html
    assert "VIA DA LOJA" in html
    assert html.count("01-01") >= 2
    assert "Bell Rações" in html
    assert "Maria da Silva" in html
    assert "Ração 15kg" in html
    assert "100,00" in html
    assert "Assinatura" in html
    assert "size: 80mm auto" in html
    assert "window.print()" in html
    assert "EDITADO" not in html


def test_impressao_fecha_a_aba_no_lugar_de_voltar(logado, cliente, usuario):
    nota_unica_fechada(cliente, usuario)
    html = logado.get("/notas/1-1/imprimir/").content.decode()
    assert '<button type="button" onclick="window.close()">Fechar</button>' in html
    assert "Voltar" not in html
    assert "href=" not in html


def test_nota_corrigida_imprime_com_marca_de_editado(logado, cliente, usuario):
    nota = nota_unica_fechada(cliente, usuario, "100.00")
    corrigir_nota(
        nota=nota,
        versao=nota.versao,
        itens=[
            {
                "descricao": "Ração 10kg",
                "quantidade": Decimal("1"),
                "preco_unitario": Decimal("70.00"),
            }
        ],
        usuario=usuario,
    )
    html = logado.get("/notas/1-1/imprimir/").content.decode()
    assert "EDITADO em " + _hoje() in html
    assert "Ração 10kg" in html
    assert "70,00" in html


def test_rascunho_nao_imprime(logado, cliente, usuario):
    criar_nota(cliente=cliente, tipo=Nota.Tipo.UNICA, usuario=usuario)
    assert logado.get("/notas/1-1/imprimir/").status_code == 404


def test_nota_inexistente_e_404(logado):
    assert logado.get("/notas/1-1/imprimir/").status_code == 404


def test_recibo_mostra_valor_forma_e_saldo_restante(logado, cliente, usuario):
    nota = nota_unica_fechada(cliente, usuario, "100.00")
    pagamento = _pagar(nota, usuario, "40.00", "PIX")
    html = logado.get(f"/recibos/{pagamento.id}/").content.decode()
    assert "RECIBO DE PAGAMENTO" in html
    assert "01-01" in html
    assert "Maria da Silva" in html
    assert "40,00" in html
    assert "Pix" in html
    assert "caixa1" in html
    assert "60,00" in html
    assert "Saldo restante da nota em " + _hoje() in html
    assert "window.close()" in html


def test_recibo_reaberto_mostra_saldo_atual_com_data(logado, cliente, usuario):
    nota = nota_unica_fechada(cliente, usuario, "100.00")
    primeiro = _pagar(nota, usuario, "40.00")
    _pagar(nota, usuario, "10.00")
    html = logado.get(f"/recibos/{primeiro.id}/").content.decode()
    assert "50,00" in html
    assert "Saldo restante da nota em " + _hoje() in html


def test_recibo_do_lote_lista_as_notas_e_a_divida_restante(logado, cliente, usuario):
    lote = _lote_de_duas_notas(cliente, usuario)
    html = logado.get(f"/recibos/lote/{lote}/").content.decode()
    assert html.count("RECIBO DE PAGAMENTO") == 1
    assert "01-01" in html and "01-02" in html
    assert "50,00" in html and "20,00" in html
    assert "70,00" in html
    assert "60,00" in html
    assert "Saldo restante do cliente em " + _hoje() in html
    assert "window.close()" in html


def test_recibo_inexistente_e_404(logado):
    assert logado.get("/recibos/999/").status_code == 404
    assert logado.get(f"/recibos/lote/{LOTE_INEXISTENTE}/").status_code == 404


@pytest.mark.parametrize(
    "caminho",
    ["/notas/1-1/imprimir/", "/recibos/1/", f"/recibos/lote/{LOTE_INEXISTENTE}/"],
)
def test_sem_login_redireciona_para_entrar_com_o_destino(client, caminho):
    resposta = client.get(caminho)
    assert resposta.status_code == 302
    assert resposta["Location"] == f"/entrar?next={caminho}"


ENDERECO_DA_LOJA = "Rua Coronel Antônio Vicente, 134, Centro, Timbaúba"


def test_nota_e_recibo_trazem_o_endereco_da_loja(logado, cliente, usuario):
    nota = nota_unica_fechada(cliente, usuario, "100.00")
    pagamento = _pagar(nota, usuario, "40.00")
    for caminho in ["/notas/1-1/imprimir/", f"/recibos/{pagamento.id}/"]:
        assert ENDERECO_DA_LOJA in logado.get(caminho).content.decode(), caminho


def test_impresso_nao_traz_telefone_da_loja(logado, cliente, usuario, settings):
    settings.LOJA_TELEFONE = "(81)90000-1111"
    nota = nota_unica_fechada(cliente, usuario, "100.00")
    pagamento = _pagar(nota, usuario, "40.00")
    for caminho in ["/notas/1-1/imprimir/", f"/recibos/{pagamento.id}/"]:
        assert "(81)90000-1111" not in logado.get(caminho).content.decode(), caminho


def test_contexto_da_loja_tem_so_nome_e_endereco():
    from fiado.contexto import loja

    assert set(loja(None)["loja"]) == {"nome", "endereco"}
