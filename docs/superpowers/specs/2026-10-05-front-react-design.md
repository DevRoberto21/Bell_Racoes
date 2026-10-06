# Bell Rações — Front em React para o sistema de fiado

Data: 2026-10-05

Este documento descreve a troca das telas do sistema de fiado por um front em React. As regras de negócio continuam as de `2026-10-05-fiado-design.md` e não mudam. O que muda é como a atendente vê e opera o sistema.

## 1. Objetivo

Dar ao fiado uma interface simples, de cores suaves e movimento fluido, pensada para o balcão: achar cliente ou nota em segundos, lançar itens e receber pagamentos sem trocar de página, e voltar ao ponto em que se estava.

## 2. Decisões já tomadas

| Assunto | Decisão |
| --- | --- |
| Tecnologia | React com Vite e TypeScript, servido pelo próprio Django |
| Fluxo | Repensado para o balcão, com as mesmas funções de hoje |
| Paleta | "Névoa": cinza-azulado claro, azul-ardósia como cor de ação |
| Navegação | Menu lateral fixo; a nota abre em gaveta à direita |
| Movimento | Fluido: cerca de 0,4 s, com mola leve |
| Telas antigas | Removidas (templates, HTMX, Alpine e os testes de tela) |
| Impressão | Continua em HTML gerado pelo servidor |
| Instalação | O computador da loja continua sem Node |

## 3. Escopo

Dentro desta entrega:

- API JSON no Django, sobre os serviços existentes.
- Aplicação React com todas as funções atuais: login, painel, clientes, registro do cliente, nota, itens, finalização, fechamento, descarte, pagamento por nota, pagamento da dívida total, correção, contas pagas, busca rápida.
- Atalhos de teclado.
- Remoção das telas antigas e dos testes de tela; testes novos de API, de componente e de ponta a ponta.
- Atualização do guia de instalação.

Fora desta entrega: tema escuro, uso em celular, mudança nos impressos, funções novas de negócio. A largura mínima suportada é 1280 px.

## 4. Arquitetura

```
Navegador ── React (arquivos estáticos servidos pelo Django)
                 │  fetch JSON, cookie de sessão, cabeçalho CSRF
                 ▼
           fiado/api/ (views JSON finas)
                 ▼
           fiado/servicos/ e fiado/consultas.py (sem mudança)
                 ▼
           SQLite
```

### 4.1 Django

- `fiado/servicos/`, `fiado/consultas.py`, `fiado/busca.py`, `fiado/backup.py`, os modelos e seus testes ficam como estão.
- Nova camada `fiado/api/`, com views que só traduzem JSON para chamadas de serviço e de volta. Nenhuma regra de negócio mora nela.
- Saem: `fiado/views/clientes.py`, `notas.py` (menos a impressão), `pagamentos.py` (menos os recibos), `correcoes.py`, `painel.py`, os templates fora de `impressao/`, `fiado/forms.py` no que não for mais usado, `htmx.min.js`, `alpine.min.js`, `app.css` e os testes `test_telas_*.py`.
- Ficam como páginas HTML: impressão da nota (`/notas/<c>-<n>/imprimir/`), recibo (`/recibos/<id>/`) e recibo de lote (`/recibos/lote/<uuid>/`). O link "Voltar" dessas páginas passa a fechar a janela.
- Qualquer outro endereço fora de `/api/`, `/static/`, das páginas de impressão e de recibo devolve o `index.html` do React, para que as rotas do front funcionem ao recarregar.
- Autenticação por sessão, como hoje. Toda rota de `/api/`, menos a de login e a de sessão, responde `401` em JSON para quem não está logado, em vez de redirecionar.

### 4.2 Contrato da API

Regras gerais:

- Dinheiro e quantidade trafegam como texto com ponto decimal (`"96.40"`, `"1.500"`). O front nunca faz conta de dinheiro com número de ponto flutuante; totais e saldos vêm prontos do servidor.
- Datas em ISO 8601 com fuso.
- Toda escrita em uma nota envia a `versao` que a tela tinha.
- Erros têm o formato `{"erro": "<mensagem para a atendente>", "campos": {...}}`.
  - `400`: dados inválidos ou regra de negócio recusou.
  - `401`: sem login.
  - `404`: cliente ou nota não existe.
  - `409`: a nota ou a dívida mudou no outro caixa. A resposta traz a mensagem; o front recarrega os dados.
