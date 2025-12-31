import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { View, ActivityIndicator } from "react-native";
// import { SuperwallProvider } from "expo-superwall"; // Requires development build

import "@/lib/supabase";

import { UserProvider, useUser } from "@/contexts/UserContext";
import { ToursProvider, useTours } from "@/contexts/ToursContext";
import ErrorBoundary from "@/components/ErrorBoundary";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { trpc, trpcClient } from "@/lib/trpc";

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
    <Stack screenOptions={{ headerBackTitle: "Back" }} initialRouteName="splash">
      <Stack.Screen name="splash" options={{ headerShown: false }} />
      <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="route-navigation" options={{ headerShown: false, presentation: "card" }} />
      <Stack.Screen name="tour-ready" options={{ headerShown: false, presentation: "card" }} />
      <Stack.Screen name="walking-tour" options={{ headerShown: false, presentation: "card" }} />
      <Stack.Screen name="auth/callback" options={{ headerShown: false, presentation: "card" }} />
    </Stack>
  );
}

function AppContent() {
  return <RootLayoutNav />;
}

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        {/* SuperwallProvider requires development build - commented out for Expo Go */}
        {/* <SuperwallProvider apiKeys={{ ios: "pk_l_qcxglqeCCusMPswKC7W" }}> */}
          <QueryClientProvider client={queryClient}>
            <trpc.Provider client={trpcClient} queryClient={queryClient}>
              <GestureHandlerRootView style={{ flex: 1 }}>
                <UserProvider>
                  <ToursProvider>
                    <AppContent />
                  </ToursProvider>
                </UserProvider>
              </GestureHandlerRootView>
            </trpc.Provider>
          </QueryClientProvider>
        {/* </SuperwallProvider> */}
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
