# Bell Rações – Sistema Auxiliar: Design

Data: 2026-09-28
Status: rascunho para revisão

## 1. Objetivo

A Bell Rações usa o Moderniza (moderloja + modernizapdv) como sistema fiscal. O estoque do Moderniza não reflete o estoque físico: parte dos produtos não tem NF de entrada nem cadastro, e parte das vendas é lançada no Moderniza com outros produtos ou não é lançada.

O Sistema Auxiliar passa a ser o **registro do estoque físico real** e cobre:

1. Estoque: cadastro de todos os produtos (com e sem NF), código de barras interno, alerta de estoque baixo.
2. Caixa auxiliar: toda venda é lida no auxiliar com os itens que realmente saíram.
3. Fiado: conta corrente por cliente, comprovante de 2 vias, página de devedores.
4. Precificação: entrada de nota de fornecedor, cálculo de preço com histórico e margem, folha de lançamento para a funcionária digitar no Moderniza.
5. Relatórios: mais vendidos por período, com gráficos.

O sistema não se integra ao Moderniza e não altera a rotina fiscal da loja.

## 2. Decisões tomadas

| Tema | Decisão |
|---|---|
| Registro de vendas | Toda venda é lida no auxiliar. No Moderniza, só quando sai NF. O auxiliar nunca importa do Moderniza. |
| Produto sem código | Sistema gera EAN-13 interno e imprime etiqueta. |
| Moderniza fora do ar | Venda marcada "pendente no Moderniza"; lista para lançar depois. |
| Hospedagem | Local, sem depender de internet. PC do Caixa 1 é servidor; Caixa 2 acessa pelo navegador na rede local. |
| Hardware | 2× Windows 10, impressora térmica 80mm, leitores USB (modo teclado). |
| Precificação V1 | XML de NF-e ou digitação manual. Foto fica para V2. |
| Planilha de precificação | Folha de lançamento por nota (A4 + Excel) para digitar no Moderniza sem conferência. |
| Fiado | Conta corrente, pagamento parcial, sem limite, sem juros. Alerta na tela após 7 dias. |
| Permissões | Nenhuma. Operador escolhido pelo nome ao abrir o caixa, só para histórico. |
| Stack | Django 5 + SQLite + HTMX + Alpine.js + Tailwind (CLI standalone) + Chart.js. |
| Fiscal | O sistema não sugere nem escolhe produtos para compor valor de NF. Comprovantes se chamam "comprovante", nunca "nota". |

## 3. Escopo

**V1:** tudo da seção 1, mais carga inicial, contagem de estoque, fechamento de caixa e backup automático.

**Fora da V1 (V2 ou depois):**
- Relatório semanal de devedores via bot do Telegram.
- Leitura de foto de nota via IA.
- Download de XML na SEFAZ com certificado digital da loja.
- Pagamento misto numa mesma venda (ex.: parte pix, parte dinheiro).
- Qualquer integração com o Moderniza.

## 4. Arquitetura

### 4.1 Implantação

- PC do Caixa 1: Python 3.12, projeto Django, servidor Waitress na porta 8000, rodando como serviço do Windows via WinSW (inicia com o PC). Arquivos estáticos servidos por WhiteNoise.
- IP fixo para o Caixa 1 no roteador. Regra de firewall liberando a porta 8000 na rede privada.
- Caixa 2: Chrome abrindo `http://<ip-caixa1>:8000`.
- Chrome dos dois PCs com atalho usando `--kiosk-printing` (impressão direta na impressora padrão, sem diálogo).
- Todos os assets (JS, CSS, fontes) ficam no projeto. Nenhum CDN.
- Atualização: script `atualizar.bat` que para o serviço, baixa a nova versão, roda `migrate` e `collectstatic` e reinicia.
- Recomendado: nobreak no PC do Caixa 1.

### 4.2 Banco

SQLite com:
- `journal_mode=WAL` (leituras não bloqueiam escrita).
- `busy_timeout=5000`.
- `transaction_mode="IMMEDIATE"` (Django 5.1+), evitando erro de lock quando os dois caixas gravam ao mesmo tempo.

Valores em `DecimalField` (dinheiro com 2 casas, quantidade com 3 casas para produtos a granel). Fuso `America/Sao_Paulo`, locale `pt-BR`.

### 4.3 Organização do código

Um projeto Django com apps por domínio. Regras de negócio ficam em `services.py` de cada app; views só recebem a requisição, chamam o serviço e renderizam o template.

