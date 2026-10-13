// Sistema de Ventas - lógica del navegador (sin frameworks).
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const sol = n => 'S/ ' + Number(n || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let catalogos = { clientes: [], vendedores: [], productos: [], categorias: [] };
let carrito = [];
let productosCache = [];

// ---------- API ----------
async function api(url, opciones = {}) {
  const r = await fetch(url, {
    ...opciones,
    headers: { 'Content-Type': 'application/json', ...(opciones.headers || {}) },
    body: opciones.body ? JSON.stringify(opciones.body) : undefined
  });
  const data = await r.json().catch(() => ({}));
  if (r.status === 401 && !url.includes('/login')) { mostrarLogin(); throw new Error(data.error || 'Sesión expirada'); }
  if (!r.ok) throw new Error(data.error || 'Error ' + r.status);
  return data;
}

function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.remove('hidden');
  clearTimeout(t._h); t._h = setTimeout(() => t.classList.add('hidden'), 3200);
}
function setMsg(el, texto, ok) { el.textContent = texto || ''; el.className = 'msg ' + (texto ? (ok ? 'ok' : 'bad') : ''); }
function estadoDb(ok, texto) { const p = $('#estadoDb'); p.textContent = texto; p.classList.toggle('bad', !ok); }

// ---------- Sesión ----------
function mostrarLogin() { $('#app').classList.add('hidden'); $('#login').classList.remove('hidden'); }
async function mostrarApp(u) {
  $('#login').classList.add('hidden'); $('#app').classList.remove('hidden');
  $('#userName').textContent = u.nombre; $('#userRol').textContent = u.rol;
  $('#avatar').textContent = (u.nombre || '?').trim()[0].toUpperCase();
  await cargarCatalogos().catch(e => estadoDb(false, e.message));
  irA(location.hash.slice(1) || 'inicio');
}

$('#formLogin').addEventListener('submit', async e => {
  e.preventDefault();
  const f = new FormData(e.target), btn = e.target.querySelector('button');
  btn.disabled = true; setMsg($('#loginMsg'), 'Conectando con Azure SQL…', true);
  try {
    const u = await api('/api/login', { method: 'POST', body: { usuario: f.get('usuario'), clave: f.get('clave') } });
    setMsg($('#loginMsg'), '');
    mostrarApp(u);
  } catch (err) { setMsg($('#loginMsg'), err.message, false); }
  finally { btn.disabled = false; }
});

$('#btnSalir').addEventListener('click', async () => { await api('/api/logout', { method: 'POST' }).catch(() => {}); mostrarLogin(); });
$('#btnMenu').addEventListener('click', () => $('.side').classList.toggle('open'));

// ---------- Navegación ----------
const TITULOS = { inicio: 'Inicio', nueva: 'Nueva venta', ventas: 'Ventas registradas', clientes: 'Clientes', productos: 'Productos' };
function irA(vista) {
  if (!TITULOS[vista]) vista = 'inicio';
  $$('.view').forEach(v => v.classList.toggle('hidden', v.id !== 'v-' + vista));
  $$('.side nav a').forEach(a => a.classList.toggle('active', a.dataset.view === vista));
  $('#titulo').textContent = TITULOS[vista];
  $('.side').classList.remove('open');
  ({ inicio: cargarInicio, nueva: prepararVenta, ventas: cargarVentas, clientes: cargarClientes, productos: cargarProductos })[vista]();
}
window.addEventListener('hashchange', () => { if (!$('#app').classList.contains('hidden')) irA(location.hash.slice(1)); });

async function cargarCatalogos() {
  catalogos = await api('/api/catalogos');
  estadoDb(true, 'Conectado a Azure SQL');
}

