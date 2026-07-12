#import "RNGeofencing.h"
#import <UserNotifications/UserNotifications.h>

/**
 * Proximity band, in metres. Mirrors TIER_1_RADIUS_M / TIER_2_RADIUS_M in
 * src/lib/distance.ts — keep the two in sync.
 *
 *   - Under kInnerRadiusM  → silent (you're basically there).
 *   - kInner..kOuter       → "You're within {x}m from {place}, check it out!"
 *   - Over kOuterRadiusM   → silent.
 */
static const CLLocationDistance kInnerRadiusM = 100.0;
static const CLLocationDistance kOuterRadiusM = 1000.0;
static const NSUInteger kMaxRegions = 20; // iOS hard cap on monitored regions
static const NSTimeInterval kCooldownSeconds = 7 * 24 * 60 * 60; // once per week
static const NSInteger kWeekMinutes = 7 * 1440;

@interface RNGeofencing ()
@property (nonatomic, strong) CLLocationManager *manager;
/** Full list of unvisited stashes pushed from JS: {id, name, lat, lng}. */
@property (nonatomic, strong) NSArray<NSDictionary *> *stashes;
@end

@implementation RNGeofencing

RCT_EXPORT_MODULE();

- (instancetype)init {
  if (self = [super init]) {
    _stashes = @[];
    _manager = [[CLLocationManager alloc] init];
    _manager.delegate = self;
    _manager.pausesLocationUpdatesAutomatically = NO;
  }
  return self;
}

+ (BOOL)requiresMainQueueSetup {
  return YES;
}

#pragma mark - Exported API

RCT_EXPORT_METHOD(requestAlwaysAuthorization) {
  dispatch_async(dispatch_get_main_queue(), ^{
    [self ensureAuthorization];
  });
}

RCT_EXPORT_METHOD(setGeofences:(NSArray *)stashes) {
  self.stashes = stashes ?: @[];
  dispatch_async(dispatch_get_main_queue(), ^{
    // Start as soon as we're authorized at all. After the user grants "While
    // Using" to our Always request, iOS reports AuthorizedWhenInUse but has
    // granted *provisional* Always, so region + significant-change monitoring
    // works in the background. iOS then surfaces the real "keep using Always?"
    // prompt itself, the first time a region fires while backgrounded.
    if ([self isAuthorized]) {
      [self startBackgroundMonitoring];
    }
  });
}

RCT_EXPORT_METHOD(clearGeofences) {
  self.stashes = @[];
  dispatch_async(dispatch_get_main_queue(), ^{
    [self stopBackgroundMonitoring];
  });
}

#pragma mark - Authorization & monitoring lifecycle

- (CLAuthorizationStatus)currentStatus {
  if (@available(iOS 14.0, *)) {
    return self.manager.authorizationStatus;
  }
  return [CLLocationManager authorizationStatus];
}

/** Authorized at all — full Always, or provisional Always (see -ensureAuthorization). */
- (BOOL)isAuthorized {
  CLAuthorizationStatus status = [self currentStatus];
  return status == kCLAuthorizationStatusAuthorizedAlways ||
         status == kCLAuthorizationStatusAuthorizedWhenInUse;
}

/**
 * Ask for background location in a single prompt. We request Always directly:
 * iOS never shows an "Always" button on a first ask, so the user sees just one
 * "Allow While Using" dialog — but because we asked for Always, iOS grants
 * *provisional* Always, so background region monitoring works right away and iOS
 * surfaces the real "keep using Always?" confirmation itself, the first time a
 * region fires while backgrounded. Never re-prompts a decided status, so it's
 * safe to call on every launch.
 */
- (void)ensureAuthorization {
  switch ([self currentStatus]) {
    case kCLAuthorizationStatusNotDetermined:
      [self.manager requestAlwaysAuthorization];
      break;
    case kCLAuthorizationStatusAuthorizedWhenInUse:
    case kCLAuthorizationStatusAuthorizedAlways:
      // Full or provisional Always — start monitoring. Don't fire a second
      // explicit Always prompt; iOS handles that upgrade on its own.
      [self startBackgroundMonitoring];
      break;
    default:
      break; // denied / restricted — don't nag
  }
}

