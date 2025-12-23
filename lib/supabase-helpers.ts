import type { PostgrestError } from "@supabase/supabase-js";

import { supabase, type PublicTableName } from "@/lib/supabase";

export type SupabaseResult<T> =
  | { data: T; error: null }
  | { data: null; error: PostgrestError | Error };

export type BaseRow = {
  id?: string;
  created_at?: string;
  updated_at?: string;
};

export type ProfileRow = BaseRow & Record<string, unknown>;
export type LandmarkRow = BaseRow & Record<string, unknown>;
export type LandmarkUpvoteRow = BaseRow & Record<string, unknown>;
export type LandmarkReviewRow = BaseRow & Record<string, unknown>;
export type TourRow = BaseRow & Record<string, unknown>;
export type TourStopRow = BaseRow & Record<string, unknown>;
export type AudioClipRow = BaseRow & Record<string, unknown>;
export type TTSAudioChunkRow = BaseRow & Record<string, unknown>;

function normalizeError(error: unknown): Error {
  if (error instanceof Error) return error;
  return new Error(typeof error === "string" ? error : "Unknown error");
}

export async function sbSelectMany<T extends Record<string, unknown> = Record<string, unknown>>(args: {
  table: PublicTableName;
  select?: string;
  eq?: Record<string, string | number | boolean | null>;
  limit?: number;
  order?: { column: string; ascending?: boolean };
}): Promise<SupabaseResult<T[]>> {
  try {
    console.log("[SupabaseHelpers] selectMany start", args);

    let query = supabase
      .from(args.table)
      .select(args.select ?? "*") as unknown as ReturnType<typeof supabase.from>;

    if (args.eq) {
      for (const [key, value] of Object.entries(args.eq)) {
        query = (query as any).eq(key, value);
      }
    }

    if (args.order) {
      query = (query as any).order(args.order.column, { ascending: args.order.ascending ?? true });
    }

    if (typeof args.limit === "number") {
      query = (query as any).limit(args.limit);
    }

    const { data, error } = await (query as any);

    if (error) {
      console.error("[SupabaseHelpers] selectMany error", { table: args.table, error });
      return { data: null, error };
    }

    const rows = (Array.isArray(data) ? data : []) as T[];
    console.log("[SupabaseHelpers] selectMany success", { table: args.table, count: rows.length });

    return { data: rows, error: null };
  } catch (e) {
    const error = normalizeError(e);
    console.error("[SupabaseHelpers] selectMany exception", { table: args.table, message: error.message });
    return { data: null, error };
  }
}

export async function sbSelectOne<T extends Record<string, unknown> = Record<string, unknown>>(args: {
  table: PublicTableName;
  select?: string;
  eq: Record<string, string | number | boolean | null>;
}): Promise<SupabaseResult<T | null>> {
  try {
    console.log("[SupabaseHelpers] selectOne start", args);

    let query = supabase
      .from(args.table)
      .select(args.select ?? "*") as unknown as ReturnType<typeof supabase.from>;

    for (const [key, value] of Object.entries(args.eq)) {
      query = (query as any).eq(key, value);
    }

    const { data, error } = await (query as any).maybeSingle();

    if (error) {
      console.error("[SupabaseHelpers] selectOne error", { table: args.table, error });
      return { data: null, error };
    }

    console.log("[SupabaseHelpers] selectOne success", { table: args.table, found: Boolean(data) });

    return { data: (data ?? null) as T | null, error: null };
  } catch (e) {
    const error = normalizeError(e);
    console.error("[SupabaseHelpers] selectOne exception", { table: args.table, message: error.message });
    return { data: null, error };
  }
}

export async function sbInsertOne<T extends Record<string, unknown> = Record<string, unknown>>(args: {
  table: PublicTableName;
  values: Record<string, unknown>;
  select?: string;
}): Promise<SupabaseResult<T>> {
  try {
    console.log("[SupabaseHelpers] insertOne start", { table: args.table, keys: Object.keys(args.values) });

    const { data, error } = await (supabase
      .from(args.table)
      .insert(args.values)
      .select(args.select ?? "*")
      .single() as any);

    if (error) {
      console.error("[SupabaseHelpers] insertOne error", { table: args.table, error });
      return { data: null, error };
    }

    console.log("[SupabaseHelpers] insertOne success", { table: args.table, hasRow: Boolean(data) });
    return { data: data as T, error: null };
  } catch (e) {
    const error = normalizeError(e);
    console.error("[SupabaseHelpers] insertOne exception", { table: args.table, message: error.message });
    return { data: null, error };
  }
}

export async function sbUpsertOne<T extends Record<string, unknown> = Record<string, unknown>>(args: {
  table: PublicTableName;
  values: Record<string, unknown>;
  onConflict?: string;
  select?: string;
}): Promise<SupabaseResult<T>> {
  try {
    console.log("[SupabaseHelpers] upsertOne start", {
      table: args.table,
      keys: Object.keys(args.values),
      onConflict: args.onConflict ?? null,
    });

    const { data, error } = await (supabase
      .from(args.table)
      .upsert(args.values, args.onConflict ? { onConflict: args.onConflict } : undefined)
      .select(args.select ?? "*")
      .single() as any);

    if (error) {
      console.error("[SupabaseHelpers] upsertOne error", { table: args.table, error });
      return { data: null, error };
    }

    console.log("[SupabaseHelpers] upsertOne success", { table: args.table, hasRow: Boolean(data) });
    return { data: data as T, error: null };
  } catch (e) {
    const error = normalizeError(e);
    console.error("[SupabaseHelpers] upsertOne exception", { table: args.table, message: error.message });
    return { data: null, error };
  }
}

