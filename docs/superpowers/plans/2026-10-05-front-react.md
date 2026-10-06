# Front em React — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trocar as telas do fiado por uma aplicação React (paleta Névoa, menu lateral, nota em gaveta, movimento fluido) apoiada numa API JSON sobre os serviços existentes.

**Architecture:** O Django ganha `fiado/api/`, com views JSON finas que chamam `fiado/servicos/` e `fiado/consultas.py` sem alterá-los. O React vive em `frontend/`, é gerado com Vite e servido pelo próprio Django como arquivo estático; qualquer endereço que não seja API, estático, impressão ou recibo devolve o `index.html`. As páginas de impressão continuam HTML do servidor.

**Tech Stack:** Django 6.1 (existente), React 19, TypeScript, Vite, react-router 7, @tanstack/react-query 5, motion, @fontsource-variable/inter, Vitest + Testing Library, Playwright (pytest-playwright existente).

**Spec:** `docs/superpowers/specs/2026-10-05-front-react-design.md` (regras de negócio: `docs/superpowers/specs/2026-10-05-fiado-design.md`)

## Global Constraints

- Não alterar `fiado/servicos/`, `fiado/consultas.py`, `fiado/busca.py`, `fiado/backup.py`, `fiado/models.py` nem os testes deles. Se uma tarefa parecer exigir isso, pare e reporte.
- Nenhuma regra de negócio em `fiado/api/` nem no React. A API traduz JSON para chamadas de serviço; o front mostra o que a API devolve.
- Dinheiro e quantidade trafegam como texto com ponto decimal (`"96.40"`, `"1.500"`). O front nunca usa `Number`, `parseFloat` ou aritmética de ponto flutuante em dinheiro; totais e saldos vêm do servidor.
- Toda escrita em nota envia `versao`. Erros: `400` regra ou dado inválido, `401` sem login, `404` inexistente, `409` conflito. Corpo de erro: `{"erro": "<mensagem>", "campos": {...}}`.
- Toda escrita envia o cabeçalho `X-CSRFToken`.
- Todo texto de interface, nome de função, variável, componente e teste em português.
- Cores, raios e tempos só pelas variáveis CSS definidas na Task 4. Nenhuma cor literal fora de `frontend/src/estilo/variaveis.css`.
- Paleta Névoa (valores exatos na Task 4). Contraste mínimo de texto 4,5:1.
- Movimento: base 0,4 s com mola leve, micro 0,15 s; com `prefers-reduced-motion: reduce` nada anima; nenhuma animação bloqueia digitação ou clique.
- Largura mínima suportada: 1280 px. Sem tema escuro, sem celular.
- Sem Tailwind e sem biblioteca de componentes. CSS puro, um arquivo `.css` ao lado de cada componente.
- O computador da loja não tem Node: nada em tempo de execução pode depender de Node.
- Commits no padrão Conventional Commits, em português, **sem** linha `Co-Authored-By` nem qualquer assinatura de IA.
- Comandos: Python com `uv run ...`; front com `npm --prefix frontend ...`.

Como este plano é escrito: as tarefas de back-end (1 a 3) trazem o código das peças de infraestrutura e os testes com valores exatos. As tarefas de front (4 a 10) trazem estrutura de arquivos, interfaces, comportamento e os testes das peças com lógica; o JSX e o CSS de cada componente são escritos pelo implementador dentro dessas regras.

## Estrutura de arquivos

```
fiado/api/__init__.py
fiado/api/http.py            decorador `api`, respostas de erro, leitura de JSON
fiado/api/validacao.py       leitura tipada de campos do corpo JSON
fiado/api/serializadores.py  modelos -> dicionários JSON
fiado/api/sessao.py          sessao, entrar, sair
fiado/api/leitura.py         painel, busca, pagas
fiado/api/clientes.py        clientes, cliente, criar nota, prévia e pagamento da dívida
fiado/api/notas.py           nota, itens, finalizar, fechar, descartar, pagamento, correção
fiado/api/urls.py
fiado/views/spa.py           devolve o index.html do front
fiado/views/impressao.py     impressão da nota e recibos (movidos das views antigas)
fiado/tests/api/             testes da API
frontend/                    projeto Vite (estrutura na Task 4)
e2e/test_fluxo_fiado.py      reescrito na Task 10
```

---

### Task 1: Infraestrutura da API e sessão

**Files:**
- Create: `fiado/api/__init__.py`, `fiado/api/http.py`, `fiado/api/validacao.py`, `fiado/api/sessao.py`, `fiado/api/urls.py`
- Modify: `bellracoes/urls.py`
- Test: `fiado/tests/api/__init__.py`, `fiado/tests/api/test_http.py`, `fiado/tests/api/test_sessao.py`

**Interfaces:**
- Produces:
  - `fiado.api.http.api(*metodos, login=True)`: decorador de view. Marca a view como `login_not_required` (o próprio decorador responde `401` em JSON), recusa método fora da lista com `405`, lê o corpo JSON em `request.dados` (dict; `{}` se vazio), e converte exceções: `DadosInvalidos` → `400` com `campos`; `ConflitoDeVersao` → `409`; `ErroDeRegra` → `400`; `Http404` → `404`. A view devolve um `dict`/`list` (vira `JsonResponse` 200), ou uma `HttpResponse` pronta.
  - `fiado.api.http.erro(mensagem, status, campos=None) -> JsonResponse`.
  - `fiado.api.validacao.DadosInvalidos(campos: dict[str, str])`, `texto(dados, campo, maximo, obrigatorio=True) -> str`, `decimal(dados, campo, casas) -> Decimal`, `opcao(dados, campo, validas) -> str`, `lista(dados, campo) -> list`.
  - Rotas `GET /api/sessao`, `POST /api/entrar`, `POST /api/sair`.

- [ ] **Step 1: Escrever os testes que falham**

`fiado/tests/api/test_http.py`:

```python
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
```

`fiado/tests/api/test_sessao.py`:

```python
import pytest

pytestmark = pytest.mark.django_db
JSON = {"content_type": "application/json"}


def test_sessao_sem_login(client):
    resposta = client.get("/api/sessao")
    assert resposta.status_code == 200
    assert resposta.json() == {"usuario": None}
    assert "csrftoken" in resposta.cookies


def test_entrar_e_sessao(client, usuario):
    resposta = client.post("/api/entrar", {"usuario": "caixa1", "senha": "senha-forte-1"}, **JSON)
    assert resposta.status_code == 200
    assert resposta.json() == {"usuario": {"nome_de_usuario": "caixa1", "nome": "Flávia"}}
    assert client.get("/api/sessao").json()["usuario"]["nome_de_usuario"] == "caixa1"


def test_entrar_com_senha_errada(client, usuario):
    resposta = client.post("/api/entrar", {"usuario": "caixa1", "senha": "errada"}, **JSON)
    assert resposta.status_code == 400
    assert resposta.json()["erro"] == "Usuário ou senha incorretos."
    assert client.get("/api/sessao").json() == {"usuario": None}


def test_sair(logado):
    assert logado.post("/api/sair", **JSON).status_code == 200
    assert logado.get("/api/sessao").json() == {"usuario": None}


def test_escrita_sem_csrf_e_recusada(usuario):
    from django.test import Client

    cliente_http = Client(enforce_csrf_checks=True)
    cliente_http.force_login(usuario)
    assert cliente_http.post("/api/sair", **JSON).status_code == 403
    token = cliente_http.get("/api/sessao").cookies["csrftoken"].value
    assert cliente_http.post("/api/sair", HTTP_X_CSRFTOKEN=token, **JSON).status_code == 200
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `uv run pytest fiado/tests/api -v`
Expected: FAIL com `ModuleNotFoundError: No module named 'fiado.api'`.

- [ ] **Step 3: Implementar**

`fiado/api/validacao.py`:

```python
import re
from decimal import Decimal


class DadosInvalidos(Exception):
    """Corpo da requisição com campo ausente ou em formato errado."""

    def __init__(self, campos):
        super().__init__("Confira os campos destacados.")
        self.campos = campos


def _falha(campo, mensagem):
    raise DadosInvalidos({campo: mensagem})


def texto(dados, campo, maximo, obrigatorio=True):
    valor = dados.get(campo, "")
    if not isinstance(valor, str):
        _falha(campo, "Valor inválido.")
    valor = valor.strip()
    if obrigatorio and not valor:
        _falha(campo, "Preencha este campo.")
    if len(valor) > maximo:
        _falha(campo, f"Use no máximo {maximo} caracteres.")
    return valor


def decimal(dados, campo, casas):
    """Aceita só texto como "96.40": dígitos, ponto opcional e até `casas` casas."""
    valor = dados.get(campo)
    if not isinstance(valor, str) or not re.fullmatch(rf"\d{{1,9}}(\.\d{{1,{casas}}})?", valor):
        _falha(campo, "Informe um número válido.")
    return Decimal(valor)


def opcao(dados, campo, validas):
    valor = dados.get(campo)
    if valor not in validas:
        _falha(campo, "Opção inválida.")
    return valor


def lista(dados, campo):
    valor = dados.get(campo)
    if not isinstance(valor, list):
        _falha(campo, "Lista inválida.")
    return valor
```

`fiado/api/http.py`:

```python
import json
from functools import wraps

from django.contrib.auth.decorators import login_not_required
from django.http import Http404, HttpResponse, JsonResponse

from fiado.api.validacao import DadosInvalidos
from fiado.erros import ConflitoDeVersao, ErroDeRegra


def erro(mensagem, status, campos=None):
    return JsonResponse({"erro": mensagem, "campos": campos or {}}, status=status)


def _ler_corpo(request):
    if not request.body:
        return {}
    dados = json.loads(request.body)
    if not isinstance(dados, dict):
        raise ValueError("corpo não é objeto")
    return dados


