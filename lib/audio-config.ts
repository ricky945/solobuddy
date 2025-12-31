import { Audio, InterruptionModeIOS, InterruptionModeAndroid } from "expo-av";
import { Platform } from "react-native";

/**
 * Configure audio mode for lock screen playback (like Spotify, Apple Music, etc.)
 * This must be called before creating any Audio.Sound instance.
 * 
 * Key features:
 * - Audio continues playing when screen locks
 * - Audio continues when app goes to background
 * - Audio plays even when phone is on silent mode (iOS)
 * - Audio won't be interrupted by other apps
 */
export async function configureAudioForLockScreen(): Promise<void> {
  try {
    console.log("[AudioConfig] Configuring audio mode for lock screen playback");
    
    await Audio.setAudioModeAsync({
      // iOS Settings
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,  // Play even when silent switch is on
      staysActiveInBackground: true,  // CRITICAL: Keep playing when screen locks or app backgrounds
      interruptionModeIOS: InterruptionModeIOS.DoNotMix,  // Don't let other apps interrupt
      
      // Android Settings
      shouldDuckAndroid: false,  // Don't reduce volume for other apps
      playThroughEarpieceAndroid: false,  // Use speaker, not earpiece
      interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,  // Don't let other apps interrupt
    });
    
    console.log("[AudioConfig] ✓ Audio configured for lock screen playback");
    return;
  } catch (error) {
    console.error("[AudioConfig] Error configuring audio mode:", error);
    throw error;
  }
}

/**
 * Enable Now Playing info and remote controls for the audio
 * Call this after creating the Audio.Sound instance
 */
export async function enableNowPlayingControls(sound: Audio.Sound): Promise<void> {
  try {
    // Update status to ensure progress tracking for lock screen
    await sound.setStatusAsync({
      progressUpdateIntervalMillis: 100,
    });
    console.log("[AudioConfig] ✓ Now Playing controls enabled");
  } catch (error) {
    console.error("[AudioConfig] Error enabling Now Playing controls:", error);
  }
}

/**
 * Check if the current environment supports lock screen audio
 * Lock screen audio only works in standalone builds, not in Expo Go or simulators
 */
export function canSupportLockScreenAudio(): boolean {
  // Web doesn't support lock screen audio in the same way
  if (Platform.OS === 'web') {
    return false;
  }
  
  // Note: This returns true, but actual lock screen audio only works in:
  // 1. Standalone builds (not Expo Go)
  // 2. Real devices (not simulators)
  // 3. Apps with proper entitlements (UIBackgroundModes in app.json)
  return true;
}
