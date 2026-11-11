import SwiftUI
import UIKit
import WebKit
import UserNotifications
import UniformTypeIdentifiers

@main struct AliMirzaApp: App {
    var body: some Scene { WindowGroup { TimeWebView().ignoresSafeArea(.container, edges: .bottom) } }
}
struct TimeWebView: UIViewRepresentable {
    func makeUIView(context: Context) -> WKWebView {
        let controller = WKUserContentController()
        controller.add(context.coordinator, name: "aliMirza")
        let js = "window.IOSZaman={post:function(kind,payload){window.webkit.messageHandlers.aliMirza.postMessage({kind:kind,payload:payload});}};"
        controller.addUserScript(WKUserScript(source: js, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        let config = WKWebViewConfiguration()
        config.userContentController = controller
        config.websiteDataStore = .default()
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []
        let web = WKWebView(frame: .zero, configuration: config)
        web.uiDelegate = context.coordinator
        web.navigationDelegate = context.coordinator
        web.isOpaque = false
        web.backgroundColor = UIColor(red: 245/255, green: 246/255, blue: 242/255, alpha: 1)
        context.coordinator.web = web
        web.load(URLRequest(url: Coordinator.home))
        return web
    }
    func updateUIView(_ view: WKWebView, context: Context) {}
    func makeCoordinator() -> Coordinator { Coordinator() }
    final class Coordinator: NSObject, WKScriptMessageHandler, WKNavigationDelegate, WKUIDelegate {
        static let home = URL(string: "https://thumper9480-droid.github.io/racking/zaman/")!
        weak var web: WKWebView?
        var scheduleGeneration = 0
        func trusted(_ url: URL?) -> Bool {
            guard let u = url else { return false }
            return u.scheme == "https" && u.host == Self.home.host && (u.port == nil || u.port == 443) && u.path.hasPrefix("/racking/zaman/")
        }
        func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
            guard message.frameInfo.isMainFrame, trusted(message.frameInfo.request.url), let body = message.body as? [String: Any], let kind = body["kind"] as? String, let payload = body["payload"] as? [String: Any] else { return }
            switch kind {
            case "permissions": UNUserNotificationCenter.current().requestAuthorization(options: [.alert,.sound,.badge]) { _,_ in }
            case "sync": schedule(payload)
            case "export":
                if let text = payload["text"] as? String, let data = text.data(using: .utf8), data.count <= 100*1024*1024 { export(data, filename: "zaman-backup.json") }
            case "guide":
                let url = Self.home.appendingPathComponent("user-guide.pdf")
                URLSession.shared.dataTask(with: url) { data,response,error in
                    guard error == nil, let data = data, let response = response as? HTTPURLResponse, response.statusCode == 200, data.count < 20*1024*1024, data.starts(with: Data("%PDF-".utf8)) else { return }
                    DispatchQueue.main.async { self.export(data, filename: "ali-mirza-user-guide.pdf") }
                }.resume()
            default: break
            }
        }
        func export(_ data: Data, filename: String) {
            do {
                let dir = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString, isDirectory: true)
                try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
                let url = dir.appendingPathComponent(filename)
                try data.write(to: url, options: .atomic)
                let picker = UIDocumentPickerViewController(forExporting: [url], asCopy: true)
                guard let root = web?.window?.rootViewController else { return }
                var presenter = root
                while let shown = presenter.presentedViewController { presenter = shown }
                presenter.present(picker, animated: true)
            } catch { }
        }
        func schedule(_ payload: [String: Any]) {
            scheduleGeneration += 1
            let generation = scheduleGeneration
            let center = UNUserNotificationCenter.current()
            let now = Date()
            var entries: [(String,String,Date,String)] = []
            let projects = payload["projects"] as? [[String:Any]] ?? []
            for alarm in payload["alarms"] as? [[String:Any]] ?? [] {
                guard alarm["enabled"] as? Bool == true, let id = alarm["id"] as? String, let stamp = alarm["at"] as? Double else { continue }
                if let pid = alarm["projectId"] as? String, let p = projects.first(where: {$0["id"] as? String == pid}) {
                    if p["deletedAt"] is Double { continue }
                    if let tid = alarm["itemId"] as? String, let t = (p["tasks"] as? [[String:Any]])?.first(where: {$0["id"] as? String == tid}), t["done"] as? Bool == true { continue }
                }
                var date = Date(timeIntervalSince1970: stamp/1000)
                let rule = alarm["repeat"] as? String ?? "none"
                if date <= now && rule != "none" {
                    var components = Calendar.current.dateComponents([.hour,.minute,.second], from: date)
                    if rule == "weekly" { components.weekday = Calendar.current.component(.weekday, from: date) }
                    if let next = Calendar.current.nextDate(after: now, matching: components, matchingPolicy: .nextTime) { date = next }
                }
                if date > now { entries.append((id,alarm["title"] as? String ?? "یادآور",date,rule)) }
            }
            if let timer = payload["countdown"] as? [String:Any], let end = timer["end"] as? Double, Date(timeIntervalSince1970:end/1000) > now { entries.append(("countdown","پایان تایمر معکوس",Date(timeIntervalSince1970:end/1000),"none")) }
            entries.sort {$0.2 < $1.2}
            let selected = Array(entries.prefix(60))
            center.getNotificationSettings { settings in
                guard settings.authorizationStatus == .authorized || settings.authorizationStatus == .provisional else { return }
                DispatchQueue.main.async {
                    guard generation == self.scheduleGeneration else { return }
                    center.removeAllPendingNotificationRequests()
                    for (id,title,date,rule) in selected {
                        let content = UNMutableNotificationContent(); content.title = "مدیریت زمان علی میرزا";content.body = title;content.sound = .default
                        let fields: Set<Calendar.Component> = rule == "daily" ? [.hour,.minute,.second] : rule == "weekly" ? [.weekday,.hour,.minute,.second] : [.year,.month,.day,.hour,.minute,.second]
                        let parts = Calendar.current.dateComponents(fields, from: date)
                        center.add(UNNotificationRequest(identifier:id,content:content,trigger:UNCalendarNotificationTrigger(dateMatching:parts,repeats:rule != "none")))
                    }
                }
            }
        }
        func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            guard let url = navigationAction.request.url else { decisionHandler(.cancel);return }
            if trusted(url) || url.absoluteString == "about:blank" { decisionHandler(.allow);return }
            if url.scheme == "tel" && url.absoluteString == "tel:09131693134" && navigationAction.navigationType == .linkActivated { UIApplication.shared.open(url) }
            decisionHandler(.cancel)
        }
        func webView(_ webView: WKWebView, requestMediaCapturePermissionFor origin: WKSecurityOrigin, initiatedByFrame frame: WKFrameInfo, type: WKMediaCaptureType, decisionHandler: @escaping (WKPermissionDecision) -> Void) {
            decisionHandler(origin.protocol == "https" && origin.host == Self.home.host && frame.isMainFrame && type == .microphone ? .prompt : .deny)
        }
    }
}