/** Begin background location work. Called under full or provisional Always. */
- (void)startBackgroundMonitoring {
  // allowsBackgroundLocationUpdates drives the *continuous* updates API and is
  // only appropriate under full Always. Region monitoring and significant-change
  // (below) still deliver in the background under provisional Always without it,
  // which is what powers the phase before iOS confirms the upgrade.
  self.manager.allowsBackgroundLocationUpdates =
      ([self currentStatus] == kCLAuthorizationStatusAuthorizedAlways);
  self.manager.pausesLocationUpdatesAutomatically = NO;
  [self.manager startMonitoringSignificantLocationChanges];
  [self syncMonitoredRegions];
}

/** Tear everything down (sign-out, or authorization dropped below Always). */
- (void)stopBackgroundMonitoring {
  [self.manager stopMonitoringSignificantLocationChanges];
  for (CLRegion *region in self.manager.monitoredRegions.allObjects) {
    [self.manager stopMonitoringForRegion:region];
  }
  self.manager.allowsBackgroundLocationUpdates = NO;
}

#pragma mark - Region set management

/** Reconcile the monitored regions with the nearest-N target set. */
- (void)syncMonitoredRegions {
  NSArray<NSDictionary *> *targets =
      [self nearestStashes:self.manager.location limit:kMaxRegions];

  NSMutableSet<NSString *> *desiredIds = [NSMutableSet set];
  for (NSDictionary *stash in targets) {
    [desiredIds addObject:stash[@"id"]];
  }

  // Drop regions that are no longer in the nearest-N set.
  for (CLRegion *region in self.manager.monitoredRegions.allObjects) {
    if (![desiredIds containsObject:region.identifier]) {
      [self.manager stopMonitoringForRegion:region];
    }
  }

  NSSet<NSString *> *monitoredIds = [self monitoredIdentifiers];
  CLLocationDistance maxRadius = self.manager.maximumRegionMonitoringDistance;
  CLLocationDistance radius =
      (maxRadius > 0 && kOuterRadiusM > maxRadius) ? maxRadius : kOuterRadiusM;

  for (NSDictionary *stash in targets) {
    NSString *stashId = stash[@"id"];
    if ([monitoredIds containsObject:stashId]) {
      continue;
    }
    CLLocationCoordinate2D center =
        CLLocationCoordinate2DMake([stash[@"lat"] doubleValue],
                                   [stash[@"lng"] doubleValue]);
    CLCircularRegion *region =
        [[CLCircularRegion alloc] initWithCenter:center
                                          radius:radius
                                      identifier:stashId];
    region.notifyOnEntry = YES;
    region.notifyOnExit = NO;
    [self.manager startMonitoringForRegion:region];
    // Catch the "already inside the band when registered" case.
    [self.manager requestStateForRegion:region];
  }
}

- (NSSet<NSString *> *)monitoredIdentifiers {
  NSMutableSet<NSString *> *ids = [NSMutableSet set];
  for (CLRegion *region in self.manager.monitoredRegions.allObjects) {
    [ids addObject:region.identifier];
  }
  return ids;
}

/** The `limit` stashes closest to `here` (or the first `limit` if no fix yet). */
- (NSArray<NSDictionary *> *)nearestStashes:(CLLocation *)here
                                      limit:(NSUInteger)limit {
  if (self.stashes.count <= limit) {
    return self.stashes;
  }
  if (here == nil) {
    return [self.stashes subarrayWithRange:NSMakeRange(0, limit)];
  }
  NSArray<NSDictionary *> *sorted = [self.stashes
      sortedArrayUsingComparator:^NSComparisonResult(NSDictionary *a,
                                                     NSDictionary *b) {
        CLLocationDistance da = [self distanceFrom:here toStash:a];
        CLLocationDistance db = [self distanceFrom:here toStash:b];
        if (da < db) {
          return NSOrderedAscending;
        }
        if (da > db) {
          return NSOrderedDescending;
        }
        return NSOrderedSame;
      }];
  return [sorted subarrayWithRange:NSMakeRange(0, limit)];
}

- (CLLocationDistance)distanceFrom:(CLLocation *)here
                           toStash:(NSDictionary *)stash {
  CLLocation *target =
      [[CLLocation alloc] initWithLatitude:[stash[@"lat"] doubleValue]
                                 longitude:[stash[@"lng"] doubleValue]];
  return [here distanceFromLocation:target];
}

