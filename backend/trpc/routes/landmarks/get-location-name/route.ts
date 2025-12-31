import { z } from "zod";
import { publicProcedure } from "@/backend/trpc/create-context";

export default publicProcedure
  .input(
    z.object({
      latitude: z.number(),
      longitude: z.number(),
    })
  )
  .query(async ({ input }) => {
    console.log("[Landmarks] Getting location name for:", input);

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${input.latitude}&lon=${input.longitude}&zoom=18&addressdetails=1`,
        {
          headers: {
            "User-Agent": "RorkTourApp/1.0",
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch location: ${response.status}`);
      }

      const data = await response.json();
      console.log("[Landmarks] Location data received:", data.display_name);

      const address = data.address || {};
      const name =
        address.restaurant ||
        address.cafe ||
        address.bar ||
        address.shop ||
        address.building ||
        address.house_number
          ? `${address.house_number || ""} ${address.road || ""}`.trim()
          : address.road ||
            address.neighbourhood ||
            address.suburb ||
            data.display_name;

      return {
        name: name || "Unknown Location",
        fullAddress: data.display_name,
        type: address.restaurant || address.cafe || address.bar ? "restaurant" : "unique",
      };
    } catch (error: any) {
      console.error("[Landmarks] Error fetching location:", error);
      return {
        name: "Unknown Location",
        fullAddress: "",
        type: "unique" as const,
      };
    }
  });
