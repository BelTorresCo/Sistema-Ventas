// Listas para los formularios: clientes, vendedores, productos activos, categorías y sucursales.
const { getPool } = require('../lib/db');
const { handler, json } = require('../lib/http');

module.exports = handler(async (req, res) => {
  const pool = await getPool();
  const r = await pool.request().query(`
    SELECT id_cliente, tipo_documento, nro_documento,
           nombres + ISNULL(' ' + apellidos, '') AS nombre
    FROM dbo.cliente ORDER BY nombres, apellidos;

    SELECT v.id_vendedor, v.nombres + ' ' + v.apellidos AS nombre, s.nombre AS sucursal
    FROM dbo.vendedor v JOIN dbo.sucursal s ON s.id_sucursal = v.id_sucursal
    WHERE v.activo = 1 ORDER BY v.nombres;

    SELECT p.id_producto, p.codigo, p.nombre, c.nombre AS categoria, p.precio_venta, p.stock
    FROM dbo.producto p JOIN dbo.categoria c ON c.id_categoria = p.id_categoria
    WHERE p.activo = 1 ORDER BY p.nombre;

    SELECT id_categoria, nombre FROM dbo.categoria ORDER BY nombre;

    SELECT id_sucursal, nombre FROM dbo.sucursal ORDER BY nombre;`);
  const [clientes, vendedores, productos, categorias, sucursales] = r.recordsets;
  json(res, 200, { clientes, vendedores, productos, categorias, sucursales });
});
