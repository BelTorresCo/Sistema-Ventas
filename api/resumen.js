// Indicadores para la pantalla de inicio. Las fechas se guardan en UTC y se muestran en hora de Perú (UTC-5).
const { getPool } = require('../lib/db');
const { handler, json } = require('../lib/http');

module.exports = handler(async (req, res) => {
  const pool = await getPool();
  const r = await pool.request().query(`
    DECLARE @hoy date = CAST(DATEADD(HOUR, -5, SYSUTCDATETIME()) AS date);

    SELECT COUNT(*)                     AS num_ventas,
           ISNULL(SUM(total), 0)        AS total_ventas,
           ISNULL(AVG(total), 0)        AS ticket_promedio,
           ISNULL(SUM(CASE WHEN CAST(DATEADD(HOUR,-5,fecha_venta) AS date) = @hoy THEN total END), 0) AS total_hoy,
           SUM(CASE WHEN CAST(DATEADD(HOUR,-5,fecha_venta) AS date) = @hoy THEN 1 ELSE 0 END)       AS ventas_hoy,
           (SELECT COUNT(*) FROM dbo.cliente)                                AS clientes,
           (SELECT COUNT(*) FROM dbo.producto WHERE activo = 1)              AS productos,
           (SELECT COUNT(*) FROM dbo.producto WHERE activo = 1 AND stock < 20) AS stock_bajo
    FROM dbo.venta WHERE estado = 'EMITIDA';

    WITH dias AS (
      SELECT TOP (14) DATEADD(DAY, -(ROW_NUMBER() OVER (ORDER BY (SELECT 1)) - 1), @hoy) AS dia
      FROM sys.objects
    )
    SELECT CONVERT(char(10), d.dia, 23) AS dia, ISNULL(SUM(v.total), 0) AS total
    FROM dias d
    LEFT JOIN dbo.venta v ON v.estado = 'EMITIDA' AND CAST(DATEADD(HOUR,-5,v.fecha_venta) AS date) = d.dia
    GROUP BY d.dia ORDER BY d.dia;

    SELECT TOP (5) p.nombre, SUM(dv.cantidad) AS unidades, SUM(dv.importe) AS importe
    FROM dbo.detalle_venta dv
    JOIN dbo.venta v ON v.id_venta = dv.id_venta AND v.estado = 'EMITIDA'
    JOIN dbo.producto p ON p.id_producto = dv.id_producto
    GROUP BY p.nombre ORDER BY importe DESC;

    SELECT metodo_pago, COUNT(*) AS ventas, SUM(total) AS total
    FROM dbo.venta WHERE estado = 'EMITIDA'
    GROUP BY metodo_pago ORDER BY total DESC;`);
  const [kpi, porDia, topProductos, porMetodo] = r.recordsets;
  json(res, 200, { kpi: kpi[0], porDia, topProductos, porMetodo });
});
