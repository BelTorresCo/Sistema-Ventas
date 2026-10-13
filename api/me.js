const { handler, json } = require('../lib/http');

module.exports = handler(async (req, res) => {
  const { nombre, usuario, rol } = req.usuario;
  json(res, 200, { nombre, usuario, rol });
});
