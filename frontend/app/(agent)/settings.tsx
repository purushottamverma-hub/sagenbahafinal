import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Card } from '../../src/components/Card';
import { Button } from '../../src/components/Button';
import { Input } from '../../src/components/Input';
import { useTranslation } from '../../src/utils/useTranslation';
import { useAuthStore } from '../../src/store/authStore';
import { useSettingsStore } from '../../src/store/settingsStore';
import api from '../../src/utils/api';

export default function AgentSettingsScreen() {
  const { t, language } = useTranslation();
  const { user, logout } = useAuthStore();
  const { setLanguage } = useSettingsStore();
  const router = useRouter();
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChangePassword = async () => {
    if (!oldPassword || !newPassword || !confirmPassword) {
      Alert.alert(t('error'), language === 'hi' ? 'सभी फील्ड भरें' : 'Fill all fields');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert(t('error'), language === 'hi' ? 'पासवर्ड मेल नहीं खाता' : 'Passwords do not match');
      return;
    }

    if (newPassword.length < 4) {
      Alert.alert(t('error'), language === 'hi' ? 'पासवर्ड कम से कम 4 अक्षर होना चाहिए' : 'Password must be at least 4 characters');
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/change-password', {
        old_password: oldPassword,
        new_password: newPassword,
      });
      Alert.alert(t('success'), language === 'hi' ? 'पासवर्ड बदल गया' : 'Password changed successfully');
      setShowChangePassword(false);
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      Alert.alert(t('error'), error.response?.data?.detail || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      t('logout'),
      language === 'hi' ? 'क्या आप लॉगआउट करना चाहते हैं?' : 'Are you sure you want to logout?',
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('logout'),
          style: 'destructive',
          onPress: () => {
            logout();
            router.replace('/(auth)/login');
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('settings')}</Text>
      </View>

      <ScrollView style={styles.content}>
        {/* Profile Section */}
        <Card>
          <View style={styles.profileSection}>
            <View style={styles.avatar}>
              <Ionicons name="person" size={40} color="#2E7D32" />
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{user?.full_name}</Text>
              <Text style={styles.profileUsername}>@{user?.username}</Text>
              <View style={styles.roleBadge}>
                <Text style={styles.roleText}>Agent</Text>
              </View>
            </View>
          </View>
        </Card>

        {/* Language Selection */}
        <Text style={styles.sectionTitle}>{t('language')}</Text>
        <Card>
          <View style={styles.languageOptions}>
            <TouchableOpacity
              style={[
                styles.languageBtn,
                language === 'en' && styles.languageBtnActive,
              ]}
              onPress={() => setLanguage('en')}
            >
              <Text style={[
                styles.languageText,
                language === 'en' && styles.languageTextActive,
              ]}>
                English
              </Text>
              {language === 'en' && (
                <Ionicons name="checkmark-circle" size={20} color="#FFF" />
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.languageBtn,
                language === 'hi' && styles.languageBtnActive,
              ]}
              onPress={() => setLanguage('hi')}
            >
              <Text style={[
                styles.languageText,
                language === 'hi' && styles.languageTextActive,
              ]}>
                हिंदी
              </Text>
              {language === 'hi' && (
                <Ionicons name="checkmark-circle" size={20} color="#FFF" />
              )}
            </TouchableOpacity>
          </View>
        </Card>

        {/* Change Password */}
        <Text style={styles.sectionTitle}>{t('changePassword')}</Text>
        <Card>
          {!showChangePassword ? (
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => setShowChangePassword(true)}
            >
              <View style={styles.menuItemLeft}>
                <Ionicons name="key" size={24} color="#666" />
                <Text style={styles.menuItemText}>{t('changePassword')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#999" />
            </TouchableOpacity>
          ) : (
            <View style={styles.passwordForm}>
              <Input
                label={t('oldPassword')}
                placeholder="********"
                value={oldPassword}
                onChangeText={setOldPassword}
                secureTextEntry
              />
              <Input
                label={t('newPassword')}
                placeholder="********"
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry
              />
              <Input
                label={t('confirmPassword')}
                placeholder="********"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
              />
              <View style={styles.passwordButtons}>
                <Button
                  title={t('cancel')}
                  variant="outline"
                  onPress={() => {
                    setShowChangePassword(false);
                    setOldPassword('');
                    setNewPassword('');
                    setConfirmPassword('');
                  }}
                  style={{ flex: 1, marginRight: 8 }}
                />
                <Button
                  title={t('save')}
                  onPress={handleChangePassword}
                  loading={loading}
                  style={{ flex: 1 }}
                />
              </View>
            </View>
          )}
        </Card>

        {/* Logout */}
        <Card style={styles.logoutCard}>
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
            <Ionicons name="log-out" size={24} color="#D32F2F" />
            <Text style={styles.logoutText}>{t('logout')}</Text>
          </TouchableOpacity>
        </Card>

        {/* App Info */}
        <View style={styles.appInfo}>
          <Text style={styles.appName}>{t('appName')}</Text>
          <Text style={styles.appVersion}>v1.0.0</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    padding: 16,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileInfo: {
    marginLeft: 16,
    flex: 1,
  },
  profileName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  profileUsername: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  roleBadge: {
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  roleText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1565C0',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginTop: 24,
    marginBottom: 8,
    marginLeft: 4,
  },
  languageOptions: {
    flexDirection: 'row',
    gap: 12,
  },
  languageBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    backgroundColor: '#E8E8E8',
    borderRadius: 8,
    gap: 8,
  },
  languageBtnActive: {
    backgroundColor: '#2E7D32',
  },
  languageText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  languageTextActive: {
    color: '#FFF',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuItemText: {
    fontSize: 16,
    color: '#333',
    marginLeft: 12,
  },
  passwordForm: {
    marginTop: 8,
  },
  passwordButtons: {
    flexDirection: 'row',
    marginTop: 8,
  },
  logoutCard: {
    marginTop: 24,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#D32F2F',
    marginLeft: 8,
  },
  appInfo: {
    alignItems: 'center',
    marginTop: 40,
    marginBottom: 40,
  },
  appName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2E7D32',
  },
  appVersion: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
});
