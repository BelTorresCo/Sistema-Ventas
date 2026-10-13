// Utilidades comunes: sesión firmada en cookie, respuestas JSON y manejo de errores.
const crypto = require('crypto');

const COOKIE = 'sv_session';
const HORAS = 8;

function secret() {
  return process.env.SESSION_SECRET || 'cambia-esta-clave-en-vercel';
}

function firmar(payload) {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', secret()).update(data).digest('base64url');
  return `${data}.${sig}`;
}

function verificar(token) {
  if (!token || !token.includes('.')) return null;
  const [data, sig] = token.split('.');
  const esperado = crypto.createHmac('sha256', secret()).update(data).digest('base64url');
  const a = Buffer.from(sig), b = Buffer.from(esperado);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  const payload = JSON.parse(Buffer.from(data, 'base64url').toString());
  if (payload.exp < Date.now()) return null;
  return payload;
}

function leerCookie(req) {
  const raw = req.headers.cookie || '';
  const par = raw.split(';').map(s => s.trim()).find(s => s.startsWith(COOKIE + '='));
  return par ? decodeURIComponent(par.slice(COOKIE.length + 1)) : null;
}

function crearSesion(res, usuario) {
  const token = firmar({ ...usuario, exp: Date.now() + HORAS * 3600 * 1000 });
  res.setHeader('Set-Cookie',
    `${COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${HORAS * 3600}`);
}

function cerrarSesion(res) {
  res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);
}

function json(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

// Envuelve un handler: exige sesión (salvo publico=true) y captura errores de SQL.
function handler(fn, { publico = false } = {}) {
  return async (req, res) => {
    try {
      const usuario = verificar(leerCookie(req));
      if (!publico && !usuario) return json(res, 401, { error: 'Sesión expirada. Vuelve a iniciar sesión.' });
      req.usuario = usuario;
      await fn(req, res);
    } catch (err) {
      console.error(err);
      let msg = err.message || 'Error interno';
      if (err.number === 2627 || err.number === 2601) msg = 'Ya existe un registro con ese código o documento.';
      if (err.code === 'ETIMEOUT' || err.code === 'ESOCKET')
        msg = 'La base de datos está despertando (pausa automática). Intenta de nuevo en unos segundos.';
      json(res, err.status || 500, { error: msg });
    }
  };
}

function falla(status, mensaje) {
  const e = new Error(mensaje);
  e.status = status;
  return e;
}

module.exports = { handler, json, crearSesion, cerrarSesion, falla };
