import { createTRPCReact } from "@trpc/react-query";
import { httpLink } from "@trpc/client";
import type { AppRouter } from "@/backend/trpc/app-router";
import superjson from "superjson";
import { Platform } from "react-native";

export const trpc = createTRPCReact<AppRouter>();

const getBaseUrl = () => {
  const url = process.env.EXPO_PUBLIC_RORK_API_BASE_URL;
  
  if (!url) {
    throw new Error(
      "EXPO_PUBLIC_RORK_API_BASE_URL is not set. Please contact support."
    );
  }
  
  console.log("[tRPC] Using backend URL:", url);
  return url;
};

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

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
  retryCount = 0
): Promise<Response> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    console.error(`[tRPC] Fetch attempt ${retryCount + 1} failed:`, error);
    
    if (retryCount < MAX_RETRIES && isNetworkError(error)) {
      const delay = RETRY_DELAY_MS * Math.pow(2, retryCount);
      console.log(`[tRPC] Retrying in ${delay}ms...`);
      
      await new Promise(resolve => setTimeout(resolve, delay));
      return fetchWithRetry(url, options, retryCount + 1);
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
        console.log("[tRPC] Making request to:", url);
        const urlString = typeof url === 'string' ? url : url.toString();
        
        try {
          const response = await fetchWithRetry(urlString, options);
          console.log("[tRPC] Response status:", response.status);
          
          const contentType = response.headers.get('content-type') || '';
          const isJson = contentType.includes('application/json');
          
          if (!response.ok) {
            let errorMessage = `HTTP ${response.status}`;
            
            try {
              if (isJson) {
                const errorData = await response.json();
                errorMessage = errorData.error || errorData.message || errorMessage;
              } else {
                const textResponse = await response.text();
                errorMessage = textResponse || errorMessage;
              }
            } catch (parseError) {
              console.error('[tRPC] Error parsing response:', parseError);
            }
            
            if (response.status === 404) {
              throw new Error('Backend endpoint not found. Please check your connection.');
            } else if (response.status === 429) {
              throw new Error('Too many requests. Please wait a moment and try again.');
            } else if (response.status >= 500) {
              throw new Error('Server error. Please try again in a few moments.');
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
