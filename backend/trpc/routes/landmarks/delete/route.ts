import { z } from "zod";
import { publicProcedure } from "@/backend/trpc/create-context";
import { landmarksDB } from "@/backend/database/landmarks-db";

const deleteLandmarkRoute = publicProcedure
  .input(
    z.object({
      landmarkId: z.string(),
      userId: z.string(),
    })
  )
  .mutation(async ({ input }) => {
    console.log("[Landmarks] Delete requested:", {
      landmarkId: input.landmarkId,
      userId: input.userId,
    });

    const landmark = landmarksDB.getById(input.landmarkId);
    if (!landmark) {
      console.error("[Landmarks] Delete failed: landmark not found", input.landmarkId);
      throw new Error("Landmark not found");
    }

    if (landmark.createdBy !== input.userId) {
      console.error("[Landmarks] Delete blocked: not creator", {
        landmarkId: input.landmarkId,
        createdBy: landmark.createdBy,
        userId: input.userId,
      });
      throw new Error("Only the creator can delete this location");
    }

    const success = landmarksDB.delete(input.landmarkId);
    if (!success) {
      console.error("[Landmarks] Delete failed in DB", input.landmarkId);
      throw new Error("Failed to delete location");
    }

    console.log("[Landmarks] Deleted landmark:", input.landmarkId);
    return { success: true, deleted: true, landmarkId: input.landmarkId };
  });

export default deleteLandmarkRoute;
