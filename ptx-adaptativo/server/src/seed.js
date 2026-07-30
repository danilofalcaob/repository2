/**
 * Base de conhecimento inicial por síndrome — o app "nasce útil" antes de
 * acumular feedback. Executado automaticamente na subida do servidor
 * (idempotente) ou via `npm run seed`.
 */
import { getDb, createDb } from './db.js';

export const SEED = [
  // --- pneumonia ---
  { syndrome: 'pneumonia', categoria: 'terapeutica medicamentosa', item: 'Reavaliar antibioticoterapia conforme culturas e resposta clínica; planejar transição EV→VO', meta: 'Transição EV→VO em até 48-72h se afebril e estável', justificativa: 'Descalonamento precoce reduz tempo de internação e eventos adversos', prioridade: 'alta' },
  { syndrome: 'pneumonia', categoria: 'exames/monitorizacao', item: 'Monitorizar SpO2 e frequência respiratória; considerar gasometria se piora', meta: 'SpO2 >= 92% em ar ambiente antes da alta', prioridade: 'alta', justificativa: 'Critério objetivo de resolução da insuficiência respiratória' },
  { syndrome: 'pneumonia', categoria: 'mobilidade', item: 'Fisioterapia respiratória e motora; sedestação e deambulação precoce', meta: 'Deambular no corredor 2x/dia a partir de D2', justificativa: 'Mobilização precoce reduz complicações e tempo de internação', prioridade: 'media' },
  { syndrome: 'pneumonia', categoria: 'profilaxias', item: 'Profilaxia de TEV com enoxaparina se sem contraindicação', meta: 'Prescrita desde D1', justificativa: 'Paciente clínico acamado com infecção ativa', prioridade: 'alta' },
  { syndrome: 'pneumonia', categoria: 'planejamento de alta', item: 'Definir seguimento ambulatorial e radiografia de controle em 6 semanas se indicado', meta: 'Consulta agendada antes da alta', justificativa: 'Continuidade do cuidado e vigilância de resolução', prioridade: 'media' },

  // --- ICC descompensada ---
  { syndrome: 'icc', categoria: 'terapeutica medicamentosa', item: 'Diurético EV com meta de balanço hídrico negativo; monitorar função renal e eletrólitos', meta: 'Balanço hídrico -500 a -1000 mL/dia; peso diário', justificativa: 'Descongestão guiada por metas objetivas', prioridade: 'alta' },
  { syndrome: 'icc', categoria: 'terapeutica medicamentosa', item: 'Otimizar terapia modificadora de doença (IECA/BRA/sacubitril-valsartana, betabloqueador, espironolactona, iSGLT2) antes da alta', meta: 'Esquema otimizado prescrito na alta', justificativa: 'Reduz mortalidade e reinternação', prioridade: 'alta' },
  { syndrome: 'icc', categoria: 'exames/monitorizacao', item: 'Peso diário em jejum, diurese de 24h, eletrólitos e creatinina', meta: 'Peso seco atingido (referência do paciente)', justificativa: 'Guia objetivo da descongestão', prioridade: 'alta' },
  { syndrome: 'icc', categoria: 'dieta/nutricao', item: 'Dieta hipossódica; restrição hídrica se hiponatremia', meta: 'Na < 2 g/dia', justificativa: 'Controle de volemia', prioridade: 'media' },
  { syndrome: 'icc', categoria: 'planejamento de alta', item: 'Orientação de sinais de alarme, peso diário domiciliar e retorno precoce em 7-14 dias', meta: 'Consulta de retorno agendada antes da alta', justificativa: 'Período vulnerável pós-alta com alta taxa de reinternação', prioridade: 'alta' },

  // --- DPOC exacerbado ---
  { syndrome: 'dpoc', categoria: 'terapeutica medicamentosa', item: 'Broncodilatador de curta ação regular + corticoide sistêmico por 5 dias', meta: 'Concluir corticoide em 5 dias (evitar prolongamento)', justificativa: 'Cursos curtos são igualmente eficazes com menos efeitos adversos', prioridade: 'alta' },
  { syndrome: 'dpoc', categoria: 'dispositivos', item: 'Titulação de O2 com alvo de SpO2 88-92%; desmame progressivo', meta: 'SpO2 88-92% com menor FiO2 possível; desmame diário', justificativa: 'Evitar hipercapnia induzida por hiperóxia', prioridade: 'alta' },
  { syndrome: 'dpoc', categoria: 'mobilidade', item: 'Fisioterapia respiratória e reabilitação motora precoce', meta: 'Sedestação D1, deambulação assistida D2', justificativa: 'Prevenção de descondicionamento', prioridade: 'media' },
  { syndrome: 'dpoc', categoria: 'planejamento de alta', item: 'Checar técnica inalatória, vacinação (influenza/pneumococo) e encaminhar à reabilitação pulmonar', meta: 'Técnica inalatória verificada antes da alta', justificativa: 'Reduz exacerbações futuras', prioridade: 'media' },

  // --- ITU / sepse ---
  { syndrome: 'itu_sepse', categoria: 'terapeutica medicamentosa', item: 'Ajustar antibiótico conforme urocultura/hemocultura e antibiograma; definir duração total', meta: 'Descalonamento em até 72h com culturas; duração definida no plano', justificativa: 'Stewardship de antimicrobianos', prioridade: 'alta' },
  { syndrome: 'itu_sepse', categoria: 'dispositivos', item: 'Reavaliar diariamente necessidade de sonda vesical de demora; retirar o quanto antes', meta: 'SVD retirada até D2 se sem indicação', justificativa: 'SVD é fator de manutenção de ITU', prioridade: 'alta' },
  { syndrome: 'itu_sepse', categoria: 'exames/monitorizacao', item: 'Monitorar sinais vitais, diurese e lactato se sepse; escore qSOFA/NEWS', meta: 'Normalização de lactato e sinais vitais em 24-48h', justificativa: 'Detecção precoce de deterioração', prioridade: 'alta' },
  { syndrome: 'itu_sepse', categoria: 'profilaxias', item: 'Profilaxia de TEV salvo contraindicação', meta: 'Prescrita desde D1', justificativa: 'Sepse é fator de risco trombótico', prioridade: 'alta' },

  // --- AVC ---
  { syndrome: 'avc', categoria: 'exames/monitorizacao', item: 'Monitorização neurológica seriada (NIHSS) e controle pressórico conforme protocolo', meta: 'NIHSS 2x/dia nas primeiras 72h', justificativa: 'Detecção precoce de deterioração neurológica', prioridade: 'alta' },
  { syndrome: 'avc', categoria: 'dieta/nutricao', item: 'Avaliação de disfagia (fonoaudiologia) antes de liberar dieta oral', meta: 'Triagem de disfagia em até 24h da admissão', justificativa: 'Prevenção de broncoaspiração', prioridade: 'alta' },
  { syndrome: 'avc', categoria: 'mobilidade', item: 'Mobilização precoce com fisioterapia após 24h se estável', meta: 'Sedestação em até 48h se estável', justificativa: 'Melhora desfecho funcional', prioridade: 'alta' },
  { syndrome: 'avc', categoria: 'terapeutica medicamentosa', item: 'Iniciar/otimizar prevenção secundária (antiagregação/anticoagulação, estatina) conforme etiologia', meta: 'Esquema de prevenção secundária definido antes da alta', justificativa: 'Reduz recorrência', prioridade: 'alta' },
  { syndrome: 'avc', categoria: 'multidisciplinar', item: 'Reabilitação multiprofissional (fisioterapia, fono, TO) e avaliação de suporte domiciliar com serviço social', meta: 'Plano de reabilitação definido até D3', justificativa: 'Planejamento de alta segura desde o início', prioridade: 'media' },

  // --- pós-operatório ---
  { syndrome: 'pos_operatorio', categoria: 'terapeutica medicamentosa', item: 'Analgesia multimodal escalonada; evitar opioide prolongado', meta: 'Dor <= 3/10 em repouso', justificativa: 'Analgesia adequada permite mobilização precoce', prioridade: 'alta' },
  { syndrome: 'pos_operatorio', categoria: 'dispositivos', item: 'Reavaliar diariamente drenos, SVD e acesso venoso central; retirada precoce', meta: 'SVD até 24-48h pós-op; drenos conforme débito', justificativa: 'Dispositivos são fonte de infecção e imobilidade', prioridade: 'alta' },
  { syndrome: 'pos_operatorio', categoria: 'mobilidade', item: 'Deambulação precoce assistida a partir do 1º pós-operatório', meta: 'Deambular 3x/dia a partir de D1 PO', justificativa: 'Reduz TEV, íleo e pneumonia', prioridade: 'alta' },
  { syndrome: 'pos_operatorio', categoria: 'dieta/nutricao', item: 'Progressão de dieta conforme aceitação e trânsito intestinal', meta: 'Dieta plena até D2-D3 PO se tolerada', justificativa: 'Realimentação precoce melhora recuperação', prioridade: 'media' },
  { syndrome: 'pos_operatorio', categoria: 'profilaxias', item: 'Profilaxia de TEV mecânica e/ou farmacológica conforme risco cirúrgico', meta: 'Prescrita desde a admissão pós-operatória', justificativa: 'Alto risco trombótico no pós-operatório', prioridade: 'alta' },
];

export function runSeed(db) {
  if (db.countSeed() > 0) return 0;
  let n = 0;
  for (const s of SEED) {
    db.insertSeed(s);
    n++;
  }
  return n;
}

// execução direta: `npm run seed`
if (import.meta.url === `file://${process.argv[1]}`) {
  const db = getDb();
  const n = runSeed(db);
  console.log(n > 0 ? `Seed inserido: ${n} itens.` : 'Seed já existente — nada a fazer.');
  db.close();
}
