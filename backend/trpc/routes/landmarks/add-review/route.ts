import { z } from "zod";
import { publicProcedure } from "@/backend/trpc/create-context";
import { landmarksDB } from "@/backend/database/landmarks-db";

const addReviewRoute = publicProcedure
  .input(
    z.object({
      landmarkId: z.string(),
      review: z.object({
        id: z.string(),
        userId: z.string(),
        userName: z.string(),
        userAvatar: z.string().optional(),
        rating: z.number().min(1).max(5),
        comment: z.string(),
        createdAt: z.number(),
      }),
    })
  )
  .mutation(async ({ input }) => {
    console.log("[Landmarks] Adding review to landmark:", input.landmarkId);
    const landmark = landmarksDB.addReview(input.landmarkId, input.review);
    
    if (!landmark) {
      throw new Error("Landmark not found");
    }

    return { landmark };
  });

export default addReviewRoute;
