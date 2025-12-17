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

function serializeError(error: unknown): { message: string; type: string; details: any } {
  const type = typeof error;
  
  if (error instanceof Error) {
    const msg = serializeValue(error.message);
    return {
      message: msg || 'Unknown error',
      type: 'Error instance',
      details: {
        name: error.name,
        message: msg,
        code: (error as any).code,
        cause: serializeValue((error as any).cause),
        stack: error.stack?.substring(0, 300),
      }
    };
  }
  
  if (type === 'object' && error !== null) {
    const errorObj = error as any;
    const message = 'message' in errorObj ? serializeValue(errorObj.message) : serializeValue(error);
    return {
      message: message || 'Unknown object error',
      type: 'object',
      details: {
        keys: Object.keys(errorObj),
        serialized: serializeValue(error),
      }
    };
  }
  
  if (type === 'string') {
    return {
      message: error as string,
      type: 'string',
      details: { raw: error }
    };
  }
  
  return {
    message: String(error),
    type,
    details: { raw: error }
  };
}

function serializeValue(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  
  if (value === null || value === undefined) {
    return String(value);
  }
  
  if (typeof value === 'object') {
    try {
      const jsonStr = JSON.stringify(value, (key, val) => {
        if (typeof val === 'function') return '[Function]';
        if (val instanceof Error) return val.message;
        return val;
      });
      
      if (jsonStr && jsonStr !== '{}' && jsonStr !== '[]') {
        return jsonStr;
      }
      
      const keys = Object.keys(value);
      if (keys.length > 0) {
        return `Object with keys: ${keys.join(', ')}`;
      }
      
      return String(value);
    } catch {
      return String(value);
    }
  }
  
  return String(value);
}

function isNetworkError(error: any): boolean {
  const message = serializeValue(error?.message || error).toLowerCase();
  return (
    message.includes('network') ||
    message.includes('fetch failed') ||
    message.includes('failed to fetch') ||
    message.includes('network request failed') ||
    message.includes('timeout') ||
    error?.code === 'ECONNREFUSED' ||
    error?.code === 'ETIMEDOUT'
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
          const errorInfo = serializeError(error);
          
          console.error('[tRPC] Request failed:', errorInfo.message);
          console.error('[tRPC] Error type:', errorInfo.type);
          console.error('[tRPC] Error details:', errorInfo.details);
          
          if (isNetworkError(error)) {
            if (Platform.OS === 'web') {
              throw new Error('Connection failed. Please check your internet connection.');
            } else {
              throw new Error('Network error. Please check your connection and try again.');
            }
          }
          
          throw new Error(errorInfo.message);
        }
      },
    }),
  ],
});
