const { handler, json, cerrarSesion } = require('../lib/http');

module.exports = handler(async (req, res) => {
  cerrarSesion(res);
  json(res, 200, { ok: true });
}, { publico: true });
