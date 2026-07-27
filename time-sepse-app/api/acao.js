/* POST /api/acao — aplica uma ação do app ao estado compartilhado. */
'use strict';

const { obterPool, garantirTabela, carregar, pinValido, ACOES } = require('./_base.js');

module.exports = async (req, res) => {
  if (!pinValido(req, res)) return;
  if (req.method !== 'POST') { res.status(405).json({ erro: 'metodo_invalido' }); return; }
  const acao = req.body && req.body.acao;
  if (!acao) { res.status(400).json({ erro: 'requisicao_invalida' }); return; }

  const cliente = await obterPool().connect();
  try {
    await garantirTabela(cliente);
    res.setHeader('Cache-Control', 'no-store');

    // Concorrência otimista: se outro aparelho gravou no meio do caminho,
    // recarrega o estado mais novo e aplica a ação de novo.
    for (let tentativa = 0; tentativa < 3; tentativa++) {
      const atual = await carregar(cliente);
      const resultado = ACOES.aplicar(atual.estado, acao);
      if (!resultado.ok) {
        res.status(200).json({ resultado, versao: atual.versao, estado: atual.estado });
        return;
      }
      const gravacao = await cliente.query(
        'UPDATE time_sepse_estado SET versao = $1, dados = $2 WHERE id = 1 AND versao = $3',
        [atual.versao + 1, JSON.stringify(atual.estado), atual.versao]
      );
      if (gravacao.rowCount === 1) {
        res.status(200).json({ resultado, versao: atual.versao + 1, estado: atual.estado });
        return;
      }
    }
    res.status(409).json({ erro: 'conflito_de_gravacao' });
  } catch (erro) {
    res.status(500).json({ erro: erro.message });
  } finally {
    cliente.release();
  }
};
