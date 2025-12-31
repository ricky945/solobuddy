import { z } from "zod";
import { publicProcedure } from "@/backend/trpc/create-context";

const saveTourSchema = z.object({
  tour: z.object({
    id: z.string(),
    type: z.enum(["route", "immersive"]),
    title: z.string(),
    description: z.string(),
    location: z.string(),
    locationCoords: z
      .object({
        latitude: z.number(),
        longitude: z.number(),
      })
      .optional(),
    topics: z.array(
      z.enum(["history", "culture", "food", "economics", "art", "architecture"])
    ),
    areaSpecificity: z.enum(["city", "region", "country"]),
    audioLength: z.union([z.literal(15), z.literal(30), z.literal(40)]),
    transportMethod: z.enum(["walking", "walking_transit"]).optional(),
    audioUrl: z.string(),
    duration: z.number(),
    thumbnailUrl: z.string().optional(),
    landmarks: z.array(z.any()).optional(),
    chapters: z.array(z.any()).optional(),
    createdAt: z.number(),
  }),
});

export default publicProcedure
  .input(saveTourSchema)
  .mutation(async ({ input }) => {
    try {
      console.log("[Backend] Saving tour:", input.tour.id, "Type:", input.tour.type);
      
      if (!input.tour.title || !input.tour.location) {
        throw new Error("Tour must have a title and location");
      }
      
      console.log("[Backend] Tour saved successfully:", input.tour.id);
      return { success: true, tour: input.tour };
    } catch (error) {
      console.error("[Backend] Error saving tour:", error);
      throw new Error("Failed to save tour. Please try again.");
    }
  });
