import { createTRPCRouter } from "./create-context";
import hiRoute, { testOpenAIKey } from "./routes/example/hi/route";
import saveTourRoute from "./routes/tours/generate/route";
import discoverLandmarksRoute from "./routes/landmarks/discover/route";
import addLandmarkRoute from "./routes/landmarks/add/route";
import getLocationNameRoute from "./routes/landmarks/get-location-name/route";
import ttsGenerateRoute from "./routes/tts/generate/route";
import getAllLandmarksRoute from "./routes/landmarks/get-all/route";
import upvoteLandmarkRoute from "./routes/landmarks/upvote/route";
import addReviewRoute from "./routes/landmarks/add-review/route";
import deleteLandmarkRoute from "./routes/landmarks/delete/route";

export const appRouter = createTRPCRouter({
  example: createTRPCRouter({
    hi: hiRoute,
    testOpenAIKey: testOpenAIKey,
  }),
  tours: createTRPCRouter({
    save: saveTourRoute,
  }),
  landmarks: createTRPCRouter({
    discover: discoverLandmarksRoute,
    add: addLandmarkRoute,
    getLocationName: getLocationNameRoute,
    getAll: getAllLandmarksRoute,
    upvote: upvoteLandmarkRoute,
    addReview: addReviewRoute,
    delete: deleteLandmarkRoute,
  }),
  tts: createTRPCRouter({
    generate: ttsGenerateRoute,
  }),
});

export type AppRouter = typeof appRouter;
