import Foundation
import Capacitor
import CoreNFC

/// Reads a D Point stand tag with the system "Ready to Scan" sheet and returns the URL written on it.
/// JS: DPointNfc.scan({ message }) → { url }   (rejects "cancelled" when the user closes the sheet)
@objc(DPointNfcPlugin)
public class DPointNfcPlugin: CAPPlugin, CAPBridgedPlugin, NFCNDEFReaderSessionDelegate {
    public let identifier = "DPointNfcPlugin"
    public let jsName = "DPointNfc"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "scan", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "isAvailable", returnType: CAPPluginReturnPromise)
    ]

    private var session: NFCNDEFReaderSession?
    private var pending: CAPPluginCall?

    @objc func isAvailable(_ call: CAPPluginCall) {
        call.resolve(["available": NFCNDEFReaderSession.readingAvailable])
    }

    @objc func scan(_ call: CAPPluginCall) {
        guard NFCNDEFReaderSession.readingAvailable else {
            call.reject("NFC is not available on this device", "unavailable")
            return
        }
        pending?.reject("cancelled", "cancelled")
        pending = call
        DispatchQueue.main.async {
            let s = NFCNDEFReaderSession(delegate: self, queue: nil, invalidateAfterFirstRead: true)
            s.alertMessage = call.getString("message") ?? "Hold the top of your iPhone near the D Point tag"
            self.session = s
            s.begin()
        }
    }

    public func readerSession(_ session: NFCNDEFReaderSession, didDetectNDEFs messages: [NFCNDEFMessage]) {
        var url = ""
        for message in messages {
            for record in message.records {
                if let u = record.wellKnownTypeURIPayload() { url = u.absoluteString; break }
                let (text, _) = record.wellKnownTypeTextPayload()
                if let t = text, t.contains("/t/") || t.contains("#/tap/") { url = t; break }
            }
            if !url.isEmpty { break }
        }
        session.alertMessage = url.isEmpty ? "ป้ายนี้ไม่ใช่ป้าย D Point" : "อ่านป้ายแล้ว ✓"
        pending?.resolve(["url": url])
        pending = nil
    }

    public func readerSessionDidBecomeActive(_ session: NFCNDEFReaderSession) {}

    public func readerSession(_ session: NFCNDEFReaderSession, didInvalidateWithError error: Error) {
        guard let call = pending else { return }
        pending = nil
        if let e = error as? NFCReaderError,
           e.code == .readerSessionInvalidationErrorUserCanceled || e.code == .readerSessionInvalidationErrorFirstNDEFTagRead {
            call.reject("cancelled", "cancelled")
        } else {
            call.reject(error.localizedDescription, "failed")
        }
    }
}