def api(*metodos, login=True):
    """Envolve uma view JSON: método, login, corpo e erros num lugar só."""

    def decorador(view):
        @login_not_required
        @wraps(view)
        def interna(request, *args, **kwargs):
            if request.method not in metodos:
                return erro("Método não permitido.", 405)
            if login and not request.user.is_authenticated:
                return erro("Entre no sistema para continuar.", 401)
            try:
                request.dados = _ler_corpo(request)
            except ValueError:
                return erro("Dados enviados em formato inválido.", 400)
            try:
                resposta = view(request, *args, **kwargs)
            except DadosInvalidos as falha:
                return erro(str(falha), 400, falha.campos)
            except ConflitoDeVersao as falha:
                return erro(str(falha), 409)
            except ErroDeRegra as falha:
                return erro(str(falha), 400)
            except Http404:
                return erro("Não encontrado.", 404)
            if isinstance(resposta, HttpResponse):
                return resposta
            return JsonResponse(resposta, safe=False)

        return interna

    return decorador
```

`json.JSONDecodeError` é subclasse de `ValueError`, então o mesmo `except` cobre os dois casos.

`fiado/api/sessao.py`:

```python
from django.contrib.auth import authenticate, login, logout
from django.views.decorators.csrf import ensure_csrf_cookie

from fiado.api.http import api, erro
from fiado.api.validacao import texto


def _usuario_json(usuario):
    if not usuario.is_authenticated:
        return None
    return {"nome_de_usuario": usuario.username, "nome": usuario.first_name}


@ensure_csrf_cookie
@api("GET", login=False)
def sessao(request):
    return {"usuario": _usuario_json(request.user)}


@api("POST", login=False)
def entrar(request):
    usuario = authenticate(
        request,
        username=texto(request.dados, "usuario", 150),
        password=texto(request.dados, "senha", 200),
    )
    if usuario is None:
        return erro("Usuário ou senha incorretos.", 400)
    login(request, usuario)
    return {"usuario": _usuario_json(usuario)}


@api("POST")
def sair(request):
    logout(request)
    return {"usuario": None}
```

`ensure_csrf_cookie` por fora de `api` remove o atributo `login_required` posto pelo decorador interno? Confira com um teste: `client.get("/api/sessao")` anônimo deve dar 200, não redirecionar. Se redirecionar, aplique `login_not_required` também por fora.

`fiado/api/urls.py`:

```python
from django.urls import path

from fiado.api import sessao

urlpatterns = [
    path("sessao", sessao.sessao),
    path("entrar", sessao.entrar),
    path("sair", sessao.sair),
]
```

Em `bellracoes/urls.py`, acrescente antes da linha `path("", include("fiado.urls")),`:

```python
    path("api/", include("fiado.api.urls")),
```

- [ ] **Step 4: Rodar e ver passar**

Run: `uv run pytest fiado/tests/api -v` e depois `uv run pytest fiado/tests -q`
Expected: todos passam; a suíte antiga continua verde.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: infraestrutura da API JSON e sessão"
```

---

### Task 2: API de leitura

**Files:**
- Create: `fiado/api/serializadores.py`, `fiado/api/leitura.py`, `fiado/api/clientes.py`, `fiado/api/notas.py`
- Modify: `fiado/api/urls.py`
- Test: `fiado/tests/api/test_leitura.py`

**Interfaces:**
- Consumes: `api`, `erro` (Task 1); `fiado.consultas`, `fiado.busca`, `fiado.backup.copia_de_hoje_existe`, modelos.
- Produces (formas JSON usadas pelo front e pela Task 3):

```
dinheiro(valor) -> str                         # "96.40"
ClienteLinha  = {codigo:int, codigo_formatado:str, nome, apelido, telefone, divida:str, notas_abertas:int}
NotaResumo    = {codigo:"12-03", cliente:{codigo:int, codigo_formatado:str, nome:str}, numero:int,
                 tipo, tipo_rotulo, situacao, situacao_rotulo, criada_em:iso, quitada_em:iso|null,
                 editada:bool, dias_em_aberto:int, nivel_alerta:int, total:str, saldo:str}
Nota          = NotaResumo + {editada_em:iso|null, versao:int, total_pago:str,
                 itens:[{id, descricao, quantidade:"1.000", preco_unitario:"189.90", subtotal:"189.90"}],
                 pagamentos:[{id, valor, forma, forma_rotulo, recebido_em:iso, recebido_por:str, recibo_url:str}],
                 acoes:{adicionar_item, remover_item, finalizar, fechar, descartar, receber, corrigir, imprimir: bool},
                 imprimir_url:str}
ClienteDetalhe = ClienteLinha + {notas:[NotaResumo], tem_continua_aberta:bool, pode_excluir:bool}
Painel        = {total_em_aberto:str, alertas:[NotaResumo], rascunhos:[NotaResumo], backup_falhou:bool}
Busca         = {tipo:"nota", nota:NotaResumo}
              | {tipo:"cliente", cliente:ClienteDetalhe}
              | {tipo:"lista", clientes:[ClienteLinha]}          # no máximo 8
              | {tipo:"nao_encontrado", mensagem:str}
Previa        = {divida:str, sobra:str, partes:[{codigo:"12-01", saldo:str, parte:str}]}
```

  - Funções em `serializadores.py`: `dinheiro`, `cliente_linha(cliente, divida, notas_abertas)`, `cliente_detalhe(cliente)`, `nota_resumo(nota, hoje=None)`, `nota_completa(nota, hoje=None)`, `acoes_da_nota(nota, tem_itens, tem_pagamentos, saldo)`.
  - `fiado.api.notas.obter_nota(cliente_codigo, numero) -> Nota` (levanta `Http404`).
  - Rotas `GET`: `/api/painel`, `/api/busca`, `/api/clientes`, `/api/clientes/<int:codigo>`, `/api/clientes/<int:codigo>/divida/previa`, `/api/notas/<int:cliente_codigo>-<int:numero>`, `/api/pagas`.

Regras de `acoes_da_nota` (S = `Nota.Situacao`, T = `Nota.Tipo`):

| ação | verdadeira quando |
| --- | --- |
| `adicionar_item` | `nota.aceita_itens` |
| `remover_item` | situação `RASCUNHO` |
| `finalizar` | tipo `UNICA`, situação `RASCUNHO`, tem itens |
| `fechar` | tipo `CONTINUA`, situação `ABERTA`, tem itens |
| `descartar` | situação `RASCUNHO`, ou tipo `CONTINUA` + situação `ABERTA` + sem itens + sem pagamentos |
| `receber` | `nota.em_divida` e saldo > 0 |
| `corrigir` | `nota.em_divida` |
| `imprimir` | situação diferente de `RASCUNHO` |

URLs dentro do JSON: `imprimir_url = f"/notas/{cliente.codigo}-{numero}/imprimir/"`; `recibo_url = f"/recibos/lote/{lote}/"` quando o pagamento tem `lote`, senão `f"/recibos/{id}/"`.

- [ ] **Step 1: Escrever os testes que falham**

`fiado/tests/api/test_leitura.py` deve cobrir, usando as fábricas de `fiado/tests/fabrica.py` e os fixtures `logado`, `cliente`, `usuario`:

