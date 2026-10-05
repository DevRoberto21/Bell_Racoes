# Instalação do sistema de fiado

O sistema roda no computador central (caixa 1). O caixa 2 só precisa de um navegador.

## Caixa 1 (servidor)

1. Instale o `uv`: https://docs.astral.sh/uv/getting-started/installation/
2. Copie a pasta do projeto para `C:\BellRacoes`.
3. Abra o Prompt de Comando nessa pasta e rode:

   ```bat
   uv sync --no-dev
   uv run python manage.py migrate
   uv run python manage.py criar_caixas
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

## Dados da loja no impresso

Antes de rodar `iniciar.bat`, defina as variáveis de ambiente do Windows:

| Variável | Exemplo |
| --- | --- |
| `BELL_LOJA_NOME` | Bell Rações |
| `BELL_LOJA_ENDERECO` | Rua Exemplo, 123 |
| `BELL_LOJA_TELEFONE` | (85) 99999-0000 |

## Onde ficam os dados

- Banco: `C:\BellRacoes\dados\bellracoes.sqlite3`.
- Cópias de segurança: `C:\BellRacoes\dados\backups\`, uma por dia, últimas 30. Para gravar em outro lugar (pen drive, pasta do Google Drive), defina `BELL_BACKUP_DIR`.
- Para restaurar: feche a janela do `iniciar.bat`, copie o arquivo do dia desejado por cima de `bellracoes.sqlite3` e abra o `iniciar.bat` de novo.
