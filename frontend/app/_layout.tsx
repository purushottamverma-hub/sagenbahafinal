import React, { useEffect, useState } from 'react';
import { Slot, useRouter, useSegments, useRootNavigationState } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useAuthStore } from '../src/store/authStore';
import { View, ActivityIndicator, StyleSheet } from 'react-native';

function InitialLayout() {
  const { isAuthenticated, user } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();
  const navigationState = useRootNavigationState();

  useEffect(() => {
    // Wait for navigation to be ready
    if (!navigationState?.key) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inAdminGroup = segments[0] === '(admin)';

    // Navigation logic based on auth state
    if (!isAuthenticated) {
      if (!inAuthGroup) {
        router.replace('/(auth)/login');
      }
    } else {
      // User is authenticated
      if (inAuthGroup) {
        if (user?.role === 'admin') {
          router.replace('/(admin)');
        } else {
          router.replace('/(agent)');
        }
      } else if (user?.role === 'agent' && inAdminGroup) {
        router.replace('/(agent)');
      }
    }
  }, [isAuthenticated, segments, user, navigationState?.key]);

  return <Slot />;
}

export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" />
      <InitialLayout />
    </>
  );
}