```python
from datetime import timedelta
from decimal import Decimal

import pytest
from django.utils import timezone

from fiado.models import Nota
from fiado.servicos.clientes import criar_cliente
from fiado.servicos.notas import criar_nota
from fiado.servicos.pagamentos import pagar_divida_total, registrar_pagamento
from fiado.tests.fabrica import nota_continua_aberta, nota_unica_fechada

pytestmark = pytest.mark.django_db


def _ha(dias):
    return timezone.now() - timedelta(days=dias)


def _pagar(nota, usuario, valor, agora=None):
    return registrar_pagamento(
        nota=nota, versao=nota.versao, valor=Decimal(valor), forma="PIX", usuario=usuario, agora=agora
    )


def test_nota_completa(logado, cliente, usuario):
    nota = nota_unica_fechada(cliente, usuario, "100.00", criada_em=_ha(14))
    pagamento = _pagar(nota, usuario, "40.00")
    corpo = logado.get("/api/notas/1-1").json()
    assert corpo["codigo"] == "01-01"
    assert corpo["cliente"] == {"codigo": 1, "codigo_formatado": "01", "nome": "Maria da Silva"}
    assert (corpo["tipo"], corpo["tipo_rotulo"]) == ("UNICA", "Única")
    assert (corpo["situacao"], corpo["situacao_rotulo"]) == ("FECHADA", "Fechada")
    assert (corpo["dias_em_aberto"], corpo["nivel_alerta"]) == (14, 2)
    assert (corpo["total"], corpo["total_pago"], corpo["saldo"]) == ("100.00", "40.00", "60.00")
    assert corpo["versao"] == pagamento.nota.versao
    assert corpo["itens"] == [
        {
            "id": nota.itens.get().id,
            "descricao": "Ração 15kg",
            "quantidade": "1.000",
            "preco_unitario": "100.00",
            "subtotal": "100.00",
        }
    ]
    assert corpo["pagamentos"][0]["valor"] == "40.00"
    assert corpo["pagamentos"][0]["forma_rotulo"] == "Pix"
    assert corpo["pagamentos"][0]["recebido_por"] == "caixa1"
    assert corpo["pagamentos"][0]["recibo_url"] == f"/recibos/{pagamento.id}/"
    assert corpo["imprimir_url"] == "/notas/1-1/imprimir/"
    assert corpo["acoes"] == {
        "adicionar_item": False,
        "remover_item": False,
        "finalizar": False,
        "fechar": False,
        "descartar": False,
        "receber": True,
        "corrigir": True,
        "imprimir": True,
    }


def test_recibo_de_lote_na_nota(logado, cliente, usuario):
    nota_unica_fechada(cliente, usuario, "50.00")
    pagamentos = pagar_divida_total(
        cliente=cliente, valor=Decimal("20.00"), forma="PIX", usuario=usuario,
        divida_esperada=Decimal("50.00"),
    )
    url = logado.get("/api/notas/1-1").json()["pagamentos"][0]["recibo_url"]
    assert url == f"/recibos/lote/{pagamentos[0].lote}/"


@pytest.mark.parametrize(
    "preparar, esperado",
    [
        ("rascunho_vazio", {"adicionar_item": True, "remover_item": True, "finalizar": False, "descartar": True, "imprimir": False, "receber": False, "corrigir": False, "fechar": False}),
        ("continua_com_item", {"adicionar_item": True, "remover_item": False, "finalizar": False, "descartar": False, "imprimir": True, "receber": True, "corrigir": True, "fechar": True}),
        ("continua_vazia", {"adicionar_item": True, "remover_item": False, "finalizar": False, "descartar": True, "imprimir": True, "receber": False, "corrigir": True, "fechar": False}),
        ("quitada", {"adicionar_item": False, "remover_item": False, "finalizar": False, "descartar": False, "imprimir": True, "receber": False, "corrigir": False, "fechar": False}),
    ],
)
def test_acoes_por_situacao(logado, cliente, usuario, preparar, esperado):
    if preparar == "rascunho_vazio":
        criar_nota(cliente=cliente, tipo=Nota.Tipo.UNICA, usuario=usuario)
    elif preparar == "continua_com_item":
        nota_continua_aberta(cliente, usuario)
    elif preparar == "continua_vazia":
        criar_nota(cliente=cliente, tipo=Nota.Tipo.CONTINUA, usuario=usuario)
    else:
        _pagar(nota_unica_fechada(cliente, usuario, "10.00"), usuario, "10.00")
    assert logado.get("/api/notas/1-1").json()["acoes"] == esperado


def test_nota_inexistente(logado, cliente):
    resposta = logado.get("/api/notas/1-9")
    assert resposta.status_code == 404
    assert resposta.json() == {"erro": "Não encontrado.", "campos": {}}


def test_lista_de_clientes(logado, cliente, usuario):
    criar_cliente(nome="Ana")
    nota_unica_fechada(cliente, usuario, "100.00")
    corpo = logado.get("/api/clientes").json()
    assert [c["nome"] for c in corpo] == ["Ana", "Maria da Silva"]
    assert corpo[1] == {
        "codigo": 1, "codigo_formatado": "01", "nome": "Maria da Silva", "apelido": "Mariinha",
        "telefone": "85999990000", "divida": "100.00", "notas_abertas": 1,
    }
    assert corpo[0]["divida"] == "0.00"
    assert [c["nome"] for c in logado.get("/api/clientes", {"q": "mariinha"}).json()] == ["Maria da Silva"]


def test_cliente_detalhe(logado, cliente, usuario):
    nova = nota_unica_fechada(cliente, usuario, "30.00", criada_em=_ha(1))
    antiga = nota_continua_aberta(cliente, usuario, "70.00", criada_em=_ha(9))
    corpo = logado.get("/api/clientes/1").json()
    assert corpo["divida"] == "100.00"
    assert [n["codigo"] for n in corpo["notas"]] == [antiga.codigo, nova.codigo]
    assert corpo["notas"][0]["saldo"] == "70.00"
    assert corpo["tem_continua_aberta"] is True
    assert corpo["pode_excluir"] is False
    assert logado.get("/api/clientes/99").status_code == 404


def test_previa_da_divida(logado, cliente, usuario):
    nota_unica_fechada(cliente, usuario, "50.00", criada_em=_ha(10))
    nota_unica_fechada(cliente, usuario, "80.00", criada_em=_ha(2))
    corpo = logado.get("/api/clientes/1/divida/previa", {"valor": "70.00"}).json()
    assert corpo == {
        "divida": "130.00",
        "sobra": "0.00",
        "partes": [
            {"codigo": "01-01", "saldo": "50.00", "parte": "50.00"},
            {"codigo": "01-02", "saldo": "80.00", "parte": "20.00"},
        ],
    }
    assert logado.get("/api/clientes/1/divida/previa", {"valor": "200.00"}).json()["sobra"] == "70.00"
    assert logado.get("/api/clientes/1/divida/previa", {"valor": "abc"}).json()["partes"] == []
    assert logado.get("/api/clientes/1/divida/previa").json()["partes"] == []


def test_painel(logado, cliente, usuario, settings):
    settings.BACKUP_ATIVO = False
    atrasada = nota_unica_fechada(cliente, usuario, "100.00", criada_em=_ha(22))
    nota_unica_fechada(cliente, usuario, "30.00", criada_em=_ha(3))
    rascunho = criar_nota(cliente=cliente, tipo=Nota.Tipo.UNICA, usuario=usuario)
    corpo = logado.get("/api/painel").json()
    assert corpo["total_em_aberto"] == "130.00"
    assert [n["codigo"] for n in corpo["alertas"]] == [atrasada.codigo]
    assert corpo["alertas"][0]["nivel_alerta"] == 3
    assert [n["codigo"] for n in corpo["rascunhos"]] == [rascunho.codigo]
    assert corpo["backup_falhou"] is False


def test_painel_avisa_backup_ausente(logado, settings, tmp_path, monkeypatch):
    from fiado import middleware

    settings.BACKUP_ATIVO = True
    settings.BACKUP_DIR = tmp_path
    monkeypatch.setattr(middleware, "backup_do_dia", lambda: None)
    monkeypatch.setattr(middleware.BackupDiarioMiddleware, "ultimo_dia", None)
    assert logado.get("/api/painel").json()["backup_falhou"] is True


def test_busca(logado, cliente, usuario):
    nota = nota_unica_fechada(cliente, usuario, "100.00")
    por_nota = logado.get("/api/busca", {"q": "01-01"}).json()
    assert (por_nota["tipo"], por_nota["nota"]["codigo"]) == ("nota", nota.codigo)
    por_cliente = logado.get("/api/busca", {"q": "1"}).json()
    assert por_cliente["tipo"] == "cliente"
    assert por_cliente["cliente"]["notas"][0]["codigo"] == "01-01"
    por_nome = logado.get("/api/busca", {"q": "maria"}).json()
    assert (por_nome["tipo"], por_nome["clientes"][0]["nome"]) == ("lista", "Maria da Silva")
    inexistente = logado.get("/api/busca", {"q": "01-07"}).json()
    assert inexistente == {"tipo": "nao_encontrado", "mensagem": "Nota 01-07 não existe."}


def test_busca_por_texto_limita_a_8(logado):
    for indice in range(10):
        criar_cliente(nome=f"Cliente {indice}")
    assert len(logado.get("/api/busca", {"q": "cliente"}).json()["clientes"]) == 8
    assert logado.get("/api/busca", {"q": ""}).json() == {"tipo": "lista", "clientes": []}


def test_pagas(logado, cliente, usuario):
    agora = timezone.now()
    _pagar(nota_unica_fechada(cliente, usuario, "10.00"), usuario, "10.00", agora=agora - timedelta(days=6))
    _pagar(nota_unica_fechada(cliente, usuario, "20.00"), usuario, "20.00", agora=agora - timedelta(days=8))
    corpo = logado.get("/api/pagas").json()
    assert [n["codigo"] for n in corpo] == ["01-01"]
    assert corpo[0]["quitada_em"] is not None


def test_leitura_exige_login(client, cliente):
    for caminho in ["/api/painel", "/api/busca?q=1", "/api/clientes", "/api/clientes/1", "/api/notas/1-1", "/api/pagas"]:
        assert client.get(caminho).status_code == 401
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `uv run pytest fiado/tests/api/test_leitura.py -v`
Expected: FAIL com 404 nas rotas.

- [ ] **Step 3: Implementar**

Escreva `serializadores.py` com as funções da seção Interfaces, produzindo exatamente as formas descritas. Regras:

- `dinheiro(valor)`: `str(Decimal(valor).quantize(Decimal("0.01")))`.
- Quantidade: `str(item.quantidade)` (o campo tem 3 casas, então sai `"1.000"`).
- Datas: `timezone.localtime(dt).isoformat()`; `None` continua `None`.
- `nota_completa` lê itens e pagamentos uma vez (`list(...)`) e calcula `total`, `total_pago` e `saldo` pelas propriedades do modelo.
- `cliente_detalhe(cliente)` usa `consultas.divida_do_cliente`, `consultas.notas_em_aberto` e monta `notas_abertas` pelo tamanho da lista.

Views (`@api("GET")` em todas):

- `leitura.painel`: `consultas.total_em_aberto()`, `consultas.notas_em_alerta()`, `consultas.rascunhos()`, `backup_falhou = settings.BACKUP_ATIVO and not copia_de_hoje_existe()`.
- `leitura.busca`: usa `fiado.busca.buscar(q)`. Para `"lista"` com termo vazio devolve lista vazia; com termo, `filtrar_clientes(termo)[:8]` com dívida e notas abertas de `consultas.dividas_por_cliente()` e `consultas.notas_abertas_por_cliente()`.
- `leitura.pagas`: `consultas.notas_pagas_recentes()`.
- `clientes.lista` (só GET nesta tarefa), `clientes.detalhe` (só GET nesta tarefa), `clientes.previa_divida`: lê `valor` da query string com a mesma regra de `validacao.decimal`; valor ausente ou inválido devolve `partes: []` e `sobra: "0.00"`, sem erro.
- `notas.detalhe` (só GET nesta tarefa) com `obter_nota`.

Acrescente as rotas em `fiado/api/urls.py`:

```python
    path("painel", leitura.painel),
    path("busca", leitura.busca),
    path("pagas", leitura.pagas),
    path("clientes", clientes.lista),
    path("clientes/<int:codigo>", clientes.detalhe),
    path("clientes/<int:codigo>/divida/previa", clientes.previa_divida),
    path("notas/<int:cliente_codigo>-<int:numero>", notas.detalhe),
```

- [ ] **Step 4: Rodar e ver passar**

Run: `uv run pytest fiado/tests/api -v` e `uv run pytest fiado/tests -q`
Expected: todos passam.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: API de leitura do fiado"
```

---

### Task 3: API de escrita

**Files:**
- Modify: `fiado/api/clientes.py`, `fiado/api/notas.py`, `fiado/api/urls.py`
- Test: `fiado/tests/api/test_escrita_clientes.py`, `fiado/tests/api/test_escrita_notas.py`

