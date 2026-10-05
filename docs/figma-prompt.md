Protótipo desktop (1366×768, pt-BR) do "Bell Rações – Sistema Auxiliar": controle de estoque físico, caixa e fiado de uma loja de rações. Uso no Chrome, 2 caixas, teclado e leitor de código de barras. Sem login/permissões; operador escolhido pelo nome.

Estilo: limpo, alto contraste, fonte 16px, totais grandes. Cinzas + verde nas ações, vermelho dívidas/alertas, amarelo avisos. Barra lateral fixa; Caixa em tela cheia. Componentes simples (Django+HTMX). Incluir estados vazio/erro/sucesso.

Telas:
1. Abertura de caixa: operador, Caixa 1/2, troco inicial.
2. Painel: alertas (estoque baixo, fiado >7 dias, notas e vendas pendentes no Moderniza), vendas do dia por pagamento.
3. Caixa: campo de leitura sempre focado, carrinho, total grande, pagamento (Dinheiro/Pix/Cartão/Fiado), troco, checkbox "Pendente no Moderniza", atalhos F2/F4/F6/F9/Esc.
4. Modal fiado: buscar/criar cliente (nome, telefone), saldo atual.
5. Comprovante 80mm, 2 vias: itens, total, saldo anterior/atual, linha de assinatura.
6. Devedores: saldo, dias em aberto (>7 em vermelho), último pagamento.
7. Conta do cliente: extrato, pagamento parcial, recibo.
8. Produtos: lista com filtros (sem NF, estoque baixo), badges "Sem NF"/"Código interno".
9. Produto: dados, botão "Gerar código interno", abas Movimentações e Preços.
10. Etiquetas: folha A4 adesiva com nome, preço, código de barras.
11. Contagem: leitura contínua, sistema × contado × diferença.
12. Precificação: notas com status (Em precificação / Pendente de lançar / Lançada); nova via XML ou digitação.
13. Precificar nota: por item custo, custo anterior ↑↓, margem %, preço atual e final, histórico lateral.
14. Folha de lançamento: A4/Excel na ordem da nota, "Marcar lançada".
15. Fechamento de caixa: sistema × maquininha × gaveta, diferença.
16. Relatórios: período, top 10 mais vendidos, vendas por dia/pagamento/categoria.

Dados realistas (ex.: "Ração Golden 15kg"). Prototipe: venda à vista, venda fiado com comprovante, nota até lançamento.