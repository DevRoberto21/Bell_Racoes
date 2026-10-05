from decimal import Decimal
from urllib.parse import urlencode

from django.contrib import messages
from django.shortcuts import get_object_or_404, redirect, render
from django.urls import reverse
from django.views.decorators.http import require_POST

from fiado import consultas
from fiado.busca import buscar, e_numero, filtrar_clientes
from fiado.erros import ErroDeRegra
from fiado.forms import ClienteForm
from fiado.models import Cliente, Nota
from fiado.servicos import clientes as servico_clientes
from fiado.servicos.clientes import criar_cliente, excluir_cliente
from fiado.servicos.notas import criar_nota


def lista_clientes(request):
    termo = request.GET.get("q", "")
    dividas = consultas.dividas_por_cliente()
    abertas = consultas.notas_abertas_por_cliente()
    linhas = [
        {
            "cliente": cliente,
            "divida": dividas.get(cliente.id, Decimal("0.00")),
            "abertas": abertas.get(cliente.id, 0),
        }
        for cliente in filtrar_clientes(termo)
    ]
    return render(request, "fiado/clientes.html", {"linhas": linhas, "termo": termo})


def novo_cliente(request):
    form = ClienteForm(request.POST or None)
    if request.method == "POST" and form.is_valid():
        cliente = criar_cliente(**form.cleaned_data)
        return redirect("cliente", cliente.codigo)
    return render(request, "fiado/cliente_form.html", {"form": form, "titulo": "Novo cliente"})


def editar_cliente(request, codigo):
    cliente = get_object_or_404(Cliente, codigo=codigo)
    form = ClienteForm(request.POST or None, instance=cliente)
    if request.method == "POST" and form.is_valid():
        servico_clientes.editar_cliente(cliente, **form.cleaned_data)
        return redirect("cliente", cliente.codigo)
    return render(request, "fiado/cliente_form.html", {"form": form, "titulo": "Editar cliente"})


def registro_cliente(request, codigo):
    cliente = get_object_or_404(Cliente, codigo=codigo)
    notas = list(consultas.notas_em_aberto(cliente))
    contexto = {
        "cliente": cliente,
        "notas": notas,
        "tem_rascunho": any(n.situacao == Nota.Situacao.RASCUNHO for n in notas),
        "divida": consultas.divida_do_cliente(cliente),
        "tem_continua_aberta": cliente.notas.filter(
            tipo=Nota.Tipo.CONTINUA, situacao=Nota.Situacao.ABERTA
        ).exists(),
        "pode_excluir": not cliente.notas.exists(),
        "foco_nota": request.GET.get("foco") == "nota",
    }
    return render(request, "fiado/cliente.html", contexto)


@require_POST
def excluir_cliente_view(request, codigo):
    cliente = get_object_or_404(Cliente, codigo=codigo)
    try:
        excluir_cliente(cliente)
    except ErroDeRegra as erro:
        messages.error(request, str(erro))
        return redirect("cliente", codigo)
    return redirect("clientes")


@require_POST
def abrir_nota_do_cliente(request, codigo):
    cliente = get_object_or_404(Cliente, codigo=codigo)
    numero = request.POST.get("numero", "").strip()
    if numero.isascii() and numero.isdigit() and not e_numero(numero):
        messages.error(request, f"Nota {numero[:12]} não existe.")
    elif e_numero(numero) and cliente.notas.filter(numero=int(numero)).exists():
        return redirect("nota", cliente.codigo, int(numero))
    elif e_numero(numero):
        messages.error(request, f"Nota {cliente.codigo:02d}-{int(numero):02d} não existe.")
    else:
        messages.error(request, "Digite o número da nota.")
    return redirect(reverse("cliente", args=[cliente.codigo]) + "?foco=nota")


@require_POST
def nova_nota(request, codigo):
    cliente = get_object_or_404(Cliente, codigo=codigo)
    try:
        nota = criar_nota(cliente=cliente, tipo=request.POST.get("tipo"), usuario=request.user)
    except ErroDeRegra as erro:
        messages.error(request, str(erro))
        return redirect("cliente", codigo)
    return redirect(nota)


def busca(request):
    resultado = buscar(request.GET.get("q", ""))
    if resultado.tipo == "nota":
        return redirect(resultado.objeto)
    if resultado.tipo == "cliente":
        return redirect(reverse("cliente", args=[resultado.objeto.codigo]) + "?foco=nota")
    if resultado.tipo == "lista":
        return redirect(reverse("clientes") + "?" + urlencode({"q": resultado.termo}))
    messages.error(request, resultado.mensagem)
    return redirect(reverse("painel") + "?" + urlencode({"q": resultado.termo}))
