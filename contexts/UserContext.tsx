import createContextHook from "@nkzw/create-context-hook";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Session } from "@supabase/supabase-js";
import { useEffect, useMemo, useRef, useState } from "react";

import { kvGetItem, kvSetItem } from "@/lib/kv-storage";
import { supabase } from "@/lib/supabase";
import { SubscriptionTier, User, UserProfile } from "@/types";

const STORAGE_KEY = "@solobuddy:user";

const defaultUser: User = {
  id: "default-user",
  subscriptionTier: "free",
  toursCreated: 0,
  toursRemaining: 2,
  hasCompletedOnboarding: false,
};

type SupabaseAuthState = {
  session: Session | null;
  isAuthLoading: boolean;
  isSignedIn: boolean;
  authUserId: string | null;
  authEmail: string | null;

  signInWithPassword: (args: { email: string; password: string }) => Promise<void>;
  signUpWithPassword: (args: { email: string; password: string }) => Promise<void>;
  signOut: () => Promise<void>;

  isSigningIn: boolean;
  isSigningUp: boolean;
  isSigningOut: boolean;
};

export const [UserProvider, useUser] = createContextHook(() => {
  const queryClient = useQueryClient();

  const userQuery = useQuery({
    queryKey: ["user"],
    queryFn: async () => {
      try {
        const stored = await kvGetItem(STORAGE_KEY);
        return stored ? JSON.parse(stored) : defaultUser;
      } catch (error) {
        console.error("Error loading user:", error);
        return defaultUser;
      }
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: async (updates: Partial<User>) => {
      const currentUser = userQuery.data || defaultUser;
      const updatedUser = { ...currentUser, ...updates };
      await kvSetItem(STORAGE_KEY, JSON.stringify(updatedUser));
      return updatedUser;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["user"], data);
    },
  });

  const upgradeTier = (tier: SubscriptionTier) => {
    const toursRemaining = tier === "free" ? 2 : -1;

    let expiresAt: number | undefined;
    if (tier === "weekly") {
      expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;
    } else if (tier === "yearly") {
      expiresAt = Date.now() + 365 * 24 * 60 * 60 * 1000;
    }

    updateUserMutation.mutate({
      subscriptionTier: tier,
      toursRemaining,
      subscriptionExpiresAt: expiresAt,
    });
  };

  const incrementToursCreated = () => {
    const currentUser = userQuery.data || defaultUser;
    const newToursCreated = currentUser.toursCreated + 1;
    const newToursRemaining =
      currentUser.subscriptionTier === "free"
        ? Math.max(0, currentUser.toursRemaining - 1)
        : -1;

    updateUserMutation.mutate({
      toursCreated: newToursCreated,
      toursRemaining: newToursRemaining,
    });
  };

  const hasActiveSubscription = () => {
    const user = userQuery.data || defaultUser;
    if (user.subscriptionTier === "free") return false;

    if (user.subscriptionExpiresAt) {
      return Date.now() < user.subscriptionExpiresAt;
    }

    // If no expiration date but has a paid tier, consider it active
    return user.subscriptionTier !== "free";
  };

  const canCreateTour = () => {
    const user = userQuery.data || defaultUser;
    return hasActiveSubscription() || user.toursRemaining > 0;
  };

  const canAccessFeature = () => {
    return hasActiveSubscription();
  };

  const updateProfile = (profile: Partial<UserProfile>) => {
    const currentUser = userQuery.data || defaultUser;
    const updatedProfile = { ...currentUser.profile, ...profile } as UserProfile;
    updateUserMutation.mutate({ profile: updatedProfile });
  };

  const resetOnboarding = () => {
    updateUserMutation.mutate({ hasCompletedOnboarding: false });
  };

  const [session, setSession] = useState<Session | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);
  const didInitRef = useRef<boolean>(false);

  useEffect(() => {
    if (didInitRef.current) return;
    didInitRef.current = true;

    let isMounted = true;

    const run = async () => {
      try {
        console.log("[SupabaseAuth] getSession start");
        const { data, error } = await supabase.auth.getSession();
        if (error) {
          console.error("[SupabaseAuth] getSession error", { message: error.message, name: error.name });
        }

        const nextSession = data?.session ?? null;
        console.log("[SupabaseAuth] getSession result", {
          hasSession: Boolean(nextSession),
          userId: nextSession?.user?.id ?? null,
        });

        if (isMounted) setSession(nextSession);
      } catch (e) {
        console.error("[SupabaseAuth] getSession exception", e);
      } finally {
        if (isMounted) setIsAuthLoading(false);
      }
    };

    run();

    const { data: sub } = supabase.auth.onAuthStateChange((event, nextSession) => {
      console.log("[SupabaseAuth] onAuthStateChange", {
        event,
        hasSession: Boolean(nextSession),
        userId: nextSession?.user?.id ?? null,
      });
      setSession(nextSession);
      setIsAuthLoading(false);
    });

    return () => {
      isMounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const { mutateAsync: signInWithPasswordAsync, isPending: isSigningIn } = useMutation({
    mutationFn: async (args: { email: string; password: string }) => {
      console.log("[SupabaseAuth] signInWithPassword", { email: args.email });
      const { data, error } = await supabase.auth.signInWithPassword({ email: args.email, password: args.password });
      if (error) {
        console.error("[SupabaseAuth] signInWithPassword error", { name: error.name, message: error.message });
        throw error;
      }
      console.log("[SupabaseAuth] signInWithPassword success", {
        hasSession: Boolean(data.session),
        userId: data.user?.id ?? null,
      });
      return data;
    },
  });

  const { mutateAsync: signUpWithPasswordAsync, isPending: isSigningUp } = useMutation({
    mutationFn: async (args: { email: string; password: string }) => {
      console.log("[SupabaseAuth] signUp", { email: args.email });
      const { data, error } = await supabase.auth.signUp({
        email: args.email,
        password: args.password,
      });
      if (error) {
        console.error("[SupabaseAuth] signUp error", { name: error.name, message: error.message });
        throw error;
      }
      console.log("[SupabaseAuth] signUp result", {
        hasSession: Boolean(data.session),
        userId: data.user?.id ?? null,
      });
      return data;
    },
  });

  const { mutateAsync: signOutAsync, isPending: isSigningOut } = useMutation({
    mutationFn: async () => {
      console.log("[SupabaseAuth] signOut");
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error("[SupabaseAuth] signOut error", { name: error.name, message: error.message });
        throw error;
      }
    },
    onSuccess: () => {
      setSession(null);
    },
  });

  const authState: SupabaseAuthState = useMemo(() => {
    const authUserId = session?.user?.id ?? null;
    const authEmail = session?.user?.email ?? null;

    return {
      session,
      isAuthLoading,
      isSignedIn: Boolean(session?.user?.id),
      authUserId,
      authEmail,

      signInWithPassword: async (args) => {
        await signInWithPasswordAsync(args);
      },
      signUpWithPassword: async (args) => {
        await signUpWithPasswordAsync(args);
      },
      signOut: async () => {
        await signOutAsync();
      },

      isSigningIn,
      isSigningUp,
      isSigningOut,
    };
  }, [isAuthLoading, isSigningIn, isSigningOut, isSigningUp, session, signInWithPasswordAsync, signOutAsync, signUpWithPasswordAsync]);

  return {
    user: userQuery.data || defaultUser,
    isLoading: userQuery.isLoading,
    upgradeTier,
    incrementToursCreated,
    canCreateTour,
    canAccessFeature,
    hasActiveSubscription,
    updateProfile,
    updateUser: updateUserMutation.mutate,
    resetOnboarding,

    ...authState,
  };
});
