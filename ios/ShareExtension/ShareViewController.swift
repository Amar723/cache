//
//  ShareViewController.swift
//  ShareExtension
//
//  A minimal Share Extension: pull the shared link out of the iOS share sheet,
//  hand it to the Cache app through a `cache://share?url=…` deep link, then
//  dismiss. We pass the URL via a custom URL scheme rather than an App Group, so
//  this works on a free Apple Developer account (App Groups need a paid one).
//

import UIKit

class ShareViewController: UIViewController {

  private var didHandle = false

  override func viewDidLoad() {
    super.viewDidLoad()
    view.backgroundColor = .clear
  }

  // Important: do the work only once the extension is actually on screen.
  // Completing the request from viewDidLoad (before the view appears) interrupts
  // the presentation and leaves the host app's share UI frozen.
  override func viewDidAppear(_ animated: Bool) {
    super.viewDidAppear(animated)
    guard !didHandle else { return }
    didHandle = true
    extractSharedURL()
  }

  private func extractSharedURL() {
    guard
      let item = extensionContext?.inputItems.first as? NSExtensionItem,
      let providers = item.attachments
    else {
      NSLog("[Cache] ShareExtension: no input items / attachments")
      return complete()
    }

    let urlType = "public.url"
    let textType = "public.plain-text"

    // Prefer a real URL attachment (how TikTok and most apps share a link).
    if let provider = providers.first(where: {
      $0.hasItemConformingToTypeIdentifier(urlType)
    }) {
      provider.loadItem(forTypeIdentifier: urlType, options: nil) { [weak self] value, _ in
        self?.finish(with: (value as? URL)?.absoluteString)
      }
      return
    }

    // Fall back to plain text that may contain a link.
    if let provider = providers.first(where: {
      $0.hasItemConformingToTypeIdentifier(textType)
    }) {
      provider.loadItem(forTypeIdentifier: textType, options: nil) { [weak self] value, _ in
        self?.finish(with: value as? String)
      }
      return
    }

    NSLog("[Cache] ShareExtension: no url/text attachment among %d providers", providers.count)
    complete()
  }

  private func finish(with shared: String?) {
    // loadItem's completion is off the main thread; UIKit/responder work isn't.
    DispatchQueue.main.async { [weak self] in
      guard let self = self else { return }
      guard let shared = shared, let deepLink = Self.deepLink(for: shared) else {
        NSLog("[Cache] ShareExtension: could not build deep link from %@", shared ?? "nil")
        self.complete()
        return
      }
      self.openHostApp(deepLink)
    }
  }

  private static func deepLink(for shared: String) -> URL? {
    var allowed = CharacterSet.urlQueryAllowed
    allowed.remove(charactersIn: "&=?#+")
    let encoded = shared.addingPercentEncoding(withAllowedCharacters: allowed) ?? ""
    return URL(string: "cache://share?url=\(encoded)")
  }

  // Launch the containing Cache app via its `cache://` URL scheme.
  //
  // An app extension can't call `UIApplication.open` directly (it's marked
  // unavailable to extensions), and `NSExtensionContext.open` only works for
  // Today extensions / http(s) URLs — neither helps a share extension open a
  // custom scheme. The working path is to walk the responder chain to the real
  // `UIApplication` instance and message its opener dynamically. We prefer the
  // current `openURL:options:completionHandler:` because the legacy one-arg
  // `openURL:` no longer launches the host from an extension on recent iOS.
  private func openHostApp(_ url: URL) {
    guard let application = responderChainApplication() else {
      NSLog("[Cache] ShareExtension: no UIApplication in responder chain — cannot open host")
      return complete()
    }

    let modern = sel_registerName("openURL:options:completionHandler:")
    let legacy = sel_registerName("openURL:")

    if application.responds(to: modern) {
      typealias OpenURL = @convention(c) (NSObject, Selector, NSURL, NSDictionary, Any?) -> Void
      let imp = application.method(for: modern)
      let openURL = unsafeBitCast(imp, to: OpenURL.self)
      openURL(application, modern, url as NSURL, NSDictionary(), nil)
      NSLog("[Cache] ShareExtension: opened host via openURL:options:completionHandler:")
    } else if application.responds(to: legacy) {
      application.perform(legacy, with: url)
      NSLog("[Cache] ShareExtension: opened host via legacy openURL:")
    } else {
      NSLog("[Cache] ShareExtension: UIApplication exposes no openURL selector")
    }

    // Give the app-switch a beat to begin before tearing down the extension.
    DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) { [weak self] in
      self?.complete()
    }
  }

  /// Walk the responder chain to the process's `UIApplication`, if present.
  private func responderChainApplication() -> UIApplication? {
    var responder: UIResponder? = self
    while let current = responder {
      if let application = current as? UIApplication {
        return application
      }
      responder = current.next
    }
    return nil
  }

  private func complete() {
    extensionContext?.completeRequest(returningItems: [], completionHandler: nil)
  }
}
