import { Hono } from "hono";
import { trpcServer } from "@hono/trpc-server";
import { cors } from "hono/cors";
import { appRouter } from "./trpc/app-router";
import { createContext } from "./trpc/create-context";

const app = new Hono();

console.log("[Backend] Starting Hono server v1.3.1 - Backend active");
console.log("[Backend] Environment:", {
  nodeEnv: process.env.NODE_ENV,
  hasOpenAI: !!process.env.EXPO_PUBLIC_OPENAI_API_KEY
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
      available: true,
      endpoints: [
        "tts.generate",
        "tours.save",
        "landmarks.discover",
        "landmarks.add",
        "landmarks.getLocationName",
        "landmarks.getAll",
        "landmarks.upvote",
        "landmarks.addReview"
      ]
    }
  });
});

app.use("/trpc/*", async (c, next) => {
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

app.use(
  "/trpc/*",
  trpcServer({
    router: appRouter,
    createContext,
    endpoint: "/api/trpc",
    onError({ error, path }) {
      console.error(`[tRPC] Error on ${path}:`, error);
      console.error("[tRPC] Error details:", JSON.stringify(error, null, 2));
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
