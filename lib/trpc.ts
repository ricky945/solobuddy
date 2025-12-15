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

function isNetworkError(error: any): boolean {
  const message = error?.message?.toLowerCase() || '';
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
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    
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
          let errorMessage = 'Unknown error occurred';
          
          if (error instanceof Error) {
            errorMessage = error.message;
          } else if (typeof error === 'object' && error !== null) {
            if ('message' in error && typeof error.message === 'string') {
              errorMessage = error.message;
            } else if ('message' in error && error.message) {
              errorMessage = String(error.message);
            } else {
              try {
                const keys = Object.keys(error);
                if (keys.length > 0) {
                  errorMessage = `Error with properties: ${keys.join(', ')}`;
                } else {
                  errorMessage = 'Unknown error (empty object)';
                }
              } catch {
                errorMessage = 'Unknown error';
              }
            }
          } else if (typeof error === 'string') {
            errorMessage = error;
          } else {
            errorMessage = String(error);
          }
          
          console.error('[tRPC] Request failed:', errorMessage);
          console.error('[tRPC] Raw error:', error);
          console.error('[tRPC] Error type:', typeof error);
          console.error('[tRPC] Error constructor:', error?.constructor?.name);
          
          if (error && typeof error === 'object') {
            console.error('[tRPC] Error.name:', (error as any).name);
            console.error('[tRPC] Error.message:', (error as any).message);
            console.error('[tRPC] Error.stack:', (error as any).stack);
            console.error('[tRPC] Error.cause:', (error as any).cause);
            console.error('[tRPC] Error.code:', (error as any).code);
            
            const allKeys = Object.getOwnPropertyNames(error);
            console.error('[tRPC] All property names:', allKeys);
            
            const extracted: any = {};
            allKeys.forEach(key => {
              try {
                extracted[key] = (error as any)[key];
              } catch {
                extracted[key] = '[Error accessing property]';
              }
            });
            console.error('[tRPC] Extracted properties:', extracted);
          }
          
          if (isNetworkError(error)) {
            if (Platform.OS === 'web') {
              throw new Error('Connection failed. Please check your internet connection.');
            } else {
              throw new Error('Network error. Please check your connection and try again.');
            }
          }
          
          throw new Error(errorMessage);
        }
      },
    }),
  ],
});