```
bellracoes/            configurações do projeto
core/                  Operador, ConfiguracaoLoja, backup, layout base, painel inicial
catalogo/              Categoria, Produto, HistoricoPreco, código interno, etiquetas
estoque/               MovimentoEstoque, Contagem, ajustes, carga inicial
vendas/                SessaoCaixa, Venda, ItemVenda, fechamento, pendências Moderniza
fiado/                 Cliente, LancamentoFiado, devedores, comprovantes
precificacao/          NotaEntrada, ItemNota, ProdutoFornecedor, parser XML, folha de lançamento
relatorios/            consultas agregadas e gráficos
```

Dependências entre apps seguem uma direção: `catalogo` ← `estoque` ← `vendas` ← `fiado`; `precificacao` usa `catalogo` e `estoque`; `relatorios` só lê.

## 5. Modelo de dados

### core
- **Operador**: nome, ativo.
- **ConfiguracaoLoja** (registro único): nome da loja, endereço e telefone para comprovante, dias para alerta de fiado (padrão 7), pasta de backup, modelo de etiqueta.

### catalogo
- **Categoria**: nome.
- **Produto**: nome, categoria, unidade (UN, KG, SC), codigo_barras (único, opcional), codigo_interno (bool), possui_nf (bool), codigo_moderniza (opcional), custo_atual, preco_venda, estoque_atual, estoque_minimo, ativo, criado_em, atualizado_em.
- **HistoricoPreco**: produto, custo, preco_venda, origem (NOTA, MANUAL), nota (opcional), criado_em, operador.

`estoque_atual` é um cache do saldo dos movimentos, atualizado na mesma transação de cada movimento.

### estoque
- **MovimentoEstoque**: produto, tipo, quantidade (com sinal), custo_unitario (opcional), item_venda (opcional), item_nota (opcional), motivo, observacao, operador, criado_em.
  - Tipos: CARGA_INICIAL, ENTRADA_NOTA, VENDA, CANCELAMENTO_VENDA, AJUSTE, CONTAGEM.
  - Motivos de AJUSTE: PERDA, QUEBRA, VENCIDO, USO_INTERNO, OUTRO.
- **Contagem**: descricao, iniciada_em, aplicada_em, operador.
- **ItemContagem**: contagem, produto, quantidade_contada.

### vendas
- **SessaoCaixa**: caixa (1 ou 2), operador, aberta_em, troco_inicial, fechada_em, dinheiro_contado, maquininha_pix, maquininha_cartao, observacao.
- **Venda**: sessao, operador, criada_em, forma_pagamento (DINHEIRO, PIX, CARTAO, FIADO), total, valor_recebido, troco, cliente (só fiado), pendente_moderniza (bool), lancada_moderniza_em, cancelada_em, motivo_cancelamento.
- **ItemVenda**: venda, produto, quantidade, preco_unitario, custo_unitario (cópia do custo no momento da venda, para lucro bruto), subtotal.

### fiado
- **Cliente**: nome, telefone, observacao, criado_em.
- **LancamentoFiado**: cliente, tipo (COMPRA, PAGAMENTO, ESTORNO), valor (positivo aumenta a dívida, negativo reduz), venda (para COMPRA/ESTORNO), forma_pagamento (para PAGAMENTO), sessao (para PAGAMENTO entrar no fechamento), operador, criado_em.

### precificacao
- **NotaEntrada**: fornecedor_nome, fornecedor_cnpj, numero, serie, chave (44 dígitos, única, opcional), data_emissao, origem (XML, MANUAL), status (EM_PRECIFICACAO, PENDENTE_LANCAMENTO, LANCADA), arquivo_xml, valor_total, fechada_em, lancada_em, operador.
- **ItemNota**: nota, ordem, codigo_fornecedor, ean, descricao, ncm, unidade, quantidade, custo_unitario, fator_conversao (padrão 1; ex.: caixa com 12 unidades = 12), produto (opcional até fechar), margem_percentual, preco_final.
- **ProdutoFornecedor**: fornecedor_cnpj, codigo_fornecedor, produto, fator_conversao. Guarda o vínculo para a próxima nota do mesmo fornecedor já vir ligada ao produto certo.

## 6. Regras de negócio

### 6.1 Estoque
- Toda mudança de estoque é um MovimentoEstoque. Não existe edição direta de `estoque_atual`.
- Venda **nunca é bloqueada** por falta de estoque. Estoque pode ficar negativo; produtos negativos aparecem em alerta no painel (indicam entrada ou cadastro faltando).
- Alerta de estoque baixo: `estoque_atual <= estoque_minimo` e `estoque_minimo > 0`.

### 6.2 Código de barras interno
- EAN-13 no formato `2` + 11 dígitos sequenciais + dígito verificador. O prefixo `2` é reservado para uso interno e não colide com códigos de fábrica.
- Gerado sob demanda no cadastro; único no banco.

