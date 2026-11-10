import UIKit
import Capacitor

/// Capacitor bridge view controller that also registers the app's own plugins.
class MainViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(DPointNfcPlugin())
    }
}