**Interfaces:**
- Consumes: Tasks 1 e 2; serviços `criar_cliente`, `editar_cliente`, `excluir_cliente`, `criar_nota`, `adicionar_item`, `remover_item`, `finalizar_nota`, `fechar_nota`, `descartar_nota`, `registrar_pagamento`, `pagar_divida_total`, `corrigir_nota`.
- Produces:

| Método e caminho | Corpo | Resposta 200 |
| --- | --- | --- |
| `POST /api/clientes` | `{nome, apelido?, telefone?}` | `ClienteDetalhe` |
| `PATCH /api/clientes/<codigo>` | `{nome, apelido?, telefone?}` | `ClienteDetalhe` |
| `DELETE /api/clientes/<codigo>` | — | `{}` |
| `POST /api/clientes/<codigo>/notas` | `{tipo}` | `Nota` |
| `POST /api/clientes/<codigo>/pagamentos` | `{valor, forma, divida_esperada}` | `{recibo_url, cliente: ClienteDetalhe}` |
| `POST /api/notas/<c>-<n>/itens` | `{versao, descricao, quantidade, preco_unitario}` | `Nota` |
| `DELETE /api/notas/<c>-<n>/itens/<id>` | `{versao}` | `Nota` |
| `PUT /api/notas/<c>-<n>/itens` | `{versao, itens:[{descricao, quantidade, preco_unitario}]}` | `Nota` |
| `POST /api/notas/<c>-<n>/finalizar` | `{versao}` | `Nota` |
| `POST /api/notas/<c>-<n>/fechar` | `{versao}` | `Nota` |
| `DELETE /api/notas/<c>-<n>` | `{versao}` | `{}` |
| `POST /api/notas/<c>-<n>/pagamentos` | `{versao, valor, forma}` | `{recibo_url, nota: Nota}` |

Limites de campo: `nome` 120, `apelido` 60, `telefone` 20, `descricao` 120; `quantidade` 3 casas; `preco_unitario`, `valor`, `divida_esperada` 2 casas. `versao` é lida como vem (`request.dados.get("versao")`) e repassada ao serviço, que trata valor inválido como conflito. Em `PUT .../itens`, um item da lista com os três campos ausentes ou em branco é ignorado; um item parcialmente preenchido é `400` com `campos` no formato `{"itens.<indice>.<campo>": "..."}`.

A mesma URL atende métodos diferentes (`/api/clientes` GET e POST; `/api/clientes/<codigo>` GET, PATCH e DELETE; `/api/notas/<c>-<n>` GET e DELETE; `/api/notas/<c>-<n>/itens` POST e PUT). Use uma view por URL com `@api("GET", "POST")` e despache por `request.method`.

- [ ] **Step 1: Escrever os testes que falham**

Escreva os dois arquivos de teste com `logado.post/patch/put/delete(..., data=<dict>, content_type="application/json")`. Casos obrigatórios, cada um como um teste nomeado em português:

`test_escrita_clientes.py`
1. Criar cliente devolve `codigo == 1` e grava; `nome` em branco → 400 com `campos == {"nome": "Preencha este campo."}` e nada gravado.
2. Editar cliente muda nome e mantém `ultimo_numero_nota`.
3. Excluir cliente sem nota → 200 e some; com nota → 400 com "não pode ser excluído".
4. Criar nota `UNICA` → `situacao == "RASCUNHO"`, `codigo == "01-01"`; segunda `CONTINUA` aberta → 400 com "já tem uma nota contínua aberta"; `tipo` inválido → 400 com `campos.tipo`.
5. Pagar dívida total com duas notas (50,00 antiga e 80,00 nova), `valor "70.00"`, `divida_esperada "130.00"` → 200, `recibo_url` começa com `/recibos/lote/`, `cliente.divida == "60.00"`, dois pagamentos de 50,00 e 20,00.
6. Pagar dívida total com `divida_esperada` antiga → 409 com "mudou no outro caixa", nenhum pagamento novo.
7. Pagar dívida total com valor acima da dívida → 400; com `valor` `"70,00"` (vírgula) → 400 com `campos.valor`; com `valor` numérico `70` → 400 com `campos.valor`.
8. Toda rota de escrita de cliente devolve 401 sem login e 404 para cliente 99.

`test_escrita_notas.py`
1. Adicionar item (`quantidade "2"`, `preco_unitario "50.00"`) → `total == "100.00"`, `versao` sobe 1, resposta é a `Nota` completa.
2. Adicionar item com `preco_unitario "abc"` → 400 com `campos.preco_unitario`, nada gravado; com `quantidade "0.001"` e `preco_unitario "0.01"` → 400 com "não pode ser zero".
3. Remover item de rascunho → lista vazia; remover em nota fechada → 400.
4. Finalizar → `situacao == "FECHADA"` e `acoes.receber is True`; finalizar sem item → 400 com "pelo menos um item".
5. Fechar contínua → `FECHADA`.
6. Descartar rascunho → 200 `{}` e a nota some; descartar nota fechada → 400.
7. Pagamento parcial `"40.00"` em nota de 100,00 → `nota.saldo == "60.00"`, `recibo_url == f"/recibos/{id}/"`; pagamento total → `nota.situacao == "QUITADA"` e `acoes.receber is False`; acima do saldo → 400 com "maior que o saldo"; `forma "CHEQUE"` → 400 com `campos.forma`.
8. Correção com `PUT` trocando o item → `editada is True`, `total` novo, uma `CorrecaoNota`; item em branco no meio da lista é ignorado; item parcial → 400 com chave `itens.0.preco_unitario`; total abaixo do já pago → 400 com "abaixo do valor já pago"; lista igual à atual → 400 com "Nenhuma alteração".
9. Versão antiga em adicionar item, finalizar, pagamento e correção → 409 com "alterada no outro caixa", estado intacto. `versao` ausente → 409.
10. Toda rota de escrita de nota devolve 401 sem login e 404 para a nota `1-9`.
11. Um teste percorre `fiado.api.urls.urlpatterns`, monta cada caminho com argumentos fictícios (inteiros → 1) e confirma que GET anônimo devolve 401 em todas, menos `sessao` e `entrar`.

Todas as asserções comparam valores exatos (strings de dinheiro, status, mensagens), como nos testes da Task 2.

- [ ] **Step 2: Rodar e ver falhar**

Run: `uv run pytest fiado/tests/api/test_escrita_clientes.py fiado/tests/api/test_escrita_notas.py -v`
Expected: FAIL com 405 ou 404.

- [ ] **Step 3: Implementar**

Acrescente os métodos às views existentes e as views novas. Padrão de uma ação de nota:

```python
@api("POST")
def finalizar(request, cliente_codigo, numero):
    nota = obter_nota(cliente_codigo, numero)
    nota = finalizar_nota(nota=nota, versao=request.dados.get("versao"))
    return nota_completa(nota)
```

Para pagamento, devolva `{"recibo_url": ..., "nota": nota_completa(pagamento.nota)}`. Para dívida total, `recibo_url` usa o `lote` do primeiro pagamento e `cliente` é `cliente_detalhe` recarregado.

Rotas novas em `fiado/api/urls.py`:

```python
    path("clientes/<int:codigo>/notas", clientes.criar_nota_do_cliente),
    path("clientes/<int:codigo>/pagamentos", clientes.pagar_divida),
    path("notas/<int:cliente_codigo>-<int:numero>/itens", notas.itens),
    path("notas/<int:cliente_codigo>-<int:numero>/itens/<int:item_id>", notas.item),
    path("notas/<int:cliente_codigo>-<int:numero>/finalizar", notas.finalizar),
    path("notas/<int:cliente_codigo>-<int:numero>/fechar", notas.fechar),
    path("notas/<int:cliente_codigo>-<int:numero>/pagamentos", notas.pagamentos),
```

- [ ] **Step 4: Rodar e ver passar**

Run: `uv run pytest fiado/tests -q`
Expected: todos passam.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: API de escrita do fiado"
```

---

### Task 4: Projeto React, estilo base, cliente HTTP e login

**Files:**
- Create: `frontend/package.json`, `frontend/vite.config.ts`, `frontend/tsconfig.json`, `frontend/index.html`, `frontend/src/main.tsx`, `frontend/src/App.tsx`, `frontend/src/rotas.tsx`
- Create: `frontend/src/estilo/variaveis.css`, `frontend/src/estilo/base.css`
- Create: `frontend/src/api/http.ts`, `frontend/src/api/tipos.ts`, `frontend/src/api/numero.ts`
- Create: `frontend/src/componentes/` (`Botao`, `Campo`, `Aviso`, cada um `.tsx` + `.css`)
- Create: `frontend/src/recursos/sessao/` (`sessao.ts`, `TelaEntrar.tsx`, `TelaEntrar.css`, `RotaProtegida.tsx`)
- Create: `frontend/src/teste/preparar.ts`
- Test: `frontend/src/api/numero.test.ts`, `frontend/src/api/http.test.ts`, `frontend/src/recursos/sessao/TelaEntrar.test.tsx`
- Modify: `.gitignore`

**Interfaces:**
- Produces:
  - `numero.ts`: `paraDecimal(texto: string, casas: number): string | null`; `formatarDinheiro(valor: string): string`; `formatarQuantidade(valor: string): string`.
  - `http.ts`: `class ErroApi extends Error { status: number; campos: Record<string,string> }`; `requisitar<T>(metodo: "GET"|"POST"|"PUT"|"PATCH"|"DELETE", caminho: string, corpo?: unknown): Promise<T>`.
  - `tipos.ts`: tipos `ClienteLinha`, `ClienteDetalhe`, `NotaResumo`, `Nota`, `ItemNota`, `Pagamento`, `AcoesDaNota`, `Painel`, `ResultadoBusca`, `PreviaDivida`, `Usuario`, espelhando as formas da Task 2.
  - `sessao.ts`: `useSessao()` (react-query sobre `GET /api/sessao`), `useEntrar()`, `useSair()`.
  - Componentes: `<Botao variante="principal"|"contorno"|"perigo" carregando? ...props de button>`; `<Campo rotulo erro? ...props de input>` (rótulo ligado por `htmlFor`, erro ligado por `aria-describedby`); `<Aviso tipo="erro"|"info">`.
  - Rota `/entrar` e `<RotaProtegida>` que leva para `/entrar?depois=<caminho atual>` quando não há usuário.

- [ ] **Step 1: Criar o projeto**

```bash
cd /Users/robertofilho/Desktop/Bell_Racoes
npm create vite@latest frontend -- --template react-ts
npm --prefix frontend install react-router @tanstack/react-query motion @fontsource-variable/inter
npm --prefix frontend install -D vitest jsdom @testing-library/react @testing-library/user-event @testing-library/jest-dom
```

Apague os arquivos de exemplo do template (`src/App.css`, `src/index.css`, `src/assets/`, `public/vite.svg`). Acrescente ao `.gitignore`:

```
frontend/node_modules/
frontend/dist/
```

`frontend/vite.config.ts`:

```ts
/// <reference types="vitest/config" />
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const django = "http://127.0.0.1:8000";

