# Site — Dr. Danilo Falcão

Landing page premium, focada em conversão de leads via WhatsApp, para substituir o site atual em `www.drdanilofalcao.com.br`.

É um único arquivo estático (`index.html`), sem dependências de build — funciona em qualquer hospedagem (Vercel, Netlify, Hostinger, cPanel etc.).

## O que otimiza a conversão

- **CTA único e claro**: todos os botões levam ao WhatsApp com mensagem pré-preenchida diferente por seção (dá para saber de onde veio o lead).
- **CTA sempre visível**: botão no menu fixo, botão flutuante de WhatsApp e barra fixa no rodapé do celular.
- **Funil na ordem certa**: dor → especialidades → método → autoridade → prova social → objeções (FAQ) → localização → CTA final.
- **FAQ que destrói objeções**: convênio/reembolso, online vs. presencial, prazo de resultado, medicamentos.
- **SEO**: meta tags, Open Graph e dados estruturados (schema.org/Physician) com os dois endereços.
- **Design premium**: paleta verde-escuro + dourado, tipografia serifada (Fraunces) + Inter, mobile-first.

## Antes de publicar — personalizar

Busque por `[inserir]` e `Substituir` no `index.html`:

1. **Fotos**: trocar os placeholders do hero e da seção "Sobre" por fotos profissionais (retrato e consultório). Os comentários no HTML indicam o ponto exato.
2. **CRM-SP / RQE**: obrigatório em publicidade médica (seção "Sobre" e rodapé).
3. **Depoimentos**: os três cards são exemplos ilustrativos marcados no texto — substituir por depoimentos reais e autorizados por escrito pelos pacientes, conforme a resolução do CFM vigente.
4. **Instagram**: inserir o @ correto no rodapé.
5. **Números do WhatsApp**: conferir (11) 97833-2820 (Santana) e (11) 99000-2020 (Alpha Doctors) — foram extraídos do site atual.

## Publicação

- **Vercel/Netlify**: aponte o projeto para a pasta `site/` (output estático).
- **Hospedagem tradicional**: suba o `index.html` para a raiz pública do domínio.
- Manter a página `/politica-privacidade` existente (o rodapé aponta para ela).

## Próximos passos recomendados

- Instalar Meta Pixel + Google Analytics 4 para medir cliques nos CTAs.
- Criar variações da página para campanhas (ex.: `/emagrecimento`) reaproveitando as seções.
- Google Business Profile atualizado para as duas unidades, linkado ao site.
