# Bell Rações — Sistema de Fiado (primeira entrega)

Data: 2026-10-05

Este documento substitui a seção 6.5 (Fiado) e o app `fiado` da especificação `2026-09-28-bell-racoes-design.md`. O modelo de conta corrente por cliente foi trocado por notas separadas. O restante daquela especificação (catálogo, estoque, caixa, precificação, relatórios) continua válido, mas fica para depois: o fiado é construído e colocado em uso primeiro, sozinho.

## 1. Objetivo

Controlar as vendas a prazo da loja: quem deve, quanto, há quantos dias, em qual nota. O operador localiza qualquer nota em segundos pelo código impresso, recebe pagamentos totais ou parciais e vê num painel quais notas estão atrasadas.

## 2. Escopo

Dentro desta entrega:

- Cadastro de clientes.
- Notas únicas e notas contínuas, com itens digitados à mão.
- Pagamento total e parcial, por nota ou distribuído pela dívida do cliente.
- Correção de nota finalizada, com marca "editado".
- Painel de notas atrasadas.
- Tela de contas pagas.
- Impressão térmica de nota e de recibo.
- Login para os dois caixas.
- Cópia de segurança diária do banco.

Fora desta entrega: catálogo de produtos, estoque, caixa e fechamento, precificação, relatórios, código de barras na nota. O pagamento já grava a forma de pagamento, para entrar no fechamento de caixa quando ele existir.

## 3. Implantação

- Django + HTMX + Alpine.js, banco SQLite em modo WAL, transações `IMMEDIATE` nas escritas.
- O servidor roda no computador central (caixa 1). O caixa 2 acessa pelo navegador, pela rede local.
- Fuso horário `America/Sao_Paulo`. Toda contagem de dias usa a data local.
- Dois usuários: `caixa1` (Flávia) e `caixa2` (Marcineide), cada um com sua senha. Os dois têm acesso total. Toda nota, pagamento e correção grava qual usuário fez.

## 4. Modelo de dados

App Django `fiado`.

**Cliente**
- `codigo`: inteiro único, sequencial a partir de 1. Nunca reaproveitado.
- `nome`, `apelido` (opcional), `telefone` (opcional).
- `ultimo_numero_nota`: contador usado para numerar as notas do cliente.
- `criado_em`.

**Nota**
- `cliente`, `numero` (sequencial por cliente, a partir de 1; único junto com o cliente).
- `tipo`: `UNICA` ou `CONTINUA`.
- `situacao`: `RASCUNHO`, `ABERTA`, `FECHADA`, `QUITADA`.
- `criada_em`, `fechada_em`, `quitada_em`.
- `editada` (sim/não), `editada_em`.
- `criada_por`.
- `versao`: inteiro, usado para detectar edição simultânea.

**ItemNota**
- `nota`, `descricao`, `quantidade` (decimal, 3 casas), `preco_unitario` (decimal, 2 casas), `adicionado_em`, `adicionado_por`.

**Pagamento**
- `nota`, `valor`, `forma` (`DINHEIRO`, `PIX`, `CARTAO`), `recebido_em`, `recebido_por`.
- `lote`: identificador comum aos pagamentos gerados por um único "pagar dívida total".

**CorrecaoNota**
- `nota`, `feita_por`, `feita_em`, `itens_anteriores` (cópia em JSON dos itens antes da alteração), `total_anterior`.

Valores calculados, nunca gravados:

- Total da nota = soma de quantidade × preço unitário dos itens.
- Saldo da nota = total − soma dos pagamentos.
- Dívida do cliente = soma dos saldos das notas não quitadas.
- Dias em aberto = data de hoje − data de criação da nota.
- Nível de alerta = dias em aberto ÷ 7, arredondado para baixo.

## 5. Códigos e busca rápida

- O código do cliente é mostrado com pelo menos dois dígitos: `01`, `02`, ... `12`, ... `105`.
- O código da nota é `cliente-numero`, também com dois dígitos: `12-03`. Ele aparece em destaque no topo da nota impressa.
- A numeração da nota conta todas as notas do cliente, inclusive as quitadas. `12-03` é sempre a mesma nota.