// Em produção os arquivos saem em /static/app/ (servidos pelo Django); a aplicação
// continua respondendo na raiz. Em desenvolvimento tudo fica na raiz do Vite.
export default defineConfig(({ command }) => ({
  base: command === "build" ? "/static/app/" : "/",
  plugins: [react()],
  server: {
    proxy: { "/api": django, "/notas": django, "/recibos": django },
  },
  test: { environment: "jsdom", setupFiles: ["./src/teste/preparar.ts"], globals: true, css: false },
}));
```

`frontend/src/teste/preparar.ts`:

```ts
import "@testing-library/jest-dom/vitest";
```

Em `frontend/package.json`, garanta os scripts `"dev": "vite"`, `"build": "tsc -b && vite build"`, `"test": "vitest run"`. `index.html` com `<html lang="pt-br">` e `<title>Bell Rações · Fiado</title>`.

- [ ] **Step 2: Escrever os testes que falham**

`frontend/src/api/numero.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { formatarDinheiro, formatarQuantidade, paraDecimal } from "./numero";

describe("paraDecimal", () => {
  it.each([
    ["12", 2, "12.00"],
    ["12,5", 2, "12.50"],
    ["12.5", 2, "12.50"],
    [" 1.234,56 ", 2, "1234.56"],
    ["0,335", 3, "0.335"],
    ["1", 3, "1.000"],
    ["007", 2, "7.00"],
  ])("%s com %i casas vira %s", (texto, casas, esperado) => {
    expect(paraDecimal(texto, casas)).toBe(esperado);
  });

  it.each(["", "abc", "1,2,3", "-5", "1,234", "1e3", "12,", ","])("recusa %s", (texto) => {
    expect(paraDecimal(texto, 2)).toBeNull();
  });

  it("não perde precisão em valores que float erraria", () => {
    expect(paraDecimal("0,1", 2)).toBe("0.10");
    expect(paraDecimal("1234567,89", 2)).toBe("1234567.89");
  });
});

describe("formatarDinheiro", () => {
  it.each([
    ["96.40", "96,40"],
    ["4812.50", "4.812,50"],
    ["1234567.00", "1.234.567,00"],
    ["0.00", "0,00"],
  ])("%s vira %s", (valor, esperado) => {
    expect(formatarDinheiro(valor)).toBe(esperado);
  });
});

describe("formatarQuantidade", () => {
  it.each([
    ["1.000", "1"],
    ["1.500", "1,5"],
    ["0.335", "0,335"],
    ["12.000", "12"],
  ])("%s vira %s", (valor, esperado) => {
    expect(formatarQuantidade(valor)).toBe(esperado);
  });
});
```

Regra de `paraDecimal`: só manipulação de texto. Tira espaços; se houver vírgula, pontos são separadores de milhar e são removidos, e a vírgula vira ponto; sem vírgula, um único ponto é o separador decimal. Depois exige `^\d+(\.\d+)?$`, recusa mais casas que `casas`, tira zeros à esquerda e completa as casas com zeros. `"1,234"` com 2 casas é recusado (3 casas decimais).

`frontend/src/api/http.test.ts` (com `fetch` simulado por `vi.stubGlobal`):

1. `requisitar("GET", "/api/painel")` chama `fetch("/api/painel", {method:"GET", credentials:"same-origin", headers:{Accept:"application/json"}})` e devolve o JSON.
2. `requisitar("POST", "/api/x", {a:1})` envia `Content-Type: application/json`, o corpo serializado e `X-CSRFToken` com o valor do cookie `csrftoken` (defina `document.cookie = "csrftoken=abc123"` no teste).
3. Resposta 409 com `{erro:"Mudou.", campos:{}}` rejeita com `ErroApi` de `status 409` e `message "Mudou."`.
4. Resposta 400 com `campos` os expõe em `erro.campos`.
5. Resposta 500 sem JSON rejeita com `ErroApi` de `status 500` e mensagem "O servidor não respondeu como esperado."
6. `fetch` que rejeita (rede) vira `ErroApi` de `status 0` e mensagem "Sem conexão com o servidor."

`frontend/src/recursos/sessao/TelaEntrar.test.tsx`:

1. Mostra campos "Usuário" e "Senha" e o botão "Entrar".
2. Ao enviar, chama `POST /api/entrar` com `{usuario, senha}`; em sucesso navega para `/` (ou para o caminho em `?depois=`).
3. Em erro 400, mostra a mensagem da API num `role="alert"` e mantém o usuário digitado.
4. O botão fica desabilitado enquanto a requisição está em andamento.

- [ ] **Step 3: Rodar e ver falhar**

Run: `npm --prefix frontend test`
Expected: FAIL (módulos inexistentes).

- [ ] **Step 4: Implementar**

`frontend/src/estilo/variaveis.css` (valores exatos):

```css
@import "@fontsource-variable/inter";

:root {
  --cor-fundo: #f3f5f8;
  --cor-superficie: #ffffff;
  --cor-borda: #dee3ec;
  --cor-borda-forte: #c9d0dd;
  --cor-texto: #232833;
  --cor-texto-secundario: #4a5364;
  --cor-texto-apoio: #636b7a;
  --cor-acao: #3d4f7a;
  --cor-acao-forte: #33426a;
  --cor-acao-suave: #e4e9f5;
  --cor-acao-suave-texto: #2e3c60;
  --cor-alerta-1-fundo: #e6e9ef;
  --cor-alerta-1-texto: #555e70;
  --cor-alerta-2-fundo: #f5e6c9;
  --cor-alerta-2-texto: #7a5a12;
  --cor-alerta-3-fundo: #f6d9dd;
  --cor-alerta-3-texto: #8c2f3d;
  --cor-quitada-fundo: #ddefe4;
  --cor-quitada-texto: #1f5a3a;
  --cor-erro-fundo: #f6d9dd;
  --cor-erro-texto: #8c2f3d;
  --cor-veu: rgb(35 40 51 / 0.28);

  --fonte: "Inter Variable", system-ui, -apple-system, "Segoe UI", sans-serif;
  --texto-corpo: 15px;
  --texto-pequeno: 13px;
  --texto-titulo: 22px;
  --peso-titulo: 650;

  --raio-controle: 10px;
  --raio-cartao: 14px;
  --espaco-1: 4px;
  --espaco-2: 8px;
  --espaco-3: 12px;
  --espaco-4: 16px;
  --espaco-5: 24px;
  --espaco-6: 32px;
  --largura-menu: 208px;
  --largura-gaveta: 560px;

  --tempo-base: 0.4s;
  --tempo-micro: 0.15s;
  --curva-mola: cubic-bezier(0.22, 1.2, 0.36, 1);
  --sombra-gaveta: -12px 0 28px rgb(35 40 51 / 0.08);
}
```

`base.css`: reset mínimo, `body` com `--cor-fundo`, `--fonte`, `--texto-corpo`; classe utilitária `.numero { font-variant-numeric: tabular-nums; }`; anel de foco visível (`outline: 2px solid var(--cor-acao); outline-offset: 2px`) em `:focus-visible`; e:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation: none !important; transition: none !important; }
}
```

`App.tsx` monta `QueryClientProvider` (com `retry: false` para erros `ErroApi` de status 4xx), `MotionConfig reducedMotion="user"` e o roteador. `rotas.tsx` declara `/entrar` e, dentro de `<RotaProtegida>`, por enquanto uma tela inicial simples com o nome do usuário e o botão "Sair"; as tarefas seguintes preenchem.

A tela de login é um cartão centrado, com o nome "Bell Rações" e os dois campos. Botão principal preenchido.

- [ ] **Step 5: Rodar e ver passar**

Run: `npm --prefix frontend test` e `npm --prefix frontend run build`
Expected: testes passam; build conclui sem erro de TypeScript.

- [ ] **Step 6: Conferir contra o Django**

```bash
uv run python manage.py migrate
uv run python manage.py criar_caixas --senha1 teste-1 --senha2 teste-2
BELL_DEBUG=1 uv run python manage.py runserver &
npm --prefix frontend run dev
```