### 6.3 Venda
- Finalizar a venda, numa transação: cria Venda e ItemVenda, cria um MovimentoEstoque VENDA por item e, se fiado, cria LancamentoFiado COMPRA.
- Fiado exige cliente. Dinheiro calcula troco. Pix e cartão registram o total.
- Cancelamento (com motivo): cria movimentos CANCELAMENTO_VENDA revertendo o estoque e, se fiado, LancamentoFiado ESTORNO. A venda fica marcada como cancelada, nunca é apagada.
- Venda com `pendente_moderniza` aparece em "Pendências no Moderniza" até ser marcada como lançada.

### 6.4 Fechamento de caixa
- Totais esperados da sessão, por forma de pagamento: vendas não canceladas + pagamentos de fiado recebidos na sessão.
- Dinheiro esperado = troco inicial + vendas em dinheiro + pagamentos de fiado em dinheiro.
- O operador informa dinheiro contado e totais da maquininha (pix, cartão). O sistema mostra as diferenças; não bloqueia o fechamento.
- Impressão de resumo em 80mm. Dispara backup.

### 6.5 Fiado
- Saldo do cliente = soma dos lançamentos.
- Dias em aberto: os pagamentos quitam as compras mais antigas primeiro. A compra mais antiga ainda não quitada define a data de referência; dias em aberto = hoje − essa data. Saldo zero = sem dias em aberto.
- Alerta quando dias em aberto ≥ `dias_alerta_fiado` (padrão 7). O painel mostra a contagem de clientes em alerta; a página de devedores ordena pelos mais atrasados.
- Comprovante de compra no fiado: 2 vias no mesmo trabalho de impressão (quebra de página entre elas), com itens, total da compra, saldo anterior, saldo atual e linha de assinatura. Via do cliente e via da loja identificadas.
- Pagamento aceita qualquer valor maior que zero. Pagamento acima do saldo pede confirmação e deixa crédito (saldo negativo).
- Pagamento recebido com caixa aberto é ligado à sessão e entra no fechamento. Sem caixa aberto, fica sem sessão e aparece só no extrato do cliente e nos relatórios.

### 6.6 Precificação
- Nova nota por XML: parser lê emitente, número, série, chave, data e itens (`det/prod`: cProd, cEAN, xProd, NCM, uCom, qCom, vUnCom). Chave duplicada é recusada com a mensagem "Nota já cadastrada".
- Nova nota manual: fornecedor, número, data e chave opcional (lida do código de barras da DANFE); itens digitados.
- Vínculo automático do item ao produto, nesta ordem: ProdutoFornecedor (CNPJ + código do fornecedor), EAN igual ao `codigo_barras` do produto, senão manual (buscar produto ou "criar novo").
- Custo na unidade da loja = custo_unitario ÷ fator_conversao. Quantidade que entra = quantidade × fator_conversao.
- Preço sugerido = custo na unidade da loja × (1 + margem%/100) (markup sobre o custo). A tela mostra custo anterior, preço atual e histórico. O preço final é editável.
- "Fechar precificação", numa transação: exige todos os itens vinculados e com preço final; cria MovimentoEstoque ENTRADA_NOTA por item; atualiza custo e preço do produto; grava HistoricoPreco; grava ou atualiza ProdutoFornecedor; muda status para PENDENTE_LANCAMENTO.
- Nota fechada não é editada. Correção de estoque via ajuste; correção de preço via cadastro do produto.
- Folha de lançamento: A4 imprimível e Excel (`openpyxl`), itens na ordem da nota, com código (codigo_moderniza, senão codigo_barras), descrição, quantidade na unidade da loja, custo, preço final e marca "preço alterado" quando difere do preço anterior. Botão "Marcar como lançada" muda status para LANCADA.

### 6.7 Carga inicial e contagem
- Carga inicial por arquivo (CSV ou XLSX exportado do Moderniza): tela mapeia colunas para nome, código de barras, preço, custo, estoque. Cria produtos e movimentos CARGA_INICIAL. Pode ser pulada.
- Contagem: leitura contínua soma 1 a cada leitura; quantidade editável para granel. Contagem parcial é permitida: só produtos contados são ajustados. "Aplicar" gera movimento CONTAGEM com a diferença entre contado e `estoque_atual` no momento da aplicação. Recomendado contar fora do horário de venda.

### 6.8 Relatórios
Por período: mais vendidos (quantidade e valor, top 10), vendas por dia, por forma de pagamento, por categoria, lucro bruto estimado (preço − custo gravado no item), produtos sem venda no período, estoque baixo, estoque negativo, total de fiado em aberto. Consultas via agregações do ORM; exportação Excel. Gráficos com Chart.js.

