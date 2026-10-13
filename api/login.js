const { getPool, sql } = require('../lib/db');
const { handler, json, crearSesion, falla } = require('../lib/http');

module.exports = handler(async (req, res) => {
  if (req.method !== 'POST') throw falla(405, 'Método no permitido');
  const { usuario, clave } = req.body || {};
  if (!usuario || !clave) throw falla(400, 'Ingresa usuario y contraseña.');

  const pool = await getPool();
  const r = await pool.request()
    .input('usuario', sql.NVarChar(50), usuario)
    .input('clave', sql.NVarChar(100), clave)
    .execute('dbo.usp_login');

  const u = r.recordset[0];
  if (!u) throw falla(401, 'Usuario o contraseña incorrectos.');
  crearSesion(res, { id: u.id_usuario, usuario: u.usuario, nombre: u.nombre, rol: u.rol });
  json(res, 200, { ok: true, nombre: u.nombre, rol: u.rol });
}, { publico: true });
