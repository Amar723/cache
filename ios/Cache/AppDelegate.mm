#import "AppDelegate.h"

#import <FirebaseCore/FirebaseCore.h>
#import <React/RCTBundleURLProvider.h>
#import <React/RCTLinkingManager.h>
#import <UserNotifications/UserNotifications.h>
#import <RNCPushNotificationIOS.h>
#import <GoogleMaps/GoogleMaps.h>
#import "RNCConfig.h"
#import "Geofencing/RNGeofencing.h"

@implementation AppDelegate

- (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)launchOptions
{
  // Initialize the default Firebase app from GoogleService-Info.plist. Required
  // by @react-native-firebase on iOS — without it, any messaging() call in JS
  // throws "No Firebase App '[DEFAULT]' has been created". Must run before RN
  // starts so it's ready before index.js's configureRemoteNotifications() runs.
  [FIRApp configure];

  [GMSServices provideAPIKey:[RNCConfig envFor:@"GOOGLE_MAPS_API_KEY_IOS"]];

  self.moduleName = @"Cache";
  // You can add your custom initial props in the dictionary below.
  // They will be passed down to the ViewController used by React Native.
  self.initialProps = @{};

  BOOL launched = [super application:application didFinishLaunchingWithOptions:launchOptions];

  // When iOS relaunches a *terminated* app for a region / significant-location
  // event, the queued event is only delivered if a CLLocationManager with a
  // delegate exists at launch. Our manager lives in the RNGeofencing module,
  // which is otherwise created lazily once JS runs — too late on a background
  // relaunch. Force it to instantiate now so its delegate is ready to receive
  // the pending didEnterRegion. (bridge is nil under the new arch; harmless.)
  if (launchOptions[UIApplicationLaunchOptionsLocationKey] != nil) {
    [self.bridge moduleForClass:[RNGeofencing class]];
  }

  return launched;
}

- (NSURL *)sourceURLForBridge:(RCTBridge *)bridge
{
  return [self bundleURL];
}

// Deep links — including the `cache://share?url=…` link the Share Extension
// sends — are forwarded to JS via the Linking API (see src/lib/share.ts).
- (BOOL)application:(UIApplication *)application
            openURL:(NSURL *)url
            options:(NSDictionary<UIApplicationOpenURLOptionsKey, id> *)options
{
  return [RCTLinkingManager application:application openURL:url options:options];
}

// Required to register for notifications
- (void)application:(UIApplication *)application didRegisterUserNotificationSettings:(UIUserNotificationSettings *)notificationSettings
{
  [RNCPushNotificationIOS didRegisterUserNotificationSettings:notificationSettings];
}

// Required for the register event.
- (void)application:(UIApplication *)application didRegisterForRemoteNotificationsWithDeviceToken:(NSData *)deviceToken
{
  [RNCPushNotificationIOS didRegisterForRemoteNotificationsWithDeviceToken:deviceToken];
}

// Required for the notification event. You must call the completion handler after handling the remote notification.
- (void)application:(UIApplication *)application didReceiveRemoteNotification:(NSDictionary *)userInfo
fetchCompletionHandler:(void (^)(UIBackgroundFetchResult))completionHandler
{
  [RNCPushNotificationIOS didReceiveRemoteNotification:userInfo fetchCompletionHandler:completionHandler];
}

// Required for the registrationError event.
- (void)application:(UIApplication *)application didFailToRegisterForRemoteNotificationsWithError:(NSError *)error
{
  [RNCPushNotificationIOS didFailToRegisterForRemoteNotificationsWithError:error];
}

// IOS 10+ Required for localNotification event
- (void)userNotificationCenter:(UNUserNotificationCenter *)center
didReceiveNotificationResponse:(UNNotificationResponse *)response
         withCompletionHandler:(void (^)(void))completionHandler
{
  [RNCPushNotificationIOS didReceiveNotificationResponse:response];
  completionHandler();
}

// Called when a notification is delivered to a foreground app.
- (void)userNotificationCenter:(UNUserNotificationCenter *)center
       willPresentNotification:(UNNotification *)notification
         withCompletionHandler:(void (^)(UNNotificationPresentationOptions options))completionHandler
{
  completionHandler(UNNotificationPresentationOptionSound | UNNotificationPresentationOptionList | UNNotificationPresentationOptionBanner | UNNotificationPresentationOptionBadge);
}

- (NSURL *)bundleURL
{
#if DEBUG
  return [[RCTBundleURLProvider sharedSettings] jsBundleURLForBundleRoot:@"index"];
#else
  return [[NSBundle mainBundle] URLForResource:@"main" withExtension:@"jsbundle"];
#endif
}

@end