## 7. Telas

Seguem o protótipo do Figma (`docs/figma-prompt.md`): abertura de caixa, painel, caixa, modal fiado, comprovante, devedores, conta do cliente, produtos, produto, etiquetas, contagem, precificação (lista, nova nota, edição, folha), fechamento, relatórios. Mais: ajuste de estoque (modal), pendências no Moderniza, configurações.

Tela de caixa:
- Campo de leitura sempre com foco; Enter após a leitura adiciona o item (leitor USB envia Enter).
- Busca por nome com HTMX (autocompletar).
- Atalhos via Alpine.js: F2 buscar, F4 quantidade, F6 fiado, F9 finalizar, Esc cancelar.
- Código não encontrado: aviso e botão "Cadastro rápido" (nome, preço, possui NF), retornando ao carrinho.

## 8. Impressão e etiquetas

- Comprovantes (fiado, recibo de pagamento, fechamento): templates HTML com `@page { size: 80mm auto; margin: 0 }`, abertos em janela e impressos via `window.print()`. Com `--kiosk-printing`, sai direto. Botão "Reimprimir" em venda, pagamento e fechamento.
- Etiquetas: folha A4 adesiva, modelo configurável (padrão Pimaco 6180: 3×10). Código de barras em SVG via `python-barcode`, com nome e preço.

## 9. Backup

- Comando `manage.py backup` usa a API de backup do SQLite (cópia consistente com o sistema rodando), gera arquivo com data e hora na pasta configurada e mantém os 30 mais recentes.
- Executado: ao fechar o caixa e diariamente pelo Agendador de Tarefas do Windows.
- Pasta recomendada: sincronizada com Google Drive ou pendrive/HD externo. O painel mostra a data do último backup e alerta se passou de 2 dias.
- Restauração documentada em `docs/restaurar-backup.md`.

## 10. Erros e situações de falha

| Situação | Comportamento |
|---|---|
| Código lido não existe | Aviso + cadastro rápido. |
| Estoque insuficiente | Venda segue; estoque fica negativo e aparece no painel. |
| Impressora falhou | Venda já está gravada; botão reimprimir. |
| XML inválido ou não é NF-e | Mensagem "Arquivo não reconhecido como NF-e". |
| Nota duplicada (mesma chave) | Recusa com link para a nota existente. |
| Dois caixas gravando juntos | Transações IMMEDIATE + busy_timeout serializam; sem erro para o usuário. |
| PC servidor desligado | Caixa 2 fica sem acesso; mitigação com nobreak. |
| Validação de formulário | Mensagens no próprio campo, via resposta HTMX. |

## 11. Testes

- `pytest` + `pytest-django`, com TDD nas regras de negócio (services):
  - Estoque: saldo por movimentos, venda com estoque negativo, cancelamento.
  - Código interno: formato e dígito verificador.
  - Fiado: saldo, pagamento parcial, dias em aberto com pagamentos quitando compras antigas, estorno.
  - Fechamento: totais esperados por forma de pagamento.
  - Precificação: parser XML com arquivos de NF-e reais anonimizados em `tests/fixtures/`, vínculo automático, fator de conversão, fechamento da nota.
  - Contagem: diferença aplicada.
- Views: testes de resposta para os fluxos principais.
- Playwright: venda à vista com leitura; venda no fiado até o comprovante; nota até a folha de lançamento.

## 12. Fases de entrega

1. **Fundação:** projeto Django, settings SQLite, layout base com Tailwind/HTMX/Alpine, operadores, configuração.
2. **Catálogo e estoque:** produtos, categorias, código interno, etiquetas, movimentos, ajustes, contagem, carga inicial.
3. **Caixa:** sessão de caixa, venda, cancelamento, pendências no Moderniza, fechamento. **Implantação na loja ao fim desta fase**, para começar a juntar dados reais.
4. **Fiado:** clientes, lançamentos, comprovantes, devedores, alerta.
5. **Precificação:** notas XML/manual, vínculo, preços, folha de lançamento.
6. **Relatórios e backup:** painel completo, relatórios com gráficos, backup agendado.

## 13. Pontos em aberto (não bloqueiam o início)

1. Margem: a loja pensa em markup sobre o custo (custo × 1,4) ou margem sobre a venda (custo ÷ 0,6)? Spec assume markup; troca é local em um serviço.
2. Arredondamento de preço: 2 casas, ou terminação fixa (ex.: ,90)? Spec assume 2 casas.
3. Venda a granel (kg) existe? Spec já suporta quantidade decimal.
4. Formato da exportação de produtos do Moderniza: aguardando arquivo de exemplo.
5. Modelo de folha de etiquetas: spec assume Pimaco 6180.
