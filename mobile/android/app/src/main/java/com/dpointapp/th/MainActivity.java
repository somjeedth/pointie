package com.dpointapp.th;

import android.content.Intent;
import android.nfc.NfcAdapter;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(DPointNfcPlugin.class);
        asViewIntent(getIntent());
        super.onCreate(savedInstanceState);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        asViewIntent(intent);
        super.onNewIntent(intent);
    }

    // A D Point tag tapped while the phone is unlocked arrives as NDEF_DISCOVERED with the tag's URL.
    // Hand it on as a normal link (ACTION_VIEW) so the App plugin reports it like any other opened link.
    private static void asViewIntent(Intent intent) {
        if (intent != null && NfcAdapter.ACTION_NDEF_DISCOVERED.equals(intent.getAction()) && intent.getData() != null) {
            intent.setAction(Intent.ACTION_VIEW);
        }
    }
}
