// Autenticação local simples: senha com scrypt (crypto nativo) e token HMAC
// assinado com segredo persistido no banco (sobrevive a reinícios).
import crypto from 'node:crypto';
import { metaGet, metaSet, buscarUsuarioPorId } from './db.js';

const TOKEN_TTL_HORAS = 12;

export function hashSenha(senha) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(senha, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verificarSenha(senha, senhaHash) {
  const [salt, hash] = senhaHash.split(':');
  if (!salt || !hash) return false;
  const calc = crypto.scryptSync(senha, salt, 64);
  const esperado = Buffer.from(hash, 'hex');
  return calc.length === esperado.length && crypto.timingSafeEqual(calc, esperado);
}

function segredo() {
  let s = metaGet('token_secret');
  if (!s) {
    s = crypto.randomBytes(32).toString('hex');
    metaSet('token_secret', s);
  }
  return s;
}

function b64url(buf) {
  return Buffer.from(buf).toString('base64url');
}

export function emitirToken(usuario) {
  const payload = {
    uid: usuario.id,
    papel: usuario.papel,
    exp: Date.now() + TOKEN_TTL_HORAS * 3600 * 1000,
  };
  const corpo = b64url(JSON.stringify(payload));
  const assinatura = crypto.createHmac('sha256', segredo()).update(corpo).digest('base64url');
  return `${corpo}.${assinatura}`;
}

export function validarToken(token) {
  if (!token || typeof token !== 'string') return null;
  const [corpo, assinatura] = token.split('.');
  if (!corpo || !assinatura) return null;
  const esperada = crypto.createHmac('sha256', segredo()).update(corpo).digest('base64url');
  const a = Buffer.from(assinatura);
  const b = Buffer.from(esperada);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(corpo, 'base64url').toString());
    if (!payload.uid || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

// Middlewares Express
export function exigirAuth(req, res, next) {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  const payload = validarToken(token);
  if (!payload) return res.status(401).json({ erro: 'Não autenticado' });
  const usuario = buscarUsuarioPorId(payload.uid);
  if (!usuario) return res.status(401).json({ erro: 'Usuário inválido' });
  req.usuario = usuario;
  next();
}

export function exigirAdmin(req, res, next) {
  if (req.usuario?.papel !== 'admin') {
    return res.status(403).json({ erro: 'Acesso restrito ao administrador' });
  }
  next();
}