- Toda escrita exige o cabeçalho `X-CSRFToken`.

Endpoints:

| Método e caminho | Função |
| --- | --- |
| `GET /api/sessao` | Usuário logado (ou `null`) e garante o cookie CSRF |
| `POST /api/entrar` | Login com `usuario` e `senha` |
| `POST /api/sair` | Logout |
| `GET /api/painel` | Total em aberto, notas em alerta, rascunhos, aviso de backup |
| `GET /api/busca?q=` | Resultado da busca rápida: nota, cliente com suas notas abertas, ou lista de clientes |
| `GET /api/clientes?q=` | Lista alfabética com dívida e número de notas abertas |
| `POST /api/clientes` | Cria cliente |
| `GET /api/clientes/<codigo>` | Cliente, dívida, notas em aberto |
| `PATCH /api/clientes/<codigo>` | Edita nome, apelido, telefone |
| `DELETE /api/clientes/<codigo>` | Exclui cliente sem notas |
| `POST /api/clientes/<codigo>/notas` | Cria nota (`tipo`) |
| `GET /api/clientes/<codigo>/divida/previa?valor=` | Distribuição do valor pelas notas |
| `POST /api/clientes/<codigo>/pagamentos` | Paga a dívida total (`valor`, `forma`, `divida_esperada`) |
| `GET /api/notas/<c>-<n>` | Nota com itens, pagamentos, totais, ações permitidas |
| `POST /api/notas/<c>-<n>/itens` | Adiciona item |
| `DELETE /api/notas/<c>-<n>/itens/<id>` | Remove item de rascunho |
| `PUT /api/notas/<c>-<n>/itens` | Correção: substitui a lista de itens |
| `POST /api/notas/<c>-<n>/finalizar` | Finaliza nota única |
| `POST /api/notas/<c>-<n>/fechar` | Fecha nota contínua |
| `DELETE /api/notas/<c>-<n>` | Descarta rascunho ou contínua vazia |
| `POST /api/notas/<c>-<n>/pagamentos` | Registra pagamento (`valor`, `forma`) |
| `GET /api/pagas` | Notas quitadas nos últimos 7 dias |

A resposta de uma nota traz um objeto `acoes` com um booleano para cada ação (`adicionar_item`, `remover_item`, `finalizar`, `fechar`, `descartar`, `receber`, `corrigir`, `imprimir`). O front mostra botões a partir dele e não reimplementa as regras de situação.

Toda escrita em nota devolve a nota atualizada, para a tela trocar os dados sem nova consulta.

### 4.3 React

Pasta `frontend/` na raiz do projeto.

- Vite, React e TypeScript.
- `react-router` para as rotas.
- `@tanstack/react-query` para buscar e invalidar dados.
- `motion` para as animações.
- CSS puro, com variáveis para cor, espaço, raio e tempo. Sem Tailwind e sem biblioteca de componentes.
- Fonte Inter embutida no pacote (`@fontsource-variable/inter`), para funcionar sem internet.

Organização:

```
frontend/src/
  api/          cliente HTTP, tipos das respostas, tratamento de erro
  estilo/       variáveis, base, tipografia
  componentes/  Botao, Campo, Selo, Gaveta, Dialogo, Aviso, Lista, Dinheiro
  recursos/
    sessao/     login, usuário atual
    busca/      campo e resultados
    painel/
    clientes/   lista, registro, formulário, pagar dívida total
    notas/      gaveta da nota, itens, receber, correção
    pagas/
  atalhos/      registro de atalhos de teclado
  App.tsx, rotas.tsx, main.tsx
```

Rotas:

| Caminho | Tela |
| --- | --- |
| `/entrar` | Login |
| `/` | Painel |
| `/clientes` | Lista de clientes |
| `/clientes/:codigo` | Registro do cliente |
| `/pagas` | Contas pagas |
| `…?nota=12-03` | Gaveta da nota aberta sobre a tela atual |