// ---------- Inicio ----------
async function cargarInicio() {
  try {
    const d = await api('/api/resumen'); const k = d.kpi;
    estadoDb(true, 'Conectado a Azure SQL');
    $('#kpis').innerHTML = `
      <div class="kpi accent"><small>Ventas de hoy</small><b>${sol(k.total_hoy)}</b><span>${k.ventas_hoy} comprobantes</span></div>
      <div class="kpi"><small>Ventas totales</small><b>${sol(k.total_ventas)}</b><span>${k.num_ventas} comprobantes</span></div>
      <div class="kpi"><small>Ticket promedio</small><b>${sol(k.ticket_promedio)}</b><span>por venta</span></div>
      <div class="kpi"><small>Clientes</small><b>${k.clientes}</b><span>registrados</span></div>
      <div class="kpi"><small>Productos activos</small><b>${k.productos}</b><span>${k.stock_bajo} con stock bajo</span></div>`;
    dibujarBarras(d.porDia);
    const maxM = Math.max(1, ...d.porMetodo.map(m => m.total));
    $('#metodos').innerHTML = d.porMetodo.length ? `<div class="bars">${d.porMetodo.map(m => `
      <div class="bar-row"><span>${esc(m.metodo_pago)}</span><div class="bar-track"><div class="bar-fill" style="width:${m.total / maxM * 100}%"></div></div><b class="r">${sol(m.total)}</b></div>`).join('')}</div>`
      : '<p class="muted">Sin ventas todavía.</p>';
    $('#topProductos').innerHTML = `<table class="tbl"><thead><tr><th>Producto</th><th class="r">Unidades</th><th class="r">Importe</th></tr></thead><tbody>
      ${d.topProductos.map(p => `<tr><td>${esc(p.nombre)}</td><td class="r">${p.unidades}</td><td class="r">${sol(p.importe)}</td></tr>`).join('') || '<tr><td colspan="3" class="empty">Sin datos</td></tr>'}</tbody></table>`;
  } catch (e) { estadoDb(false, 'Sin conexión: ' + e.message); }
}

function dibujarBarras(datos) {
  const W = 700, H = 240, pad = { l: 56, r: 10, t: 14, b: 34 };
  const max = Math.max(10, ...datos.map(d => d.total));
  const paso = Math.pow(10, Math.floor(Math.log10(max))); const tope = Math.ceil(max / paso) * paso;
  const bw = (W - pad.l - pad.r) / datos.length;
  const y = v => pad.t + (H - pad.t - pad.b) * (1 - v / tope);
  let svg = '';
  for (let i = 0; i <= 4; i++) {
    const v = tope * i / 4;
    svg += `<line x1="${pad.l}" x2="${W - pad.r}" y1="${y(v)}" y2="${y(v)}" stroke="#e3e7f0"/>
            <text x="${pad.l - 8}" y="${y(v) + 4}" text-anchor="end" font-size="11" fill="#6b7590">${Math.round(v).toLocaleString('es-PE')}</text>`;
  }
  datos.forEach((d, i) => {
    const x = pad.l + i * bw + bw * 0.18, w = bw * 0.64, top = y(d.total);
    svg += `<rect x="${x}" y="${top}" width="${w}" height="${H - pad.b - top}" rx="4" fill="${d.total ? '#2f4bd8' : '#dfe4f2'}"><title>${d.dia}: ${sol(d.total)}</title></rect>
            <text x="${x + w / 2}" y="${H - 14}" text-anchor="middle" font-size="10.5" fill="#6b7590">${d.dia.slice(8)}/${d.dia.slice(5, 7)}</text>`;
  });
  $('#chartDias').innerHTML = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">${svg}</svg>`;
}

// ---------- Nueva venta ----------
async function prepararVenta() {
  await cargarCatalogos().catch(e => estadoDb(false, e.message));
  $('#vCliente').innerHTML = catalogos.clientes.map(c => `<option value="${c.id_cliente}">${esc(c.nombre)} · ${esc(c.tipo_documento)} ${esc(c.nro_documento)}</option>`).join('');
  $('#vVendedor').innerHTML = catalogos.vendedores.map(v => `<option value="${v.id_vendedor}">${esc(v.nombre)} · ${esc(v.sucursal)}</option>`).join('');
  $('#vProducto').innerHTML = catalogos.productos.map(p => `<option value="${p.id_producto}" ${p.stock ? '' : 'disabled'}>${esc(p.nombre)} · ${sol(p.precio_venta)} · stock ${p.stock}</option>`).join('');
  pintarCarrito();
}