- (NSDictionary *)stashForId:(NSString *)stashId {
  for (NSDictionary *stash in self.stashes) {
    if ([stash[@"id"] isEqualToString:stashId]) {
      return stash;
    }
  }
  return nil;
}

#pragma mark - CLLocationManagerDelegate

// iOS 14+ delegate.
- (void)locationManagerDidChangeAuthorization:(CLLocationManager *)manager
    API_AVAILABLE(ios(14.0)) {
  [self handleAuthChange];
}

// Pre-iOS 14 delegate (ignored on 14+, where the method above fires instead).
- (void)locationManager:(CLLocationManager *)manager
    didChangeAuthorizationStatus:(CLAuthorizationStatus)status {
  if (@available(iOS 14.0, *)) {
    return;
  }
  [self handleAuthChange];
}

- (void)handleAuthChange {
  switch ([self currentStatus]) {
    case kCLAuthorizationStatusAuthorizedAlways:
    case kCLAuthorizationStatusAuthorizedWhenInUse:
      // Full Always, or provisional Always (user granted "While Using" to our
      // Always request) — start/resume monitoring either way. iOS surfaces the
      // real Always upgrade prompt itself once background events begin, so we
      // never fire a second explicit prompt here.
      [self startBackgroundMonitoring];
      break;
    default:
      [self stopBackgroundMonitoring];
      break;
  }
}

- (void)locationManager:(CLLocationManager *)manager
     didUpdateLocations:(NSArray<CLLocation *> *)locations {
  // A significant-location change → the nearest-20 set may have shifted.
  [self syncMonitoredRegions];
}

- (void)locationManager:(CLLocationManager *)manager
         didEnterRegion:(CLRegion *)region {
  // Crossing inward at the 1km boundary → definitely in-band even without a
  // fresh fix, so allow firing if a fix is momentarily unavailable.
  [self handleRegionId:region.identifier allowWithoutFix:YES];
}

- (void)locationManager:(CLLocationManager *)manager
      didDetermineState:(CLRegionState)state
              forRegion:(CLRegion *)region {
  if (state == CLRegionStateInside) {
    // Already inside on registration: we can't tell if we're under 100m without
    // a fix, so require one before firing.
    [self handleRegionId:region.identifier allowWithoutFix:NO];
  }
}

#pragma mark - Firing

- (void)handleRegionId:(NSString *)stashId allowWithoutFix:(BOOL)allowWithoutFix {
  NSDictionary *stash = [self stashForId:stashId];
  if (stash == nil) {
    return;
  }

  CLLocation *here = self.manager.location;
  CLLocationDistance distance = kOuterRadiusM;
  if (here != nil) {
    distance = [self distanceFrom:here toStash:stash];
    if (distance <= kInnerRadiusM || distance > kOuterRadiusM) {
      return; // silent under 100m / outside the band
    }
  } else if (!allowWithoutFix) {
    return;
  }

  // Fail-closed: only notify when we can confirm the place is open right now.
  if (![self isOpenNowForStash:stash]) {
    return;
  }

  // Don't spam: at most one notification per stash per week. Checked last so a
  // place we skipped (closed / out of band) never starts the cooldown.
  if ([self hasFiredThisWeekForId:stashId]) {
    return;
  }
  [self markFiredForId:stashId];
  [self postNotificationForStash:stash distance:distance];
}

#pragma mark - Open-now evaluation

/**
 * Whether the stash is open right now, judged in the place's own timezone.
 * Fail-OPEN: missing/empty hours → treated as open, so a place without captured
 * hours still notifies. Mirrors `isOpenNow` in src/lib/openingHours.ts.
 */
