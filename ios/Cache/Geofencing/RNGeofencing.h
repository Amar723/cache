#import <CoreLocation/CoreLocation.h>
#import <React/RCTBridgeModule.h>

/**
 * Native iOS geofencing for Cache.
 *
 * Wraps CLLocationManager region monitoring so the app is notified the instant
 * the user crosses into the 1km radius of an unvisited stash — even when the app
 * is terminated (iOS relaunches us in the background to deliver the event). The
 * notification is posted natively via UNUserNotificationCenter so no JS needs to
 * be running at fire time.
 *
 * JS keeps the monitored set in sync by passing the full unvisited-stash list to
 * `setGeofences`; this module picks the nearest 20 (iOS's hard cap) and
 * re-registers as the user moves (significant-location-change).
 */
@interface RNGeofencing : NSObject <RCTBridgeModule, CLLocationManagerDelegate>
@end
