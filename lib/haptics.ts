import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/**
 * Trigger a light haptic feedback for button presses and interactions
 * This is a very subtle feedback that feels natural for most UI interactions
 */
export const triggerHapticFeedback = () => {
  if (Platform.OS === 'ios' || Platform.OS === 'android') {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }
};

/**
 * Trigger a medium haptic feedback for more significant interactions
 */
export const triggerMediumHaptic = () => {
  if (Platform.OS === 'ios' || Platform.OS === 'android') {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }
};

/**
 * Trigger a heavy haptic feedback for important actions
 */
export const triggerHeavyHaptic = () => {
  if (Platform.OS === 'ios' || Platform.OS === 'android') {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  }
};

/**
 * Trigger a selection haptic feedback for picker/selector changes
 */
export const triggerSelectionHaptic = () => {
  if (Platform.OS === 'ios' || Platform.OS === 'android') {
    Haptics.selectionAsync();
  }
};

/**
 * Trigger a success notification haptic
 */
export const triggerSuccessHaptic = () => {
  if (Platform.OS === 'ios' || Platform.OS === 'android') {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }
};

/**
 * Trigger an error notification haptic
 */
export const triggerErrorHaptic = () => {
  if (Platform.OS === 'ios' || Platform.OS === 'android') {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  }
};