Abra `http://localhost:5173/`, entre com `caixa1` / `teste-1` e confirme que a tela inicial mostra o usuário. Encerre os dois servidores. Se o implementador não tiver navegador, confirme com `curl` que `http://localhost:5173/api/sessao` responde JSON pelo proxy, e diga no relatório o que não foi visto.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: projeto React com estilo base, cliente HTTP e login"
```

---

### Task 5: Estrutura da aplicação, busca e painel

**Files:**
- Create: `frontend/src/componentes/` (`Selo`, `Dinheiro`, `Lista`, `EstadoVazio`)
- Create: `frontend/src/recursos/estrutura/` (`Estrutura.tsx`, `Estrutura.css`, `Menu.tsx`, `Menu.css`)
- Create: `frontend/src/recursos/busca/` (`Busca.tsx`, `Busca.css`, `busca.ts`)
- Create: `frontend/src/recursos/painel/` (`TelaPainel.tsx`, `TelaPainel.css`, `painel.ts`)
- Create: `frontend/src/recursos/notas/abrirNota.ts`
- Modify: `frontend/src/rotas.tsx`
- Test: `Busca.test.tsx`, `TelaPainel.test.tsx`, `Selo.test.tsx`, `Dinheiro.test.tsx`

**Interfaces:**
- Consumes: Task 4.
- Produces:
  - `<Estrutura>`: menu lateral fixo (largura `--largura-menu`) com "Painel" (`/`), "Clientes" (`/clientes`), "Contas pagas" (`/pagas`), usuário e "Sair" no rodapé; à direita, `<Busca>` no topo e `<Outlet>` abaixo. Item ativo com fundo `--cor-acao-suave`.
  - `<Selo nivel={0|1|2|3} | tipo="quitada"|"editado"|"rascunho">texto</Selo>`. `nivel` 1, 2 e 3+ usam as cores de alerta 1, 2 e 3; `nivel` 0 não renderiza nada. Helper `rotuloDeAlerta(nivel: number): string` → `"7 dias"`, `"14 dias"`, `"21 dias"`, … (`nivel * 7`).
  - `<Dinheiro valor="96.40" animar? />`: mostra `R$ 96,40` com algarismos tabulares. Com `animar`, quando `valor` muda, conta do valor antigo ao novo em `--tempo-base` usando centavos inteiros (`BigInt` ou inteiro de centavos derivado do texto, nunca float de reais); com movimento reduzido, troca direto.
  - `<Lista>` e `<Lista.Item onAbrir>`: lista de linhas clicáveis, cada linha um `<button>`; entrada em sequência (atraso de 40 ms por item, no máximo 8) e leve afundamento ao pressionar.
  - `useAbrirNota(): (codigo: string) => void` e `useNotaAberta(): string | null`, que escrevem e leem o parâmetro `?nota=12-03` preservando o resto do endereço.
  - `useBusca(termo)`: react-query sobre `GET /api/busca?q=`, com espera de 150 ms.
  - Rotas `/` (painel), e marcadores de posição para `/clientes`, `/clientes/:codigo`, `/pagas` com o título da tela.

Comportamento da busca:

- Campo com `placeholder` "Código (12 ou 12-03) ou nome" e `aria-label` "Busca rápida".
- A lista de resultados abre abaixo do campo enquanto há texto, como `listbox`:
  - `tipo "nota"`: uma linha com código, cliente e saldo.
  - `tipo "cliente"`: primeira linha o cliente (código, nome, dívida), seguida das notas abertas dele.
  - `tipo "lista"`: clientes.
  - `tipo "nao_encontrado"`: a mensagem da API, sem linhas.
  - lista vazia: "Nenhum cliente encontrado."
- `↓` e `↑` movem a seleção; `Enter` abre o item selecionado (o primeiro, se nenhum). Cliente → navega para `/clientes/<codigo>`; nota → `abrirNota(codigo)`. Abrir limpa o campo e fecha a lista.
- `Esc` fecha a lista e mantém o texto.

Painel:

- Título "Painel"; cartão com "Fiado em aberto" e `<Dinheiro animar>`.
- Se `backup_falhou`: `<Aviso tipo="erro">A cópia de segurança de hoje não foi feita. Confira a pasta de cópias e avise o responsável.</Aviso>` no topo.
- Seção "Notas atrasadas": linhas com `<Selo nivel>`, código, cliente, tipo, dias em aberto e saldo; clicar abre a nota. Vazia: "Nenhuma nota atrasada."
- Seção "Rascunhos não finalizados" só quando houver rascunhos.

- [ ] **Step 1: Escrever os testes que falham**

Com `fetch` simulado e um utilitário de teste `renderizarComApp(ui, {rota})` (crie em `frontend/src/teste/renderizar.tsx`: `QueryClientProvider` novo por teste + `MemoryRouter`):

`Busca.test.tsx`
1. Digitar "12" consulta `/api/busca?q=12` uma vez, depois da espera (use timers falsos).
2. Resposta `tipo "cliente"` mostra o cliente e suas notas; `Enter` navega para `/clientes/12`.
3. Resposta `tipo "nota"` + `Enter` põe `?nota=12-03` no endereço e limpa o campo.
4. `↓` duas vezes + `Enter` abre a segunda nota do cliente.
5. `tipo "nao_encontrado"` mostra a mensagem e mantém o texto digitado.
6. `Esc` fecha a lista e mantém o texto.

`TelaPainel.test.tsx`
1. Mostra total, uma linha por alerta com selo "21 dias" e a seção de rascunhos.
2. Sem rascunhos, a seção não existe; sem alertas, mostra "Nenhuma nota atrasada."
3. `backup_falhou` mostra o aviso.
4. Clicar numa linha põe `?nota=<codigo>` no endereço.

`Selo.test.tsx`: `rotuloDeAlerta(1..4)` → "7 dias", "14 dias", "21 dias", "28 dias"; `nivel 0` não renderiza; `nivel 5` usa a classe do nível 3.

`Dinheiro.test.tsx`: `valor "4812.50"` mostra "R$ 4.812,50"; sem `animar`, trocar o valor troca o texto na hora.

- [ ] **Step 2: Rodar e ver falhar** — `npm --prefix frontend test` → FAIL.
- [ ] **Step 3: Implementar** conforme as interfaces e o comportamento acima.
- [ ] **Step 4: Rodar e ver passar** — `npm --prefix frontend test` e `npm --prefix frontend run build`.
- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: menu lateral, busca rápida e painel"
```

---

### Task 6: Clientes e registro do cliente

**Files:**
- Create: `frontend/src/componentes/` (`Dialogo`)
- Create: `frontend/src/recursos/clientes/` (`clientes.ts`, `TelaClientes.tsx`, `TelaCliente.tsx`, `FormularioCliente.tsx`, `.css` de cada)
- Modify: `frontend/src/rotas.tsx`
- Test: `TelaClientes.test.tsx`, `TelaCliente.test.tsx`, `FormularioCliente.test.tsx`, `Dialogo.test.tsx`

**Interfaces:**
- Consumes: Tasks 4 e 5.
- Produces:
  - `<Dialogo aberto titulo aoFechar>`: `role="dialog"`, `aria-modal`, prende o foco, fecha com `Esc` e com clique no véu, devolve o foco ao elemento que abriu. Entra com escala e opacidade em `--tempo-base`.
  - `<Dialogo.Confirmacao aberto titulo mensagem rotuloConfirmar aoConfirmar aoFechar perigo?>`.
  - `clientes.ts`: `useClientes(q)`, `useCliente(codigo)`, `useCriarCliente()`, `useEditarCliente(codigo)`, `useExcluirCliente(codigo)`, `useCriarNota(codigo)`. Mutations invalidam as consultas `["clientes"]`, `["cliente", codigo]` e `["painel"]`.
  - Telas `/clientes` e `/clientes/:codigo`.

Comportamento:

- **Clientes**: título, botão "Novo cliente" (abre `<Dialogo>` com `<FormularioCliente>`), campo "Filtrar por nome ou apelido" (filtra pela API com espera de 150 ms), tabela/lista com código, nome, apelido, notas abertas e dívida (`<Dinheiro>`). Clicar na linha navega para o cliente. Criar leva para a tela do cliente novo.
- **Cliente**: cabeçalho com `codigo_formatado · nome (apelido)`, telefone, dívida com `<Dinheiro animar>`. Ações: "Nova nota única" (atalho `N`, ligado na Task 9), "Nova nota contínua" (desabilitado com `title` "Já existe uma nota contínua aberta" quando `tem_continua_aberta`), "Pagar dívida total" (visível quando dívida > "0.00"; o diálogo vem na Task 8 — nesta tarefa o botão existe e chama uma prop/hook `abrirPagarDivida` ainda sem efeito), "Editar cadastro" (diálogo com o formulário preenchido), "Excluir cliente" (só quando `pode_excluir`; com confirmação). Lista "Notas em aberto" com código, tipo, situação, selo "Editado" quando `editada`, selo de rascunho, dias e saldo; clicar abre a nota. Havendo rascunho na lista: frase "Rascunho ainda não é dívida: só entra na conta depois de finalizado."
- Criar nota chama `POST /api/clientes/<codigo>/notas` e abre a gaveta da nota criada (`abrirNota`).
- Erros `400` do formulário aparecem junto ao campo (`campos`) e a mensagem geral num `<Aviso>`. Cliente inexistente (`404`) mostra "Cliente não encontrado." com link para a lista.
- Comparação de dívida com zero é por texto (`divida !== "0.00"`), sem converter em número.