$('#btnAgregar').addEventListener('click', () => {
  const id = Number($('#vProducto').value), cant = parseInt($('#vCantidad').value, 10);
  const p = catalogos.productos.find(x => x.id_producto === id);
  if (!p || !(cant > 0)) return;
  const item = carrito.find(i => i.id_producto === id);
  const nueva = (item ? item.cantidad : 0) + cant;
  if (nueva > p.stock) return toast(`Solo hay ${p.stock} unidades de ${p.nombre}`);
  if (item) item.cantidad = nueva; else carrito.push({ id_producto: id, nombre: p.nombre, precio: p.precio_venta, cantidad: cant, stock: p.stock });
  $('#vCantidad').value = 1; pintarCarrito();
});

function pintarCarrito() {
  const tb = $('#carrito');
  if (!carrito.length) tb.innerHTML = '<tr><td colspan="5" class="empty">Aún no hay productos</td></tr>';
  else tb.innerHTML = carrito.map((i, k) => `<tr>
      <td>${esc(i.nombre)}</td>
      <td class="r"><input class="qty" type="number" min="1" max="${i.stock}" value="${i.cantidad}" data-k="${k}"></td>
      <td class="r">${sol(i.precio)}</td><td class="r">${sol(i.precio * i.cantidad)}</td>
      <td class="r"><button class="btn sm" data-del="${k}" aria-label="Quitar">✕</button></td></tr>`).join('');
  const total = carrito.reduce((s, i) => s + i.precio * i.cantidad, 0);
  const sub = Math.round(total / 1.18 * 100) / 100;
  $('#tSub').textContent = sol(sub); $('#tIgv').textContent = sol(total - sub); $('#tTotal').textContent = sol(total);
}
$('#carrito').addEventListener('input', e => {
  if (!e.target.dataset.k) return;
  const i = carrito[e.target.dataset.k]; const v = parseInt(e.target.value, 10);
  if (v > 0 && v <= i.stock) { i.cantidad = v; pintarCarrito(); }
});
$('#carrito').addEventListener('click', e => {
  if (e.target.dataset.del === undefined) return;
  carrito.splice(Number(e.target.dataset.del), 1); pintarCarrito();
});

$('#btnRegistrar').addEventListener('click', async () => {
  const btn = $('#btnRegistrar'), msg = $('#ventaMsg');
  if (!carrito.length) return setMsg(msg, 'Agrega al menos un producto.', false);
  btn.disabled = true; setMsg(msg, 'Registrando en Azure SQL…', true);
  try {
    const r = await api('/api/ventas', { method: 'POST', body: {
      tipo_comprobante: $('#vTipo').value, metodo_pago: $('#vMetodo').value,
      id_cliente: Number($('#vCliente').value), id_vendedor: Number($('#vVendedor').value),
      items: carrito.map(i => ({ id_producto: i.id_producto, cantidad: i.cantidad }))
    } });
    setMsg(msg, `✔ Venta ${r.comprobante} registrada por ${sol(r.total)} (${r.ms} ms).`, true);
    toast('Venta registrada: ' + r.comprobante);
    carrito = []; prepararVenta();
  } catch (e) { setMsg(msg, e.message, false); }
  finally { btn.disabled = false; }
});

