/**
 * Autenticação local simples: e-mail/senha (bcrypt) + sessão em banco
 * com cookie httpOnly. O primeiro usuário registrado vira administrador.
 */
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';

const SESSION_DAYS = 14;
export const COOKIE_NAME = 'ptx_session';

export function registerUser(db, { email, name, password }) {
  if (!email || !name || !password) {
    throw Object.assign(new Error('E-mail, nome e senha são obrigatórios.'), { status: 400 });
  }
  if (password.length < 6) {
    throw Object.assign(new Error('Senha deve ter ao menos 6 caracteres.'), { status: 400 });
  }
  if (db.findUserByEmail(email)) {
    throw Object.assign(new Error('E-mail já cadastrado.'), { status: 409 });
  }
  const role = db.countUsers() === 0 ? 'admin' : 'medico';
  const id = db.createUser({ email, name, passwordHash: bcrypt.hashSync(password, 10), role });
  return db.findUserById(id);
}

export function loginUser(db, { email, password }) {
  const user = email ? db.findUserByEmail(email) : null;
  if (!user || !bcrypt.compareSync(password || '', user.password_hash)) {
    throw Object.assign(new Error('Credenciais inválidas.'), { status: 401 });
  }
  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + SESSION_DAYS * 864e5).toISOString();
  db.createSession(token, user.id, expires);
  return { token, user: { id: user.id, email: user.email, name: user.name, role: user.role } };
}

export function authMiddleware(db) {
  return (req, res, next) => {
    const token = req.cookies?.[COOKIE_NAME];
    const session = token ? db.findSession(token) : null;
    if (!session) return res.status(401).json({ error: 'Não autenticado.' });
    req.user = { id: session.id, email: session.email, name: session.name, role: session.role };
    req.sessionToken = token;
    next();
  };
}

export function adminOnly(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Acesso restrito ao administrador.' });
  }
  next();
}

export function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: SESSION_DAYS * 864e5,
    path: '/',
  };
}
