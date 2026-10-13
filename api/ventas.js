// GET  /api/ventas?desde=YYYY-MM-DD&hasta=YYYY-MM-DD  -> lista
// GET  /api/ventas?id=5                                -> detalle de una venta
// POST /api/ventas                                     -> registra una venta (usp_registrar_venta)
const { getPool, sql } = require('../lib/db');
const { handler, json, falla } = require('../lib/http');

const COMPROBANTES = ['BOLETA', 'FACTURA'];
const METODOS = ['EFECTIVO', 'TARJETA', 'YAPE', 'PLIN', 'TRANSFERENCIA'];
const FECHA_PE = "FORMAT(DATEADD(HOUR,-5,v.fecha_venta),'yyyy-MM-dd HH:mm')";

module.exports = handler(async (req, res) => {
  const pool = await getPool();

  if (req.method === 'GET' && req.query.id) {
    const r = await pool.request().input('id', sql.Int, Number(req.query.id)).query(`
      SELECT v.id_venta, v.serie + '-' + RIGHT('00000000' + CAST(v.numero AS varchar(8)), 8) AS comprobante,
             v.tipo_comprobante, ${FECHA_PE} AS fecha, v.metodo_pago, v.subtotal, v.igv, v.total, v.estado,
             c.tipo_documento + ' ' + c.nro_documento AS documento,
             c.nombres + ISNULL(' ' + c.apellidos, '') AS cliente,
             ve.nombres + ' ' + ve.apellidos AS vendedor, s.nombre AS sucursal
      FROM dbo.venta v
      JOIN dbo.cliente c   ON c.id_cliente   = v.id_cliente
      JOIN dbo.vendedor ve ON ve.id_vendedor = v.id_vendedor
      JOIN dbo.sucursal s  ON s.id_sucursal  = v.id_sucursal
      WHERE v.id_venta = @id;

      SELECT p.codigo, p.nombre, dv.cantidad, dv.precio_unitario, dv.importe
      FROM dbo.detalle_venta dv JOIN dbo.producto p ON p.id_producto = dv.id_producto
      WHERE dv.id_venta = @id ORDER BY dv.id_detalle;`);
    if (!r.recordsets[0][0]) throw falla(404, 'Venta no encontrada.');
    return json(res, 200, { venta: r.recordsets[0][0], detalle: r.recordsets[1] });
  }

  if (req.method === 'GET') {
    const fecha = /^\d{4}-\d{2}-\d{2}$/;
    const desde = fecha.test(req.query.desde || '') ? req.query.desde : '2000-01-01';
    const hasta = fecha.test(req.query.hasta || '') ? req.query.hasta : '2100-12-31';
    const r = await pool.request()
      .input('desde', sql.Date, desde)
      .input('hasta', sql.Date, hasta)
      .query(`
      SELECT TOP (500) v.id_venta,
             v.serie + '-' + RIGHT('00000000' + CAST(v.numero AS varchar(8)), 8) AS comprobante,
             ${FECHA_PE} AS fecha,
             c.nombres + ISNULL(' ' + c.apellidos, '') AS cliente,
             ve.nombres + ' ' + ve.apellidos AS vendedor,
             v.metodo_pago, v.total, v.estado
      FROM dbo.venta v
      JOIN dbo.cliente c   ON c.id_cliente   = v.id_cliente
      JOIN dbo.vendedor ve ON ve.id_vendedor = v.id_vendedor
      WHERE CAST(DATEADD(HOUR,-5,v.fecha_venta) AS date) BETWEEN @desde AND @hasta
      ORDER BY v.id_venta DESC;`);
    return json(res, 200, r.recordset);
  }

  if (req.method === 'POST') {
    const b = req.body || {};
    const items = Array.isArray(b.items) ? b.items
      .map(i => ({ id_producto: Number(i.id_producto), cantidad: Number(i.cantidad) }))
      .filter(i => i.id_producto > 0 && Number.isInteger(i.cantidad) && i.cantidad > 0) : [];

    if (!COMPROBANTES.includes(b.tipo_comprobante)) throw falla(400, 'Tipo de comprobante no válido.');
    if (!METODOS.includes(b.metodo_pago)) throw falla(400, 'Método de pago no válido.');
    if (!(Number(b.id_cliente) > 0)) throw falla(400, 'Selecciona un cliente.');
    if (!(Number(b.id_vendedor) > 0)) throw falla(400, 'Selecciona un vendedor.');
    if (!items.length) throw falla(400, 'Agrega al menos un producto.');

    const t0 = Date.now();
    const r = await pool.request()
      .input('tipo_comprobante', sql.NVarChar(10), b.tipo_comprobante)
      .input('id_cliente', sql.Int, Number(b.id_cliente))
      .input('id_vendedor', sql.Int, Number(b.id_vendedor))
      .input('metodo_pago', sql.NVarChar(20), b.metodo_pago)
      .input('detalle_json', sql.NVarChar(sql.MAX), JSON.stringify(items))
      .input('id_usuario', sql.Int, req.usuario.id)
      .execute('dbo.usp_registrar_venta');
    const v = r.recordset[0];
    return json(res, 201, {
      ok: true,
      id_venta: v.id_venta,
      comprobante: `${v.serie}-${String(v.numero).padStart(8, '0')}`,
      total: v.total,
      ms: Date.now() - t0
    });
  }

  throw falla(405, 'Método no permitido');
});
