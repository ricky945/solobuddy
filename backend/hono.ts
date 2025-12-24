import { Hono } from "hono";
import { cors } from "hono/cors";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "./trpc/app-router";
import { createContext } from "./trpc/create-context";

const app = new Hono();

console.log("[Backend] Starting Hono server v1.3.4 - Backend active");
console.log("[Backend] Environment:", {
  nodeEnv: process.env.NODE_ENV,
  hasOpenAI: !!process.env.EXPO_PUBLIC_OPENAI_API_KEY,
  hasGooglePlaces: !!process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY
});

app.use("*", cors());

app.get("/", (c) => {
  return c.json({ 
    status: "ok", 
    message: "API is running - Production ready!", 
    version: "1.1.0",
    timestamp: new Date().toISOString(),
    health: "healthy"
  });
});

app.get("/health", (c) => {
  return c.json({ 
    status: "healthy",
    timestamp: new Date().toISOString(),
    routes: {
      trpc: "/api/trpc",
      available: true
    }
  });
});

// Logging middleware for tRPC
app.use("/api/trpc/*", async (c, next) => {
  const startTime = Date.now();
  const path = new URL(c.req.url).pathname;
  console.log(`[Hono] ${c.req.method} ${path}`);
  try {
    await next();
    const duration = Date.now() - startTime;
    console.log(`[Hono] ✓ ${path} completed in ${duration}ms`);
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[Hono] ✗ ${path} failed after ${duration}ms:`, error);
    throw error;
  }
});

// tRPC Handler
app.all("/api/trpc/*", (c) => {
  // Use Hono's parsed path for reliability and normalize it
  const pathname = c.req.path.replace(/\/+/g, '/');
  
  console.log(`[tRPC Debug] Request URL: ${c.req.url}`);
  console.log(`[tRPC Debug] Normalized Pathname: ${pathname}`);
  
  // Determine the correct endpoint to strip based on the actual path
  // This fixes issues where proxies might strip parts of the path
  let endpoint = "/api/trpc";
  
  // Dynamic endpoint detection: find the /trpc segment
  // This handles /api/trpc, /trpc, or any other prefix ending in /trpc
  const trpcSegment = "/trpc";
  const trpcIndex = pathname.indexOf(trpcSegment);
  
  if (trpcIndex !== -1) {
    // The endpoint is everything from the start up to and including /trpc
    endpoint = pathname.substring(0, trpcIndex + trpcSegment.length);
  } else if (pathname.includes("/api/trpc")) {
     // Fallback for cases where /trpc might be part of /api/trpc string but something else matches
     endpoint = "/api/trpc";
  }
  
  console.log(`[tRPC Debug] Using endpoint: ${endpoint}`);
  
  return fetchRequestHandler({
    endpoint,
    req: c.req.raw,
    router: appRouter,
    createContext,
    onError({ error, path }) {
      console.error(`[tRPC] Error on ${path}:`, error);
      // Detailed error logging to catch path mismatches
      if (error.code === 'NOT_FOUND') {
        console.error(`[tRPC] Path resolution failed. Router has keys: ${Object.keys(appRouter._def.procedures).join(', ') || 'unknown'}`);
        console.error(`[tRPC] Attempted path: ${path}`);
        console.error(`[tRPC] Configured endpoint: ${endpoint}`);
        console.error(`[tRPC] Request URL: ${c.req.url}`);
      }
    },
  });
});

app.onError((err, c) => {
  console.error("[Hono] Error:", err);
  return c.json(
    { 
      error: err.message || "Internal server error",
      stack: process.env.NODE_ENV === "development" ? err.stack : undefined 
    }, 
    500
  );
});

app.notFound((c) => {
  console.error("[Hono] 404 Not Found:", c.req.url);
  return c.json({ error: "Route not found", url: c.req.url }, 404);
});

export default app;
