import { Hono } from "hono";
import { cors } from "hono/cors";
import { trpcServer } from "@hono/trpc-server";
import { appRouter } from "./trpc/app-router";
import { createContext } from "./trpc/create-context";

const app = new Hono();

console.log("[Backend] Starting Hono server v1.4.0 - Backend active");
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
    version: "1.4.0",
    timestamp: new Date().toISOString(),
    health: "healthy"
  });
});

app.get("/health", (c) => {
  return c.json({ 
    status: "healthy",
    timestamp: new Date().toISOString(),
    routes: {
      trpc: "/trpc",
      available: true
    }
  });
});

// Also support /api/health for frontend compatibility
app.get("/api/health", (c) => {
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
  const path = c.req.path;
  console.log(`[tRPC] ${c.req.method} ${path}`);
  try {
    await next();
    const duration = Date.now() - startTime;
    console.log(`[tRPC] ✓ ${path} completed in ${duration}ms`);
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[tRPC] ✗ ${path} failed after ${duration}ms:`, error);
    throw error;
  }
});

// tRPC Handler - mounted at /api/trpc
app.use(
  "/api/trpc/*",
  trpcServer({
    endpoint: '/api/trpc',
    router: appRouter,
    createContext,
    onError({ error, path }) {
      console.error(`[tRPC] Error on ${path}:`, error);
    },
  })
);

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