- (BOOL)isOpenNowForStash:(NSDictionary *)stash {
  NSDictionary *hours = stash[@"openingHours"];
  if (![hours isKindOfClass:[NSDictionary class]]) {
    return YES;
  }
  NSArray *periods = hours[@"periods"];
  if (![periods isKindOfClass:[NSArray class]] || periods.count == 0) {
    return YES;
  }
  NSInteger utcOffsetMinutes = [hours[@"utc_offset_minutes"] integerValue];

  // "Now" in the place's local time, as minutes since Sunday 00:00.
  NSTimeInterval placeNow =
      [[NSDate date] timeIntervalSince1970] + (utcOffsetMinutes * 60.0);
  NSCalendar *cal =
      [NSCalendar calendarWithIdentifier:NSCalendarIdentifierGregorian];
  cal.timeZone = [NSTimeZone timeZoneForSecondsFromGMT:0];
  NSDateComponents *c = [cal
      components:(NSCalendarUnitWeekday | NSCalendarUnitHour | NSCalendarUnitMinute)
        fromDate:[NSDate dateWithTimeIntervalSince1970:placeNow]];
  // NSCalendar weekday is 1=Sunday..7=Saturday → Google's day is 0..6.
  NSInteger nowMin = ((c.weekday - 1) * 1440) + (c.hour * 60) + c.minute;

  for (NSDictionary *period in periods) {
    NSDictionary *open = period[@"open"];
    if (![open isKindOfClass:[NSDictionary class]]) {
      continue;
    }
    NSInteger openMin = [self minutesForDay:open[@"day"] time:open[@"time"]];

    NSDictionary *close = period[@"close"];
    if (![close isKindOfClass:[NSDictionary class]]) {
      return YES; // no close → Google's "open 24/7" representation
    }
    NSInteger closeMin = [self minutesForDay:close[@"day"] time:close[@"time"]];
    if (closeMin <= openMin) {
      closeMin += kWeekMinutes; // interval wraps past Saturday → Sunday
    }
    if ((nowMin >= openMin && nowMin < closeMin) ||
        (nowMin + kWeekMinutes >= openMin && nowMin + kWeekMinutes < closeMin)) {
      return YES;
    }
  }
  return NO;
}

/** (day 0..6, "HHMM") → minutes since Sunday 00:00. */
- (NSInteger)minutesForDay:(id)day time:(id)time {
  NSInteger d = [day integerValue];
  NSString *t = [time isKindOfClass:[NSString class]] ? time : @"0000";
  NSInteger hhmm = [t integerValue];
  return (d * 1440) + ((hhmm / 100) * 60) + (hhmm % 100);
}

- (NSString *)formatDistance:(CLLocationDistance)distance {
  if (distance >= 950.0) {
    return @"1 km";
  }
  NSInteger rounded = ((NSInteger)round(distance / 50.0)) * 50;
  if (rounded < 50) {
    rounded = 50;
  }
  return [NSString stringWithFormat:@"%ldm", (long)rounded];
}

- (void)postNotificationForStash:(NSDictionary *)stash
                        distance:(CLLocationDistance)distance {
  NSString *name = stash[@"name"] ?: @"a saved place";
  NSString *stashId = stash[@"id"] ?: @"";

  UNMutableNotificationContent *content =
      [[UNMutableNotificationContent alloc] init];
  content.title = @"Cache";
  content.body = [NSString
      stringWithFormat:@"You're within %@ from %@, check it out!",
                       [self formatDistance:distance], name];
  content.sound = [UNNotificationSound defaultSound];
  // Same shape the JS tap handler expects (notifications.ts → stashIdFrom).
  content.userInfo = @{@"stashId" : stashId, @"tier" : @"nearby"};

  NSString *requestId =
      [NSString stringWithFormat:@"geofence-%@-%.0f", stashId,
                                 [[NSDate date] timeIntervalSince1970]];
  UNNotificationRequest *request =
      [UNNotificationRequest requestWithIdentifier:requestId
                                           content:content
                                           trigger:nil];
  [[UNUserNotificationCenter currentNotificationCenter]
      addNotificationRequest:request
       withCompletionHandler:nil];
}

#pragma mark - Weekly suppression (UserDefaults, readable when app is killed)

- (NSString *)suppressionKeyForId:(NSString *)stashId {
  return [NSString stringWithFormat:@"geofence:lastfired:%@", stashId];
}

- (BOOL)hasFiredThisWeekForId:(NSString *)stashId {
  NSNumber *last = [[NSUserDefaults standardUserDefaults]
      objectForKey:[self suppressionKeyForId:stashId]];
  if (last == nil) {
    return NO;
  }
  NSTimeInterval elapsed =
      [[NSDate date] timeIntervalSince1970] - [last doubleValue];
  return elapsed < kCooldownSeconds;
}

- (void)markFiredForId:(NSString *)stashId {
  [[NSUserDefaults standardUserDefaults]
      setObject:@([[NSDate date] timeIntervalSince1970])
         forKey:[self suppressionKeyForId:stashId]];
}

@end
