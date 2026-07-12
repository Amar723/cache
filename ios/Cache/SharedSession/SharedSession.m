#import "SharedSession.h"

// Must match `com.apple.security.application-groups` in Cache.entitlements and
// ShareExtension.entitlements.
static NSString *const kAppGroup = @"group.com.goldenavenue.cache";
static NSString *const kSessionKey = @"supabase.session";

@implementation SharedSession

RCT_EXPORT_MODULE();

// Pure UserDefaults I/O — no UIKit — so it's safe off the main queue.
+ (BOOL)requiresMainQueueSetup {
  return NO;
}

- (NSUserDefaults *)sharedDefaults {
  return [[NSUserDefaults alloc] initWithSuiteName:kAppGroup];
}

/** Store the JSON `{access_token, refresh_token}` blob the extension rehydrates. */
RCT_EXPORT_METHOD(setSession:(NSString *)json) {
  [[self sharedDefaults] setObject:json forKey:kSessionKey];
}

/** Wipe on sign-out so a signed-out app can't be shared into as the old user. */
RCT_EXPORT_METHOD(clearSession) {
  [[self sharedDefaults] removeObjectForKey:kSessionKey];
}

/** Read the stored blob (used by the extension). Resolves null when unset. */
RCT_EXPORT_METHOD(getSession:(RCTPromiseResolveBlock)resolve
                   rejecter:(RCTPromiseRejectBlock)reject) {
  NSString *json = [[self sharedDefaults] stringForKey:kSessionKey];
  resolve(json ?: (id)[NSNull null]);
}

@end