Um campo de busca fica fixo no topo de todas as telas:

- `12` + Enter abre o registro do cliente 12, com o cursor no campo de número da nota. `3` + Enter abre a nota `12-03`.
- `12-03` + Enter abre a nota direto.
- Texto abre a lista de clientes filtrada por nome ou apelido.
- Qualquer nota abre pelo código, inclusive as quitadas que já saíram da tela de pagas.
- Código inexistente mostra aviso e mantém o que foi digitado.

## 6. Regras de negócio

### 6.1 Nota única
1. Nasce como `RASCUNHO`. O operador adiciona, altera e remove itens à vontade.
2. "Finalizar e imprimir" exige pelo menos um item, muda a situação para `FECHADA` e imprime.
3. Depois de finalizada, a nota oferece dois botões: **Pagamento** (total ou parcial) e **Correção**. Não há outra forma de alterá-la.
4. Um rascunho pode ser descartado. O número dele não é reaproveitado.

### 6.2 Nota contínua
1. Nasce como `ABERTA`. Aceita novos itens e pagamentos parciais enquanto estiver aberta.
2. Cada cliente tem no máximo uma nota contínua `ABERTA` por vez. Notas únicas não têm limite.
3. O operador fecha a nota manualmente. Fechada, ela oferece os mesmos dois botões da nota única: **Pagamento** e **Correção**.
4. Depois de fechada, uma nova nota contínua pode ser aberta para o cliente, mesmo que a anterior ainda tenha saldo.
5. Enquanto aberta, itens só são acrescentados. Alterar ou remover um item já lançado é feito pelo botão de correção.
6. Uma nota contínua aberta com saldo zero continua aberta. Ela só vira `QUITADA` quando é fechada com saldo zero, ou quando o saldo zera depois de fechada.
7. Uma nota contínua aberta e sem itens pode ser descartada.

### 6.3 Pagamento
1. O pagamento é lançado numa nota. O valor vem preenchido com o saldo e pode ser reduzido para pagamento parcial.
2. O valor deve ser maior que zero e não pode passar do saldo da nota.
3. Quando o saldo de uma nota `FECHADA` chega a zero, ela vira `QUITADA` e `quitada_em` é gravado.
4. "Pagar dívida total", no registro do cliente, recebe um valor e o distribui das notas mais antigas para as mais recentes, gerando um pagamento por nota com o mesmo `lote`. O valor não pode passar da dívida do cliente. A tela mostra a distribuição antes de confirmar.
5. Cada pagamento gera um recibo impresso.

### 6.4 Correção
1. Disponível em nota `FECHADA` e em nota contínua `ABERTA`. Não disponível em rascunho (que já é editável) nem em nota `QUITADA`.
2. O operador altera, remove ou acrescenta itens. Ao salvar, o sistema grava uma `CorrecaoNota` com a cópia dos itens anteriores, marca a nota como `editada` e reimprime.
3. A marca "EDITADO" e a data da correção aparecem na tela e em toda impressão posterior da nota.
4. O novo total não pode ficar abaixo do que já foi pago. Se ficar igual, a nota fechada vira `QUITADA`.
5. A correção não altera pagamentos nem troca o cliente da nota.

### 6.5 Contagem de dias e alerta
1. Os dias em aberto contam a partir da criação da nota, para os dois tipos.
2. Uma nota não quitada com 7 dias ou mais entra no painel. Ela aparece uma única vez, com o nível atual: 7, 14, 21 dias e assim por diante.
3. A nota sai do painel quando é quitada.
4. O alerta é calculado pela data no momento da consulta. Não depende de tarefa agendada nem de o computador ter ficado ligado.

### 6.6 Contas pagas
1. A tela de contas pagas mostra as notas quitadas nos últimos 7 dias.
2. Depois de 7 dias a nota sai da tela, mas continua no banco e abre pelo código.
3. Nenhuma nota quitada é apagada.

### 6.7 Clientes
1. A lista de clientes fica em ordem alfabética por nome.
2. Um cliente que tem qualquer nota não pode ser excluído.

## 7. Telas

