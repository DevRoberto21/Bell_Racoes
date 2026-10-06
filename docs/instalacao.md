# Instalação do sistema de fiado

O sistema roda no computador central (caixa 1). O caixa 2 só precisa de um navegador.

## Caixa 1 (servidor)

**Antes de copiar, na máquina de desenvolvimento (precisa de Node 20 ou mais novo):**

```bash
npm --prefix frontend ci
npm --prefix frontend run build
```

Isso gera a pasta `frontend/dist`, que precisa ir junto. A loja não precisa de Node.

1. Instale o `uv`: https://docs.astral.sh/uv/getting-started/installation/
2. Copie a pasta do projeto para `C:\BellRacoes`. Copie tudo, menos as pastas `.venv`, `dados` e `frontend/node_modules`. A pasta `dados` guarda o banco da loja: nunca copie outra por cima dela, nem ao atualizar o sistema.
3. Abra o Prompt de Comando nessa pasta e rode:

   ```bat
   uv sync --no-dev
   uv run --no-dev python manage.py migrate
   uv run --no-dev python manage.py criar_caixas
   ```

   O último comando pede a senha do `caixa1` e do `caixa2`. Rode de novo quando quiser trocar uma senha.

4. Dê dois cliques em `iniciar.bat`. A janela preta precisa ficar aberta enquanto a loja estiver funcionando.
5. Para iniciar junto com o Windows: `Win + R`, digite `shell:startup`, e coloque ali um atalho para `iniciar.bat`.
6. Fixe o endereço IP do caixa 1 no roteador (por exemplo `192.168.0.10`) e libere a porta 8000 no Firewall do Windows para a rede privada.

## Navegador (os dois caixas)

- Caixa 1 abre `http://localhost:8000`. Caixa 2 abre `http://192.168.0.10:8000`.
- Para imprimir sem a janela de confirmação, crie um atalho do Chrome com:

  ```
  "C:\Program Files\Google\Chrome\Application\chrome.exe" --kiosk-printing http://localhost:8000
  ```

  No caixa 2, troque `localhost` pelo IP do caixa 1.
- No Windows, deixe a impressora térmica de 80 mm como impressora padrão de cada caixa.
- As notas e os recibos abrem em nova aba para imprimir; libere pop-ups para o endereço do sistema quando o Chrome perguntar.

## Dados da loja no impresso

O nome, o endereço e o telefone que saem na nota e no recibo ficam no começo do arquivo `iniciar.bat`:

1. Clique com o botão direito em `iniciar.bat` e escolha **Editar**.
2. Altere o que vem depois do sinal de igual nestas três linhas, sem aspas:

   ```bat
   set BELL_LOJA_NOME=Bell Rações
   set BELL_LOJA_ENDERECO=Rua Exemplo, 123
   set BELL_LOJA_TELEFONE=(85) 99999-0000
   ```

3. Salve, feche a janela preta do sistema e abra o `iniciar.bat` de novo.

## Onde ficam os dados

- Banco: `C:\BellRacoes\dados\bellracoes.sqlite3`.
- Cópias de segurança: `C:\BellRacoes\dados\backups\`, uma por dia, últimas 30. Para gravar em outro lugar (pen drive, pasta do Google Drive), defina `BELL_BACKUP_DIR`. Para definir, acrescente uma linha `set BELL_BACKUP_DIR=E:\backups-bell` no `iniciar.bat`, junto das linhas da loja.
- As cópias ficam, por padrão, no mesmo disco do banco. Se o disco estragar, perde-se tudo. Aponte `BELL_BACKUP_DIR` para um pen drive ou uma pasta sincronizada.
- Se a cópia do dia falhar, o Painel mostra um aviso em vermelho.

### Como restaurar uma cópia

Faça isto só se o banco atual estiver perdido ou estragado. Tudo o que foi lançado depois da cópia escolhida se perde.

1. Feche a janela preta do `iniciar.bat`.
2. Abra a pasta `C:\BellRacoes\dados`.
3. Renomeie `bellracoes.sqlite3` para `bellracoes-estragado.sqlite3`. Assim o arquivo atual fica guardado.
4. Apague os arquivos `bellracoes.sqlite3-wal` e `bellracoes.sqlite3-shm`, se existirem.
5. Abra a pasta `backups`, copie o arquivo do dia desejado (por exemplo `bellracoes-2026-10-05.sqlite3`) e cole na pasta `dados`.
6. Renomeie a cópia colada para exatamente `bellracoes.sqlite3`.
7. Abra o `iniciar.bat` de novo e confira as notas de um cliente conhecido.

## Rede

O sistema não tem proteção para rede aberta. Use só na rede interna da loja. Não libere a porta 8000 no roteador para a internet e não deixe os caixas na mesma rede Wi-Fi oferecida a clientes.

## Antes de usar de verdade

- [ ] Rodar o `iniciar.bat` no computador da loja.
- [ ] Conferir se o nome da loja, com acentos, aparece certo numa nota impressa.
- [ ] Imprimir uma nota e um recibo na impressora térmica.
- [ ] Abrir o sistema a partir do caixa 2.
- [ ] Abrir uma nota, receber um pagamento e conferir que o recibo abre em nova aba.
