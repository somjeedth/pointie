// Supabase "Send SMS" auth hook → boost-sms.
// Supabase generates the 6-digit code and calls this function; we only deliver it.
//
// Secrets (Dashboard → Edge Functions → Secrets):
//   SEND_SMS_HOOK_SECRET  the "v1,whsec_..." secret shown when you create the hook
//   BOOST_SMS_URL         boost-sms "send SMS" endpoint
//   BOOST_SMS_API_KEY     boost-sms API key
//   BOOST_SMS_API_SECRET  boost-sms API secret (leave unset if the API has none)
//   BOOST_SMS_SENDER      approved sender name, e.g. Pointie
// Deploy with "Verify JWT" OFF: Supabase Auth signs the request itself (checked below).
import { Webhook } from 'npm:standardwebhooks@1.0.0';

const env = (k: string) => Deno.env.get(k) ?? '';

// +66812345678 / 66812345678 → 0812345678 (Thai local format)
const localTh = (p: string) => { const d = p.replace(/\D/g, ''); return d.startsWith('66') ? '0' + d.slice(2) : d; };

// ---- the only part that depends on boost-sms's API format ----
async function sendSms(phone: string, text: string): Promise<void> {
  const res = await fetch(env('BOOST_SMS_URL'), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': env('BOOST_SMS_API_KEY'),
      ...(env('BOOST_SMS_API_SECRET') ? { 'x-api-secret': env('BOOST_SMS_API_SECRET') } : {}),
    },
    body: JSON.stringify({ sender: env('BOOST_SMS_SENDER') || 'Pointie', msisdn: localTh(phone), message: text }),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`boost-sms ${res.status}: ${body.slice(0, 300)}`);
  console.log('boost-sms ok', res.status, body.slice(0, 200));
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
    await sendSms(phone, `รหัส Pointie ของคุณคือ ${code} (ใช้ได้ 5 นาที) ห้ามบอกรหัสนี้กับใคร`);
  } catch (e) {
    console.error(String(e));
    return fail(502, 'sms provider error');
  }
  return new Response('{}', { headers: { 'content-type': 'application/json' } });
});
