# Deployment Steps - Cellular Data Implementation

## Quick 3-Step Deployment

### Step 1: Deploy Supabase Edge Functions (2 minutes)

The Supabase Edge Functions have been updated with proper headers. You need to redeploy them:

```bash
# Make sure you're logged in to Supabase
supabase login

# Deploy the updated functions
supabase functions deploy generate-text
supabase functions deploy generate-tts
```

**Expected output:**
```
✓ Deployed function generate-text
✓ Deployed function generate-tts
```

---

### Step 2: Rebuild Your App (5-10 minutes)

Since `app.json` was modified, you need to rebuild the app:

#### Option A: Development Build (Quick Testing)

```bash
# Clear cache and restart
npx expo start --clear

# Then on your physical device:
# - Shake device → "Reload"
# - Or close and reopen the app
```

⚠️ **Note:** Some `app.json` changes may require a native rebuild (Option B).

#### Option B: Full Native Rebuild (Recommended)

**For iOS:**
```bash
# If using EAS:
eas build --platform ios --profile development

# Or local build:
npx expo run:ios
```

**For Android:**
```bash
# If using EAS:
eas build --platform android --profile development

# Or local build:
npx expo run:android
```

---

### Step 3: Test on Physical Device (10 minutes)

**Critical:** Test on a **physical device** (not simulator) with cellular data:

```bash
# On your device:
# 1. Go to Settings
# 2. Turn OFF WiFi
# 3. Make sure Cellular Data is ON for SoloBuddy
# 4. Open the app
```

**Quick Test Checklist:**
- [ ] Open app → completes onboarding
- [ ] Generate a tour (any type)
- [ ] Play tour audio
- [ ] Ask a question (walking tour)
- [ ] Browse explore tab
- [ ] Analyze an image (discover tab)

If any of these fail, see troubleshooting below.

---

## Detailed Testing Guide

### Test Environment Setup

1. **Get a physical device** (iPhone or Android)
2. **Disable WiFi completely**
3. **Enable cellular data** for the app
4. **Move to different locations** if possible:
   - Strong signal (outdoors, clear view)
   - Weak signal (indoors, basement)

### Feature-by-Feature Testing

#### 1. Onboarding (5 minutes)
```
✓ Location permission request
✓ City detection via GPS
✓ Landmark carousel loads
✓ Tour preferences save
✓ Navigate to home screen
```

#### 2. Tour Generation (3 minutes)
```
✓ Select tour type (immersive/landmark/route)
✓ Choose duration
✓ Select topics
✓ Wait for generation (30-90 seconds on cellular is normal)
✓ Tour appears in library
```

#### 3. Walking Tour (5 minutes)
```
✓ Open a route tour
✓ GPS location shows on map
✓ Play audio
✓ Audio continues with screen locked
✓ Ask a question (tests OpenAI API)
✓ Navigate to next stop
```

#### 4. Explore Tab (3 minutes)
```
✓ Location loads
✓ Landmarks appear on map
✓ Switch between "Touristic" and "Unique"
✓ Tap a landmark → see details
✓ Images load
```

#### 5. Discover Tab (3 minutes)
```
✓ Take/upload a photo
✓ Image analysis completes
✓ Description generates
✓ Audio description plays
✓ Ask a follow-up question
```

### Performance Benchmarks

**On 4G/LTE cellular (should take approximately):**

| Feature | Expected Time | Max Acceptable |
|---------|--------------|----------------|
| Location detection | 3-8 seconds | 15 seconds |
| Tour generation (20 min) | 30-60 seconds | 90 seconds |
| Image analysis | 5-10 seconds | 20 seconds |
| Audio generation | 8-15 seconds | 30 seconds |
| Landmark discovery | 4-10 seconds | 20 seconds |

If times are **way** beyond "Max Acceptable", something may be wrong.

---

## Troubleshooting

### Issue: "Network request failed"

**Solution:**
1. Check cellular data is enabled:
   - **iOS:** Settings → Cellular → SoloBuddy → toggle ON
   - **Android:** Settings → Network & Internet → Mobile data → SoloBuddy → toggle ON

2. Try airplane mode toggle:
   - Turn on Airplane Mode (wait 5 seconds)
   - Turn off Airplane Mode
   - Try again

3. Restart the app completely (force quit, reopen)