- [ ] **Step 1: Escrever os testes que falham**, um por comportamento listado acima (lista renderiza e filtra; criar cliente navega; erro de campo aparece ligado ao campo; botão de contínua desabilitado; frase do rascunho presente/ausente; excluir pede confirmação e só então chama `DELETE`; criar nota abre a gaveta; `404` mostra a mensagem; `Dialogo` fecha com Esc e devolve o foco).
- [ ] **Step 2: Rodar e ver falhar** — `npm --prefix frontend test`.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Rodar e ver passar** — `npm --prefix frontend test` e `npm --prefix frontend run build`.
- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: telas de clientes e registro do cliente"
```

---

### Task 7: Gaveta da nota

**Files:**
- Create: `frontend/src/componentes/` (`Gaveta`)
- Create: `frontend/src/recursos/notas/` (`notas.ts`, `GavetaDaNota.tsx`, `ItensDaNota.tsx`, `LinhaNovoItem.tsx`, `ResumoDaNota.tsx`, `imprimir.ts`, `.css` de cada)
- Modify: `frontend/src/recursos/estrutura/Estrutura.tsx`
- Test: `Gaveta.test.tsx`, `GavetaDaNota.test.tsx`, `LinhaNovoItem.test.tsx`

**Interfaces:**
- Consumes: Tasks 4 a 6.
- Produces:
  - `<Gaveta aberta titulo aoFechar rodape?>`: painel à direita (largura `--largura-gaveta`), `role="dialog"`, prende o foco, fecha com `Esc`, véu `--cor-veu` sobre o resto. Entra deslizando da direita com mola (`motion`, `type: "spring"`, duração visual ~0,4 s); sai deslizando.
  - `notas.ts`: `useNota(codigo)`, e mutations `useAdicionarItem`, `useRemoverItem`, `useFinalizar`, `useFechar`, `useDescartar`. Toda mutation envia `versao` da nota em cache, grava a `Nota` devolvida no cache (`setQueryData(["nota", codigo])`) e invalida `["painel"]`, `["cliente", nota.cliente.codigo]`, `["clientes"]`, `["pagas"]`.
  - `tratarErroDeNota(erro, codigo)`: em `409`, invalida `["nota", codigo]` (recarrega) e devolve a mensagem para exibir; em outros, só devolve a mensagem.
  - `abrirImpressao(url: string): void` → `window.open(url, "_blank", "noopener")`.
  - `<GavetaDaNota>` montada uma vez em `<Estrutura>`, aberta quando `useNotaAberta()` devolve um código.

Comportamento:

- Cabeçalho: código grande (`.numero`), cliente (link para o cliente), tipo, situação; selos "Editado" e "Quitada"; "N dia(s)" para nota não quitada, "quitada em dd/mm/aaaa" para quitada.
- Itens: descrição, quantidade (`formatarQuantidade`), preço e subtotal. Em rascunho, cada item tem "Remover" (confirmação por `<Dialogo.Confirmacao>` "Remover este item?").
- Quando `acoes.adicionar_item`: `<LinhaNovoItem>` no fim da lista, com "Descrição", "Quantidade" (inicial "1") e "Preço". `Enter` em qualquer campo envia; converte com `paraDecimal` (3 e 2 casas); campo inválido fica marcado com "Número inválido." e nada é enviado. Em sucesso limpa, volta a quantidade para "1" e põe o foco na descrição. O item novo entra animado; total e saldo usam `<Dinheiro animar>`.
- Pagamentos (quando houver): data, forma, quem recebeu, valor e link "Recibo" (`recibo_url`, nova janela).
- Resumo: Total, Pago, Saldo.
- Rodapé, conforme `acoes`: "Finalizar e imprimir" (principal; em sucesso chama `abrirImpressao(nota.imprimir_url)`), "Fechar nota", "Reimprimir" (quando `acoes.imprimir`), "Descartar" (perigo; confirmação "Descartar esta nota? Não dá para desfazer."; em sucesso fecha a gaveta). Os botões "Receber" e "Correção" aparecem conforme `acoes.receber` e `acoes.corrigir`, mas o conteúdo deles vem na Task 8 (nesta tarefa mudam um estado local `modo` para `"receber"` ou `"corrigir"` que ainda não renderiza nada).
- Erro de qualquer ação aparece num `<Aviso tipo="erro">` que desliza no topo da gaveta. Em `409` a nota recarrega sozinha e a gaveta continua aberta.
- Nota inexistente (`404`): gaveta mostra "Nota não encontrada." e botão "Fechar".
- Fechar a gaveta remove `?nota` do endereço (o botão Voltar do navegador também fecha).

- [ ] **Step 1: Escrever os testes que falham.** Obrigatórios:
  1. `Gaveta`: fecha com Esc, prende o foco, devolve o foco.
  2. Abrir com `?nota=01-01` busca `/api/notas/1-1`? **Atenção ao caminho:** o código exibido é `"01-01"`, mas a API usa inteiros sem zero à esquerda: `/api/notas/1-1`. Crie `caminhoDaNota(codigo: string): string` em `notas.ts` que converte `"01-03"` → `"/api/notas/1-3"` e teste-o (`"12-03"` → `"/api/notas/12-3"`, `"105-10"` → `"/api/notas/105-10"`).
  3. Botões do rodapé seguem `acoes` (parametrize: rascunho, contínua aberta, fechada, quitada).
  4. `LinhaNovoItem`: "2" e "50,00" enviam `{versao, descricao, quantidade: "2.000", preco_unitario: "50.00"}`; preço "abc" marca o campo e não envia; após sucesso o foco volta à descrição.
  5. Remover e Descartar só chamam a API depois da confirmação.
  6. "Finalizar e imprimir" chama `window.open` com `imprimir_url` depois da resposta.
  7. `409` em adicionar item mostra a mensagem, refaz o `GET` da nota e mantém a gaveta aberta.
  8. Resposta de mutation atualiza total e saldo na tela sem novo `GET`.
- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Rodar e ver passar** — testes e build.
- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: gaveta da nota com itens e ações"
```

---

### Task 8: Receber, pagar dívida total e correção

**Files:**
- Create: `frontend/src/recursos/notas/` (`Receber.tsx`, `Correcao.tsx`, `.css`)
- Create: `frontend/src/recursos/clientes/PagarDivida.tsx` (+ `.css`)
- Modify: `frontend/src/recursos/notas/notas.ts`, `GavetaDaNota.tsx`, `frontend/src/recursos/clientes/clientes.ts`, `TelaCliente.tsx`
- Test: `Receber.test.tsx`, `Correcao.test.tsx`, `PagarDivida.test.tsx`

**Interfaces:**
- Consumes: Tasks 4 a 7.
- Produces: `useReceber(codigo)`, `useCorrigir(codigo)`, `usePagarDivida(clienteCodigo)`, `usePreviaDivida(clienteCodigo, valor)`.

Comportamento:

- **Receber** (dentro da gaveta, sobe de baixo): campo "Valor" preenchido com o saldo formatado (`formatarDinheiro(nota.saldo)`), seleção "Forma" (Dinheiro, Pix, Cartão), "Confirmar pagamento" e "Cancelar". Valor convertido com `paraDecimal(…, 2)`; inválido marca o campo. O botão de confirmar fica desabilitado do clique até a resposta (dois cliques rápidos geram uma requisição só). Em sucesso: grava a nota devolvida, fecha o formulário e chama `abrirImpressao(recibo_url)`. Erro `400` aparece no formulário; `409` recarrega a nota e fecha o formulário com o aviso.
- **Correção** (os itens viram campos editáveis no lugar): uma linha por item, com descrição, quantidade e preço, mais um botão "Adicionar linha". Linha com os três campos em branco é enviada em branco e o servidor a ignora. "Salvar correção e reimprimir" envia `PUT` com a lista; em sucesso volta ao modo de leitura e chama `abrirImpressao(nota.imprimir_url)`. "Cancelar" volta sem enviar. Campo numérico inválido marca o campo e não envia. Erro `400` com chaves `itens.<i>.<campo>` marca o campo da linha `i`. Em `409`: aviso, nota recarregada, modo de leitura (o digitado é descartado).
- **Pagar dívida total** (`<Dialogo>` na tela do cliente): "Valor" preenchido com a dívida, "Forma", e a tabela de distribuição (nota, saldo, abate) vinda de `GET …/divida/previa?valor=`, refeita com espera de 200 ms enquanto o valor é digitado. Se `sobra !== "0.00"`: aviso "O valor é maior que a dívida do cliente." e confirmar desabilitado. Envia `{valor, forma, divida_esperada: cliente.divida}`. Sucesso: fecha, atualiza o cliente com o `cliente` devolvido e abre o recibo. `409`: aviso com a mensagem, recarrega o cliente e a prévia, diálogo continua aberto com a dívida nova. Botão de confirmar trava como em Receber.

- [ ] **Step 1: Escrever os testes que falham**, um por comportamento acima; obrigatórios: valor inicial igual ao saldo; "40,00" envia `"40.00"`; dois cliques geram um `fetch`; recibo abre em sucesso; `409` em receber; correção envia a lista editada e linha em branco; erro `itens.0.preco_unitario` marca a linha certa; prévia consulta com o valor convertido e respeita a espera; `sobra` desabilita confirmar; `409` na dívida total mantém o diálogo e mostra a dívida nova.
- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Rodar e ver passar** — testes e build.
- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: receber, pagar dívida total e correção"
```

---

### Task 9: Contas pagas, atalhos, sessão expirada e acabamento

**Files:**
- Create: `frontend/src/recursos/pagas/` (`TelaPagas.tsx`, `pagas.ts`, `.css`)
- Create: `frontend/src/atalhos/atalhos.ts`
- Modify: `frontend/src/App.tsx`, `rotas.tsx`, `Busca.tsx`, `TelaCliente.tsx`, `GavetaDaNota.tsx`, `frontend/src/api/http.ts` se necessário
- Test: `TelaPagas.test.tsx`, `atalhos.test.tsx`, `sessaoExpirada.test.tsx`

**Interfaces:**
- Consumes: Tasks 4 a 8.
- Produces:
  - `useAtalho(tecla: string, acao: () => void, opcoes?: { ativo?: boolean })`: ouve `keydown` em `window`; ignora quando o foco está em `input`, `textarea`, `select` ou elemento `contenteditable`, quando há tecla modificadora (`ctrl`, `meta`, `alt`), ou quando `ativo` é falso. `F2` e `Escape` não são atalhos de letra e valem também com foco em campo.
  - Tela `/pagas`.

Comportamento:

- **Contas pagas**: título, texto "Notas quitadas nos últimos 7 dias. As mais antigas continuam guardadas e abrem pelo código na busca.", lista com código, cliente, tipo, quitada em, total e "Reimprimir" (abre `imprimir_url`). Clicar na linha abre a gaveta. Vazia: "Nenhuma nota quitada nos últimos 7 dias."
- **Atalhos**: `/` e `F2` focam a busca (o `/` não é digitado no campo); `N` na tela do cliente cria nota única; `R` com a gaveta aberta e `acoes.receber` abre Receber. Com gaveta ou diálogo aberto, `N` não dispara.
- **Sessão expirada**: qualquer resposta `401` fora de `/api/sessao` e `/api/entrar` limpa o cache da sessão e leva para `/entrar?depois=<caminho e query atuais>`; depois do login volta para lá.
- **Falha de rede** (`ErroApi` de status 0) em consultas mostra `<Aviso tipo="erro">Sem conexão com o servidor.</Aviso>` com botão "Tentar de novo"; em formulários, o aviso aparece e os campos mantêm o que foi digitado.
- **Avisos anunciados**: `<Aviso tipo="erro">` usa `role="alert"`; `tipo="info"` usa `role="status"`.
- **Movimento**: revise todas as telas contra a seção 5.3 da spec — gaveta, diálogo, entrada em sequência das listas, afundamento da linha, contagem de valores, troca de selo ao quitar, deslize dos avisos. Tudo por `motion` ou transições CSS com as variáveis de tempo; nada acima de `--tempo-base`.
- **Título da aba**: cada tela define `document.title` ("Painel · Bell Rações", "Clientes · Bell Rações", "<nome> · Bell Rações", "Contas pagas · Bell Rações").

- [ ] **Step 1: Escrever os testes que falham**: `useAtalho` (dispara fora de campo; não dispara dentro de `input`; não dispara com `ctrl`; `F2` dispara dentro de `input`; `ativo: false` não dispara); `/` foca a busca sem digitar; `N` cria nota na tela do cliente e não com diálogo aberto; `R` abre Receber só com `acoes.receber`; tela de pagas (lista, vazio, reimprimir chama `window.open`); `401` numa consulta leva para `/entrar?depois=%2Fclientes%2F12%3Fnota%3D12-03` e o login volta ao mesmo endereço; falha de rede mostra o aviso com "Tentar de novo".
- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Rodar e ver passar** — testes e build.
- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: contas pagas, atalhos de teclado e acabamento"
```

