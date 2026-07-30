// Cliente da API. O token fica no localStorage; a chave da Anthropic nunca
// chega ao navegador — todas as chamadas ao modelo passam pelo backend.
const CHAVE_TOKEN = 'ptx_token';
const CHAVE_USUARIO = 'ptx_usuario';

export function obterToken() { return localStorage.getItem(CHAVE_TOKEN); }
export function obterUsuario() {
  try { return JSON.parse(localStorage.getItem(CHAVE_USUARIO)); } catch { return null; }
}
export function salvarSessao(token, usuario) {
  localStorage.setItem(CHAVE_TOKEN, token);
  localStorage.setItem(CHAVE_USUARIO, JSON.stringify(usuario));
}
export function limparSessao() {
  localStorage.removeItem(CHAVE_TOKEN);
  localStorage.removeItem(CHAVE_USUARIO);
}

export async function api(caminho, { metodo = 'GET', corpo } = {}) {
  const r = await fetch(caminho, {
    method: metodo,
    headers: {
      'content-type': 'application/json',
      ...(obterToken() ? { authorization: `Bearer ${obterToken()}` } : {}),
    },
    body: corpo !== undefined ? JSON.stringify(corpo) : undefined,
  });
  const dados = await r.json().catch(() => ({}));
  if (r.status === 401) {
    limparSessao();
    window.dispatchEvent(new Event('ptx:deslogado'));
  }
  if (!r.ok) throw new Error(dados.erro ?? `Erro ${r.status}`);
  return dados;
}
