// Supabase "Send SMS" auth hook → boost-sms.
// Supabase generates the 6-digit code and calls this function; we only deliver it.
//
// Secrets (Dashboard → Edge Functions → Secrets):
//   SEND_SMS_HOOK_SECRET   the "v1,whsec_..." secret shown when you create the hook
//   BOOST_SMS_API_BASE     boost-sms API base URL, the part before /sms/send (see their API docs)
//   BOOST_SMS_API_KEY      API key created in boost-sms → SMS API
//   BOOST_SMS_SENDER       approved sender name, e.g. DPoint (optional; boost-sms default if unset)
//   BOOST_SMS_AUTH_HEADER  optional, default "Authorization" (sent as "Bearer <key>");
//                          set e.g. "X-API-Key" if their Authentication section says so (key sent as-is)
// Deploy with "Verify JWT" OFF: Supabase Auth signs the request itself (checked below).
import { Webhook } from 'npm:standardwebhooks@1.0.0';

const env = (k: string) => Deno.env.get(k) ?? '';

// 66812345678 / +66812345678 / 0812345678 → +66812345678
const e164 = (p: string) => { const d = p.replace(/\D/g, ''); return '+' + (d.startsWith('0') ? '66' + d.slice(1) : d); };

// ---- the only part that depends on boost-sms's API ----
// POST {base}/sms/send  { to, message, sender_name? }  — "to" accepts E.164 or local format.
async function sendSms(phone: string, text: string): Promise<void> {
  const base = env('BOOST_SMS_API_BASE').replace(/\/+$/, '');
  if (!base || !env('BOOST_SMS_API_KEY')) throw new Error('BOOST_SMS_API_BASE / BOOST_SMS_API_KEY not set');
  const header = env('BOOST_SMS_AUTH_HEADER') || 'Authorization';
  const key = env('BOOST_SMS_API_KEY');
  const body: Record<string, string> = { to: e164(phone), message: text };
  if (env('BOOST_SMS_SENDER')) body.sender_name = env('BOOST_SMS_SENDER');
  const res = await fetch(`${base}/sms/send`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json', [header]: header.toLowerCase() === 'authorization' ? `Bearer ${key}` : key },
    body: JSON.stringify(body),
  });
  const out = await res.text();
  if (!res.ok) throw new Error(`boost-sms ${res.status}: ${out.slice(0, 300)}`);
  console.log('boost-sms sent', res.status, out.slice(0, 200)); // contains the message id (GET /sms/status/{id})
}
// ----------------------------------------------------------------

const fail = (status: number, message: string) =>
  new Response(JSON.stringify({ error: { http_code: status, message } }), { status, headers: { 'content-type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method !== 'POST') return fail(405, 'method not allowed');
  const payload = await req.text();
  let data: { user: { phone?: string; new_phone?: string }; sms: { otp: string } };
  try {
    const secret = env('SEND_SMS_HOOK_SECRET').replace('v1,whsec_', '');
    data = new Webhook(secret).verify(payload, Object.fromEntries(req.headers)) as typeof data;
  } catch (_e) {
    return fail(401, 'invalid signature');
  }
  // When a number is being attached to an existing account, Supabase sends it as new_phone.
  const phone = data.user?.new_phone || data.user?.phone || '';
  const code = data.sms?.otp || '';
  if (!phone || !/^\d{6}$/.test(code)) return fail(400, 'missing phone or code');
  try {
    await sendSms(phone, `รหัส D Point: ${code} ใช้ได้ 5 นาที ห้ามบอกรหัสนี้กับผู้อื่น`);
  } catch (e) {
    console.error(String(e));
    return fail(502, 'sms provider error');
  }
  return new Response('{}', { headers: { 'content-type': 'application/json' } });
});
