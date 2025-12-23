import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { View, ActivityIndicator } from "react-native";

import "@/lib/supabase";

import { UserProvider, useUser } from "@/contexts/UserContext";
import { ToursProvider, useTours } from "@/contexts/ToursContext";
import ErrorBoundary from "@/components/ErrorBoundary";
import { SafeAreaProvider } from "react-native-safe-area-context";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      retryDelay: 1000,
      staleTime: 30000,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 1,
      retryDelay: 1000,
    },
  },
});

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerBackTitle: "Back" }}>
      <Stack.Screen name="splash" options={{ headerShown: false }} />
      <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="route-navigation" options={{ headerShown: false, presentation: "card" }} />
      <Stack.Screen name="auth/callback" options={{ headerShown: false, presentation: "card" }} />
    </Stack>
  );
}

function AppContent() {
  const { user, isLoading: userLoading } = useUser();
  const { isLoading: toursLoading } = useTours();
  const [isReady, setIsReady] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!userLoading && !toursLoading && !isReady) {
      setIsReady(true);
      SplashScreen.hideAsync();
    }
  }, [userLoading, toursLoading, isReady]);

  useEffect(() => {
    if (isReady) {
      if (!user.hasCompletedOnboarding) {
        router.replace("/splash");
      } else {
        router.replace("/(tabs)");
      }
    }
  }, [isReady, user.hasCompletedOnboarding, router]);

  if (!isReady) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#FFFFFF" }}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return <RootLayoutNav />;
}

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <UserProvider>
              <ToursProvider>
                <AppContent />
              </ToursProvider>
            </UserProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