A gaveta é controlada por um parâmetro do endereço. Assim o botão Voltar do navegador fecha a gaveta, e um endereço com `?nota=12-03` abre a nota direto.

### 4.4 Entrega

- `npm run build` gera `frontend/dist/`. O Django serve essa pasta pelo WhiteNoise e usa o `index.html` dela.
- `frontend/dist/` e `frontend/node_modules/` ficam fora do git.
- O guia de instalação ganha um passo: gerar o front na máquina de desenvolvimento antes de copiar a pasta para a loja. O `iniciar.bat` não muda.
- Em desenvolvimento, o Vite roda com proxy de `/api`, `/notas`, `/recibos` e `/static` para o Django.
- Se `frontend/dist/index.html` não existir, o Django responde com uma página simples dizendo que o front precisa ser gerado, em vez de erro 500.

## 5. Sistema visual

### 5.1 Cores

| Uso | Valor |
| --- | --- |
| Fundo da página | `#F3F5F8` |
| Superfície (cartões, gaveta, menu) | `#FFFFFF` |
| Borda | `#DEE3EC` |
| Borda forte | `#C9D0DD` |
| Texto | `#232833` |
| Texto secundário | `#4A5364` |
| Texto de apoio | `#636B7A` |
| Ação | `#3D4F7A` |
| Ação, fundo suave | `#E4E9F5` com texto `#2E3C60` |
| Alerta 7 dias | fundo `#E6E9EF`, texto `#555E70` |
| Alerta 14 dias | fundo `#F5E6C9`, texto `#7A5A12` |
| Alerta 21 dias ou mais | fundo `#F6D9DD`, texto `#8C2F3D` |
| Quitada | fundo `#DDEFE4`, texto `#1F5A3A` |
| Erro | fundo `#F6D9DD`, texto `#8C2F3D` |

Todo par de texto e fundo atende contraste 4,5:1.

### 5.2 Forma e tipografia

- Inter. Números de dinheiro e códigos com algarismos tabulares.
- Corpo em 15 px; títulos de tela em 22 px, peso 650.
- Raio de 10 px em botões e campos, 14 px em cartões e na gaveta.
- Sem sombras pesadas. A gaveta tem uma sombra larga e fraca; o resto se separa por borda e fundo.
- Um botão de ação principal por contexto, preenchido. Os demais são de contorno.

### 5.3 Movimento

- Duração base de 0,4 s com mola leve; microinterações em 0,15 s.
- A gaveta desliza da direita e a tela ao fundo escurece um pouco.
- Itens de lista entram em sequência curta, no máximo oito por vez.
- A linha clicada afunda levemente.
- Saldo e totais contam do valor antigo ao novo.
- Ao quitar, o selo troca para "Quitada" e a nota sai da lista de abertas.
- Avisos de erro e de conflito deslizam do topo da gaveta ou da tela.
- Com "reduzir movimento" ligado no sistema, nada anima.
- Nenhuma animação bloqueia digitação ou clique.

## 6. Telas e fluxo

### 6.1 Estrutura fixa

- Menu lateral: Painel, Clientes, Contas pagas. No rodapé, o usuário e o botão Sair.
- Campo de busca no topo da área principal, em todas as telas.
- A nota abre em gaveta à direita. Esc ou o botão Voltar fecha.

### 6.2 Busca

- Responde enquanto a atendente digita, com espera de 150 ms.
- `12` mostra o cliente 12 e suas notas em aberto. `12-03` mostra a nota. Texto mostra clientes por nome ou apelido.
- Setas escolhem, Enter abre. Um cliente abre a tela do cliente; uma nota abre a gaveta.
- Sem resultado, a lista diz isso e mantém o texto digitado.

### 6.3 Telas

