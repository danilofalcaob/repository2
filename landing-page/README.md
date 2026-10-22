# Landing page — Dr. Danilo Falcão

Página única (landing page) focada em **gerar agendamentos pelo WhatsApp** para o
consultório do Dr. Danilo Falcão (Vila da Serra, Nova Lima/MG).

É um site estático: HTML, CSS e JavaScript puros, sem dependências nem build. Fica
leve e carrega rápido no celular, e pode ser hospedado em qualquer lugar (Wix,
Vercel, Netlify, Cloudflare Pages, Hostinger…).

```
landing-page/
├── index.html                  # a landing page
├── politica-de-privacidade.html
└── assets/
    ├── css/styles.css
    ├── js/config.js            # ← ÚNICO arquivo que você precisa editar
    ├── js/main.js
    └── img/                    # favicon, imagem de compartilhamento e fotos
```

Para visualizar no computador: `npx serve landing-page` e abra o endereço que aparecer.

---

## Diagnóstico

O site **drdanilofalcao.com.br** e a referência **bravomagistral.com.br** não
puderam ser abertos a partir do ambiente onde esta página foi construída (bloqueio
de rede). Por isso o diagnóstico partiu do site **"Dr. Danilo Falcão" na conta
Wix**, de onde vieram os dados reais usados na página:

| O que foi encontrado no Wix | Situação | O que fazer |
|---|---|---|
| Status do site | Rascunho (não publicado), plano gratuito | Publicar esta landing page como site principal |
| Telefone / WhatsApp / e-mail | **Não cadastrados** | Preencher em `config.js` (e nas Informações do negócio do Wix) |
| Serviços do Wix Bookings | 3 serviços, com preços em **USD** (150 / 120 / 100) | Corrigir para BRL ou ocultar o preço |
| Fotos / logotipo | Biblioteca de mídia vazia | Fazer fotos profissionais (ver checklist) |
| Blog | Nenhum post | Opcional: conteúdo educativo ajuda no SEO local |
| Descrição e endereço | Preenchidos | Usados na página |

O estilo da referência foi seguido pelo padrão de landing page de alta conversão:
página única, CTA de WhatsApp repetido em todas as seções, botão flutuante, barra
fixa no celular, quebra de objeções e prova de confiança. Se quiser uma fidelidade
maior ao visual da Bravo Magistral, envie prints da página.

## Estrutura da página (funil)

1. **Hero** — promessa clara (emagrecimento e performance com acompanhamento
   médico), CTA principal de WhatsApp e três selos de confiança.
2. **Pilares** — as três frentes de atuação em uma faixa.
3. **"Você se identifica?"** — dores do paciente e virada ("não é falta de força
   de vontade, é falta de um plano").
4. **Tratamentos** — as 3 consultas cadastradas no Wix, cada uma com CTA e
   mensagem de WhatsApp própria (você já sabe qual serviço o paciente quer).
5. **Como funciona** — 4 passos que tiram a incerteza do primeiro contato.
6. **Diferenciais** — por que escolher o Dr. Danilo.
7. **Sobre** — foto, apresentação, formação e CRM/RQE.
8. **Depoimentos** — só aparece quando houver depoimentos reais em `config.js`.
9. **Formulário** — nome, WhatsApp e objetivo: abre o WhatsApp com a mensagem
   pronta e (opcional) envia o lead para uma planilha/CRM.
10. **Dúvidas frequentes** — quebra de objeções (plano de saúde, exames, prazo…).
11. **Localização** — mapa, endereço, Google Maps e Waze.
12. **CTA final** e rodapé com responsável técnico e aviso legal.

## Checklist antes de publicar

- [ ] **`assets/js/config.js`**: `whatsapp` (DDI+DDD+número, ex. `5531999999999`)
      e `crm`. Enquanto estiverem vazios, aparece uma faixa amarela de aviso no
      topo e os botões levam ao formulário.
- [ ] `rqe`: só se houver especialidade registrada. Sem RQE, não anuncie
      especialidade (ex.: "nutrólogo"); o título padrão é "Médico".
- [ ] `credenciais`: formação e experiência para a seção "Sobre".
- [ ] **Fotos** em `assets/img/` (enquanto não existirem, aparece o monograma "DF"):
  - `dr-danilo-falcao.jpg` — retrato vertical para o topo (≈1120×1400 px);
  - `dr-danilo-falcao-sobre.jpg` — foto no consultório (≈1040×1240 px).
  Uma foto profissional e real é o item que mais aumenta a confiança na página.
- [ ] Revisar os textos (`index.html`) e ajustar o que não refletir o atendimento
      (ex.: se houver teleconsulta, citar na FAQ).
- [ ] Opcional: `instagram`, `email`, `googleReviewsUrl`, `depoimentos`.
- [ ] Opcional: `ga4Id` e `metaPixelId` para medir conversões de anúncios.
- [ ] Opcional: `leadWebhookUrl` para salvar cada lead (veja abaixo).
- [ ] Corrigir no Wix os preços dos serviços em USD.

## Publicidade médica e LGPD

- Nome, CRM (e RQE, quando houver especialidade) aparecem no rodapé e na seção
  "Sobre", como pede a Resolução CFM nº 2.336/2023.
- Os textos não prometem resultados e trazem o aviso "os resultados variam de
  pessoa para pessoa".
- Depoimentos: use apenas depoimentos reais, com autorização por escrito do
  paciente, e confirme as regras vigentes do CFM/CRM-MG antes de publicar.
- O formulário pede consentimento explícito e há uma política de privacidade
  (`politica-de-privacidade.html`). Revise-a com quem cuida da LGPD do consultório.

## Medição de conversões

Com `ga4Id` e/ou `metaPixelId` preenchidos, a página envia:

| Evento | Quando | Meta Pixel |
|---|---|---|
| `whatsapp_click` | clique em qualquer botão de WhatsApp (parâmetro `cta_location` diz qual) | `Contact` |
| `form_start` | começou a preencher o formulário | — |
| `generate_lead` | enviou o formulário | `Lead` |
| `outbound_click` | clique em Google Maps / Waze | — |

Todos também vão para `window.dataLayer`, então funcionam com o Google Tag Manager.
Parâmetros de campanha (`utm_*`, `gclid`, `fbclid`) são guardados durante a visita
e enviados junto com o lead.

## Salvando os leads (opcional)

Se `leadWebhookUrl` estiver preenchido, cada envio do formulário faz um `POST`
(`application/x-www-form-urlencoded`) para essa URL com os campos `nome`,
`telefone`, `objetivo`, `mensagem`, `pagina`, `data` e, quando houver, os
parâmetros de campanha. Funciona com Make, Zapier, n8n, RD Station ou um Google
Apps Script ligado a uma planilha. Assim nenhum lead se perde, mesmo que a pessoa
não envie a mensagem no WhatsApp.

## Como publicar

Qualquer hospedagem de site estático serve: basta enviar o conteúdo desta pasta.

- **Wix**: dá para enviar estes arquivos como um site no Wix; peça ao Claude para
  fazer o upload na sua conta.
- **Vercel / Netlify / Cloudflare Pages** (gratuitos): crie um projeto apontando
  para a pasta `landing-page` deste repositório, sem comando de build.

Depois, aponte o domínio `drdanilofalcao.com.br` para a hospedagem escolhida
(configuração de DNS no Registro.br ou onde o domínio estiver registrado).
