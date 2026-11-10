// Supabase project used by both the customer app and the merchant web.
// The publishable key is meant to be public; data access is enforced by the
// SECURITY DEFINER functions in supabase/schema.sql.
// Leave SUPABASE_URL empty (or open the page with ?local=1) to run the
// self-contained localStorage demo instead.
export const SUPABASE_URL = 'https://vcerkaqjagvciuxjgktg.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_xz55KJNbqLcp49cn4pcCRQ_Ko7Fl_Kw';

// Real SMS OTP (Supabase Phone sign-in + "Send SMS" hook → boost-sms, see supabase/README.md).
// false = the on-screen simulated code + an anonymous account per device.
export const SMS_OTP = false;

// Google sign-in inside the iOS app: the iOS OAuth client ID (Google Cloud → Clients → iOS, bundle com.dpointapp.th)
// and the Web client ID (the one already in Supabase → Google). Empty = the Google button is hidden in the app.
export const GOOGLE_IOS_CLIENT_ID = '';
export const GOOGLE_WEB_CLIENT_ID = '';
