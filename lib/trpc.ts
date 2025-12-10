import { createTRPCReact } from "@trpc/react-query";
import { httpLink } from "@trpc/client";
import type { AppRouter } from "@/backend/trpc/app-router";
import superjson from "superjson";
import { Platform } from "react-native";

export const trpc = createTRPCReact<AppRouter>();

const getBaseUrl = () => {
  const projectId = "buhvfi1mufdztgwxbocnu";
  
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const currentHost = window.location.host;
    if (currentHost.includes('localhost') || currentHost.includes('127.0.0.1')) {
      const baseUrl = `http://localhost:8081/api`;
      console.log("[tRPC] Using local development URL:", baseUrl);
      return baseUrl.replace('/api', '');
    }
  }
  
  const baseUrl = `https://dev-${projectId}.rorktest.dev`;
  console.log("[tRPC] Using production URL:", baseUrl);
  return baseUrl;
};

export const trpcClient = trpc.createClient({
  links: [
    httpLink({
      url: `${getBaseUrl()}/api/trpc`,
      transformer: superjson,
      fetch: async (url, options) => {
        console.log("[tRPC] Making request to:", url);
        console.log("[tRPC] Request method:", options?.method);
        
        const maxRetries = 2;
        
        for (let attempt = 0; attempt < maxRetries; attempt++) {
          try {
            if (attempt > 0) {
              const waitTime = 1000 * attempt;
              console.log(`[tRPC] Retry attempt ${attempt + 1}/${maxRetries}, waiting ${waitTime}ms`);
              await new Promise(resolve => setTimeout(resolve, waitTime));
            }
            
            const response = await fetch(url, options);
            console.log("[tRPC] Response status:", response.status);
            console.log("[tRPC] Response headers:", Object.fromEntries(response.headers.entries()));
            
            const contentType = response.headers.get('content-type') || '';
            const isJson = contentType.includes('application/json');
            
            if (!response.ok) {
              let errorMessage = `HTTP ${response.status}`;
              
              try {
                if (isJson) {
                  const errorData = await response.json();
                  errorMessage = errorData.error || errorData.message || errorMessage;
                  console.error('[tRPC] JSON error response:', errorData);
                } else {
                  const textResponse = await response.text();
                  errorMessage = textResponse || errorMessage;
                  console.error('[tRPC] Non-JSON error response:', textResponse);
                }
              } catch (parseError) {
                console.error('[tRPC] Error parsing response:', parseError);
              }
              
              if (response.status === 404) {
                if (attempt < maxRetries - 1) {
                  const waitTime = 2000;
                  console.warn(`[tRPC] Backend not found (404), waiting ${waitTime}ms before retry ${attempt + 1}/${maxRetries}...`);
                  await new Promise(resolve => setTimeout(resolve, waitTime));
                  continue;
                }
                console.error("[tRPC] Backend not found after all retries");
                throw new Error('Backend is temporarily unavailable. Please try again later.');
              }
              
              if (response.status >= 500 && attempt < maxRetries - 1) {
                console.warn(`[tRPC] Server error (${response.status}), retrying...`);
                continue;
              }
              
              throw new Error(errorMessage);
            }
            
            if (!isJson) {
              console.warn('[tRPC] Response is not JSON, content-type:', contentType);
              const textResponse = await response.text();
              console.warn('[tRPC] Non-JSON body:', textResponse.substring(0, 200));
              throw new Error('Non-JSON response received from server');
            }
            
            return response;
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(`[tRPC] Request error (attempt ${attempt + 1}/${maxRetries}):`, errorMessage);
            
            if (attempt === maxRetries - 1) {
              console.error('[tRPC] All retries failed');
              throw error;
            }
          }
        }
        
        throw new Error('Request failed after all retries');
      },
    }),
  ],
});
