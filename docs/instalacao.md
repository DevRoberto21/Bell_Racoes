# Instalação do sistema de fiado

O sistema roda no computador central (caixa 1). O caixa 2 só precisa de um navegador.

## Caixa 1 (servidor)

1. Abra https://github.com/DevRoberto21/Bell_Racoes/releases e baixe `BellRacoes-Setup.exe` da versão mais recente.
2. Dê dois cliques no arquivo. O Windows pode mostrar a tela azul "O Windows protegeu o computador": clique em **Mais informações** e depois em **Executar assim mesmo**. O aviso aparece porque o instalador não tem assinatura paga; ele é o mesmo arquivo gerado a partir deste repositório.
3. Aceite o pedido de permissão de administrador e clique em **Avançar** até **Concluir**.

O instalador:

- copia o sistema para `C:\BellRacoes`;
- cria o atalho **Bell Rações** na área de trabalho e no menu Iniciar;
- cria o atalho **Trocar senhas** no menu Iniciar;
- faz o sistema abrir junto com o Windows;
- libera a porta 8000 no Firewall do Windows, só para rede privada.

Depois, uma vez só:

- fixe o endereço IP do caixa 1 no roteador (por exemplo `192.168.0.10`);
- no caixa 1, deixe a rede da loja como rede privada: Configurações → Rede e Internet → propriedades da conexão → Perfil de rede: **Particular** (Rede privada). A porta 8000 só é liberada para rede privada; se o Windows marcar a rede como pública, o caixa 2 não consegue abrir o sistema.

### Se o caixa 1 já usava o iniciar.bat

Se o sistema já estava instalado do jeito antigo (com o `iniciar.bat`), faça isto ANTES de instalar:

1. Feche a janela preta do sistema.
2. Aperte `Win + R`, digite `shell:startup` e apague o atalho do `iniciar.bat`.
3. Rode o instalador normalmente.

Os dados em `C:\BellRacoes\dados` são mantidos e as senhas dos caixas continuam as mesmas: os usuários já existem no banco, então a janela não pede senha na primeira abertura.

### Primeira abertura

Na primeira vez, a janela preta do sistema pede a senha do `caixa1` (Flávia) e do `caixa2` (Marcineide).

- Ao digitar a senha, nada aparece na tela. Digite e aperte Enter.
- Cada senha é pedida duas vezes. Se as duas não forem iguais, o sistema pergunta de novo.

Em seguida o navegador abre no sistema. A janela preta precisa ficar aberta enquanto a loja estiver funcionando: fechá-la desliga o sistema.

### Trocar ou recuperar uma senha

No menu Iniciar, abra **Bell Rações → Trocar senhas** e responda às mesmas perguntas. Não é preciso saber a senha antiga, então isso serve também para senha esquecida. Só funciona no caixa 1.

## Atualizar o sistema

1. Baixe o `BellRacoes-Setup.exe` da versão nova na página Releases.
2. Dê dois cliques e avance até o fim. O instalador fecha o sistema, troca os arquivos e mantém a pasta `C:\BellRacoes\dados` como está.
3. Abra o sistema pelo atalho.

Nunca apague a pasta `C:\BellRacoes\dados` nem copie outra por cima dela: ela guarda o banco da loja. Desinstalar o sistema também não a remove.

## Navegador (os dois caixas)

- No caixa 1, o sistema abre o Chrome sozinho em `http://localhost:8000`, já com impressão sem janela de confirmação. Isso só vale se o Chrome estava fechado antes de abrir o sistema. Sem Chrome instalado, abre o navegador padrão. Se a janela de confirmação da impressão ainda aparecer, desligue a opção "Continuar executando aplicativos em segundo plano quando o Google Chrome estiver fechado" nas configurações do Chrome (Sistema), porque um Chrome que ficou rodando em segundo plano faz o sistema ignorar a impressão sem janela.
- No caixa 2, crie um atalho do Chrome com:

  ```
  "C:\Program Files\Google\Chrome\Application\chrome.exe" --kiosk-printing http://192.168.0.10:8000
  ```

  Troque `192.168.0.10` pelo IP do caixa 1.
- No Windows, deixe a impressora térmica de 80 mm como impressora padrão de cada caixa.
- As notas e os recibos abrem em nova aba para imprimir; libere pop-ups para o endereço do sistema quando o Chrome perguntar.

## Dados da loja no impresso

