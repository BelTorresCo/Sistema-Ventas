# Sistema de Ventas (OLTP) – Azure SQL + Vercel

Sistema web del curso de Big Data Analytics. Registra ventas en **Azure SQL** (base `SistemaVentas`),
que luego el **ETL** lleva al data warehouse **CONSOLIDADO** (SQL Server local) y a **Power BI** por el gateway.

## Estructura
| Carpeta / archivo | Qué contiene |
|---|---|
| `public/` | Pantallas del sistema (HTML, CSS y JavaScript) |
| `api/` | Funciones del servidor que consultan Azure SQL (login, ventas, clientes, productos, resumen) |
| `lib/` | Conexión a la base (`db.js`) y sesión / errores (`http.js`) |
| `package.json` | Dependencia: `mssql` (driver de SQL Server para Node.js) |
| `vercel.json` | Tiempo máximo de las funciones (60 s, por si la base está "despertando") |

## Variables de entorno (se configuran en Vercel, nunca en el código)
| Nombre | Valor |
|---|---|
| `DB_SERVER` | `sql-isaura-bigdata.database.windows.net` |
| `DB_NAME` | `SistemaVentas` |
| `DB_USER` | `adminisaura` |
| `DB_PASSWORD` | (tu contraseña de Azure SQL) |
| `SESSION_SECRET` | una frase larga cualquiera, ej. `bigdata-upsjb-2026-isaura-ventas` |

## Publicación
1. **Azure SQL → Redes:** agregar regla de firewall `0.0.0.0` – `255.255.255.255` (Vercel no tiene IP fija).
2. **GitHub:** crear repositorio `sistema-ventas` y subir el contenido de esta carpeta.
3. **Vercel:** Add New → Project → importar el repositorio → Framework *Other* → agregar las variables → Deploy.
4. Entrar con **admin / Admin123\*** (usuario creado por el script 05).

## Pantallas
- **Inicio:** ventas de hoy, totales, ticket promedio, ventas de 14 días, métodos de pago y top de productos.
- **Nueva venta:** cliente, vendedor, comprobante (boleta/factura), método de pago y carrito; calcula IGV,
  descuenta stock y genera la serie-número (procedimiento `usp_registrar_venta`).
- **Ventas:** filtro por fechas y detalle del comprobante.
- **Clientes:** búsqueda y registro (valida DNI de 8 y RUC de 11 dígitos).
- **Productos:** registro y edición de precio, costo, stock y estado (actualiza `fecha_modificacion` para el ETL incremental).

Las fechas se guardan en UTC en Azure y se muestran en hora de Perú (UTC−5).
