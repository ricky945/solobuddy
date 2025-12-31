# Setup Guide for SoloBuddy Landmarks Feature

## Issues Fixed

### 1. Backend Route Mismatch ✅
**Problem**: The frontend was calling `/api/trpc/*` but the backend was mounted at `/trpc/*`

**Solution**: Updated `backend/hono.ts` to mount tRPC handlers at `/api/trpc/*` to match frontend expectations.

## Required Configuration

### Google Places API Key (Required for Landmarks Discovery)

The landmarks tab requires a Google Places API key to discover nearby tourist attractions.

**Steps to get your API key:**

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the **Places API (New)** for your project
4. Go to **APIs & Services > Credentials**
5. Click **Create Credentials > API Key**
6. Copy your API key

**How to set it:**

When running with Rork:
```bash
# The Rork platform will manage environment variables
# Set EXPO_PUBLIC_GOOGLE_PLACES_API_KEY in your Rork project settings
```

When running locally:
```bash
# Option 1: Set in your shell
export EXPO_PUBLIC_GOOGLE_PLACES_API_KEY=your_api_key_here

# Option 2: Create a .env file (not tracked by git)
echo "EXPO_PUBLIC_GOOGLE_PLACES_API_KEY=your_api_key_here" > .env
```

## How the Landmarks Tab Works

### Two Types of Landmarks:

1. **Tourist Sites (Touristic tab)**
   - Fetched from Google Places API
   - Shows popular tourist attractions, museums, parks, churches within 5km
   - Displays descriptions, ratings, and photos from Google
   - Requires Google Places API key to work

2. **Hidden Gems (User-submitted landmarks)**
   - User-contributed landmarks stored in the backend database
   - Any user can add a hidden gem by clicking the + button
   - Can include custom photos and notes
   - Other users can review and upvote these locations

### Features:
- **Map View**: See all landmarks on an interactive map
- **List View**: Swipe up the bottom sheet to see landmarks in a list
- **Distance**: Shows distance from your current location
- **Details**: Tap any landmark to see full details, reviews, and photos
- **Add New**: On the Hidden Gems tab, tap + to add a new location
- **Reviews**: Leave reviews and ratings on user-submitted landmarks

## Restart Instructions

After making these changes, you need to restart the development server:

```bash
# Stop the current server (Ctrl+C in the terminal)
# Then restart:
bun run start
```

Or for web preview:
```bash
bun run start-web
```

## Troubleshooting

### Still seeing "Network request failed"?

1. **Check if the backend is running**: The terminal should show backend logs like `[Backend] Starting Hono server`

2. **Check your internet connection**: The Rork tunnel requires internet access

3. **Try clearing the cache**:
   ```bash
   bunx expo start --clear
   ```

4. **Check the Rork tunnel status**: Look for messages about tunnel connectivity in the terminal

### "Google Places API key not configured" error?

- Make sure you've set the `EXPO_PUBLIC_GOOGLE_PLACES_API_KEY` environment variable
- Verify the API key is valid and the Places API is enabled in Google Cloud Console
- Restart the development server after setting the environment variable

### No landmarks showing on the map?

- **For Tourist Sites**: Requires Google Places API key and active internet connection
- **For Hidden Gems**: Starts empty - users need to add landmarks by clicking the + button
- Make sure location permissions are granted on your device/simulator

## Testing the Fix

1. **Stop the current server** (Ctrl+C if running)
2. **Set your Google Places API key** (see above)
3. **Restart the server**: `bun run start`
4. **Open the app** and navigate to the Explore tab
5. **Grant location permissions** when prompted
6. **Switch between tabs**:
   - "Tourist Sites" tab should show nearby attractions (requires API key)
   - "Hidden Gems" tab shows user-submitted locations (tap + to add one)

## Additional Notes

- The app uses your device's location to find nearby landmarks
- Location updates automatically when you move around
- Landmarks are cached for 5 minutes to reduce API calls
- User-submitted landmarks are stored in a local in-memory database (resets on server restart)