A nota e o recibo saem com o nome `Bell Rações` e o endereço `Rua Coronel Antônio Vicente, 134, Centro, Timbaúba`.

Para mudar sem trocar de versão, abra o Prompt de Comando no caixa 1 e rode, com o texto novo:

```bat
setx BELL_LOJA_ENDERECO "Rua Nova, 10, Centro, Timbaúba"
setx BELL_LOJA_NOME "Bell Rações"
```

Depois feche a janela preta do sistema e abra de novo pelo atalho.

## Onde ficam os dados

- Banco: `C:\BellRacoes\dados\bellracoes.sqlite3`.
- Cópias de segurança: `C:\BellRacoes\dados\backups\`, uma por dia, últimas 30.
- As cópias ficam, por padrão, no mesmo disco do banco. Se o disco estragar, perde-se tudo. Para gravar em um pen drive ou numa pasta sincronizada (Google Drive), abra o Prompt de Comando e rode:

  ```bat
  setx BELL_BACKUP_DIR "E:\backups-bell"
  ```

  Depois feche a janela preta do sistema e abra de novo.
- Se a cópia do dia falhar, o Painel mostra um aviso em vermelho.

### Como restaurar uma cópia

Faça isto só se o banco atual estiver perdido ou estragado. Tudo o que foi lançado depois da cópia escolhida se perde.

1. Feche a janela preta do sistema.
2. Abra a pasta `C:\BellRacoes\dados`.
3. Renomeie `bellracoes.sqlite3` para `bellracoes-estragado.sqlite3`. Assim o arquivo atual fica guardado.
4. Apague os arquivos `bellracoes.sqlite3-wal` e `bellracoes.sqlite3-shm`, se existirem.
5. Abra a pasta `backups`, copie o arquivo do dia desejado (por exemplo `bellracoes-2026-10-05.sqlite3`) e cole na pasta `dados`. Se a variável `BELL_BACKUP_DIR` foi configurada, o arquivo precisa vir da pasta indicada nela, e não de `dados\backups`: as cópias de `dados\backups` pararam no dia em que a variável foi configurada, e restaurar uma delas descarta tudo o que foi lançado desde então.
6. Renomeie a cópia colada para exatamente `bellracoes.sqlite3`.
7. Abra o sistema pelo atalho e confira as notas de um cliente conhecido.

## Rede

O sistema não tem proteção para rede aberta. Use só na rede interna da loja. Não libere a porta 8000 no roteador para a internet e não deixe os caixas na mesma rede Wi-Fi oferecida a clientes.

## Antes de usar de verdade

- [ ] Instalar no computador da loja e passar pela primeira abertura.
- [ ] Conferir se o nome e o endereço da loja, com acentos, aparecem certos numa nota impressa.
- [ ] Imprimir uma nota e um recibo na impressora térmica, sem janela de confirmação.
- [ ] Reiniciar o caixa 1 e conferir que o sistema abre sozinho.
- [ ] Abrir o sistema a partir do caixa 2. Se não abrir, confira se a rede do caixa 1 está como rede privada.
- [ ] Abrir uma nota, receber um pagamento e conferir que o recibo abre em nova aba.
- [ ] Instalar a mesma versão por cima e conferir que os clientes e as notas continuam lá.

## Para quem desenvolve

Rodar na máquina de desenvolvimento (precisa de `uv` e de Node 20 ou mais novo):

```bash
npm --prefix frontend ci
npm --prefix frontend run build
uv run python iniciar.py
```

`uv run python iniciar.py criar_caixas` define as senhas; `uv run python manage.py <comando>` continua funcionando.

### Publicar uma versão

O instalador é gerado pelo GitHub Actions (`.github/workflows/build-windows.yml`) num computador Windows do GitHub. Para publicar:

```bash
git tag v1.0.0
git push origin v1.0.0
```

Em alguns minutos o `BellRacoes-Setup.exe` aparece na página Releases. O workflow roda os testes, empacota com o PyInstaller, sobe o executável de verdade num teste de fumaça e só então gera o instalador.

Arquivos do empacotamento, em `empacotamento/`:

- `BellRacoes.spec`: receita do PyInstaller.
- `instalador.iss`: script do Inno Setup (UTF-8 com BOM).
- `bell.ico`: ícone, gerado por `gerar_icone.py` a partir de `frontend/public/favicon.svg`.
- `teste_de_fumaca.py`: confere que o pacote sobe e responde.
