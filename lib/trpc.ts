import { createTRPCReact } from "@trpc/react-query";
import { httpLink } from "@trpc/client";
import type { AppRouter } from "@/backend/trpc/app-router";
import superjson from "superjson";
import { Platform } from "react-native";
import Constants from "expo-constants";

export const trpc = createTRPCReact<AppRouter>();

/**
 * Get the backend URL for tRPC requests
 * 
 * PRODUCTION NOTE: Most features now use Supabase Edge Functions directly
 * (see lib/supabase-functions.ts). The tRPC backend is primarily used for:
 * - Local development
 * - Any advanced features that require custom backend logic
 * 
 * In production, if no backend URL is configured, tRPC calls will fail gracefully
 * and the app should fall back to Supabase Edge Functions.
 */
const getBaseUrl = () => {
  // Check for explicit environment variable first
  const envUrl = process.env.EXPO_PUBLIC_RORK_API_BASE_URL || 
                 Constants.expoConfig?.extra?.EXPO_PUBLIC_RORK_API_BASE_URL;
  
  if (envUrl) {
    const cleanUrl = envUrl.endsWith('/') ? envUrl.slice(0, -1) : envUrl;
    console.log("[tRPC] Using configured backend URL:", cleanUrl);
    return cleanUrl;
  }
  
  // Check if we're in development mode (local backend available)
  const isDev = process.env.EXPO_PUBLIC_USE_LOCAL_BACKEND === 'true' || __DEV__;
  
  if (isDev) {
    // For physical devices, we need to use the computer's IP instead of localhost
    const debuggerHost = Constants.expoConfig?.hostUri || Constants.manifest2?.extra?.expoGo?.debuggerHost;
    
    if (debuggerHost && Platform.OS !== 'web') {
      const hostIp = debuggerHost.split(':')[0];
      if (hostIp && hostIp !== 'localhost' && hostIp !== '127.0.0.1') {
        const url = `http://${hostIp}:3000`;
        console.log("[tRPC] Development mode - using device IP:", url);
        return url;
      }
    }
    
    console.log("[tRPC] Development mode - using localhost");
    return 'http://localhost:3000';
  }
  
  // Production mode without configured URL
  // Return a placeholder - tRPC requests will fail, but the app should
  // use Supabase Edge Functions for production features
  console.log("[tRPC] Production mode - no backend URL configured, using Supabase Edge Functions");
  return 'https://api.placeholder.local'; // Will fail gracefully
};

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;
const RATE_LIMIT_RETRY_DELAY_MS = 5000;

function serializeError(error: unknown): string {
  console.log('[tRPC] Serializing error:', error);
  console.log('[tRPC] Error type:', typeof error);
  
  if (!error) return 'An unexpected error occurred';
  
  if (typeof error === 'string') {
    console.log('[tRPC] Error is string:', error);
    return error;
  }
  
  if (error instanceof Error) {
    console.log('[tRPC] Error is Error instance:', error.message);
    return error.message || 'Unknown error occurred';
  }
  
  if (typeof error === 'object') {
    const errorObj = error as any;
    console.log('[tRPC] Error object keys:', Object.keys(errorObj));
    
    if (errorObj.message) {
      console.log('[tRPC] Has message:', errorObj.message, 'type:', typeof errorObj.message);
      if (typeof errorObj.message === 'string') {
        return errorObj.message;
      }
      if (typeof errorObj.message === 'object') {
        try {
          const msgStr = JSON.stringify(errorObj.message);
          if (msgStr && msgStr !== '{}' && msgStr !== 'null') {
            return msgStr;
          }
        } catch {}
      }
    }
    
    if (errorObj.data?.message && typeof errorObj.data.message === 'string') {
      console.log('[tRPC] Has data.message:', errorObj.data.message);
      return errorObj.data.message;
    }
    
    if (errorObj.shape?.message && typeof errorObj.shape.message === 'string') {
      console.log('[tRPC] Has shape.message:', errorObj.shape.message);
      return errorObj.shape.message;
    }
    
    try {
      const safeStringify = (obj: any): string => {
        const seen = new WeakSet();
        return JSON.stringify(obj, (key, value) => {
          if (typeof value === 'object' && value !== null) {
            if (seen.has(value)) {
              return '[Circular]';
            }
            seen.add(value);
          }
          if (typeof value === 'function') {
            return '[Function]';
          }
          if (typeof value === 'symbol') {
            return value.toString();
          }
          if (value instanceof Error) {
            return value.message;
          }
          return value;
        });
      };
      
      const json = safeStringify(errorObj);
      console.log('[tRPC] Stringified error:', json.substring(0, 200));
      
      if (json && json !== '{}' && json !== 'null') {
        const parsed = JSON.parse(json);
        if (parsed.message && typeof parsed.message === 'string') {
          return parsed.message;
        }
        if (parsed.data?.message && typeof parsed.data.message === 'string') {
          return parsed.data.message;
        }
        return `Error: ${json.substring(0, 100)}`;
      }
    } catch (e) {
      console.error('[tRPC] Error during serialization:', e);
    }
  }
  
  try {
    const str = String(error);
    console.log('[tRPC] String conversion:', str);
    if (str && str !== '[object Object]') {
      return str;
    }
  } catch {}
  
  return 'An unexpected error occurred. Please try again.';
}



