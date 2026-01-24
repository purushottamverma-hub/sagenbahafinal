import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../src/store/authStore';
import { useSettingsStore } from '../../src/store/settingsStore';
import { Card } from '../../src/components/Card';

export default function SettingsScreen() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const { language, setLanguage } = useSettingsStore();

  const handleLogout = () => {
    Alert.alert(
      language === 'hi' ? 'लॉगआउट' : 'Logout',
      language === 'hi' ? 'क्या आप लॉगआउट करना चाहते हैं?' : 'Are you sure you want to logout?',
      [
        { text: language === 'hi' ? 'रद्द करें' : 'Cancel', style: 'cancel' },
        {
          text: language === 'hi' ? 'लॉगआउट' : 'Logout',
          style: 'destructive',
          onPress: async () => {
            await logout();
            router.replace('/(auth)/login');
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>
          {language === 'hi' ? 'सेटिंग्स' : 'Settings'}
        </Text>

        {/* User Profile */}
        <Card style={styles.profileCard}>
          <View style={styles.avatarContainer}>
            <Ionicons name="person-circle" size={64} color="#2E7D32" />
          </View>
          <Text style={styles.userName}>{user?.full_name}</Text>
          <Text style={styles.userHandle}>@{user?.username}</Text>
          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>
              {language === 'hi' ? 'किसान' : 'Farmer'}
            </Text>
          </View>
          {user?.village && (
            <View style={styles.infoRow}>
              <Ionicons name="location" size={16} color="#666" />
              <Text style={styles.infoText}>{user.village}</Text>
            </View>
          )}
          {user?.mobile && (
            <View style={styles.infoRow}>
              <Ionicons name="call" size={16} color="#666" />
              <Text style={styles.infoText}>{user.mobile}</Text>
            </View>
          )}
        </Card>

        {/* Language Setting */}
        <Card>
          <Text style={styles.sectionTitle}>
            {language === 'hi' ? 'भाषा' : 'Language'}
          </Text>
          <View style={styles.langToggle}>
            <TouchableOpacity
              style={[styles.langOption, language === 'en' && styles.langOptionActive]}
              onPress={() => setLanguage('en')}
            >
              <Text style={[styles.langText, language === 'en' && styles.langTextActive]}>
                English
              </Text>
              {language === 'en' && <Ionicons name="checkmark" size={20} color="#2E7D32" />}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.langOption, language === 'hi' && styles.langOptionActive]}
              onPress={() => setLanguage('hi')}
            >
              <Text style={[styles.langText, language === 'hi' && styles.langTextActive]}>
                हिंदी
              </Text>
              {language === 'hi' && <Ionicons name="checkmark" size={20} color="#2E7D32" />}
            </TouchableOpacity>
          </View>
        </Card>

        {/* Logout Button */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Ionicons name="log-out" size={22} color="#D32F2F" />
          <Text style={styles.logoutText}>
            {language === 'hi' ? 'लॉगआउट' : 'Logout'}
          </Text>
        </TouchableOpacity>

        {/* App Version */}
        <Text style={styles.versionText}>
          {language === 'hi' ? 'सागेन बहा FPO' : 'Sagen Baha FPO'} v1.0.0
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  scrollContent: {
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
  },
  profileCard: {
    alignItems: 'center',
    paddingVertical: 24,
    marginBottom: 16,
  },
  avatarContainer: {
    marginBottom: 12,
  },
  userName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  userHandle: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  roleBadge: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
    marginTop: 12,
  },
  roleText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2E7D32',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 6,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  langToggle: {
    gap: 8,
  },
  langOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderRadius: 10,
    backgroundColor: '#F5F5F5',
  },
  langOptionActive: {
    backgroundColor: '#E8F5E9',
  },
  langText: {
    fontSize: 16,
    color: '#333',
  },
  langTextActive: {
    fontWeight: '600',
    color: '#2E7D32',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFEBEE',
    padding: 16,
    borderRadius: 12,
    marginTop: 20,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#D32F2F',
  },
  versionText: {
    textAlign: 'center',
    fontSize: 12,
    color: '#999',
    marginTop: 24,
  },
});
