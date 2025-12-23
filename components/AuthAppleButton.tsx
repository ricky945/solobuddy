import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Linking from "expo-linking";

import Colors from "@/constants/colors";
import { supabase } from "@/lib/supabase";

type Props = {
  onAuthed?: () => void;
};

export const AuthAppleButton = React.memo(function AuthAppleButton({ onAuthed }: Props) {
  const [isAvailable, setIsAvailable] = useState<boolean>(false);
  const [isBusy, setIsBusy] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;

    const run = async () => {
      try {
        const available = Platform.OS === "ios" ? await AppleAuthentication.isAvailableAsync() : false;
        console.log("[AuthAppleButton] AppleAuthentication availability", { available, platform: Platform.OS });
        if (isMounted) setIsAvailable(available);
      } catch (error) {
        console.error("[AuthAppleButton] isAvailableAsync error", error);
        if (isMounted) setIsAvailable(false);
      }
    };

    run();
    return () => {
      isMounted = false;
    };
  }, []);

  const redirectTo = useMemo(() => {
    const url = Linking.createURL("/auth/callback");
    console.log("[AuthAppleButton] redirectTo", url);
    return url;
  }, []);

  const signInWithAppleOAuth = useCallback(async () => {
    setIsBusy(true);
    try {
      console.log("[AuthAppleButton] Starting Apple OAuth flow", { redirectTo });

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "apple",
        options: {
          redirectTo,
          skipBrowserRedirect: false,
        },
      });

      console.log("[AuthAppleButton] signInWithOAuth result", {
        hasData: Boolean(data),
        error: error ? { name: error.name, message: error.message } : null,
      });

      if (error) {
        Alert.alert("Sign-in failed", error.message);
        return;
      }

      onAuthed?.();
    } catch (error) {
      console.error("[AuthAppleButton] OAuth sign-in error", error);
      Alert.alert("Sign-in failed", "Please try again.");
    } finally {
      setIsBusy(false);
    }
  }, [onAuthed, redirectTo]);

  const signInWithAppleNative = useCallback(async () => {
    setIsBusy(true);
    try {
      console.log("[AuthAppleButton] Starting Apple native sign-in");
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      console.log("[AuthAppleButton] Apple credential", {
        hasIdentityToken: Boolean(credential.identityToken),
        hasFullName: Boolean(credential.fullName),
        email: credential.email ? "<provided>" : null,
      });

      if (!credential.identityToken) {
        Alert.alert("Sign-in failed", "Missing identity token.");
        return;
      }

      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: "apple",
        token: credential.identityToken,
      });

      console.log("[AuthAppleButton] supabase signInWithIdToken", {
        hasUser: Boolean(data?.user),
        hasSession: Boolean(data?.session),
        error: error ? { name: error.name, message: error.message } : null,
      });

      if (error) {
        Alert.alert("Sign-in failed", error.message);
        return;
      }

      if (credential.fullName) {
        const nameParts: string[] = [];
        if (credential.fullName.givenName) nameParts.push(credential.fullName.givenName);
        if (credential.fullName.middleName) nameParts.push(credential.fullName.middleName);
        if (credential.fullName.familyName) nameParts.push(credential.fullName.familyName);

        const fullName = nameParts.join(" ").trim();

        if (fullName) {
          const updateRes = await supabase.auth.updateUser({
            data: {
              full_name: fullName,
              given_name: credential.fullName.givenName ?? null,
              family_name: credential.fullName.familyName ?? null,
            },
          });

          console.log("[AuthAppleButton] updateUser metadata", {
            error: updateRes.error ? { name: updateRes.error.name, message: updateRes.error.message } : null,
          });
        }
      }

      onAuthed?.();
    } catch (e: unknown) {
      const err = e as { code?: string; message?: string };
      console.error("[AuthAppleButton] native sign-in error", e);
      if (err?.code === "ERR_REQUEST_CANCELED") return;
      Alert.alert("Sign-in failed", err?.message ?? "Please try again.");
    } finally {
      setIsBusy(false);
    }
  }, [onAuthed]);

  if (Platform.OS === "ios" && isAvailable) {
    return (
      <View style={styles.iosWrap} testID="auth-apple-ios-wrap">
        {isBusy ? (
          <View style={styles.busyOverlay} testID="auth-apple-busy">
            <ActivityIndicator color={Colors.light.text} />
          </View>
        ) : null}
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
          buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
          cornerRadius={12}
          style={styles.iosButton}
          onPress={signInWithAppleNative}
        />
      </View>
    );
  }

  return (
    <Pressable
      onPress={signInWithAppleOAuth}
      disabled={isBusy}
      style={({ pressed }) => [styles.fallbackButton, pressed ? styles.fallbackPressed : null, isBusy ? styles.fallbackDisabled : null]}
      testID="auth-apple-fallback"
    >
      <View style={styles.fallbackInner}>
        {isBusy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.fallbackApple}></Text>}
        <Text style={styles.fallbackText}>Continue with Apple</Text>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  iosWrap: {
    position: "relative",
  },
  iosButton: {
    width: 260,
    height: 52,
  },
  busyOverlay: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.35)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 2,
  },
  fallbackButton: {
    height: 52,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: "#0A0A0A",
    justifyContent: "center",
  },
  fallbackInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  fallbackApple: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "700" as const,
    marginTop: -1,
  },
  fallbackText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700" as const,
    letterSpacing: 0.2,
  },
  fallbackPressed: {
    opacity: 0.86,
    transform: [{ scale: 0.99 }],
  },
  fallbackDisabled: {
    opacity: 0.6,
  },
});
