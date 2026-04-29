import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Input } from '../../src/components/Input';
import { Button } from '../../src/components/Button';
import { useAuthStore } from '../../src/store/authStore';
import { useSettingsStore } from '../../src/store/settingsStore';
import { useTranslation } from '../../src/utils/useTranslation';
import api from '../../src/utils/api';

type AuthMode = 'login' | 'signup';
type UserRole = 'farmer' | 'agent';

export default function LoginScreen() {
  const [mode, setMode] = useState<AuthMode>('login');
  const [selectedRole, setSelectedRole] = useState<UserRole>('farmer');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [mobile, setMobile] = useState('');
  const [village, setVillage] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const { language, setLanguage } = useSettingsStore();
  const { t } = useTranslation();

  const resetForm = () => {
    setUsername('');
    setPassword('');
    setFullName('');
    setMobile('');
    setVillage('');
  };

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      Alert.alert(t('error'), language === 'hi' ? 'कृपया सभी फील्ड भरें' : 'Please fill all fields');
      return;
    }

    setLoading(true);
    console.log('[Login] Attempting login for user:', username.trim());
    
    try {
      const response = await api.post('/auth/login', {
        username: username.trim(),
        password: password.trim(),
      });

      console.log('[Login] Login successful, setting auth...');
      const { access_token, user } = response.data;
      
      // Set auth and wait for it to complete
      await setAuth(access_token, user);
      console.log('[Login] Auth set complete, redirecting to:', user.role);

      // Small delay to ensure state is fully updated
      await new Promise(resolve => setTimeout(resolve, 100));

      // Redirect based on role
      if (user.role === 'admin') {
        router.replace('/(admin)');
      } else if (user.role === 'agent') {
        router.replace('/(agent)');
      } else {
        router.replace('/(farmer)');
      }
    } catch (error: any) {
      console.error('[Login] Login error:', error);
      console.error('[Login] Error response:', error.response?.data);
      console.error('[Login] Error status:', error.response?.status);
      
      let message = t('loginFailed');
      if (error.response?.data?.detail) {
        message = error.response.data.detail;
      } else if (error.message?.includes('Network')) {
        message = language === 'hi' 
          ? 'नेटवर्क त्रुटि। कृपया अपना कनेक्शन जांचें।' 
          : 'Network error. Please check your connection.';
      }
      
      Alert.alert(t('error'), message);
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async () => {
    if (!username.trim() || !password.trim() || !fullName.trim()) {
      Alert.alert(t('error'), language === 'hi' ? 'कृपया सभी आवश्यक फील्ड भरें' : 'Please fill all required fields');
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/auth/register', {
        username: username.trim(),
        password: password.trim(),
        full_name: fullName.trim(),
        role: selectedRole,
        mobile: mobile.trim() || null,
        village: village.trim() || null,
      });

      if (selectedRole === 'agent') {
        // Agent needs approval
        Alert.alert(
          language === 'hi' ? 'पंजीकरण सफल' : 'Registration Successful',
          language === 'hi' 
            ? 'आपका खाता व्यवस्थापक की स्वीकृति के लिए लंबित है। कृपया प्रतीक्षा करें।'
            : 'Your account is pending approval by admin. Please wait.',
          [{ text: 'OK', onPress: () => setMode('login') }]
        );
        resetForm();
      } else {
        // Farmer - auto logged in
        const { access_token, user } = response.data;
        await setAuth(access_token, user);
        router.replace('/(farmer)');
      }
    } catch (error: any) {
      console.error('Signup error:', error);
      const message = error.response?.data?.detail || (language === 'hi' ? 'पंजीकरण विफल' : 'Registration failed');
      Alert.alert(t('error'), message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Language Toggle */}
          <View style={styles.languageToggle}>
            <TouchableOpacity
              style={[styles.langBtn, language === 'en' && styles.langBtnActive]}
              onPress={() => setLanguage('en')}
            >
              <Text style={[styles.langText, language === 'en' && styles.langTextActive]}>EN</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.langBtn, language === 'hi' && styles.langBtnActive]}
              onPress={() => setLanguage('hi')}
            >
              <Text style={[styles.langText, language === 'hi' && styles.langTextActive]}>हि</Text>
            </TouchableOpacity>
          </View>

          {/* Logo/Header */}
          <View style={styles.header}>
            <View style={styles.logoContainer}>
              <Ionicons name="leaf" size={60} color="#2E7D32" />
            </View>
            <Text style={styles.title}>{t('appName')}</Text>
            <Text style={styles.subtitle}>
              {language === 'hi' 
                ? 'एफपीओ व्यापार प्रबंधन प्रणाली'
                : 'FPO Business Management System'
              }
            </Text>
          </View>

          {/* Mode Toggle */}
          <View style={styles.modeToggle}>
            <TouchableOpacity
              style={[styles.modeBtn, mode === 'login' && styles.modeBtnActive]}
              onPress={() => { setMode('login'); resetForm(); }}
            >
              <Text style={[styles.modeText, mode === 'login' && styles.modeTextActive]}>
                {language === 'hi' ? 'लॉगिन' : 'Login'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeBtn, mode === 'signup' && styles.modeBtnActive]}
              onPress={() => { setMode('signup'); resetForm(); }}
            >
              <Text style={[styles.modeText, mode === 'signup' && styles.modeTextActive]}>
                {language === 'hi' ? 'पंजीकरण' : 'Sign Up'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Form */}
          <View style={styles.form}>
            {mode === 'signup' && (
              <>
                {/* Role Selection */}
                <Text style={styles.roleLabel}>
                  {language === 'hi' ? 'पंजीकरण करें:' : 'Register as:'}
                </Text>
                <View style={styles.roleToggle}>
                  <TouchableOpacity
                    style={[styles.roleBtn, selectedRole === 'farmer' && styles.roleBtnActive]}
                    onPress={() => setSelectedRole('farmer')}
                  >
                    <Ionicons 
                      name="leaf-outline" 
                      size={20} 
                      color={selectedRole === 'farmer' ? '#FFF' : '#2E7D32'} 
                    />
                    <Text style={[styles.roleText, selectedRole === 'farmer' && styles.roleTextActive]}>
                      {language === 'hi' ? 'किसान' : 'Farmer'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.roleBtn, selectedRole === 'agent' && styles.roleBtnActive]}
                    onPress={() => setSelectedRole('agent')}
                  >
                    <Ionicons 
                      name="person-outline" 
                      size={20} 
                      color={selectedRole === 'agent' ? '#FFF' : '#2E7D32'} 
                    />
                    <Text style={[styles.roleText, selectedRole === 'agent' && styles.roleTextActive]}>
                      {language === 'hi' ? 'एजेंट' : 'Agent'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {selectedRole === 'agent' && (
                  <View style={styles.infoBox}>
                    <Ionicons name="information-circle" size={18} color="#1976D2" />
                    <Text style={styles.infoText}>
                      {language === 'hi' 
                        ? 'एजेंट पंजीकरण के लिए व्यवस्थापक की स्वीकृति आवश्यक है'
                        : 'Agent registration requires admin approval'}
                    </Text>
                  </View>
                )}

                <Input
                  label={language === 'hi' ? 'पूरा नाम' : 'Full Name'}
                  placeholder={language === 'hi' ? 'अपना नाम दर्ज करें' : 'Enter your full name'}
                  value={fullName}
                  onChangeText={setFullName}
                  required
                />

                <Input
                  label={language === 'hi' ? 'मोबाइल नंबर' : 'Mobile Number'}
                  placeholder={language === 'hi' ? 'मोबाइल नंबर दर्ज करें' : 'Enter mobile number'}
                  value={mobile}
                  onChangeText={setMobile}
                  keyboardType="phone-pad"
                />

                <Input
                  label={language === 'hi' ? 'गाँव' : 'Village'}
                  placeholder={language === 'hi' ? 'गाँव का नाम दर्ज करें' : 'Enter village name'}
                  value={village}
                  onChangeText={setVillage}
                />
              </>
            )}

            <Input
              label={t('username')}
              placeholder={language === 'hi' ? 'उपयोगकर्ता नाम दर्ज करें' : 'Enter username'}
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
              required
            />

            <View style={styles.passwordContainer}>
              <Input
                label={t('password')}
                placeholder={language === 'hi' ? 'पासवर्ड दर्ज करें' : 'Enter password'}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                required
              />
              <TouchableOpacity
                style={styles.eyeIcon}
                onPress={() => setShowPassword(!showPassword)}
              >
                <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <Button
              title={mode === 'login' ? t('login') : (language === 'hi' ? 'पंजीकरण करें' : 'Register')}
              onPress={mode === 'login' ? handleLogin : handleSignup}
              loading={loading}
              size="large"
              style={styles.submitBtn}
            />
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              {language === 'hi' ? 'पोरैयाहाट ब्लॉक, गोड्डा जिला' : 'Poraiyahat Block, Godda District'}
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
  },
  languageToggle: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 16,
    gap: 12,
  },
  langBtn: {
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 20,
    backgroundColor: '#E8E8E8',
  },
  langBtnActive: {
    backgroundColor: '#2E7D32',
  },
  langText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  langTextActive: {
    color: '#FFF',
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logoContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2E7D32',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  modeToggle: {
    flexDirection: 'row',
    backgroundColor: '#E8E8E8',
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
  },
  modeBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 10,
  },
  modeBtnActive: {
    backgroundColor: '#FFF',
  },
  modeText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  modeTextActive: {
    color: '#2E7D32',
  },
  form: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  roleLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  roleToggle: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  roleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#2E7D32',
    backgroundColor: '#FFF',
  },
  roleBtnActive: {
    backgroundColor: '#2E7D32',
  },
  roleText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2E7D32',
  },
  roleTextActive: {
    color: '#FFF',
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    gap: 8,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#1976D2',
  },
  passwordContainer: {
    position: 'relative',
  },
  eyeIcon: {
    position: 'absolute',
    right: 14,
    top: 38,
    padding: 4,
  },
  submitBtn: {
    marginTop: 8,
  },
  footer: {
    marginTop: 24,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
  },
});
