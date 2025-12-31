import { z } from "zod";
import { publicProcedure } from "@/backend/trpc/create-context";
import { landmarksDB } from "@/backend/database/landmarks-db";
import { MapLandmark } from "@/types";

export default publicProcedure
  .input(
    z.object({
      name: z.string().min(1, "Name is required").max(200, "Name too long"),
      type: z.enum(["unique", "restaurant", "touristic"]),
      coordinates: z.object({
        latitude: z.number().min(-90).max(90),
        longitude: z.number().min(-180).max(180),
      }),
      userNote: z.string().max(1000, "Note too long").optional(),
      userImages: z.array(z.string().url()).max(10, "Too many images").optional(),
      userId: z.string().min(1, "User ID required"),
      userName: z.string().min(1, "User name required"),
      userAvatar: z.string().url().optional(),
      category: z.enum(["historical", "cultural", "religious", "museum", "park", "monument", "building", "natural"]).optional(),
      description: z.string().max(1000, "Description too long").optional(),
      imageUrl: z.string().url().optional(),
    })
  )
  .mutation(async ({ input }) => {
    try {
      console.log("[Landmarks] Adding user landmark:", input.name);

      const landmark: MapLandmark = {
        id: `landmark-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: input.name.trim(),
        description: input.description || input.userNote || `A ${input.type} added by a user`,
        coordinates: input.coordinates,
        type: input.type as "unique" | "restaurant" | "touristic",
        userNote: input.userNote,
        userImages: input.userImages || [],
        imageUrl: input.imageUrl,
        category: input.category || (input.type === "restaurant" ? "cultural" : "monument"),
        createdBy: input.userId,
        createdByName: input.userName,
        createdByAvatar: input.userAvatar,
        createdAt: Date.now(),
        upvotes: 0,
        upvotedBy: [],
        reviews: [],
      };

      const savedLandmark = landmarksDB.create(landmark);
      console.log("[Landmarks] Landmark saved successfully:", savedLandmark.id);

      return {
        success: true,
        landmark: savedLandmark,
      };
    } catch (error) {
      console.error("[Landmarks] Error adding landmark:", error);
      throw new Error("Failed to add landmark. Please try again.");
    }
  });
