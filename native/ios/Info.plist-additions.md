# iOS native additions

Apply these to the **main app target** in Xcode (or edit `ios/Cache/Info.plist`
and the project settings directly).

## 1. Info.plist keys

```xml
<!-- Location -->
<key>NSLocationWhenInUseUsageDescription</key>
<string>Cache shows your position on the map and reminds you when you are near a saved place.</string>
<key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
<string>Cache checks in the background whether you are near a saved place so it can notify you.</string>

<!-- Photo library (avatar picker) -->
<key>NSPhotoLibraryUsageDescription</key>
<string>Cache lets you choose a profile photo from your library.</string>

<!-- Background modes for the 15-minute proximity check + background fetch -->
<key>UIBackgroundModes</key>
<array>
  <string>fetch</string>
  <string>processing</string>
  <string>location</string>
</array>

<!-- react-native-background-fetch task identifiers -->
<key>BGTaskSchedulerPermittedIdentifiers</key>
<array>
  <string>com.transistorsoft.fetch</string>
</array>

<!-- Allow opening the TikTok / Instagram apps from the detail sheet -->
<key>LSApplicationQueriesSchemes</key>
<array>
  <string>tiktok</string>
  <string>instagram</string>
</array>
```

## 2. Google Maps API key (AppDelegate)

`react-native-maps` with the Google provider needs the SDK key registered at
launch. In `ios/Cache/AppDelegate.mm` (or `.swift`):

**Objective-C (`AppDelegate.mm`):**
```objc
#import <GoogleMaps/GoogleMaps.h>
// inside didFinishLaunchingWithOptions, before the RN bridge is created:
[GMSServices provideAPIKey:@"YOUR_GOOGLE_MAPS_API_KEY"];
```

And in `ios/Podfile`, inside the app target:
```ruby
rn_maps_path = '../node_modules/react-native-maps'
pod 'react-native-google-maps', :path => rn_maps_path
```
Then `cd ios && pod install`.

## 3. Background fetch (AppDelegate)

Follow react-native-background-fetch's iOS install: it auto-registers the task,
but you must keep the `BGTaskSchedulerPermittedIdentifiers` entry above and
enable **Background Modes → Background fetch + Background processing** under
Signing & Capabilities.