### Issue: "Request timed out"

**Solution:**
- This is normal on very weak signal (< 1 bar)
- Try moving to an area with better signal
- Or switch to WiFi temporarily
- The app will show appropriate error messages

### Issue: "API key not configured"

**Solution:**
1. Check your `.env` or `app.config.js`:
   ```bash
   EXPO_PUBLIC_OPENAI_API_KEY=sk-...
   EXPO_PUBLIC_GOOGLE_PLACES_API_KEY=AIza...
   ```

2. For Supabase Edge Functions, check secrets:
   - Go to Supabase Dashboard
   - Project Settings → Edge Functions → Secrets
   - Make sure `OPENAI_API_KEY` is set

3. Restart Expo dev server:
   ```bash
   npx expo start --clear
   ```

### Issue: iOS "Connection not allowed"

**Solution:**
- This means `app.json` changes didn't take effect
- **Must do a native rebuild:**
  ```bash
  npx expo prebuild --clean
  npx expo run:ios
  ```
- Or use EAS Build:
  ```bash
  eas build --platform ios --profile development
  ```

### Issue: Still not working after rebuild

**Debug steps:**

1. **Check device logs:**
   ```bash
   # iOS:
   npx expo run:ios
   # Watch console for errors
   
   # Android:
   npx expo run:android
   # Watch Logcat
   ```

2. **Test individual APIs manually:**
   ```bash
   # Test OpenAI API with proper headers:
   curl -X POST https://api.openai.com/v1/chat/completions \
     -H "Content-Type: application/json" \
     -H "Accept: application/json" \
     -H "User-Agent: SoloBuddy/1.0" \
     -H "Authorization: Bearer YOUR_OPENAI_KEY" \
     -d '{"model":"gpt-4o-mini","messages":[{"role":"user","content":"test"}]}'
   ```

3. **Check Supabase Edge Function logs:**
   - Go to Supabase Dashboard
   - Edge Functions → Select function → Logs
   - Look for errors

4. **Try on different carrier:**
   - If possible, test on a different cellular carrier
   - Some carriers have aggressive filtering

---

## Production Deployment

Once testing passes, deploy to production:

### 1. Update Production Edge Functions
```bash
# Make sure you're targeting production project
supabase link --project-ref YOUR_PROD_PROJECT_REF

# Deploy to production
supabase functions deploy generate-text
supabase functions deploy generate-tts
```

### 2. Build Production Apps

**iOS (App Store):**
```bash
eas build --platform ios --profile production
eas submit --platform ios
```

**Android (Google Play):**
```bash
eas build --platform android --profile production
eas submit --platform android
```

### 3. Monitor After Release
- Watch for crash reports
- Check Edge Function logs for errors
- Monitor user reviews mentioning "cellular" or "mobile data"
- Track API success rates

---

## What If I Need to Roll Back?

If you need to revert these changes (though you shouldn't need to):

```bash
# Revert git changes
git checkout HEAD -- app.json
git checkout HEAD -- app/walking-tour.tsx
git checkout HEAD -- app/onboarding.tsx
git checkout HEAD -- app/(tabs)/explore.tsx
git checkout HEAD -- lib/trpc.ts
git checkout HEAD -- supabase/functions/generate-text/index.ts
git checkout HEAD -- supabase/functions/generate-tts/index.ts

# Redeploy old functions
supabase functions deploy generate-text
supabase functions deploy generate-tts

# Rebuild app
npx expo start --clear
```

**But wait!** These changes are **backward compatible** - they work on both WiFi and cellular. There's no reason to roll back.

---

## Success Criteria

✅ **You're done when:**

1. App works on WiFi (as before)
2. App works on cellular data (new!)
3. All features tested on physical device
4. No errors in console logs
5. Performance is acceptable (see benchmarks above)

---

## Questions?

If you run into issues:

1. Check `CELLULAR_DATA_FIX.md` for detailed troubleshooting
2. Review console logs for specific errors
3. Verify all steps in this guide were completed
4. Test on multiple devices/carriers if possible

---

**Estimated Total Time:** 20-30 minutes  
**Difficulty:** Easy (mostly waiting for builds)  
**Risk Level:** Very Low (backward compatible changes)

**Good luck! Your app will work everywhere now. 🎉**
