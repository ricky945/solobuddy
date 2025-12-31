module.exports = ({ config }) => {
  // Check if we're explicitly using local backend or if we're in local dev mode
  const useLocalBackend = process.env.EXPO_PUBLIC_USE_LOCAL_BACKEND === 'true';
  const isDev = process.env.NODE_ENV !== 'production';
  
  // Set the backend API URL
  // For production: Uses Supabase Edge Functions (no external backend needed for most features)
  // For local development: Uses localhost:3000
  let backendUrl;
  
  if (process.env.EXPO_PUBLIC_RORK_API_BASE_URL) {
    // Explicit URL provided - use it
    backendUrl = process.env.EXPO_PUBLIC_RORK_API_BASE_URL;
  } else if (process.env.RORK_API_URL) {
    // Rork platform URL
    backendUrl = process.env.RORK_API_URL;
  } else if (useLocalBackend || isDev) {
    // Local development - don't set a URL, let trpc.ts auto-detect
    backendUrl = undefined;
  } else {
    // Production - Primary features use Supabase Edge Functions
    // tRPC backend URL only needed for advanced features
    // Leave undefined to let the app detect if backend is available
    backendUrl = undefined;
  }

  // Note: Google Places API key should be stored in Supabase Secrets
  // The app uses Supabase Edge Functions for all Places API calls
  // This keeps the API key secure on the server side

  // Set the AI toolkit URL for tour generation
  const toolkitUrl = process.env.EXPO_PUBLIC_TOOLKIT_URL || backendUrl;

  console.log('[App Config] Environment:', isDev ? 'development' : 'production');
  console.log('[App Config] Backend URL:', backendUrl || 'Supabase Edge Functions');
  console.log('[App Config] Use Local Backend:', useLocalBackend);

  const extra = {
    ...config.extra,
    // Supabase URL and anon key are public - they're designed to be exposed
    // Row Level Security protects your data
    SUPABASE_URL: 'https://blcnymocctrbnqljzzco.supabase.co',
  };

  // Only set backend URL if it's defined (let app use Supabase Edge Functions otherwise)
  if (backendUrl) {
    extra.EXPO_PUBLIC_RORK_API_BASE_URL = backendUrl;
    extra.EXPO_PUBLIC_TOOLKIT_URL = toolkitUrl;
  }

  return {
    ...require('./app.json').expo,
    extra,
  };
};