1. **Entrar**: usuário e senha; erro de login aparece no próprio formulário.
2. **Painel**: total de fiado em aberto; notas atrasadas com selo de nível, da mais atrasada para a menos; rascunhos não finalizados; aviso em vermelho se a cópia de segurança do dia não foi feita.
3. **Clientes**: lista alfabética com código, nome, apelido, notas abertas e dívida; botão "Novo cliente".
4. **Cliente**: dados, dívida e notas em aberto, da mais antiga para a mais recente. Ações: nova nota única, nova nota contínua (desabilitada se já houver uma aberta), pagar dívida total, editar cadastro, excluir (só sem notas).
5. **Nota** (gaveta): código em destaque, cliente, tipo, situação, selo "editado", itens, pagamentos com link do recibo, total, pago e saldo. Botões conforme `acoes`.
6. **Contas pagas**: notas quitadas nos últimos 7 dias, com reimpressão.

### 6.4 Dentro da gaveta

- **Adicionar item**: linha de digitação no fim da lista, com descrição, quantidade e preço. Enter grava e abre uma linha nova.
- **Receber**: formulário que sobe dentro da gaveta, com o valor preenchido com o saldo e a forma de pagamento. Ao confirmar, o recibo abre em janela de impressão.
- **Correção**: os itens ficam editáveis no lugar. Linha em branco conta como removida. Salvar reimprime a nota.
- **Finalizar e imprimir**, **Fechar nota**, **Reimprimir**, **Descartar**: botões no rodapé da gaveta.

Pagar dívida total fica na tela do cliente, em diálogo próprio: valor, forma e a distribuição pelas notas, que se atualiza enquanto o valor é digitado.

Quantidade e preço aceitam vírgula ou ponto como separador decimal. O front converte para o formato da API antes de enviar.

### 6.5 Atalhos

| Tecla | Ação |
| --- | --- |
| `/` ou `F2` | Foco na busca |
| `Esc` | Fecha gaveta, diálogo ou formulário |
| `N` | Nova nota única, na tela do cliente |
| `R` | Receber, com uma nota aberta |
| `↑` `↓` `Enter` | Navegar e abrir resultados da busca |

Atalhos de letra só valem quando o foco não está em um campo de texto.

### 6.6 Proteções

- O botão de confirmar pagamento trava depois do primeiro clique, até a resposta chegar.
- Descartar nota e remover item pedem confirmação em diálogo próprio.
- Em conflito (`409`), a tela mostra o aviso, recarrega a nota ou o cliente e mantém a gaveta aberta. O que estava digitado em uma correção é descartado, como hoje.
- Em `401`, o front leva para a tela de login e volta ao mesmo endereço depois.
- Falha de rede mostra aviso e não apaga o que foi digitado.

## 7. Acessibilidade

- Tudo operável por teclado; foco visível.
- A gaveta e os diálogos prendem o foco enquanto abertos e o devolvem ao fechar.
- Campos com rótulo; erros ligados ao campo.
- Avisos anunciados a leitores de tela.

## 8. Testes

- **Regras**: os testes atuais de serviços, consultas, busca e backup continuam, sem mudança.
- **API** (pytest-django): para cada endpoint, o caminho feliz, erro de regra (`400`), sem login (`401`), inexistente (`404`) e conflito (`409`) onde couber. Um teste percorre todas as rotas de `/api/` e confirma que exigem login.
- **Front** (Vitest e Testing Library): conversão de número digitado, campo de busca, linha de novo item, formulário de receber, distribuição da dívida total, tratamento de `409` e `401`.
- **Ponta a ponta** (Playwright): o fluxo de hoje reescrito para as telas novas, do cadastro do cliente até a nota em contas pagas, mais um teste de abrir nota pelo código na busca.

## 9. Ordem de construção

1. API de sessão, e Django servindo o front gerado.
2. API de leitura: painel, busca, clientes, cliente, nota, pagas.
3. API de escrita: clientes, notas, itens, pagamentos, correção.
4. Projeto React: estrutura, estilo base, componentes, cliente HTTP, login.
5. Menu, busca e painel.
6. Clientes e registro do cliente.
7. Gaveta da nota: itens, finalizar, fechar, descartar, imprimir.
8. Receber, pagar dívida total, correção.
9. Contas pagas, atalhos, movimento, acessibilidade.
10. Remoção das telas antigas, ponta a ponta novo, guia de instalação.
