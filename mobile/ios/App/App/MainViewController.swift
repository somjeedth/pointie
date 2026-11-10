import UIKit
import Capacitor
import AuthenticationServices

/// Capacitor bridge view controller that also registers the app's own plugins.
class MainViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(DPointNfcPlugin())
        bridge?.registerPluginInstance(DPointAuthPlugin())
    }
}

/// Google sign-in (and any web sign-in) in the system sign-in sheet: opens the Supabase authorize URL and returns the
/// com.dpointapp.th://auth#access_token=… link it ends on. JS: DPointAuth.start({ url, callbackScheme }) → { url }
/// Rejects with code CANCELLED when the user closes the sheet.
@objc(DPointAuthPlugin)
public class DPointAuthPlugin: CAPPlugin, CAPBridgedPlugin, ASWebAuthenticationPresentationContextProviding {
    public let identifier = "DPointAuthPlugin"
    public let jsName = "DPointAuth"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise)
    ]
    private var session: ASWebAuthenticationSession?

    @objc func start(_ call: CAPPluginCall) {
        guard let s = call.getString("url"), let url = URL(string: s) else {
            call.reject("missing url", "FAILED")
            return
        }
        let scheme = call.getString("callbackScheme") ?? "com.dpointapp.th"
        DispatchQueue.main.async {
            let session = ASWebAuthenticationSession(url: url, callbackURLScheme: scheme) { [weak self] callbackURL, error in
                self?.session = nil
                if let callbackURL = callbackURL {
                    call.resolve(["url": callbackURL.absoluteString])
                } else if let e = error as? ASWebAuthenticationSessionError, e.code == .canceledLogin {
                    call.reject("cancelled", "CANCELLED")
                } else {
                    call.reject(error?.localizedDescription ?? "sign-in failed", "FAILED")
                }
            }
            session.presentationContextProvider = self
            session.prefersEphemeralWebBrowserSession = false
            self.session = session
            if !session.start() {
                self.session = nil
                call.reject("could not open the sign-in page", "FAILED")
            }
        }
    }

    public func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        return bridge?.webView?.window ?? ASPresentationAnchor()
    }
}
