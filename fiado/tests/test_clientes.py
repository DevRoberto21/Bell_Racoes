import pytest

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
