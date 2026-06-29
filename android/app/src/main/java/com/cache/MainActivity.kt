package com.cache

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

class MainActivity : ReactActivity() {

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "Cache"

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)

  /**
   * A share from another app arrives as an `ACTION_SEND` intent, which React Native's `Linking`
   * API does not surface. We rewrite it into the same `cache://share?url=<encoded>` deep link the
   * iOS Share Extension emits, so `src/lib/share.ts` handles both platforms through one path.
   *
   * The shared text is passed through verbatim — the JS side pulls the actual video URL out of it
   * (a share is often a caption plus a link). `ReactInstanceManager.onNewIntent` only emits the
   * JS `url` event for `ACTION_VIEW` intents with data, which is exactly what we produce here.
   */
  override fun onCreate(savedInstanceState: Bundle?) {
    shareDeepLink(intent)?.let { setIntent(it) }
    super.onCreate(savedInstanceState)
  }

  override fun onNewIntent(intent: Intent) {
    val converted = shareDeepLink(intent) ?: intent
    super.onNewIntent(converted)
    // Keep getInitialURL() consistent if JS reads it after a warm share.
    setIntent(converted)
  }

  /** Convert an `ACTION_SEND` text share into a `cache://share?url=…` VIEW intent, else null. */
  private fun shareDeepLink(source: Intent?): Intent? {
    if (source?.action != Intent.ACTION_SEND) return null
    val shared = source.getStringExtra(Intent.EXTRA_TEXT) ?: return null
    val deepLink = "cache://share?url=" + Uri.encode(shared)
    return Intent(Intent.ACTION_VIEW, Uri.parse(deepLink))
  }
}
