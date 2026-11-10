package com.dpointapp.th;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.nfc.NdefMessage;
import android.nfc.NdefRecord;
import android.nfc.NfcAdapter;
import android.nfc.Tag;
import android.nfc.tech.Ndef;
import android.provider.Settings;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Reads the URL written on a D Point NFC tag while the scan screen is open.
 * Android has no system "Ready to Scan" sheet, so the app shows its own screen and listens in reader mode.
 * JS: DPointNfc.scan() → { url }, DPointNfc.stop(), DPointNfc.openSettings().
 * Errors: code NO_NFC (phone has no NFC), NFC_OFF (turned off in Settings), CANCELLED (stop() or left the app).
 */
@CapacitorPlugin(name = "DPointNfc")
public class DPointNfcPlugin extends Plugin {
    private PluginCall pending;

    @PluginMethod
    public void scan(PluginCall call) {
        NfcAdapter nfc = NfcAdapter.getDefaultAdapter(getContext());
        if (nfc == null) { call.reject("This phone has no NFC", "NO_NFC"); return; }
        if (!nfc.isEnabled()) { call.reject("NFC is turned off", "NFC_OFF"); return; }
        if (pending != null) pending.reject("cancelled", "CANCELLED");
        pending = call;
        getActivity().runOnUiThread(this::startReader);
    }

    @PluginMethod
    public void stop(PluginCall call) {
        finish(null, "cancelled");
        call.resolve();
    }

    @PluginMethod
    public void openSettings(PluginCall call) {
        try { getActivity().startActivity(new Intent(Settings.ACTION_NFC_SETTINGS)); }
        catch (Exception e) { getActivity().startActivity(new Intent(Settings.ACTION_WIRELESS_SETTINGS)); }
        call.resolve();
    }

    private void startReader() {
        Activity a = getActivity();
        NfcAdapter nfc = NfcAdapter.getDefaultAdapter(a);
        if (nfc == null || pending == null) return;
        int flags = NfcAdapter.FLAG_READER_NFC_A | NfcAdapter.FLAG_READER_NFC_B | NfcAdapter.FLAG_READER_NFC_F | NfcAdapter.FLAG_READER_NFC_V;
        nfc.enableReaderMode(a, this::onTag, flags, null);
    }

    private void stopReader() {
        Activity a = getActivity();
        NfcAdapter nfc = a == null ? null : NfcAdapter.getDefaultAdapter(a);
        if (nfc != null) a.runOnUiThread(() -> { try { nfc.disableReaderMode(a); } catch (Exception ignored) { } });
    }

    private void onTag(Tag tag) {
        String url = "";
        Ndef ndef = Ndef.get(tag);
        if (ndef != null) {
            NdefMessage msg = ndef.getCachedNdefMessage();
            if (msg == null) {
                try { ndef.connect(); msg = ndef.getNdefMessage(); } catch (Exception ignored) { }
                finally { try { ndef.close(); } catch (Exception ignored) { } }
            }
            if (msg != null) {
                for (NdefRecord r : msg.getRecords()) {
                    Uri u = r.toUri();
                    if (u != null) { url = u.toString(); break; }
                }
            }
        }
        JSObject ret = new JSObject();
        ret.put("url", url);
        finish(ret, null);
    }

    private synchronized void finish(JSObject ok, String error) {
        PluginCall c = pending;
        pending = null;
        stopReader();
        if (c == null) return;
        if (ok != null) c.resolve(ok); else c.reject(error, "CANCELLED");
    }

    // Reader mode only works while the app is in front: pause it when the app goes to the background.
    @Override
    protected void handleOnPause() { super.handleOnPause(); stopReader(); }

    @Override
    protected void handleOnResume() { super.handleOnResume(); if (pending != null) getActivity().runOnUiThread(this::startReader); }
}
