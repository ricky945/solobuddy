import createContextHook from "@nkzw/create-context-hook";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { kvGetItem, kvSetItem } from "@/lib/kv-storage";
import { SubscriptionTier, User, UserProfile } from "@/types";

const STORAGE_KEY = "@solobuddy:user";

const defaultUser: User = {
  id: "default-user",
  subscriptionTier: "free",
  toursCreated: 0,
  toursRemaining: 2,
  hasCompletedOnboarding: false,
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
    
    return false;
  };

  const canCreateTour = () => {
    return true;
  };

  const updateProfile = (profile: Partial<UserProfile>) => {
    const currentUser = userQuery.data || defaultUser;
    const updatedProfile = { ...currentUser.profile, ...profile } as UserProfile;
    updateUserMutation.mutate({ profile: updatedProfile });
  };

  return {
    user: userQuery.data || defaultUser,
    isLoading: userQuery.isLoading,
    upgradeTier,
    incrementToursCreated,
    canCreateTour,
    hasActiveSubscription,
    updateProfile,
    updateUser: updateUserMutation.mutate,
  };
});
