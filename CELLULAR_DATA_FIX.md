# Cellular Data & Geolocation Fixes

## Changes Made

### 1. Network Request Headers
Added proper headers to all API calls to prevent blocking by cellular networks:

**Modified Files:**
- `app/(tabs)/explore.tsx`
- `app/(tabs)/discover.tsx`

**Changes:**
- Added `User-Agent: SoloBuddy/1.0` header to OpenAI API calls
- Added `Accept: application/json` header
- Added headers to OpenStreetMap geocoding requests

### 2. Location Service Configuration
Improved location accuracy settings for better cellular network performance:

**Changes in explore.tsx and discover.tsx:**
- Changed from `Location.Accuracy.High` to `Location.Accuracy.Balanced`
- Added `timeInterval: 1000` and `distanceInterval: 1`
- Increased geolocation timeout from 15s/10s to 30s
- Set `maximumAge: 0` to always get fresh location data

### 3. Required app.json Configuration

**IMPORTANT:** The following configuration needs to be added to `app.json`:

#### For iOS (add to `ios.infoPlist`):
```json
"NSAppTransportSecurity": {
  "NSAllowsArbitraryLoads": false,
  "NSExceptionDomains": {
    "api.openai.com": {
      "NSExceptionAllowsInsecureHTTPLoads": false,
      "NSExceptionRequiresForwardSecrecy": true,
      "NSExceptionMinimumTLSVersion": "TLSv1.2",
      "NSIncludesSubdomains": true,
      "NSRequiresCertificateTransparency": false
    },
    "nominatim.openstreetmap.org": {
      "NSExceptionAllowsInsecureHTTPLoads": false,
      "NSExceptionRequiresForwardSecrecy": true,
      "NSExceptionMinimumTLSVersion": "TLSv1.2",
      "NSIncludesSubdomains": true
    }
  }
}
```

#### For Android (add to `android.permissions`):
```json
"ACCESS_NETWORK_STATE",
"ACCESS_WIFI_STATE"
```

## Why These Changes Help

### 1. User-Agent Header
- Many cellular networks and APIs block requests without a proper User-Agent header
- This identifies your app as a legitimate mobile application

### 2. Balanced Location Accuracy
- High accuracy mode can fail on cellular networks when GPS signal is weak
- Balanced mode uses cell towers and WiFi in addition to GPS
- More reliable on cellular data

### 3. Increased Timeout
- Cellular networks can be slower than WiFi
- 30-second timeout gives more time for requests to complete

### 4. App Transport Security
- iOS requires explicit configuration for network security
- This tells iOS to allow HTTPS connections to specific domains on cellular

### 5. Network State Permissions
- Android needs explicit permissions to detect and use cellular networks
- These permissions allow the app to check network availability

## Testing Checklist

After applying the app.json changes, test on a physical device:

1. ✓ **WiFi Only**: Disable cellular, test location and API calls
2. ✓ **Cellular Only**: Disable WiFi, test location and API calls
3. ✓ **Switch Networks**: Test while switching between WiFi and cellular
4. ✓ **Low Signal**: Test in areas with weak cellular signal
5. ✓ **Background**: Test location tracking in background (if applicable)

## Troubleshooting

If issues persist:

1. **Check API Key**: Ensure `EXPO_PUBLIC_OPENAI_API_KEY` is set correctly
2. **Check Logs**: Look for specific error messages in console
3. **Test Network**: Use a simple fetch to google.com to verify network is working
4. **Rebuild App**: Some iOS changes require a full rebuild
5. **Check Permissions**: Verify location permissions are granted on device

## Additional Recommendations

For production:

1. Consider implementing a backend proxy for API calls
   - More secure (API keys not exposed in client)
   - Better error handling
   - Request caching and rate limiting

2. Add offline support
   - Cache landmark data
   - Queue failed requests for retry

3. Add network status detection
   - Show user-friendly messages when offline
   - Adjust timeout based on network type

4. Implement retry logic
   - Automatically retry failed requests
   - Exponential backoff for rate limiting
