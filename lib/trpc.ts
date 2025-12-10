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
        
        try {
          const response = await fetch(url, options);
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
              throw new Error('Backend is temporarily unavailable. Please try again later.');
            }
            
            throw new Error(errorMessage);
          }
          
          if (!isJson) {
            console.warn('[tRPC] Response is not JSON, content-type:', contentType);
            throw new Error('Non-JSON response received from server');
          }
          
          return response;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.error('[tRPC] Request error:', errorMessage);
          throw error;
        }
      },
    }),
  ],
});
