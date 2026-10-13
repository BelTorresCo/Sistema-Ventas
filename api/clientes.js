// GET /api/clientes?q=texto  -> lista (búsqueda por nombre o documento)
// POST /api/clientes         -> registra un cliente nuevo
const { getPool, sql } = require('../lib/db');
const { handler, json, falla } = require('../lib/http');

module.exports = handler(async (req, res) => {
  const pool = await getPool();

  if (req.method === 'GET') {
    const q = `%${(req.query.q || '').trim()}%`;
    const r = await pool.request().input('q', sql.NVarChar(160), q).query(`
      SELECT c.id_cliente, c.tipo_documento, c.nro_documento,
             c.nombres + ISNULL(' ' + c.apellidos, '') AS nombre,
             c.sexo, CONVERT(char(10), c.fecha_nacimiento, 23) AS fecha_nacimiento,
             c.telefono, c.email, c.distrito,
             (SELECT COUNT(*) FROM dbo.venta v WHERE v.id_cliente = c.id_cliente AND v.estado = 'EMITIDA') AS compras,
             (SELECT ISNULL(SUM(total),0) FROM dbo.venta v WHERE v.id_cliente = c.id_cliente AND v.estado = 'EMITIDA') AS total_comprado
      FROM dbo.cliente c
      WHERE c.nombres + ISNULL(' ' + c.apellidos, '') LIKE @q OR c.nro_documento LIKE @q
      ORDER BY c.id_cliente DESC;`);
    return json(res, 200, r.recordset);
  }

  if (req.method === 'POST') {
    const b = req.body || {};
    const tipo = b.tipo_documento;
    const doc = String(b.nro_documento || '').trim();
    if (!['DNI', 'RUC', 'CE'].includes(tipo)) throw falla(400, 'Tipo de documento no válido.');
    if (tipo === 'DNI' && !/^\d{8}$/.test(doc)) throw falla(400, 'El DNI debe tener 8 dígitos.');
    if (tipo === 'RUC' && !/^\d{11}$/.test(doc)) throw falla(400, 'El RUC debe tener 11 dígitos.');
    if (tipo === 'CE' && !/^[A-Za-z0-9]{6,12}$/.test(doc)) throw falla(400, 'Carné de extranjería no válido.');
    if (!String(b.nombres || '').trim()) throw falla(400, 'Ingresa el nombre o razón social.');
    if (b.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(b.email)) throw falla(400, 'Correo no válido.');

    const r = await pool.request()
      .input('tipo', sql.NVarChar(10), tipo)
      .input('doc', sql.NVarChar(15), doc)
      .input('nombres', sql.NVarChar(150), b.nombres.trim())
      .input('apellidos', sql.NVarChar(150), (b.apellidos || '').trim() || null)
      .input('sexo', sql.Char(1), ['F', 'M'].includes(b.sexo) ? b.sexo : null)
      .input('nac', sql.Date, /^\d{4}-\d{2}-\d{2}$/.test(b.fecha_nacimiento || '') ? b.fecha_nacimiento : null)
      .input('tel', sql.NVarChar(20), (b.telefono || '').trim() || null)
      .input('email', sql.NVarChar(150), (b.email || '').trim() || null)
      .input('distrito', sql.NVarChar(100), (b.distrito || '').trim() || null)
      .query(`
        INSERT INTO dbo.cliente (tipo_documento, nro_documento, nombres, apellidos, sexo,
                                 fecha_nacimiento, telefono, email, distrito)
        OUTPUT inserted.id_cliente
        VALUES (@tipo, @doc, @nombres, @apellidos, @sexo, @nac, @tel, @email, @distrito);`);
    return json(res, 201, { ok: true, id_cliente: r.recordset[0].id_cliente });
  }

  throw falla(405, 'Método no permitido');
});