// ---------- Ventas ----------
async function cargarVentas() {
  const q = new URLSearchParams();
  if ($('#fDesde').value) q.set('desde', $('#fDesde').value);
  if ($('#fHasta').value) q.set('hasta', $('#fHasta').value);
  const tb = $('#tVentas'); tb.innerHTML = '<tr><td colspan="6" class="empty">Cargando…</td></tr>';
  try {
    const filas = await api('/api/ventas?' + q);
    const total = filas.filter(v => v.estado === 'EMITIDA').reduce((s, v) => s + v.total, 0);
    $('#ventasInfo').textContent = `${filas.length} ventas · ${sol(total)}`;
    tb.innerHTML = filas.map(v => `<tr data-id="${v.id_venta}">
      <td><b>${esc(v.comprobante)}</b> ${v.estado !== 'EMITIDA' ? '<span class="tag off">ANULADA</span>' : ''}</td>
      <td>${esc(v.fecha)}</td><td>${esc(v.cliente)}</td><td>${esc(v.vendedor)}</td>
      <td><span class="tag">${esc(v.metodo_pago)}</span></td><td class="r">${sol(v.total)}</td></tr>`).join('')
      || '<tr><td colspan="6" class="empty">No hay ventas en ese rango</td></tr>';
  } catch (e) { tb.innerHTML = `<tr><td colspan="6" class="empty">${esc(e.message)}</td></tr>`; }
}
$('#btnFiltrar').addEventListener('click', cargarVentas);
$('#tVentas').addEventListener('click', async e => {
  const tr = e.target.closest('tr[data-id]'); if (!tr) return;
  const { venta: v, detalle } = await api('/api/ventas?id=' + tr.dataset.id);
  $('#modalBody').innerHTML = `
    <div class="comp-head"><div><small class="muted">${esc(v.tipo_comprobante)} ELECTRÓNICA</small><h3>${esc(v.comprobante)}</h3></div>
      <div class="r"><small class="muted">Fecha</small><div><b>${esc(v.fecha)}</b></div></div></div>
    <div class="kv"><span>Cliente</span><b>${esc(v.cliente)}</b><span>Documento</span><b>${esc(v.documento)}</b>
      <span>Vendedor</span><b>${esc(v.vendedor)}</b><span>Sucursal</span><b>${esc(v.sucursal)}</b><span>Pago</span><b>${esc(v.metodo_pago)}</b></div>
    <table class="tbl"><thead><tr><th>Código</th><th>Producto</th><th class="r">Cant.</th><th class="r">P. unit.</th><th class="r">Importe</th></tr></thead>
      <tbody>${detalle.map(d => `<tr><td>${esc(d.codigo)}</td><td>${esc(d.nombre)}</td><td class="r">${d.cantidad}</td><td class="r">${sol(d.precio_unitario)}</td><td class="r">${sol(d.importe)}</td></tr>`).join('')}</tbody></table>
    <div class="totales"><div><span>Op. gravada</span><b>${sol(v.subtotal)}</b></div><div><span>IGV (18 %)</span><b>${sol(v.igv)}</b></div>
      <div class="grand"><span>Total</span><b>${sol(v.total)}</b></div></div>`;
  $('#modal').classList.remove('hidden');
});
$('#modalClose').addEventListener('click', () => $('#modal').classList.add('hidden'));
$('#modal').addEventListener('click', e => { if (e.target.id === 'modal') $('#modal').classList.add('hidden'); });

// ---------- Clientes ----------
async function cargarClientes() {
  const tb = $('#tClientes'); tb.innerHTML = '<tr><td colspan="5" class="empty">Cargando…</td></tr>';
  try {
    const filas = await api('/api/clientes?q=' + encodeURIComponent($('#qCliente').value));
    tb.innerHTML = filas.map(c => `<tr><td>${esc(c.tipo_documento)} ${esc(c.nro_documento)}</td><td>${esc(c.nombre)}</td>
      <td>${esc(c.distrito || '—')}</td><td class="r">${c.compras}</td><td class="r">${sol(c.total_comprado)}</td></tr>`).join('')
      || '<tr><td colspan="5" class="empty">Sin resultados</td></tr>';
  } catch (e) { tb.innerHTML = `<tr><td colspan="5" class="empty">${esc(e.message)}</td></tr>`; }
}
$('#btnBuscarCli').addEventListener('click', cargarClientes);
$('#qCliente').addEventListener('keydown', e => { if (e.key === 'Enter') cargarClientes(); });
$('#formCliente').addEventListener('submit', async e => {
  e.preventDefault();
  const body = Object.fromEntries(new FormData(e.target));
  try {
    await api('/api/clientes', { method: 'POST', body });
    setMsg($('#cliMsg'), '✔ Cliente registrado.', true); e.target.reset(); cargarClientes();
  } catch (err) { setMsg($('#cliMsg'), err.message, false); }
});

