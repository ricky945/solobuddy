/**
 * Superwall wrapper that gracefully handles missing native modules in Expo Go.
 * 
 * expo-superwall requires native code that isn't available in Expo Go.
 * This wrapper provides fallback implementations so the app doesn't crash.
 */

import React, { createContext, useContext, useCallback, ReactNode } from 'react';

// Check if we're in Expo Go (native module not available)
let isSuperwallAvailable = false;
let SuperwallProviderNative: React.ComponentType<any> | null = null;
let usePlacementNative: any = null;

try {
  // Try to import the native Superwall module
  const superwall = require('expo-superwall');
  SuperwallProviderNative = superwall.SuperwallProvider;
  usePlacementNative = superwall.usePlacement;
  isSuperwallAvailable = true;
  console.log('[Superwall] Native module available');
} catch (error) {
  console.log('[Superwall] Native module not available - using mock (Expo Go mode)');
  isSuperwallAvailable = false;
}

// Mock types for fallback
interface PlacementOptions {
  placement: string;
  params?: Record<string, any>;
  feature?: () => void;
}

interface UsePlacementOptions {
  onPresent?: (info: any) => void;
  onDismiss?: (info: any, result: any) => void;
  onSkip?: (reason: any) => void;
  onError?: (error: any) => void;
}

interface UsePlacementReturn {
  registerPlacement: (options: PlacementOptions) => Promise<void>;
  state: 'idle' | 'loading' | 'presented' | 'dismissed';
}

// Mock implementation for Expo Go
const usePlacementMock = (options: UsePlacementOptions = {}): UsePlacementReturn => {
  const registerPlacement = useCallback(async (placementOptions: PlacementOptions) => {
    console.log('[Superwall Mock] registerPlacement called:', placementOptions.placement);
    // In mock mode, just call the feature callback directly (user gets through)
    if (placementOptions.feature) {
      placementOptions.feature();
    }
  }, []);

  return {
    registerPlacement,
    state: 'idle',
  };
};

// Export the usePlacement hook - uses native if available, mock otherwise
export const usePlacement = isSuperwallAvailable && usePlacementNative 
  ? usePlacementNative 
  : usePlacementMock;

// Provider component props
interface SuperwallProviderWrapperProps {
  children: ReactNode;
  apiKeys?: { ios?: string; android?: string };
  onConfigurationError?: (error: Error) => void;
}

// Provider wrapper component
export const SuperwallProviderWrapper: React.FC<SuperwallProviderWrapperProps> = ({ 
  children, 
  apiKeys,
  onConfigurationError 
}) => {
  if (isSuperwallAvailable && SuperwallProviderNative) {
    return (
      <SuperwallProviderNative 
        apiKeys={apiKeys}
        onConfigurationError={onConfigurationError}
      >
        {children}
      </SuperwallProviderNative>
    );
  }

  // In Expo Go, just render children without Superwall
  console.log('[Superwall] Running without Superwall (Expo Go mode)');
  return <>{children}</>;
};

// Re-export availability check for components that need to know
export const superwallAvailable = isSuperwallAvailable;



