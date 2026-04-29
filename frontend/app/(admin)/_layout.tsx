import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from '../../src/utils/useTranslation';
import { useSettingsStore } from '../../src/store/settingsStore';
import { Platform, View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function AdminLayout() {
  const { t } = useTranslation();
  const language = useSettingsStore((state) => state.language);
  const insets = useSafeAreaInsets();
  // Add safe-area bottom inset to avoid conflicting with Android gesture/nav bar
  const bottomInset = insets.bottom || 0;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#2E7D32',
        tabBarInactiveTintColor: '#666',
        tabBarStyle: {
          backgroundColor: '#FFF',
          borderTopWidth: 1,
          borderTopColor: '#E0E0E0',
          height: (Platform.OS === 'ios' ? 60 : 58) + bottomInset,
          paddingBottom: 8 + bottomInset,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 9,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('dashboard'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="grid" size={size - 2} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="sales"
        options={{
          title: t('sales'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="cart" size={size - 2} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="purchase"
        options={{
          title: language === 'hi' ? 'खरीद' : 'Purchase',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="basket" size={size - 2} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="vendor-purchase"
        options={{
          href: null, // Hide this tab - handled in purchase screen
        }}
      />
      <Tabs.Screen
        name="stock"
        options={{
          title: t('stock'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="cube" size={size - 2} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="reports"
        options={{
          title: language === 'hi' ? 'रिपोर्ट' : 'Reports',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="document-text" size={size - 2} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="users"
        options={{
          title: language === 'hi' ? 'यूज़र' : 'Users',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="people" size={size - 2} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="shareholders"
        options={{
          title: language === 'hi' ? 'शेयरधारक' : 'Shares',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="ribbon" size={size - 2} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t('settings'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings" size={size - 2} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="manage"
        options={{
          title: language === 'hi' ? 'प्रबंधन' : 'Manage',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="construct" size={size - 2} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="khata"
        options={{
          title: language === 'hi' ? 'खाता' : 'Khata',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="book" size={size - 2} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: language === 'hi' ? 'सूचनाएं' : 'Alerts',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="notifications" size={size - 2} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
