# SoloBuddy Production Deployment Guide

This guide will help you deploy SoloBuddy to the App Store using Supabase for your backend.

## ✅ What's Already Done (Code Changes)

The codebase has been updated to be production-ready:

- ✅ **All API calls use Supabase Edge Functions** - No API keys exposed in client code
- ✅ **TTS generation** - Routes through `generate-tts` Edge Function
- ✅ **Text generation (AI)** - Routes through `generate-text` Edge Function  
- ✅ **Google Places API** - Routes through `places-api` Edge Function
- ✅ **No hardcoded API keys** - Removed from `app.config.js` and other files
- ✅ **EAS configuration** - Updated for production builds

## 🚀 Steps to Deploy

### Step 1: Install Supabase CLI

```bash
# Install Supabase CLI
npm install -g supabase

# Or with Homebrew (Mac)
brew install supabase/tap/supabase
```

### Step 2: Link to Your Supabase Project

Your project is already connected to: `blcnymocctrbnqljzzco.supabase.co`

```bash
# Login to Supabase
supabase login

# Link to your project (in the project directory)
cd "/Users/rickyortega/Downloads/solobuddy-main 2"
supabase link --project-ref blcnymocctrbnqljzzco
```

### Step 3: Set Up Secrets (CRITICAL!)

Store your API keys securely in Supabase Secrets:

```bash
# Set OpenAI API key (for TTS and text generation)
supabase secrets set OPENAI_API_KEY=sk-proj-YOUR_OPENAI_KEY_HERE

# Set Google Places API key (for location/places features)
supabase secrets set GOOGLE_PLACES_API_KEY=YOUR_GOOGLE_PLACES_KEY_HERE
```

⚠️ **IMPORTANT**: Replace the placeholder keys with your actual keys!

To verify secrets are set:
```bash
supabase secrets list
```

### Step 4: Deploy Edge Functions

```bash
# Deploy all Edge Functions to Supabase
supabase functions deploy generate-text
supabase functions deploy generate-tts
supabase functions deploy places-api
```

### Step 5: Test Edge Functions

Test that your functions work:

```bash
# Test text generation
curl -X POST 'https://blcnymocctrbnqljzzco.supabase.co/functions/v1/generate-text' \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJsY255bW9jY3RyYm5xbGp6emNvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY0NDMyNDYsImV4cCI6MjA4MjAxOTI0Nn0.v3_qCI7D8kNboBdondmCh7de0NQAWzuJrD5--5JvRJ8" \
  -H "Content-Type: application/json" \
  -d '{"messages": [{"role": "user", "content": "Say hello"}]}'

# Test TTS generation
curl -X POST 'https://blcnymocctrbnqljzzco.supabase.co/functions/v1/generate-tts' \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJsY255bW9jY3RyYm5xbGp6emNvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY0NDMyNDYsImV4cCI6MjA4MjAxOTI0Nn0.v3_qCI7D8kNboBdondmCh7de0NQAWzuJrD5--5JvRJ8" \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello world", "voice": "alloy"}'
```

### Step 6: Update EAS Credentials

Edit `eas.json` and replace the placeholders:

```json
{
  "submit": {
    "production": {
      "ios": {
        "appleId": "YOUR_REAL_APPLE_ID@example.com",
        "ascAppId": "YOUR_APP_STORE_CONNECT_APP_ID",
        "appleTeamId": "YOUR_APPLE_TEAM_ID"
      }
    }
  }
}
```

To find these values:
- **appleId**: Your Apple ID email
- **ascAppId**: Go to App Store Connect > Your App > App Information > Apple ID
- **appleTeamId**: Go to developer.apple.com > Account > Membership > Team ID

### Step 7: Build for App Store

```bash
# Install EAS CLI if not already installed
npm install -g eas-cli
eas login

# Build iOS app for App Store
eas build --platform ios --profile production

# Once build completes, submit to App Store
eas submit --platform ios
```

### Step 8: Build for Android (Optional)

```bash
# Build Android app
eas build --platform android --profile production

# Submit to Google Play
eas submit --platform android
```

## 📋 Pre-Submission Checklist

### Technical Requirements
- [ ] Supabase Edge Functions deployed (`generate-text`, `generate-tts`, `places-api`)
- [ ] API keys set in Supabase Secrets (`OPENAI_API_KEY`, `GOOGLE_PLACES_API_KEY`)
- [ ] Edge Functions tested and working
- [ ] EAS credentials configured (`eas.json`)
- [ ] App tested on physical iOS device

### App Store Requirements
- [ ] App icon (1024x1024) - already in `assets/images/icon.png`
- [ ] App screenshots (required sizes for App Store)
- [ ] App description written
- [ ] Privacy Policy URL (required for location/camera permissions)
- [ ] Support URL
- [ ] Marketing URL (optional)

### Permissions Justification
Your app uses these permissions - prepare justifications for App Review:
- **Location**: "To find nearby landmarks and create personalized audio tours"
- **Microphone**: "For future voice recording features" (or remove if not used)
- **Camera**: "To let users add photos to landmarks" (or remove if not used)
- **Background Audio**: "To continue playing audio tours when app is backgrounded"

## 🔧 Database Setup

Your Supabase database should have these tables. Create them via Supabase Dashboard > SQL Editor:

```sql
-- Profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Landmarks table
CREATE TABLE IF NOT EXISTS landmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  latitude FLOAT NOT NULL,
  longitude FLOAT NOT NULL,
  type TEXT,
  image_url TEXT,
  category TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tours table  
CREATE TABLE IF NOT EXISTS tours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  location TEXT,
  duration INTEGER,
  type TEXT,
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE landmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE tours ENABLE ROW LEVEL SECURITY;

-- Create policies (adjust based on your needs)
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Public can view landmarks" ON landmarks FOR SELECT USING (true);
CREATE POLICY "Authenticated can create landmarks" ON landmarks FOR INSERT WITH CHECK (auth.role() = 'authenticated');
```

## 💰 Cost Estimates

- **Supabase Free Tier**: 500K Edge Function invocations/month, 500MB database
- **OpenAI API**: 
  - GPT-4o-mini: ~$0.15 per 1M input tokens
  - TTS: ~$0.015 per 1K characters
- **Google Places**: $17 per 1000 requests (with $200/month free credit)
- **EAS Build**: Free for limited builds, $99/month for unlimited

## 🆘 Troubleshooting

### "Function not found" error
```bash
# Check function is deployed
supabase functions list

# Redeploy the function
supabase functions deploy generate-text
```

### "API key not configured" error
```bash
# Check secrets are set
supabase secrets list

# Re-set the secret
supabase secrets set OPENAI_API_KEY=your_key
```

### Build fails
```bash
# Clear cache and rebuild
eas build --platform ios --clear-cache
```

### Edge Function returns 500 error
```bash
# Check function logs
supabase functions logs generate-text
```

## 📚 Resources

- [Supabase Docs](https://supabase.com/docs)
- [Expo Docs](https://docs.expo.dev)  
- [EAS Build](https://docs.expo.dev/build/introduction)
- [App Store Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [OpenAI Pricing](https://openai.com/pricing)
- [Google Places Pricing](https://developers.google.com/maps/documentation/places/web-service/usage-and-billing)
