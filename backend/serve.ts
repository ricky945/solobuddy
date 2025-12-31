import app from "./hono";

const port = parseInt(process.env.PORT || "3000");

console.log("[Backend] Starting local server on port", port);
console.log("[Backend] Google Places API Key:", process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY ? "Configured" : "NOT SET");

export default {
  port,
  fetch: app.fetch,
};




