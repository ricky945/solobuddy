import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Platform, StyleSheet, Text, View } from "react-native";
import { Stack, useRouter } from "expo-router";
import * as Linking from "expo-linking";

import Colors from "@/constants/colors";
import { supabaseExchangeCodeForSessionFromUrl } from "@/lib/supabase";

type Status = "loading" | "success" | "error";

export default function AuthCallbackScreen() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const initialUrl = useMemo(() => {
    if (Platform.OS === "web" && typeof window !== "undefined") return window.location.href;
    return null;
  }, []);

  const finalize = useCallback(
    async (url: string) => {
      console.log("[AuthCallback] finalize", { url: url.slice(0, 140) });

      const res = await supabaseExchangeCodeForSessionFromUrl(url);
      if (res.error) throw res.error;

      setStatus("success");
      setTimeout(() => {
        try {
          router.replace({ pathname: "/(tabs)/account" as any } as any);
        } catch (e) {
          console.error("[AuthCallback] navigation error", e);
        }
      }, 250);
    },
    [router]
  );

  useEffect(() => {
    let isMounted = true;

    const onError = (e: unknown) => {
      const msg = e instanceof Error ? e.message : "Sign-in failed";
      console.error("[AuthCallback] error", e);
      if (!isMounted) return;
      setStatus("error");
      setErrorMessage(msg);
      Alert.alert("Sign-in failed", msg);
    };

    const run = async () => {
      try {
        console.log("[AuthCallback] opened", { platform: Platform.OS, initialUrl });

        if (initialUrl) {
          await finalize(initialUrl);
          return;
        }

        const url = await Linking.getInitialURL();
        if (url) {
          await finalize(url);
          return;
        }

        console.log("[AuthCallback] waiting for URL event");
        const sub = Linking.addEventListener("url", async ({ url: nextUrl }) => {
          try {
            await finalize(nextUrl);
          } catch (e) {
            onError(e);
          }
        });

        return () => sub.remove();
      } catch (e) {
        onError(e);
      }
    };

    const cleanupPromise = run();

    return () => {
      isMounted = false;
      void cleanupPromise;
    };
  }, [finalize, initialUrl]);

  return (
    <View style={styles.container} testID="auth-callback-screen">
      <Stack.Screen options={{ title: "Signing you in…", headerShown: false }} />

      <View style={styles.card} testID="auth-callback-card">
        <ActivityIndicator size="large" color={Colors.light.primary} />
        <Text style={styles.title}>
          {status === "loading" ? "Finishing sign-in" : status === "success" ? "Signed in" : "Sign-in failed"}
        </Text>
        {errorMessage ? (
          <Text style={styles.subtitle}>{errorMessage}</Text>
        ) : (
          <Text style={styles.subtitle}>Please wait a moment.</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.backgroundSecondary,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  card: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: Colors.light.card,
    borderRadius: 18,
    padding: 20,
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.light.border,
    alignItems: "center",
  },
  title: {
    marginTop: 6,
    fontSize: 18,
    fontWeight: "800" as const,
    color: Colors.light.text,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
    color: Colors.light.textSecondary,
    textAlign: "center",
  },
});
