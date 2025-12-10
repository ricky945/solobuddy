import { z } from "zod";
import { publicProcedure } from "@/backend/trpc/create-context";
import { landmarksDB } from "@/backend/database/landmarks-db";

const getAllLandmarksRoute = publicProcedure
  .input(
    z.object({
      latitude: z.number().min(-90).max(90).optional(),
      longitude: z.number().min(-180).max(180).optional(),
      radius: z.number().min(0).max(500).optional().default(50),
    })
  )
  .query(async ({ input }) => {
    try {
      console.log("[Landmarks] Fetching landmarks", input.latitude && input.longitude ? `near ${input.latitude}, ${input.longitude}` : "globally");

      if (input.latitude && input.longitude) {
        const landmarks = landmarksDB.getByRegion(
          input.latitude,
          input.longitude,
          input.radius
        );
        console.log("[Landmarks] Found", landmarks.length, "landmarks in region");
        return { success: true, landmarks };
      }

      const landmarks = landmarksDB.getAll();
      console.log("[Landmarks] Found", landmarks.length, "total landmarks");
      return { success: true, landmarks };
    } catch (error) {
      console.error("[Landmarks] Error fetching landmarks:", error);
      return { success: true, landmarks: [] };
    }
  });

export default getAllLandmarksRoute;