function isNetworkError(error: any): boolean {
  if (!error) return false;
  
  const message = String(error?.message || error || '').toLowerCase();
  const code = error?.code || '';
  
  return (
    message.includes('network') ||
    message.includes('fetch failed') ||
    message.includes('failed to fetch') ||
    message.includes('network request failed') ||
    message.includes('timeout') ||
    code === 'ECONNREFUSED' ||
    code === 'ETIMEDOUT'
  );
}

async function fetchWithRetry(
  url: string,
  options?: RequestInit,
  retryCount = 0,
  isRateLimitRetry = false
): Promise<Response> {
  try {
    const controller = new AbortController();
    const isTTSRequest = url.includes('/tts/generate') || url.includes('/tours/generate');
    const timeoutDuration = isTTSRequest ? 180000 : 60000;
    const timeoutId = setTimeout(() => controller.abort(), timeoutDuration);
    
    const response = await fetch(url, {
      ...options,
      signal: options?.signal || controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if ((response.status === 429 || response.status === 503 || response.status === 502) && retryCount < 2) {
      const delay = isRateLimitRetry 
        ? RATE_LIMIT_RETRY_DELAY_MS * Math.pow(2, retryCount)
        : (response.status === 429 ? RATE_LIMIT_RETRY_DELAY_MS : RETRY_DELAY_MS * Math.pow(2, retryCount));
      
      const reason = response.status === 429 ? 'Rate limited' : 'Service unavailable';
      console.log(`[tRPC] ${reason}. Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return fetchWithRetry(url, options, retryCount + 1, response.status === 429);
    }
    
    return response;
  } catch (error: any) {
    console.error(`[tRPC] Fetch attempt ${retryCount + 1} failed:`, error);
    
    const isAborted = error?.name === 'AbortError' || error?.message?.includes('Aborted');
    if (isAborted) {
      throw new Error('Request timed out. The operation took too long. Please try again with a shorter request.');
    }
    
    if (retryCount < MAX_RETRIES && isNetworkError(error)) {
      const delay = RETRY_DELAY_MS * Math.pow(2, retryCount);
      console.log(`[tRPC] Retrying in ${delay}ms...`);
      
      await new Promise(resolve => setTimeout(resolve, delay));
      return fetchWithRetry(url, options, retryCount + 1, isRateLimitRetry);
    }
    
    throw error;
  }
}

export const trpcClient = trpc.createClient({
  links: [
    httpLink({
      url: `${getBaseUrl()}/api/trpc`,
      transformer: superjson,
      fetch: async (url, options) => {
        const urlString = typeof url === 'string' ? url : url.toString();
        console.log("[tRPC] Making request to:", urlString);
        console.log("[tRPC] Request method:", options?.method || 'GET');
        
        // Add cellular-compatible headers
        const headers = {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': 'SoloBuddy/1.0 (Audio Tour App)',
          ...(options?.headers || {}),
        };
        
        console.log("[tRPC] Request headers:", headers);
        
        try {
          const response = await fetchWithRetry(urlString, { ...options, headers });
          console.log("[tRPC] Response status:", response.status);
          
          const contentType = response.headers.get('content-type') || '';
          const isJson = contentType.includes('application/json');
          
          if (!response.ok) {
            let errorMessage = `HTTP ${response.status}`;
            let isTRPCError = false;
            
            try {
              if (isJson) {
                const errorData = await response.json();
                console.log('[tRPC] Error response data:', errorData);
                
                if (errorData.error?.message) {
                  errorMessage = errorData.error.message;
                  isTRPCError = true;
                } else if (errorData.message) {
                  errorMessage = errorData.message;
                  isTRPCError = true;
                } else if (errorData.error?.data?.message) {
                  errorMessage = errorData.error.data.message;
                  isTRPCError = true;
                } else if (errorData.error) {
                  errorMessage = typeof errorData.error === 'string' ? errorData.error : JSON.stringify(errorData.error);
                  isTRPCError = true;
                }
              } else {
                const textResponse = await response.text();
                
                if (textResponse.includes('<!DOCTYPE html>') || textResponse.includes('<html')) {
                  console.warn('[tRPC] Received HTML error page, likely blocked by security system');
                  
                  if (textResponse.includes('403') || textResponse.includes('Access Denied')) {
                    errorMessage = 'Request blocked by security system. The request may be too large or contain invalid characters. Please try simplifying your request.';
                  } else if (textResponse.includes('502') || textResponse.includes('Bad Gateway')) {
                    errorMessage = 'Backend service temporarily unavailable. Please try again.';
                  } else {
                    errorMessage = 'Request blocked by server. Please try again later.';
                  }
                } else {
                  errorMessage = textResponse.length > 200 ? textResponse.substring(0, 200) + '...' : textResponse;
                  isTRPCError = textResponse.trim().length > 0;
                }
              }
            } catch (parseError) {
              console.error('[tRPC] Error parsing response:', parseError);
            }
            
            if (response.status === 404) {
              console.error('[tRPC] 404 Error - Full URL:', urlString);
              console.error('[tRPC] Endpoint not found. Request headers:', JSON.stringify(options?.headers || {}));
              
              // Helper for debugging Rork/Hono path issues
              const urlObj = new URL(urlString);
              console.error('[tRPC] Path components:', urlObj.pathname.split('/'));
              
              console.error('[tRPC] Backend may not be deployed or endpoint is incorrect');
              if (!isTRPCError) {
                errorMessage = 'Backend endpoint not found. The backend may not be deployed yet. Please wait a moment and try again.';
              }
            } else if (response.status === 429) {
              if (!isTRPCError) {
                errorMessage = 'Too many requests. Please wait a moment and try again.';
              }
            } else if (response.status === 502 || response.status === 503) {
              if (!isTRPCError) {
                errorMessage = 'Service temporarily unavailable. Please try again in a moment.';
              }
            } else if (response.status >= 500) {
              if (!isTRPCError) {
                errorMessage = 'Server error. Please try again in a few moments.';
              }
            }
            
            throw new Error(errorMessage);
          }
          
          if (!isJson) {
            console.warn('[tRPC] Response is not JSON, content-type:', contentType);
            throw new Error('Invalid response from server');
          }
          
          return response;
        } catch (error) {
          const errorMessage = serializeError(error);
          console.error('[tRPC] Request failed:', errorMessage);
          
          if (isNetworkError(error)) {
            const msg = Platform.OS === 'web'
              ? 'Connection failed. Please check your internet connection.'
              : 'Network error. Please check your connection and try again.';
            throw new Error(msg);
          }
          
          throw new Error(errorMessage);
        }
      },
    }),
  ],
});
