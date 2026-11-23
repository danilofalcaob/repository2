# 00 · Verificação do ambiente (Fase 0)

Objetivo: confirmar, **sem precisar da TI**, que a sua conta do hospital consegue
criar tudo o que o projeto usa. Leva cerca de 30 minutos.

Use o **Edge** ou o **Chrome**, logado com a sua conta institucional Microsoft.

---

## 1. Power Apps: criar um aplicativo de tela

1. Abra **make.powerapps.com**.
2. No menu da esquerda, clique em **+ Criar**.
3. Em **"Começar pelo design"**, clique no cartão **"Criar do zero"**, o que tem a
   etiqueta **Canvas app**. É o primeiro cartão da primeira linha.

   > Não use os cartões marcados como **Model driven app** nem os de **Dataverse**:
   > eles exigem licença *premium*. O projeto usa só o aplicativo de tela.
4. Se pedir nome e formato, digite qualquer nome (ex.: "Teste NIR") e escolha
   **Tablet**.
5. **Resultado esperado:** abre o editor (Power Apps Studio) com uma tela em branco.

Se abrir, está tudo certo: feche sem salvar. Se aparecer uma mensagem de licença ou
de bloqueio, tire um print e me envie. Nesse caso será preciso falar com a TI.

## 2. Power Automate: criar um fluxo agendado

1. Abra **make.powerautomate.com**.
2. Clique em **+ Criar** e depois em **Fluxo da nuvem agendado**.
3. **Resultado esperado:** abre a tela para dar nome e escolher o horário do fluxo.

Feche sem salvar.

## 3. Site do SharePoint do NIR

O site guarda as listas com os dados. Escolha **uma** das opções:

- **Opção A, site do SharePoint:** abra `https://SEUTENANT.sharepoint.com`, clique
  em **+ Criar site** e escolha **Site de equipe**. Nome: **NIR – Command Center**.
  Privacidade: **Privado**.
- **Opção B, uma equipe no Teams** (se a opção A não aparecer): no Teams, vá em
  **Equipes > Criar equipe > Do zero > Privada**, com o nome **NIR – Command Center**.
  O Teams cria um site do SharePoint junto. Para abri-lo, entre na equipe, vá à aba
  **Arquivos** e clique em **Abrir no SharePoint**.

Anote o endereço do site, por exemplo `https://SEUTENANT.sharepoint.com/sites/NIR-CommandCenter`.
Ele será usado no script das listas e no app.

**Você precisa ser proprietário do site.** Quem cria o site já é proprietário.

## 4. Fuso horário do site

Os cronômetros e as rotinas dependem do horário certo.

1. No site, clique na **engrenagem ⚙** e depois em **Informações do site > Exibir
   todas as configurações do site**. Em sites mais novos, o caminho é **Configurações
   do site**.
2. Em **Administração do Site**, abra **Configurações regionais**.
3. Fuso horário: **(UTC-03:00) Brasília**. Localidade: **Português (Brasil)**.
   Formato de hora: **24 horas**. Clique em **OK**.

## 5. Teste do console do navegador (para o script das listas)

1. Na página inicial do site, pressione **F12** e abra a aba **Console**.
2. Digite `1+1` e pressione Enter. Deve aparecer `2`.
   - Se o navegador pedir, digite `allow pasting` e pressione Enter. A partir daí
     ele aceita colar código.
   - Se o F12 estiver bloqueado pela política do hospital, sem problema: as listas
     podem ser criadas manualmente ([01-modelo-de-dados.md](01-modelo-de-dados.md),
     opção B).

## 6. Amostra do Ctrl+E do Tasy (sem dados de paciente)

Para eu conferir se os nomes das colunas batem com o que o app reconhece:

1. No Tasy, entre em um setor, por exemplo a UTI, e pressione **Ctrl+E**.
2. Abra o arquivo no Excel.
3. Tire um print **só da linha de cabeçalho**, a linha com os nomes das colunas.
   Cubra ou corte qualquer linha com dados de paciente.
4. Me envie o print. Ele serve para ajustar a lista de sinônimos de colunas
   (`tblMapaColunas` em `App.Formulas`).

O app procura sozinho a linha de cabeçalho. As colunas reconhecidas hoje são:
- **Obrigatórias:** Atendimento, Paciente, Leito e Data de internação.
- **Opcionais:** Prontuário, Médico, Especialidade, Convênio, Diagnóstico, Idade,
  Sexo, Setor e Previsão de alta.

---

## Checklist da Fase 0

- [ ] O Power Apps abre o editor em **Criar do zero (Canvas app)**
- [ ] O Power Automate abre a criação de **Fluxo da nuvem agendado**
- [ ] O site **NIR – Command Center** foi criado e você é proprietário
- [ ] O fuso do site está em **(UTC-03:00) Brasília**
- [ ] O console do navegador funciona (ou vai usar a criação manual das listas)
- [ ] O print do cabeçalho do Ctrl+E foi enviado

Próximo passo: [01-modelo-de-dados.md](01-modelo-de-dados.md), criar as listas.