export async function sbUpdateMany<T extends Record<string, unknown> = Record<string, unknown>>(args: {
  table: PublicTableName;
  values: Record<string, unknown>;
  eq: Record<string, string | number | boolean | null>;
  select?: string;
}): Promise<SupabaseResult<T[]>> {
  try {
    console.log("[SupabaseHelpers] updateMany start", {
      table: args.table,
      keys: Object.keys(args.values),
      eqKeys: Object.keys(args.eq),
    });

    let query = supabase
      .from(args.table)
      .update(args.values)
      .select(args.select ?? "*") as unknown as ReturnType<typeof supabase.from>;

    for (const [key, value] of Object.entries(args.eq)) {
      query = (query as any).eq(key, value);
    }

    const { data, error } = await (query as any);

    if (error) {
      console.error("[SupabaseHelpers] updateMany error", { table: args.table, error });
      return { data: null, error };
    }

    const rows = (Array.isArray(data) ? data : []) as T[];
    console.log("[SupabaseHelpers] updateMany success", { table: args.table, count: rows.length });

    return { data: rows, error: null };
  } catch (e) {
    const error = normalizeError(e);
    console.error("[SupabaseHelpers] updateMany exception", { table: args.table, message: error.message });
    return { data: null, error };
  }
}

export async function sbDeleteMany<T extends Record<string, unknown> = Record<string, unknown>>(args: {
  table: PublicTableName;
  eq: Record<string, string | number | boolean | null>;
  select?: string;
}): Promise<SupabaseResult<T[]>> {
  try {
    console.log("[SupabaseHelpers] deleteMany start", { table: args.table, eqKeys: Object.keys(args.eq) });

    let query = supabase
      .from(args.table)
      .delete()
      .select(args.select ?? "*") as unknown as ReturnType<typeof supabase.from>;

    for (const [key, value] of Object.entries(args.eq)) {
      query = (query as any).eq(key, value);
    }

    const { data, error } = await (query as any);

    if (error) {
      console.error("[SupabaseHelpers] deleteMany error", { table: args.table, error });
      return { data: null, error };
    }

    const rows = (Array.isArray(data) ? data : []) as T[];
    console.log("[SupabaseHelpers] deleteMany success", { table: args.table, count: rows.length });

    return { data: rows, error: null };
  } catch (e) {
    const error = normalizeError(e);
    console.error("[SupabaseHelpers] deleteMany exception", { table: args.table, message: error.message });
    return { data: null, error };
  }
}

export async function getProfileById(userId: string): Promise<SupabaseResult<ProfileRow | null>> {
  return sbSelectOne<ProfileRow>({ table: "profiles", eq: { id: userId } });
}

export async function upsertProfile(profile: ProfileRow): Promise<SupabaseResult<ProfileRow>> {
  return sbUpsertOne<ProfileRow>({ table: "profiles", values: profile, onConflict: "id" });
}

export async function listLandmarks(args: {
  limit?: number;
  orderBy?: { column: string; ascending?: boolean };
  eq?: Record<string, string | number | boolean | null>;
}): Promise<SupabaseResult<LandmarkRow[]>> {
  return sbSelectMany<LandmarkRow>({
    table: "landmarks",
    limit: args.limit,
    order: args.orderBy,
    eq: args.eq,
  });
}

export async function createLandmark(values: LandmarkRow): Promise<SupabaseResult<LandmarkRow>> {
  return sbInsertOne<LandmarkRow>({ table: "landmarks", values });
}

export async function createLandmarkUpvote(values: LandmarkUpvoteRow): Promise<SupabaseResult<LandmarkUpvoteRow>> {
  return sbInsertOne<LandmarkUpvoteRow>({ table: "landmark_upvotes", values });
}

export async function deleteLandmarkUpvote(args: {
  landmarkId: string;
  userId: string;
}): Promise<SupabaseResult<LandmarkUpvoteRow[]>> {
  return sbDeleteMany<LandmarkUpvoteRow>({
    table: "landmark_upvotes",
    eq: { landmark_id: args.landmarkId, user_id: args.userId },
  });
}

export async function createLandmarkReview(values: LandmarkReviewRow): Promise<SupabaseResult<LandmarkReviewRow>> {
  return sbInsertOne<LandmarkReviewRow>({ table: "landmark_reviews", values });
}

export async function createTour(values: TourRow): Promise<SupabaseResult<TourRow>> {
  return sbInsertOne<TourRow>({ table: "tours", values });
}

export async function listTourStopsByTourId(tourId: string): Promise<SupabaseResult<TourStopRow[]>> {
  return sbSelectMany<TourStopRow>({
    table: "tour_stops",
    eq: { tour_id: tourId },
    order: { column: "stop_index", ascending: true },
  });
}

export async function createTourStop(values: TourStopRow): Promise<SupabaseResult<TourStopRow>> {
  return sbInsertOne<TourStopRow>({ table: "tour_stops", values });
}

export async function createAudioClip(values: AudioClipRow): Promise<SupabaseResult<AudioClipRow>> {
  return sbInsertOne<AudioClipRow>({ table: "audio_clips", values });
}

export async function listTTSAudioChunksByClipId(clipId: string): Promise<SupabaseResult<TTSAudioChunkRow[]>> {
  return sbSelectMany<TTSAudioChunkRow>({
    table: "tts_audio_chunks",
    eq: { audio_clip_id: clipId },
    order: { column: "chunk_index", ascending: true },
  });
}

export async function createTTSAudioChunk(values: TTSAudioChunkRow): Promise<SupabaseResult<TTSAudioChunkRow>> {
  return sbInsertOne<TTSAudioChunkRow>({ table: "tts_audio_chunks", values });
}
