import React, { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useAuthStore } from '../src/store/authStore';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';

export default function RootLayout() {
  const { isAuthenticated, user, _hasHydrated } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();
  const [hasNavigated, setHasNavigated] = useState(false);

  useEffect(() => {
    if (!_hasHydrated || hasNavigated) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inAdminGroup = segments[0] === '(admin)';

    // Initial navigation based on auth state
    if (!isAuthenticated) {
      if (!inAuthGroup) {
        setHasNavigated(true);
        router.replace('/(auth)/login');
      }
    } else {
      // User is authenticated
      if (inAuthGroup) {
        setHasNavigated(true);
        if (user?.role === 'admin') {
          router.replace('/(admin)');
        } else {
          router.replace('/(agent)');
        }
      } else if (user?.role === 'agent' && inAdminGroup) {
        setHasNavigated(true);
        router.replace('/(agent)');
      }
    }
  }, [isAuthenticated, segments, _hasHydrated, user, hasNavigated]);

  // Reset navigation flag when auth state changes
  useEffect(() => {
    setHasNavigated(false);
  }, [isAuthenticated]);

  if (!_hasHydrated) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2E7D32" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(admin)" />
        <Stack.Screen name="(agent)" />
        <Stack.Screen name="index" />
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
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },
});
