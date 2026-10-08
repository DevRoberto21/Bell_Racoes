import pytest

from fiado.erros import DadosInvalidos
from fiado.models import Cliente, Nota
from fiado.servicos.clientes import criar_cliente, editar_cliente
from fiado.servicos.notas import criar_nota

pytestmark = pytest.mark.django_db


def test_editar_cliente_nao_volta_o_contador_de_notas(usuario):
    antigo = criar_cliente(nome="Maria")
    obsoleto = Cliente.objects.get(pk=antigo.pk)
    criar_nota(cliente=antigo, tipo=Nota.Tipo.UNICA, usuario=usuario)
    editar_cliente(obsoleto, nome="  Novo ", apelido=" ", telefone="")
    recarregado = Cliente.objects.get(pk=antigo.pk)
    assert recarregado.ultimo_numero_nota == 1
    assert recarregado.nome == "Novo"
    assert recarregado.texto_busca == "novo"
    assert criar_nota(cliente=recarregado, tipo=Nota.Tipo.UNICA, usuario=usuario).numero == 2


@pytest.mark.parametrize("digitado", ["11912345678", "11 91234-5678", "(11)91234-5678", "+55 11 91234-5678"])
def test_criar_cliente_grava_telefone_formatado(digitado):
    assert criar_cliente(nome="Ana", telefone=digitado).telefone == "(11)91234-5678"


def test_telefone_vazio_continua_vazio():
    assert criar_cliente(nome="Ana", telefone="  ").telefone == ""
    assert criar_cliente(nome="Bia").telefone == ""


@pytest.mark.parametrize("digitado", ["1191234567", "119123456789", "11812345678", "01912345678", "abc"])
def test_telefone_invalido_levanta_erro_no_campo(digitado):
    with pytest.raises(DadosInvalidos) as falha:
        criar_cliente(nome="Ana", telefone=digitado)
    assert falha.value.campos == {"telefone": "Telefone incompleto. Use (dd)9xxxx-xxxx."}
    assert Cliente.objects.count() == 0


def test_editar_cliente_grava_telefone_formatado():
    cliente = criar_cliente(nome="Ana")
    assert editar_cliente(cliente, nome="Ana", telefone="11912345678").telefone == "(11)91234-5678"
    with pytest.raises(DadosInvalidos):
        editar_cliente(cliente, nome="Ana", telefone="123")
