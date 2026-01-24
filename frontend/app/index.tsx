import React, { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useAuthStore } from '../src/store/authStore';

export default function Index() {
  const { isAuthenticated, user } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    // Small delay to ensure navigation is ready
    const timeout = setTimeout(() => {
      if (!isAuthenticated) {
        router.replace('/(auth)/login');
      } else if (user?.role === 'admin') {
        router.replace('/(admin)');
      } else {
        router.replace('/(agent)');
      }
    }, 100);

    return () => clearTimeout(timeout);
  }, [isAuthenticated, user, router]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#2E7D32" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
  },
});
