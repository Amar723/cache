#import <React/RCTBridgeModule.h>

/**
 * Bridges the Supabase auth session into the App Group container shared by the
 * Cache app and its Share Extension. The app writes the current session on every
 * auth change; the extension reads it back to spin up an authenticated Supabase
 * client, so a stash can be saved as the logged-in user without ever leaving the
 * share drawer.
 *
 * Compiled into BOTH the Cache and ShareExtension targets — each target's RN
 * bridge auto-registers the module, and they meet in the shared UserDefaults
 * suite (see kAppGroup, which must match both targets' entitlements).
 */
@interface SharedSession : NSObject <RCTBridgeModule>
@end
