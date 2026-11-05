// Thin Supabase wrapper shared by the customer app and the merchant web.
// Everything goes through RPC functions (see supabase/schema.sql).
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';

const clients = {};
let forcedLocal = false;
try { forcedLocal = new URLSearchParams(location.search).has('local') || sessionStorage.getItem('pointie.local') === '1'; } catch { /* ignore */ }
try { if (forcedLocal) sessionStorage.setItem('pointie.local', '1'); } catch { /* ignore */ }

export const configured = () => !forcedLocal && !!SUPABASE_URL && !!SUPABASE_KEY && !!window.supabase?.createClient;

// Separate auth storage per app so a merchant login never replaces a customer session.
export function client(app = 'customer') {
  if (!configured()) return null;
  if (!clients[app]) {
    clients[app] = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, storageKey: `pointie.auth.${app}`, detectSessionInUrl: false },
    });
  }
  return clients[app];
}

export class RemoteError extends Error {
  constructor(message, code) { super(message); this.code = code; }
}
export async function rpc(app, name, args, timeoutMs = 12000) {
  const c = client(app);
  if (!c) throw new RemoteError('not_configured');
  let timer;
  const timeout = new Promise((_, rej) => { timer = setTimeout(() => rej(new RemoteError('timeout', 'timeout')), timeoutMs); });
  const { data, error } = await Promise.race([c.rpc(name, args), timeout]).finally(() => clearTimeout(timer));
  if (error) throw new RemoteError(error.message || 'rpc_failed', error.code);
  return data;
}
export async function session(app) {
  const c = client(app); if (!c) return null;
  const { data } = await c.auth.getSession();
  return data?.session || null;
}
// Supabase auth calls have no timeout of their own.
export function timed(promise, ms = 15000) {
  let timer;
  const t = new Promise((_, rej) => { timer = setTimeout(() => rej(new RemoteError('timeout', 'timeout')), ms); });
  return Promise.race([promise, t]).finally(() => clearTimeout(timer));
}
