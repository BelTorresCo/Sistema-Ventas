// GET  /api/productos       -> lista
// POST /api/productos       -> registra un producto nuevo
// PUT  /api/productos       -> actualiza precio, costo, stock o estado (marca fecha_modificacion)
const { getPool, sql } = require('../lib/db');
const { handler, json, falla } = require('../lib/http');

function num(v, nombre, entero = false) {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0 || (entero && !Number.isInteger(n))) throw falla(400, `${nombre} no válido.`);
  return n;
}

module.exports = handler(async (req, res) => {
  const pool = await getPool();

  if (req.method === 'GET') {
    const r = await pool.request().query(`
      SELECT p.id_producto, p.codigo, p.nombre, p.id_categoria, c.nombre AS categoria, p.marca,
             p.precio_venta, p.costo_unitario, p.stock, p.activo,
             CAST(CASE WHEN p.precio_venta > 0
                       THEN (p.precio_venta - p.costo_unitario) / p.precio_venta * 100 END AS decimal(5,1)) AS margen_pct
      FROM dbo.producto p JOIN dbo.categoria c ON c.id_categoria = p.id_categoria
      ORDER BY p.codigo;`);
    return json(res, 200, r.recordset);
  }

  const b = req.body || {};

  if (req.method === 'POST') {
    const codigo = String(b.codigo || '').trim().toUpperCase();
    if (!/^[A-Z0-9-]{2,20}$/.test(codigo)) throw falla(400, 'Código no válido (letras, números o guion).');
    if (!String(b.nombre || '').trim()) throw falla(400, 'Ingresa el nombre del producto.');
    if (!(Number(b.id_categoria) > 0)) throw falla(400, 'Selecciona una categoría.');
    const precio = num(b.precio_venta, 'Precio de venta');
    const costo = num(b.costo_unitario, 'Costo unitario');
    const stock = num(b.stock ?? 0, 'Stock', true);

    const r = await pool.request()
      .input('codigo', sql.NVarChar(20), codigo)
      .input('nombre', sql.NVarChar(150), b.nombre.trim())
      .input('cat', sql.Int, Number(b.id_categoria))
      .input('marca', sql.NVarChar(100), (b.marca || '').trim() || null)
      .input('precio', sql.Decimal(12, 2), precio)
      .input('costo', sql.Decimal(12, 2), costo)
      .input('stock', sql.Int, stock)
      .query(`
        INSERT INTO dbo.producto (codigo, nombre, id_categoria, marca, precio_venta, costo_unitario, stock)
        OUTPUT inserted.id_producto
        VALUES (@codigo, @nombre, @cat, @marca, @precio, @costo, @stock);`);
    return json(res, 201, { ok: true, id_producto: r.recordset[0].id_producto });
  }

  if (req.method === 'PUT') {
    if (!(Number(b.id_producto) > 0)) throw falla(400, 'Producto no válido.');
    await pool.request()
      .input('id', sql.Int, Number(b.id_producto))
      .input('precio', sql.Decimal(12, 2), num(b.precio_venta, 'Precio de venta'))
      .input('costo', sql.Decimal(12, 2), num(b.costo_unitario, 'Costo unitario'))
      .input('stock', sql.Int, num(b.stock, 'Stock', true))
      .input('activo', sql.Bit, b.activo ? 1 : 0)
      .query(`
        UPDATE dbo.producto
        SET precio_venta = @precio, costo_unitario = @costo, stock = @stock,
            activo = @activo, fecha_modificacion = SYSUTCDATETIME()
        WHERE id_producto = @id;`);
    return json(res, 200, { ok: true });
  }

  throw falla(405, 'Método no permitido');
});
