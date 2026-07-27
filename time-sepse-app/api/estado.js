/* GET /api/estado?versao=N — devolve o estado compartilhado da equipe. */
'use strict';

const { obterPool, garantirTabela, carregar, pinValido } = require('./_base.js');

module.exports = async (req, res) => {
  if (!pinValido(req, res)) return;
  const cliente = await obterPool().connect();
  try {
    await garantirTabela(cliente);
    const atual = await carregar(cliente);
    const versaoCliente = Number((req.query && req.query.versao) || 0);
    res.setHeader('Cache-Control', 'no-store');
    if (versaoCliente && versaoCliente === atual.versao) {
      res.status(200).json({ versao: atual.versao });
    } else {
      res.status(200).json(atual);
    }
  } catch (erro) {
    res.status(500).json({ erro: erro.message });
  } finally {
    cliente.release();
  }
};