1. **Login**: usuário e senha.
2. **Painel**: notas em alerta (cliente, código da nota, dias, nível, saldo), da mais atrasada para a menos. Total de fiado em aberto. Clicar abre a nota.
3. **Clientes**: lista alfabética com código, nome, apelido, dívida e número de notas abertas. Botão "novo cliente".
4. **Registro do cliente**: dados do cliente e notas não quitadas, da mais antiga para a mais recente, com código, tipo, dias em aberto e saldo. Campo de número da nota. Botões: nova nota única, nova nota contínua (desabilitado se já houver uma aberta), pagar dívida total.
5. **Nota**: código, cliente, tipo, situação, marca "editado", itens, pagamentos, total e saldo. Botões conforme a situação:
   - única em rascunho: adicionar item, finalizar e imprimir, descartar;
   - contínua aberta: adicionar item, pagamento, correção, fechar nota, imprimir;
   - fechada: pagamento, correção, reimprimir;
   - quitada: reimprimir.
6. **Pagamento** (janela): valor e forma.
7. **Pagar dívida total** (janela): valor, forma e prévia da distribuição pelas notas.
8. **Contas pagas**: notas quitadas nos últimos 7 dias, com reimpressão.

## 8. Impressão

- Impressora térmica de 80 mm. Modelos HTML com `@page { size: 80mm auto; margin: 0 }`, impressos pelo navegador com `window.print()`. Com o Chrome em `--kiosk-printing`, sai direto.
- **Nota**: duas vias no mesmo trabalho de impressão (via do cliente e via da loja). Cabeçalho da loja, código da nota em destaque, cliente, data, itens, total, pagamentos já feitos, saldo e linha de assinatura. Se corrigida, "EDITADO" e a data da correção.
- **Recibo de pagamento**: código da nota, cliente, valor pago, forma, saldo restante. No "pagar dívida total", um recibo só, listando as notas abatidas.

## 9. Tratamento de erros

- Pagamento acima do saldo, valor zero ou negativo: bloqueado com mensagem.
- Finalizar nota sem itens: bloqueado.
- Segunda nota contínua aberta para o mesmo cliente: bloqueado.
- Correção que deixa o total abaixo do valor já pago: bloqueada.
- Edição simultânea: cada gravação confere a `versao` da nota. Se outro caixa alterou a nota nesse meio-tempo, o segundo recebe um aviso e a tela recarrega com os dados atuais.
- Código de cliente e número de nota são gerados dentro da transação de gravação, com restrição de unicidade no banco.

## 10. Cópia de segurança

No primeiro acesso de cada dia o sistema copia o banco para a pasta configurada, usando a API de backup do SQLite, e mantém as últimas 30 cópias.

## 11. Testes

Testes automáticos (pytest-django) das regras:

- total, saldo e dívida do cliente;
- numeração de clientes e de notas, sem reaproveitamento;
- ciclo da nota única e da nota contínua, incluindo o limite de uma contínua aberta;
- pagamento parcial, quitação, bloqueio de valor acima do saldo;
- distribuição do "pagar dívida total" da nota mais antiga para a mais recente;
- contagem de dias e nível de alerta em 6, 7, 13, 14 e 21 dias;
- filtro de 7 dias das contas pagas;
- correção: cópia dos itens anteriores, marca de editado, bloqueio abaixo do valor pago, quitação por correção;
- bloqueio de alteração de nota fechada fora do botão de correção;
- conflito de versão em edição simultânea;
- busca rápida por `12`, `12-03` e por nome.

Um teste de ponta a ponta com Playwright: criar cliente, criar nota única, finalizar, pagar parcialmente, quitar e conferir a nota em contas pagas.

## 12. Ordem de construção

1. Projeto Django, login, usuários dos dois caixas, layout base com a busca rápida.
2. Clientes: cadastro, lista, registro.
3. Nota única: rascunho, itens, finalização.
4. Nota contínua: abertura, itens, fechamento.
5. Pagamentos: por nota e dívida total.
6. Correção.
7. Painel de alertas e contas pagas.
8. Impressão de nota e recibo.
9. Cópia de segurança e instalação nos dois computadores.
