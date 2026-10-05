import re
from dataclasses import dataclass

from fiado.models import Cliente, Nota, normalizar

PADRAO_NOTA = re.compile(r"^(\d+)\s*-\s*(\d+)$")
MAX_DIGITOS = 9


def e_numero(texto):
    """Só dígitos ASCII, no máximo 9: seguro para virar int."""
    return texto.isascii() and texto.isdigit() and len(texto) <= MAX_DIGITOS


@dataclass
class ResultadoBusca:
    tipo: str  # "nota", "cliente", "lista" ou "nao_encontrado"
    objeto: object = None
    termo: str = ""
    mensagem: str = ""


def buscar(texto):
    termo = (texto or "").strip()
    codigo_de_nota = PADRAO_NOTA.match(termo)
    if codigo_de_nota and all(e_numero(parte) for parte in codigo_de_nota.groups()):
        cliente_codigo, numero = map(int, codigo_de_nota.groups())
        nota = (
            Nota.objects.select_related("cliente")
            .filter(cliente__codigo=cliente_codigo, numero=numero)
            .first()
        )
        if nota:
            return ResultadoBusca("nota", objeto=nota, termo=termo)
        return ResultadoBusca("nao_encontrado", termo=termo, mensagem=f"Nota {termo} não existe.")
    if e_numero(termo):
        cliente = Cliente.objects.filter(codigo=int(termo)).first()
        if cliente:
            return ResultadoBusca("cliente", objeto=cliente, termo=termo)
        return ResultadoBusca("nao_encontrado", termo=termo, mensagem=f"Cliente {termo} não existe.")
    return ResultadoBusca("lista", termo=termo)


def filtrar_clientes(termo):
    termo = normalizar(termo or "")
    clientes = Cliente.objects.all()
    return clientes.filter(texto_busca__contains=termo) if termo else clientes
