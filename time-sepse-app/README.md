# Time Sepse App

Aplicativo web para os membros das equipes de **Código Sepse**: quando o
protocolo é aberto, cada membro do time cumpre e **registra suas etapas com
dia e horário**, o médico calcula o **SOFA-score** a partir dos resultados dos
exames e, ao final, o atendimento gera um **relatório completo para auditoria**
do líder/gestor do Time Sepse.

> ⚠️ **Aviso (LGPD/CFM):** ferramenta de registro operacional do protocolo
> institucional. Não substitui o julgamento clínico nem o prontuário do
> paciente. Utilize dados reais apenas conforme as políticas institucionais.

---

## Como executar

Não há dependências nem build — é HTML/CSS/JavaScript puro:

```bash
# opção 1: abrir diretamente
abra time-sepse-app/index.html no navegador (Chrome, Edge, Firefox, Safari)

# opção 2: servir localmente
cd time-sepse-app
python3 -m http.server 8080   # http://localhost:8080
```

Os dados ficam salvos no navegador (`localStorage`) do dispositivo — ideal para
um tablet ou computador compartilhado no posto de enfermagem. Use os botões de
exportação (JSON/CSV) para levar os registros à auditoria/planilhas.

---

## O time e suas etapas

Cada membro **faz login no time ao iniciar o turno/plantão** (aba **Equipe**) —
a entrada e a saída ficam registradas com dia e horário. Cada etapa tem um
botão **“Concluir etapa”**: ao apertá-lo, o registro é feito com **data,
horário e responsável**.

| Membro | Etapas |
|---|---|
| **Médico** | Avaliação inicial do caso · Prescrição dos exames (Kit Sepse + adicionais) · Prescrição da antibioticoterapia · Ressuscitação volêmica *(quando indicado)* · Norepinefrina *(quando indicado)* · Avaliação dos resultados dos exames · Reavaliação do caso (status volêmico/hemodinâmico) |
| **Enfermeiro / Técnico de Enfermagem** | Coleta dos exames do Kit Sepse (culturas/hemoculturas + lactato arterial) · Monitorização · Instalação da antibioticoterapia · Coleta do 2º lactato *(quando indicado)* |
| **Analista do Laboratório** | Recebimento dos exames · Liberação do lactato arterial (**meta: 30 min**) · Liberação dos demais exames, exceto culturas (**meta: 2 h**) |
| **Fisioterapeuta** | Suporte ventilatório *(quando indicado)* |
| **Líder/Gestor** | Auditoria dos atendimentos, indicadores e exportação |

Etapas *(quando indicado)* também podem ser marcadas como **“Não indicada”**.
Registros podem ser desfeitos enquanto o protocolo está aberto — a correção
fica gravada na trilha do atendimento (nada é apagado do histórico).

### Metas de tempo monitoradas

- **Lactato arterial liberado em até 30 min** (a partir do recebimento no laboratório);
- **Demais exames em até 2 h** (exceto culturas);
- **Antibiótico instalado na 1ª hora** do protocolo (meta do pacote).

Cada etapa concluída exibe se ficou **dentro ✓** ou **fora ⚠** da meta, e o
painel de auditoria consolida os percentuais.

---

## SOFA-score

Na aba **SOFA-score**, o médico insere apenas os resultados dos exames
(PaO₂/FiO₂, plaquetas, bilirrubina, PAM/vasoativos, Glasgow, creatinina/diurese)
e o sistema gera a pontuação (0–24) com o detalhamento por sistema:

- **SOFA < 2** → **Sepse excluída** (infecção sem sepse ou causas não infecciosas);
- **SOFA ≥ 2** → **Sepse**;
- **Norepinefrina registrada** na etapa do médico → **Choque Séptico**.

O cálculo é registrado no protocolo com dia, horário e médico responsável
(recalcular é permitido — todas as versões ficam no histórico).

---

## Encerramento e auditoria

Ao encerrar o protocolo (médico ou líder/gestor), o app registra o desfecho e
gera o **relatório do atendimento**: identificação, todas as etapas com
responsável/horário/meta, histórico de SOFA, equipe participante e a **trilha
completa de eventos**. O relatório pode ser **impresso/salvo em PDF** e
**exportado em JSON**.

A aba **Auditoria** (acesso do líder/gestor) reúne:

- indicadores: protocolos, encerrados, choque séptico, % antibiótico na 1ª hora,
  % lactato ≤ 30 min, % demais exames ≤ 2 h;
- tabela de todos os atendimentos com acesso ao relatório;
- registro de plantões (entrada/saída de cada membro);
- exportação **CSV** (uma linha por atendimento, com horário e responsável de
  cada etapa) e **JSON** completo.

---

## Estrutura

```
time-sepse-app/
  index.html        página única (SPA)
  css/styles.css    estilos (mobile-first, tema claro, impressão)
  js/dominio.js     regras puras: SOFA, classificação, etapas, metas (UMD)
  js/app.js         interface, persistência (localStorage), exportação
  tests/            testes das regras críticas (node --test, sem dependências)
```

## Testes

```bash
node --test time-sepse-app/tests/dominio.test.cjs
```

Cobrem todas as faixas do SOFA por sistema (respiratório, coagulação, hepático,
cardiovascular, neurológico, renal), a classificação (sepse excluída / sepse /
choque séptico) e as metas de tempo do laboratório e do antibiótico.