---

### Task 10: Django serve o front, remoção das telas antigas, ponta a ponta e guia

**Files:**
- Create: `fiado/views/spa.py`, `fiado/views/impressao.py`, `fiado/tests/test_spa.py`, `fiado/tests/test_impressao.py`
- Modify: `bellracoes/settings.py`, `bellracoes/urls.py`, `fiado/urls.py`, `fiado/models.py` (só `get_absolute_url`, ver abaixo), `fiado/templates/fiado/impressao/base.html`, `e2e/test_fluxo_fiado.py`, `docs/instalacao.md`, `fiado/tests/test_login.py`
- Delete: `fiado/views/clientes.py`, `notas.py`, `pagamentos.py`, `correcoes.py`, `painel.py`, `comum.py`; `fiado/forms.py`; `fiado/templates/base.html`, `fiado/templates/registration/`, `fiado/templates/fiado/*.html` (menos a pasta `impressao/`); `fiado/static/fiado/`; `fiado/tests/test_telas_*.py`

**Interfaces:**
- Consumes: Tasks 1 a 9.
- Produces: rotas finais do Django:

```
/api/...                          API
/notas/<c>-<n>/imprimir/          impressão da nota (HTML)
/recibos/<id>/                    recibo (HTML)
/recibos/lote/<uuid>/             recibo de lote (HTML)
/static/...                       estáticos (WhiteNoise)
qualquer outro caminho            index.html do React
```

Exceção à regra global: nesta tarefa `fiado/models.py` muda em um ponto só. `Nota.get_absolute_url` hoje faz `reverse("nota", ...)`, rota que deixa de existir; passa a devolver `f"/clientes/{self.cliente.codigo}?nota={self.codigo}"`. Nenhuma outra linha do arquivo muda.

- [ ] **Step 1: Escrever os testes que falham**

`fiado/tests/test_spa.py`:
1. Com `settings.FRONT_DIST = tmp_path` contendo `index.html` com `<div id="root"></div>`: `GET /`, `/clientes`, `/clientes/12`, `/pagas`, `/entrar` e `/qualquer/coisa` devolvem 200 com esse conteúdo, **sem login**.
2. Sem `index.html`: `GET /` devolve 503 com o texto "O front ainda não foi gerado" e a instrução `npm --prefix frontend run build`.
3. `GET /api/inexistente` devolve 404 e não o `index.html`.
4. A resposta do `index.html` leva `Cache-Control: no-cache`.

`fiado/tests/test_impressao.py`: mova para cá os testes de impressão e de recibo que existiam em `test_telas_notas.py` e `test_telas_pagamentos.py` (duas vias, código, assinatura, EDITADO em nota corrigida, rascunho não imprime, recibo simples com saldo datado, recibo de lote, 404), preparando os dados com os serviços em vez de POST nas telas antigas. Acrescente: sem login, as três rotas redirecionam para `/entrar?next=...`; a página de impressão contém `window.close()` no controle "Voltar"; rascunho devolve 404 (não há mais tela para onde redirecionar com mensagem).

`fiado/tests/test_login.py`: remova os testes do login antigo (`/entrar/` como formulário Django); mantenha os de `criar_caixas`; o teste de "todas as rotas exigem login" passa a cobrir as três rotas de impressão/recibo.

- [ ] **Step 2: Rodar e ver falhar** — `uv run pytest fiado/tests/test_spa.py fiado/tests/test_impressao.py -v`.

- [ ] **Step 3: Implementar o Django**

Em `bellracoes/settings.py`:

```python
FRONT_DIST = BASE_DIR / "frontend" / "dist"
STATICFILES_DIRS = [("app", FRONT_DIST)] if FRONT_DIST.exists() else []
LOGIN_URL = "/entrar"
```

Remova `LOGIN_REDIRECT_URL` e `LOGOUT_REDIRECT_URL` e tire `"fiado.contexto.loja"` só se as páginas de impressão não o usarem (elas usam `loja`; mantenha).

`fiado/views/spa.py`:

```python
from django.conf import settings
from django.contrib.auth.decorators import login_not_required
from django.http import HttpResponse

SEM_FRONT = (
    "<h1>O front ainda não foi gerado</h1>"
    "<p>Na máquina de desenvolvimento, rode <code>npm --prefix frontend run build</code> "
    "e copie a pasta do projeto de novo.</p>"
)


@login_not_required
def spa(request):
    indice = settings.FRONT_DIST / "index.html"
    if not indice.is_file():
        return HttpResponse(SEM_FRONT, status=503)
    resposta = HttpResponse(indice.read_text(encoding="utf-8"))
    resposta["Cache-Control"] = "no-cache"
    return resposta
```

`fiado/views/impressao.py`: mova `imprimir_nota`, `recibo`, `recibo_lote` e os auxiliares que eles usam (`_contexto`, `VIAS`, `_recibo`, `obter_nota`). `imprimir_nota` de rascunho levanta `Http404`. O contexto `voltar` deixa de existir.

O `LoginRequiredMiddleware` redireciona as páginas de impressão para `/entrar?next=<caminho>`. Em `frontend/src/recursos/sessao/TelaEntrar.tsx`, aceite `next` além de `depois`; quando o destino começa com `/notas/` ou `/recibos/`, use `window.location.assign(destino)` em vez da navegação do roteador, porque essas páginas são do servidor. Aceite só destinos que começam com `/` e não com `//`. Acrescente testes para os três casos.

`fiado/templates/fiado/impressao/base.html`: troque o link "Voltar" por `<button type="button" onclick="window.close()">Fechar</button>`.

`fiado/urls.py` (arquivo inteiro):

```python
from django.urls import path, re_path

from fiado.views import impressao, spa

urlpatterns = [
    path("notas/<int:cliente_codigo>-<int:numero>/imprimir/", impressao.imprimir_nota, name="imprimir_nota"),
    path("recibos/<int:pagamento_id>/", impressao.recibo, name="recibo"),
    path("recibos/lote/<uuid:lote>/", impressao.recibo_lote, name="recibo_lote"),
    re_path(r"^(?!api/|static/).*$", spa.spa, name="spa"),
]
```

Em `bellracoes/urls.py`, remova as rotas `entrar/` e `sair/` do Django; fique com `api/` e o `include("fiado.urls")`.

Apague os arquivos listados em "Delete". Depois rode `uv run pytest fiado/tests -q` e corrija só importações quebradas pela remoção.

- [ ] **Step 4: Reescrever o teste de ponta a ponta**

`e2e/test_fluxo_fiado.py` roda contra o Django servindo `frontend/dist` (rode `npm --prefix frontend run build` antes). Fluxo, com `window.print` e `window.open` tratados (as páginas de impressão abrem em nova aba: use `context.expect_page()` e feche a aba):

1. Login com `caixa1`.
2. Clientes → Novo cliente "Maria da Silva" → tela do cliente mostra "01 · Maria da Silva".
3. Nova nota única → gaveta "01-01" abre.
4. Adiciona "Ração 15kg", quantidade 1, preço "100,00" com Enter → item na lista, saldo "R$ 100,00".
5. Finalizar e imprimir → a nova aba contém "VIA DO CLIENTE" e "01-01"; fecha a aba.
6. Receber → valor "40,00" → Confirmar → nova aba com "RECIBO DE PAGAMENTO"; fecha; saldo "R$ 60,00".
7. Receber de novo (valor já vem "60,00") → Confirmar → fecha a aba; a gaveta mostra "Quitada" e não há botão "Receber".
8. Esc fecha a gaveta; "Contas pagas" lista "01-01".
9. Segundo teste: com uma nota criada pelos serviços, digitar "01-01" na busca e Enter abre a gaveta; o endereço contém `nota=01-01`; o botão Voltar do navegador fecha a gaveta.

- [ ] **Step 5: Atualizar `docs/instalacao.md`**

Na seção "Caixa 1 (servidor)", antes do passo de copiar a pasta, acrescente:

```markdown
**Antes de copiar, na máquina de desenvolvimento (precisa de Node 20 ou mais novo):**

```bash
npm --prefix frontend ci
npm --prefix frontend run build
```

Isso gera a pasta `frontend/dist`, que precisa ir junto. A loja não precisa de Node.
```

No passo de copiar, a lista do que não copiar passa a ser `.venv`, `dados` e `frontend/node_modules`. Na seção "Navegador", acrescente: "As notas e os recibos abrem em nova aba para imprimir; libere pop-ups para o endereço do sistema quando o Chrome perguntar." Na seção "Antes de usar de verdade", acrescente o item: "abrir uma nota, receber um pagamento e conferir que o recibo abre em nova aba".

- [ ] **Step 6: Rodar tudo**

```bash
npm --prefix frontend test
npm --prefix frontend run build
uv run pytest -q
```

Expected: tudo passa, sem avisos. Confira também que `grep -R "htmx\|alpine" fiado bellracoes --include='*.py' --include='*.html'` não encontra nada.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: Django serve o front React; telas antigas removidas"
```
