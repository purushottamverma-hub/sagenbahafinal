import React, { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useAuthStore } from '../src/store/authStore';
import { View, ActivityIndicator } from 'react-native';

export default function RootLayout() {
  const { isAuthenticated, user } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();
  const [isReady, setIsReady] = React.useState(false);

  useEffect(() => {
    // Give zustand time to rehydrate
    const timer = setTimeout(() => setIsReady(true), 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!isReady) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inAdminGroup = segments[0] === '(admin)';
    const inAgentGroup = segments[0] === '(agent)';

    if (!isAuthenticated && !inAuthGroup) {
      // Not logged in, redirect to login
      router.replace('/(auth)/login');
    } else if (isAuthenticated && inAuthGroup) {
      // Logged in, redirect based on role
      if (user?.role === 'admin') {
        router.replace('/(admin)');
      } else {
        router.replace('/(agent)');
      }
    } else if (isAuthenticated && user?.role === 'agent' && inAdminGroup) {
      // Agent trying to access admin area
      router.replace('/(agent)');
    } else if (isAuthenticated && user?.role === 'admin' && inAgentGroup) {
      // Admin can access agent area, but default to admin
      // Allow this as admin might want to see agent view
    }
  }, [isAuthenticated, segments, isReady, user]);

  if (!isReady) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F5F5' }}>
        <ActivityIndicator size="large" color="#2E7D32" />
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
