# Time Sepse App — modo integrado (equipe sincronizada em tempo real)

No **modo integrado**, os registros moram num servidor central: cada membro da
equipe abre a **mesma URL no seu celular** e todos veem os mesmos protocolos,
etapas e plantões, atualizados automaticamente a cada ~3 segundos. O topo da
tela mostra **“☁ equipe sincronizada”** quando o aparelho está conectado.

Há duas formas de ter esse servidor — escolha uma:

| | Opção A — Nuvem (Vercel) | Opção B — Computador do hospital |
|---|---|---|
| Custo | Gratuito (planos hobby) | Gratuito |
| Acesso | Qualquer lugar (internet/4G) | Somente na rede Wi-Fi local |
| Exige | Conta no GitHub + Vercel + Neon | Um computador ligado com Node.js |
| Dados ficam | No banco Postgres da nuvem | No próprio computador |

> ⚠️ **LGPD:** em qualquer opção, defina o **PIN da equipe** (abaixo) e trate
> com a instituição a política para dados reais de pacientes.

---

## Opção A — Publicar na nuvem (Vercel + banco Neon) — ~15 minutos

Você fará isso uma única vez, pelo computador:

### 1. Banco de dados gratuito (Neon)

1. Crie uma conta em **https://neon.tech** (pode entrar com o GitHub);
2. Crie um projeto (ex.: `time-sepse`);
3. Na tela do projeto, copie a **Connection string** (começa com
   `postgresql://...`). Guarde-a — é o "endereço" do banco.

### 2. Publicar o app (Vercel)

1. Crie uma conta em **https://vercel.com** entrando com o **GitHub**;
2. Clique em **Add New → Project** e importe o repositório
   `danilofalcaob/repository2`;
3. **Importante:** em **Root Directory**, clique em *Edit* e selecione a pasta
   **`time-sepse-app`** (é ela que será publicada, não o repositório inteiro);
4. Em **Environment Variables**, adicione:
   - `POSTGRES_URL` = a connection string copiada do Neon;
   - `TIME_SEPSE_PIN` = um PIN para a equipe (ex.: `2468`) — recomendado;
5. Clique em **Deploy**.

Ao final, a Vercel mostra a URL do app (ex.: `https://time-sepse.vercel.app`).

### 3. Nos celulares da equipe

1. Cada membro abre a URL no navegador do celular;
2. Digita o **PIN da equipe** (uma vez por aparelho);
3. Opcional: no menu do navegador, toque em **“Adicionar à tela inicial”** para
   virar um ícone de app;
4. Confirme que aparece **“☁ equipe sincronizada”** no topo.

Pronto: cada um faz o login do seu plantão no próprio celular e os registros
aparecem para todos.

---

## Opção B — Computador do hospital (rede Wi-Fi local)

Requisito: um computador com **Node.js 18+** (https://nodejs.org), ligado
enquanto o app estiver em uso, na mesma rede Wi-Fi dos celulares.

```bash
cd time-sepse-app
TIME_SEPSE_PIN=2468 node server.js
# Windows (PowerShell):
#   $env:TIME_SEPSE_PIN="2468"; node server.js
```

O terminal mostra os endereços de acesso, por exemplo:

```
Acesse deste computador:  http://localhost:3080
Acesse dos celulares:     http://192.168.0.15:3080   (mesma rede Wi-Fi)
```

Cada membro abre o endereço `http://192.168...` no celular e informa o PIN.
Os registros ficam salvos em `time-sepse-app/dados/estado.json` — inclua esse
arquivo na rotina de backup da instituição.

> Dica: se o endereço não abrir no celular, verifique se o computador e os
> celulares estão na mesma rede e se o firewall permite a porta 3080.

---

## Como funciona (resumo técnico)

- O front-end é o mesmo dos outros modos; ao carregar, ele detecta o servidor
  (`GET /api/estado`) e entra no modo integrado automaticamente. Aberto como
  arquivo local, continua no modo de um aparelho só (localStorage).
- Toda ação (login de plantão, conclusão de etapa, SOFA, encerramento) é
  enviada ao servidor (`POST /api/acao`), que valida e aplica **as mesmas
  regras** do modo local (`js/acoes.js`) e devolve o estado novo.
- Os aparelhos sincronizam por *polling* leve a cada 3 s (só baixam o estado
  quando a versão muda). Conflitos são impedidos no servidor (ex.: dois
  aparelhos concluindo a mesma etapa — o segundo recebe o aviso).
- Na Vercel, o estado fica numa tabela Postgres (`time_sepse_estado`) com
  controle de versão otimista; no servidor local, em `dados/estado.json`.
- O PIN é exigido em todas as rotas da API (cabeçalho `X-Time-Sepse-Pin`).
