// Seed: base de conhecimento inicial por síndrome (o app "nasce útil") e
// usuário administrador padrão. Idempotente — só insere se estiver vazio.
import {
  openDb, contarConhecimento, inserirConhecimento, contarUsuarios, criarUsuario,
} from './db.js';
import { hashSenha } from './auth.js';

const BASE = [
  // ---- Pneumonia adquirida na comunidade ----
  { sindrome: 'Pneumonia', chaves: ['pneumonia', 'pac ', 'broncopneumonia', 'consolidacao pulmonar'], itens: [
    ['terapêutica medicamentosa', 'Antibioticoterapia conforme protocolo institucional; reavaliar espectro com culturas', 'Transição EV→VO quando afebril ≥ 48h e estável hemodinamicamente'],
    ['exames/monitorização', 'Curva térmica, FR e SpO2 de horário; hemoculturas antes do antibiótico se ainda não colhidas', 'Afebril por 48h; PCR em queda na reavaliação de D+3'],
    ['dispositivos', 'Desmame progressivo de O2 suplementar', 'SpO2 ≥ 92% em ar ambiente por 24h'],
    ['mobilidade', 'Fisioterapia respiratória e motora; sedestação e deambulação precoces', 'Deambular no corredor 2x/dia a partir de D+1 se estável'],
    ['profilaxias', 'Profilaxia de TEV se sem contraindicação', 'Prescrita em D0 e reavaliada diariamente'],
    ['planejamento de alta', 'Definir seguimento ambulatorial e orientar sinais de alarme desde o dia 1', 'Consulta de retorno agendada antes da alta'],
  ]},
  // ---- Insuficiência cardíaca descompensada ----
  { sindrome: 'IC descompensada', chaves: ['insuficiencia cardiaca', 'icc', 'ic descompensada', 'congestao', 'edema agudo'], itens: [
    ['terapêutica medicamentosa', 'Diurético EV com meta de balanço hídrico negativo; otimizar terapia modificadora de doença antes da alta', 'Balanço hídrico -500 a -1000 mL/dia; peso diário em queda'],
    ['exames/monitorização', 'Peso diário, balanço hídrico, eletrólitos e função renal a cada 24-48h', 'K e Cr estáveis em 2 medidas consecutivas'],
    ['dieta/nutrição', 'Restrição hídrica e de sódio conforme protocolo; avaliação da nutrição', 'Adesão registrada pela enfermagem em 24h'],
    ['mobilidade', 'Mobilização progressiva conforme tolerância; fisioterapia motora', 'Sair do leito para poltrona 2x/dia'],
    ['planejamento de alta', 'Reconciliação medicamentosa e orientação sobre peso diário e sinais de congestão; retorno precoce em 7-14 dias', 'Paciente/cuidador verbaliza plano de uso dos diuréticos antes da alta'],
    ['metas de cuidado', 'Se IC avançada/internações recorrentes: discutir metas de cuidado com paciente e família', 'Registro da discussão em prontuário durante a internação'],
  ]},
  // ---- DPOC exacerbado ----
  { sindrome: 'DPOC exacerbado', chaves: ['dpoc', 'doenca pulmonar obstrutiva', 'exacerbacao de dpoc', 'broncoespasmo'], itens: [
    ['terapêutica medicamentosa', 'Broncodilatador de curta ação regular + corticoide sistêmico por 5 dias; antibiótico se critérios de Anthonisen', 'Redução progressiva da frequência de resgates até D+3'],
    ['dispositivos', 'Titulação de O2 com alvo de SpO2 88-92%; avaliar VNI se acidose respiratória', 'SpO2 88-92% com menor FiO2 possível; gasometria controle se VNI'],
    ['mobilidade', 'Fisioterapia respiratória; deambulação precoce conforme tolerância', 'Deambular com O2 se necessário a partir de D+1'],
    ['planejamento de alta', 'Checar técnica inalatória e vacinação; encaminhar para reabilitação pulmonar e cessação de tabagismo', 'Técnica inalatória verificada e corrigida antes da alta'],
  ]},
  // ---- ITU / Sepse ----
  { sindrome: 'ITU/Sepse', chaves: ['itu', 'infeccao urinaria', 'pielonefrite', 'sepse', 'choque septico', 'urosepse'], itens: [
    ['terapêutica medicamentosa', 'Antibioticoterapia empírica precoce ajustada por foco e culturas; descalonar conforme antibiograma', 'Descalonamento avaliado em até 72h com resultado de culturas'],
    ['exames/monitorização', 'Lactato, diurese e sinais vitais seriados nas primeiras 24-48h; culturas antes do antibiótico', 'Lactato normalizado e diurese ≥ 0,5 mL/kg/h'],
    ['dispositivos', 'Retirar ou trocar sonda vesical de demora o mais precocemente possível; revisar necessidade diária de acessos', 'SVD retirada ou justificada diariamente em prontuário'],
    ['profilaxias', 'Profilaxia de TEV; prevenção de delirium (orientação, sono, mobilização) em idosos', 'Prescritas/registradas em D0'],
    ['planejamento de alta', 'Definir duração total do antibiótico e via; orientar sinais de alarme', 'Data de término do antibiótico registrada no plano'],
  ]},
  // ---- AVC ----
  { sindrome: 'AVC', chaves: ['avc', 'acidente vascular', 'isquemia cerebral', 'hemiparesia', 'disartria'], itens: [
    ['exames/monitorização', 'Monitorização neurológica seriada (escala NIHSS) e controle pressórico conforme fase', 'NIHSS registrado a cada plantão nas primeiras 48h'],
    ['dieta/nutrição', 'Triagem de disfagia ANTES de dieta oral; adequar via e consistência com fonoaudiologia', 'Teste de deglutição realizado e registrado antes da primeira dieta'],
    ['profilaxias', 'Profilaxia de TEV; prevenção de broncoaspiração (cabeceira elevada) e de LPP', 'Cabeceira ≥ 30° registrada; TEV prescrita em D0'],
    ['mobilidade', 'Mobilização precoce com fisioterapia após estabilização', 'Primeira mobilização em até 48h do ictus se estável'],
    ['multidisciplinar', 'Acionar fonoaudiologia, fisioterapia, terapia ocupacional e serviço social desde o início', 'Avaliações solicitadas em D0-D1'],
    ['planejamento de alta', 'Investigação etiológica completa e prevenção secundária definidas antes da alta; plano de reabilitação', 'Antiagregação/anticoagulação e estatina definidas antes da alta'],
  ]},
  // ---- Pós-operatório ----
  { sindrome: 'Pós-operatório', chaves: ['pos-operatorio', 'pos operatorio', 'po de', 'cirurgia', 'laparotomia', 'osteossintese'], itens: [
    ['terapêutica medicamentosa', 'Analgesia multimodal escalonada; reduzir opioides progressivamente', 'Dor ≤ 3/10 em repouso com analgesia oral até D+2'],
    ['dispositivos', 'Retirada precoce de drenos, SVD e acessos conforme evolução', 'Cada dispositivo com critério de retirada registrado; revisão diária'],
    ['mobilidade', 'Deambulação precoce conforme protocolo cirúrgico', 'Primeira deambulação em até 24h se sem contraindicação'],
    ['dieta/nutrição', 'Progressão dietética conforme aceitação e trânsito intestinal', 'Dieta plena tolerada antes da alta'],
    ['profilaxias', 'Profilaxia de TEV conforme risco cirúrgico; curativo e vigilância de ferida operatória', 'TEV prescrita; ferida avaliada e registrada diariamente'],
    ['planejamento de alta', 'Orientações de curativo, sinais de alarme e retorno cirúrgico agendado', 'Retorno agendado antes da alta'],
  ]},
];

export function executarSeed({ senhaAdmin = process.env.PTX_ADMIN_SENHA ?? 'admin123' } = {}) {
  const resultado = { conhecimento: 0, admin: false };
  if (contarConhecimento() === 0) {
    for (const s of BASE) {
      for (const [categoria, item, meta] of s.itens) {
        inserirConhecimento({ sindrome: s.sindrome, palavrasChave: s.chaves, categoria, item, meta });
        resultado.conhecimento++;
      }
    }
  }
  if (contarUsuarios() === 0) {
    criarUsuario({
      nome: 'Administrador',
      email: process.env.PTX_ADMIN_EMAIL ?? 'admin@ptx.local',
      senhaHash: hashSenha(senhaAdmin),
      papel: 'admin',
    });
    resultado.admin = true;
  }
  return resultado;
}

// Execução direta: `npm run seed`
if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  openDb();
  const r = executarSeed();
  console.log(`Seed concluído: ${r.conhecimento} itens de conhecimento; admin ${r.admin ? 'criado (admin@ptx.local)' : 'já existia'}.`);
}
