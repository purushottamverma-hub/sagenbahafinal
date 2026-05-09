import React, { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { Ionicons, MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuthStore } from '../src/store/authStore';
import { useSettingsStore } from '../src/store/settingsStore';

// Prevent splash screen from auto-hiding until fonts are loaded
SplashScreen.preventAutoHideAsync().catch(() => {
  /* ignore — already hidden */
});

export default function RootLayout() {
  const [isReady, setIsReady] = useState(false);
  const hydrateAuth = useAuthStore((state) => state.hydrate);
  const hydrateSettings = useSettingsStore((state) => state.hydrate);

  // Preload icon fonts ONCE at root to avoid the SDK 54 race condition
  // where many <Ionicons> mounting in parallel cause "Font file is empty" errors.
  const [fontsLoaded, fontError] = useFonts({
    ...Ionicons.font,
    ...MaterialIcons.font,
    ...MaterialCommunityIcons.font,
  });

  useEffect(() => {
    if (!fontsLoaded && !fontError) return;
    const initializeApp = async () => {
      try {
        await Promise.all([hydrateAuth(), hydrateSettings()]);
      } catch (error) {
        console.error('Failed to initialize app:', error);
      } finally {
        setIsReady(true);
        SplashScreen.hideAsync().catch(() => {});
      }
    };
    initializeApp();
  }, [fontsLoaded, fontError]);

  // Wait for both font load and store hydration before rendering routes
  if ((!fontsLoaded && !fontError) || !isReady) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar style="dark" />
        <ActivityIndicator size="large" color="#2E7D32" />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(admin)" />
        <Stack.Screen name="(agent)" />
      </Stack>
    </>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
  },
});