// ---------- Productos ----------
async function cargarProductos() {
  await cargarCatalogos().catch(() => {});
  $('#pCategoria').innerHTML = catalogos.categorias.map(c => `<option value="${c.id_categoria}">${esc(c.nombre)}</option>`).join('');
  const tb = $('#tProductos'); tb.innerHTML = '<tr><td colspan="8" class="empty">Cargando…</td></tr>';
  try {
    productosCache = await api('/api/productos');
    tb.innerHTML = productosCache.map(p => `<tr>
      <td>${esc(p.codigo)}</td><td>${esc(p.nombre)} ${p.activo ? '' : '<span class="tag off">INACTIVO</span>'}</td><td>${esc(p.categoria)}</td>
      <td class="r">${sol(p.precio_venta)}</td><td class="r">${sol(p.costo_unitario)}</td><td class="r">${p.margen_pct ?? '—'} %</td>
      <td class="r">${p.stock < 20 ? `<span class="tag low">${p.stock}</span>` : p.stock}</td>
      <td class="r"><button class="btn sm" data-edit="${p.id_producto}">Editar</button></td></tr>`).join('');
  } catch (e) { tb.innerHTML = `<tr><td colspan="8" class="empty">${esc(e.message)}</td></tr>`; }
}
function modoEdicion(p) {
  const f = $('#formProducto');
  f.id_producto.value = p ? p.id_producto : '';
  f.codigo.value = p ? p.codigo : ''; f.nombre.value = p ? p.nombre : ''; f.marca.value = p ? (p.marca || '') : '';
  f.precio_venta.value = p ? p.precio_venta : ''; f.costo_unitario.value = p ? p.costo_unitario : '';
  f.stock.value = p ? p.stock : 0; f.activo.checked = p ? !!p.activo : true;
  if (p) f.id_categoria.value = p.id_categoria;
  [f.codigo, f.nombre, f.marca, f.id_categoria].forEach(el => el.disabled = !!p);   // en edición solo precio, costo, stock y estado
  $('#prodTitulo').textContent = p ? `Editar ${p.codigo}` : 'Nuevo producto';
  $('#btnGuardarProd').textContent = p ? 'Guardar cambios' : 'Guardar producto';
  $('#btnCancelarProd').classList.toggle('hidden', !p);
  setMsg($('#prodMsg'), '');
}
$('#tProductos').addEventListener('click', e => {
  const id = Number(e.target.dataset.edit); if (!id) return;
  modoEdicion(productosCache.find(p => p.id_producto === id));
});
$('#btnCancelarProd').addEventListener('click', () => modoEdicion(null));
$('#formProducto').addEventListener('submit', async e => {
  e.preventDefault();
  const f = e.target, editando = !!f.id_producto.value;
  const body = {
    id_producto: Number(f.id_producto.value) || undefined, codigo: f.codigo.value, nombre: f.nombre.value,
    id_categoria: Number(f.id_categoria.value), marca: f.marca.value,
    precio_venta: f.precio_venta.value, costo_unitario: f.costo_unitario.value, stock: f.stock.value, activo: f.activo.checked
  };
  try {
    await api('/api/productos', { method: editando ? 'PUT' : 'POST', body });
    setMsg($('#prodMsg'), editando ? '✔ Cambios guardados.' : '✔ Producto registrado.', true);
    modoEdicion(null); cargarProductos();
  } catch (err) { setMsg($('#prodMsg'), err.message, false); }
});

// ---------- Arranque ----------
(async () => {
  const hoy = new Date(Date.now() - 5 * 3600e3).toISOString().slice(0, 10);
  $('#fHasta').value = hoy;
  $('#fDesde').value = new Date(Date.now() - 5 * 3600e3 - 30 * 86400e3).toISOString().slice(0, 10);
  try { mostrarApp(await api('/api/me')); } catch { mostrarLogin(); }
})();
