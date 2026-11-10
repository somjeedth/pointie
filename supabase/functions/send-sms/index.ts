// Supabase "Send SMS" auth hook → boost-sms.
// Supabase generates the 6-digit code and calls this function; we only deliver it.
//
// Secrets (Dashboard → Edge Functions → Secrets):
//   SEND_SMS_HOOK_SECRET   the "v1,whsec_..." secret shown when you create the hook
//   BOOST_SMS_API_BASE     optional, default https://app.boost-sms.com/api/v1
//   BOOST_SMS_API_KEY      API key created in boost-sms → SMS API
//   BOOST_SMS_SENDER       REQUIRED: a sender name approved in boost-sms → ชื่อผู้ส่ง (e.g. DPoint)
//   BOOST_SMS_AUTH_HEADER  optional, default "Authorization" ("Bearer sk_live_…"); boost-sms also accepts "x-api-key"
// boost-sms limits: SMS 10 req/min per key → 429 (passed on so the app says "try again shortly").
// Deploy with "Verify JWT" OFF: Supabase Auth signs the request itself (checked below).
import { Webhook } from 'npm:standardwebhooks@1.0.0';

const env = (k: string) => Deno.env.get(k) ?? '';

// 66812345678 / +66812345678 / 0812345678 → +66812345678
const e164 = (p: string) => { const d = p.replace(/\D/g, ''); return '+' + (d.startsWith('0') ? '66' + d.slice(1) : d); };

// ---- the only part that depends on boost-sms's API ----
// POST {base}/sms/send  { to, message, sender }  — "to" accepts E.164 or local format.
// The live API requires the sender as `sender` (or `senderName`), not `sender_name` as the docs table says.
class RateLimited extends Error {}
async function sendSms(phone: string, text: string): Promise<void> {
  const base = (env('BOOST_SMS_API_BASE') || 'https://app.boost-sms.com/api/v1').replace(/\/+$/, '');
  if (!env('BOOST_SMS_API_KEY')) throw new Error('BOOST_SMS_API_KEY not set');
  if (!env('BOOST_SMS_SENDER')) throw new Error('BOOST_SMS_SENDER not set (approved sender name)');
  const header = env('BOOST_SMS_AUTH_HEADER') || 'Authorization';
  const key = env('BOOST_SMS_API_KEY');
  const body = { to: e164(phone), message: text, sender: env('BOOST_SMS_SENDER') };
  const res = await fetch(`${base}/sms/send`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json', [header]: header.toLowerCase() === 'authorization' ? `Bearer ${key}` : key },
    body: JSON.stringify(body),
  });
  const out = await res.text();
  if (res.status === 429) throw new RateLimited(out.slice(0, 200));
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
    if (e instanceof RateLimited) return fail(429, 'SMS rate limit reached, too many requests — try again in a minute');
    return fail(502, 'sms provider error');
  }
  return new Response('{}', { headers: { 'content-type': 'application/json' } });
});
