import { z } from "zod";
import { publicProcedure } from "@/backend/trpc/create-context";
import { landmarksDB } from "@/backend/database/landmarks-db";

const upvoteLandmarkRoute = publicProcedure
  .input(
    z.object({
      landmarkId: z.string(),
      userId: z.string(),
    })
  )
  .mutation(async ({ input }) => {
    console.log("[Landmarks] Toggling upvote for landmark:", input.landmarkId);
    const landmark = landmarksDB.addUpvote(input.landmarkId, input.userId);
    
    if (!landmark) {
      throw new Error("Landmark not found");
    }

    return { landmark };
  });

export default upvoteLandmarkRoute;
