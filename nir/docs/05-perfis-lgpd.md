# 05 · Perfis, permissões e LGPD

## Dois níveis de acesso

O acesso se controla em dois lugares.

1. **No app**, pela lista `PerfisUsuarios`. Define **o que a pessoa vê**: menu,
   botões do NIR e telas.
2. **No SharePoint**, pelos grupos do site. Define **o que a pessoa pode ler ou
   gravar** nas listas. Essa é a segurança de verdade: impede que alguém abra a
   lista direto no navegador e veja ou altere o que não deve.

Os dois precisam estar coerentes.

## Perfis do app

| Perfil | Quem | O que vê no app |
|---|---|---|
| `NIR` | Equipe do NIR | As 10 guias e todos os botões (inclusive Passagem de Plantão) |
| `SOLICITANTE` | Médicos assistentes e enfermeiros dos setores | **Só a Gestão de Vagas**: lista de pacientes, solicitar vaga, mudar a condição de transporte e cancelar **os próprios** pedidos |
| `PERMANENCIA` | Enfermeiros supervisores e seniores, Serviço Social, coordenadores médicos, fisioterapeutas supervisores | Gestão da Permanência e Previsões de Alta (registra previsões, flags e tópicos do Kanban) |
| `VISUALIZACAO` | Diretoria, coordenações, qualidade | Principal, Vagas, Metas, Previsões, Permanência, Ambulâncias, Cateterismos e Recepção, só leitura |

Quem não está cadastrado entra como `SOLICITANTE`. O padrão pode ser trocado em
`gPerfilPadrao` (App.Formulas).

## Grupos do site SharePoint

O proprietário do site cria e gerencia os grupos sem precisar da TI.

**Criar os grupos:**
1. Vá em **⚙ > Permissões do site > Configurações de permissão avançadas** e clique
   em **Criar Grupo**.
2. Crie os quatro grupos:
   - `NIR – Equipe`
   - `NIR – Solicitantes`
   - `NIR – Permanência`
   - `NIR – Visualização`

**Quebrar a herança de permissões em cada lista:**
1. Na lista, vá em **⚙ > Configurações da lista > Permissões para esta lista**.
2. Clique em **Parar Herança de Permissões**.
3. Ajuste as permissões conforme a tabela.

| Lista | NIR – Equipe | NIR – Solicitantes | NIR – Permanência | NIR – Visualização |
|---|---|---|---|---|
| `Setores` · `PerfisUsuarios` · `CensoResumo` · `IndicadoresDiarios` | Editar | Ler | Ler | Ler |
| `Internacoes` | Editar | Ler | **Colaborar** ¹ | Ler |
| `SolicitacoesVaga` · `EventosVaga` | Editar | **Colaborar** | Ler | Ler |
| `Importacoes` · `Movimentacoes` | Editar | — | — | Ler |
| `PrevisoesAlta` · `PermanenciaAcompanhamento` · `PermanenciaTopicos` | Editar | — | **Colaborar** | Ler |
| `Transportes` · `Cateterismos` · `Recepcoes` · `PassagensPlantao` | Editar | — | — | Ler |
| `MetasIndicadores` · `MetasValores` | Editar | — | — | Ler |

¹ A equipe da Permanência precisa gravar a **previsão de alta** em `Internacoes`. O
app só altera as colunas de previsão. Se a coordenação preferir que esse grupo não
tenha escrita nessa lista, dá para trocar por um fluxo que copia a previsão da lista
`PrevisoesAlta`. Me peça essa mudança.

- **Colaborar** = adicionar, editar e excluir itens.
- **Editar** = colaborar e também gerenciar a lista.
- "—" = sem acesso.

> **Ponto de atenção:** com "Colaborar" em `SolicitacoesVaga`, um solicitante
> tecnicamente consegue editar pedidos de outros se abrir a lista direto no
> navegador. O app não permite. Para auditoria, a lista tem **versionamento**
> ativado, e todo clique no app também fica gravado em `EventosVaga`. Se for preciso
> blindar mais, a fase 5 prevê mover a gravação para um fluxo que roda com conta
> de serviço.

**Adicionar pessoas:** abra o grupo e clique em **Novo > Adicionar usuários**. Para
grupos grandes, como todos os enfermeiros, adicione um grupo do Microsoft 365 ou do
Teams que já exista.

## LGPD — boas práticas adotadas

| Princípio | Como o projeto atende |
|---|---|
| **Dados dentro da instituição** | Tudo fica no Microsoft 365 do próprio hospital (SharePoint), já coberto pelos contratos e políticas institucionais com a Microsoft. Nenhum dado vai para serviços externos |
| **Necessidade / minimização** | O app grava só as colunas úteis à regulação (atendimento, prontuário, nome, leito, datas, médico, convênio, diagnóstico). Colunas do Ctrl+E que não estão no mapa de colunas são **descartadas** |
| **Controle de acesso** | Login institucional obrigatório + grupos do SharePoint por função (tabela acima) |
| **Rastreabilidade** | `EventosVaga` (cada ação com autor e hora), `Importacoes` (cada arquivo com autor e o original anexado), `Movimentacoes` e o versionamento do SharePoint |
| **Finalidade** | Uso restrito à gestão de leitos, fluxo e permanência (Núcleo Interno de Regulação) |

**Recomendações:**
1. **Comunique o Encarregado de Dados (DPO)** do hospital sobre o projeto. Leve este
   documento e o [modelo de dados](01-modelo-de-dados.md). A TI não precisa operar
   nada, mas a governança de dados deve saber que o repositório existe.
2. **Retenção:** defina com o DPO e a Qualidade por quanto tempo manter os anexos de
   `Importacoes`. Sugestão: 1 ano para os anexos. Os dados consolidados
   (`CensoResumo`, `IndicadoresDiarios`) podem ficar por prazo maior.
3. **Exportações:** quem exportar listas para Excel deve tratar o arquivo como
   documento com dados de pacientes. Não envie por e-mail externo nem salve em
   dispositivo pessoal.
4. **TV da sala do NIR:** a tela Principal **não mostra nomes de pacientes**, com
   exceção do bloco "maiores esperas". Se a TV estiver em local de circulação, peça
   para eu criar uma versão do Modo TV que mostre só as iniciais.
5. **Contas desligadas:** ao desligar um profissional, remova-o dos grupos e marque
   `Ativo = Não` em `PerfisUsuarios`.
