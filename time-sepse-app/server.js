/*
 * Time Sepse App — servidor do modo integrado (sem dependências externas).
 *
 * Serve a interface e mantém o estado compartilhado da equipe: cada celular
 * acessa a mesma URL e vê os registros de todos, atualizados a cada poucos
 * segundos. O estado é persistido em dados/estado.json.
 *
 * Uso:
 *   node server.js                         # http://<ip-do-computador>:3080
 *   PORT=8080 node server.js               # porta personalizada
 *   TIME_SEPSE_PIN=1234 node server.js     # exige PIN da equipe
 */
'use strict';

const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const ACOES = require('./js/acoes.js');

const PORTA = Number(process.env.PORT || 3080);
const PIN = process.env.TIME_SEPSE_PIN || '';
const DIR_DADOS = path.join(__dirname, 'dados');
const ARQUIVO_ESTADO = path.join(DIR_DADOS, 'estado.json');

const TIPOS_MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

let estado = carregarEstado();
let versao = 1;

function carregarEstado() {
  try {
    return JSON.parse(fs.readFileSync(ARQUIVO_ESTADO, 'utf8'));
  } catch (erro) {
    return ACOES.estadoInicial();
  }
}

function persistirEstado() {
  try {
    fs.mkdirSync(DIR_DADOS, { recursive: true });
    fs.writeFileSync(ARQUIVO_ESTADO, JSON.stringify(estado));
  } catch (erro) {
    console.error('Falha ao persistir o estado:', erro.message);
  }
}

function responderJson(res, codigo, corpo) {
  const dados = JSON.stringify(corpo);
  res.writeHead(codigo, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(dados);
}

function pinValido(req) {
  if (!PIN) return true;
  return (req.headers['x-time-sepse-pin'] || '') === PIN;
}

function lerCorpo(req, aoConcluir) {
  let corpo = '';
  req.on('data', (parte) => {
    corpo += parte;
    if (corpo.length > 1024 * 1024) req.destroy();
  });
  req.on('end', () => {
    try {
      aoConcluir(null, corpo ? JSON.parse(corpo) : {});
    } catch (erro) {
      aoConcluir(erro, null);
    }
  });
}

function servirEstatico(req, res, caminhoUrl) {
  let relativo = decodeURIComponent(caminhoUrl.split('?')[0]);
  if (relativo === '/') relativo = '/index.html';
  const arquivo = path.normalize(path.join(__dirname, relativo));
  if (!arquivo.startsWith(__dirname) || arquivo.startsWith(DIR_DADOS)) {
    res.writeHead(403); res.end('Acesso negado'); return;
  }
  fs.readFile(arquivo, (erro, conteudo) => {
    if (erro) { res.writeHead(404); res.end('Não encontrado'); return; }
    res.writeHead(200, {
      'Content-Type': TIPOS_MIME[path.extname(arquivo).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-cache'
    });
    res.end(conteudo);
  });
}

const servidor = http.createServer((req, res) => {
  const url = req.url || '/';

  if (url.startsWith('/api/')) {
    if (!pinValido(req)) { responderJson(res, 401, { erro: 'pin_necessario' }); return; }

    if (req.method === 'GET' && url.startsWith('/api/estado')) {
      const consulta = new URL(url, 'http://local').searchParams;
      const versaoCliente = Number(consulta.get('versao') || 0);
      if (versaoCliente && versaoCliente === versao) {
        responderJson(res, 200, { versao });
      } else {
        responderJson(res, 200, { versao, estado });
      }
      return;
    }

    if (req.method === 'POST' && url.startsWith('/api/acao')) {
      lerCorpo(req, (erro, corpo) => {
        if (erro || !corpo || !corpo.acao) {
          responderJson(res, 400, { erro: 'requisicao_invalida' });
          return;
        }
        const resultado = ACOES.aplicar(estado, corpo.acao);
        if (resultado.ok) {
          versao++;
          persistirEstado();
        }
        responderJson(res, 200, { resultado, versao, estado });
      });
      return;
    }

    responderJson(res, 404, { erro: 'rota_desconhecida' });
    return;
  }

  if (req.method !== 'GET') { res.writeHead(405); res.end(); return; }
  servirEstatico(req, res, url);
});

servidor.listen(PORTA, '0.0.0.0', () => {
  console.log('');
  console.log('🚨 Time Sepse App — modo integrado (equipe sincronizada)');
  console.log('');
  console.log('   Acesse deste computador:  http://localhost:' + PORTA);
  const redes = os.networkInterfaces();
  Object.keys(redes).forEach((nome) => {
    (redes[nome] || []).forEach((rede) => {
      if (rede.family === 'IPv4' && !rede.internal) {
        console.log('   Acesse dos celulares:     http://' + rede.address + ':' + PORTA + '   (mesma rede Wi-Fi)');
      }
    });
  });
  console.log('');
  console.log(PIN ? '   PIN da equipe: exigido (variável TIME_SEPSE_PIN definida).'
                  : '   PIN da equipe: desativado — defina TIME_SEPSE_PIN para proteger o acesso.');
  console.log('   Registros salvos em: ' + ARQUIVO_ESTADO);
  console.log('');
});
