import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../src/store/authStore';
import { useSettingsStore } from '../../src/store/settingsStore';
import { Card } from '../../src/components/Card';
import { Button } from '../../src/components/Button';
import { Input } from '../../src/components/Input';
import api from '../../src/utils/api';

interface UpgradeRequest {
  id: string;
  status: string;
  folio_number?: string;
  share_value?: number;
  created_at: string;
  admin_remark?: string;
}

export default function SettingsScreen() {
  const router = useRouter();
  const { user, logout, refreshUser } = useAuthStore();
  const { language, setLanguage } = useSettingsStore();
  
  // Shareholder upgrade states
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [folioNumber, setFolioNumber] = useState('');
  const [shareValue, setShareValue] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [upgradeRequest, setUpgradeRequest] = useState<UpgradeRequest | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchUpgradeStatus();
  }, []);

  const fetchUpgradeStatus = async () => {
    try {
      setLoading(true);
      const res = await api.get('/shareholder-upgrade/requests');
      if (res.data && res.data.length > 0) {
        // Get the most recent request
        setUpgradeRequest(res.data[0]);
      }
    } catch (error) {
      console.error('Failed to fetch upgrade status:', error);
    } finally {
      setLoading(false);
    }
  };

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

  const handleSubmitUpgrade = async () => {
    if (!folioNumber.trim()) {
      Alert.alert(
        language === 'hi' ? 'त्रुटि' : 'Error',
        language === 'hi' ? 'कृपया फोलियो नंबर दर्ज करें' : 'Please enter folio number'
      );
      return;
    }

    setSubmitting(true);
    try {
      const params = new URLSearchParams();
      params.append('folio_number', folioNumber.trim());
      if (shareValue.trim()) {
        params.append('share_value', shareValue.trim());
      }
      
      await api.post(`/shareholder-upgrade/request?${params.toString()}`);
      
      Alert.alert(
        language === 'hi' ? 'सफल' : 'Success',
        language === 'hi' 
          ? 'आपका शेयरधारक अपग्रेड अनुरोध जमा हो गया है। व्यवस्थापक की स्वीकृति की प्रतीक्षा करें।'
          : 'Your shareholder upgrade request has been submitted. Please wait for admin approval.',
        [{ text: 'OK', onPress: () => {
          setShowUpgradeModal(false);
          setFolioNumber('');
          setShareValue('');
          fetchUpgradeStatus();
        }}]
      );
    } catch (error: any) {
      Alert.alert(
        language === 'hi' ? 'त्रुटि' : 'Error',
        error.response?.data?.detail || (language === 'hi' ? 'अनुरोध जमा करने में विफल' : 'Failed to submit request')
      );
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { bg: string; text: string; label: string; labelHi: string }> = {
      pending: { bg: '#FFF3E0', text: '#E65100', label: 'Pending', labelHi: 'लंबित' },
      approved: { bg: '#E8F5E9', text: '#2E7D32', label: 'Approved', labelHi: 'स्वीकृत' },
      rejected: { bg: '#FFEBEE', text: '#C62828', label: 'Rejected', labelHi: 'अस्वीकृत' },
    };
    const config = statusConfig[status] || statusConfig.pending;
    return (
      <View style={[styles.statusBadge, { backgroundColor: config.bg }]}>
        <Text style={[styles.statusText, { color: config.text }]}>
          {language === 'hi' ? config.labelHi : config.label}
        </Text>
      </View>
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
          
          {/* Role Badges */}
          <View style={styles.badgeRow}>
            <View style={styles.roleBadge}>
              <Text style={styles.roleText}>
                {language === 'hi' ? 'किसान' : 'Farmer'}
              </Text>
            </View>
            {user?.is_shareholder && (
              <View style={[styles.roleBadge, styles.shareholderBadge]}>
                <Ionicons name="ribbon" size={14} color="#FF9800" />
                <Text style={[styles.roleText, { color: '#FF9800', marginLeft: 4 }]}>
                  {language === 'hi' ? 'शेयरधारक' : 'Shareholder'}
                </Text>
              </View>
            )}
          </View>

          {/* Shareholder Info */}
          {user?.is_shareholder && user?.folio_number && (
            <View style={styles.shareholderInfo}>
              <View style={styles.infoRow}>
                <Ionicons name="document-text" size={16} color="#FF9800" />
                <Text style={styles.infoText}>
                  {language === 'hi' ? 'फोलियो: ' : 'Folio: '}{user.folio_number}
                </Text>
              </View>
              {user?.share_value && (
                <View style={styles.infoRow}>
                  <Ionicons name="cash" size={16} color="#FF9800" />
                  <Text style={styles.infoText}>
                    {language === 'hi' ? 'शेयर मूल्य: ₹' : 'Share Value: ₹'}{user.share_value}
                  </Text>
                </View>
              )}
            </View>
          )}

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

        {/* Shareholder Upgrade Section - Only show if not already a shareholder */}
        {!user?.is_shareholder && (
          <Card style={styles.upgradeCard}>
            <View style={styles.upgradeHeader}>
              <Ionicons name="ribbon-outline" size={24} color="#FF9800" />
              <Text style={styles.upgradeTitle}>
                {language === 'hi' ? 'शेयरधारक बनें' : 'Become a Shareholder'}
              </Text>
            </View>
            
            <Text style={styles.upgradeDesc}>
              {language === 'hi' 
                ? 'यदि आपके पास शेयर प्रमाणपत्र है, तो आप शेयरधारक स्थिति के लिए अपग्रेड का अनुरोध कर सकते हैं और विशेष लाभ प्राप्त कर सकते हैं।'
                : 'If you have a share certificate, you can request upgrade to shareholder status and get special benefits.'}
            </Text>

            {loading ? (
              <ActivityIndicator color="#2E7D32" style={{ marginTop: 16 }} />
            ) : upgradeRequest ? (
              <View style={styles.requestStatus}>
                <View style={styles.requestHeader}>
                  <Text style={styles.requestLabel}>
                    {language === 'hi' ? 'आपका अनुरोध' : 'Your Request'}
                  </Text>
                  {getStatusBadge(upgradeRequest.status)}
                </View>
                {upgradeRequest.folio_number && (
                  <Text style={styles.requestDetail}>
                    {language === 'hi' ? 'फोलियो: ' : 'Folio: '}{upgradeRequest.folio_number}
                  </Text>
                )}
                {upgradeRequest.admin_remark && (
                  <Text style={styles.adminRemark}>
                    {language === 'hi' ? 'टिप्पणी: ' : 'Remark: '}{upgradeRequest.admin_remark}
                  </Text>
                )}
                <Text style={styles.requestDate}>
                  {new Date(upgradeRequest.created_at).toLocaleDateString('en-IN')}
                </Text>
                
                {upgradeRequest.status === 'rejected' && (
                  <Button
                    title={language === 'hi' ? 'पुनः अनुरोध करें' : 'Request Again'}
                    onPress={() => setShowUpgradeModal(true)}
                    variant="outline"
                    size="small"
                    style={{ marginTop: 12 }}
                  />
                )}
              </View>
            ) : (
              <Button
                title={language === 'hi' ? 'अपग्रेड के लिए अनुरोध करें' : 'Request Upgrade'}
                onPress={() => setShowUpgradeModal(true)}
                variant="primary"
                icon={<Ionicons name="arrow-up-circle" size={18} color="#FFF" style={{ marginRight: 8 }} />}
                style={{ marginTop: 16 }}
              />
            )}
          </Card>
        )}

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

      {/* Upgrade Request Modal */}
      <Modal
        visible={showUpgradeModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowUpgradeModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowUpgradeModal(false)}>
              <Ionicons name="close" size={28} color="#333" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {language === 'hi' ? 'शेयरधारक अपग्रेड' : 'Shareholder Upgrade'}
            </Text>
            <View style={{ width: 28 }} />
          </View>

          <ScrollView style={styles.modalContent}>
            <View style={styles.infoBox}>
              <Ionicons name="information-circle" size={20} color="#1976D2" />
              <Text style={styles.infoBoxText}>
                {language === 'hi'
                  ? 'कृपया अपने शेयर प्रमाणपत्र से फोलियो नंबर दर्ज करें। व्यवस्थापक द्वारा सत्यापन के बाद आपको शेयरधारक का दर्जा दिया जाएगा।'
                  : 'Please enter the folio number from your share certificate. You will be granted shareholder status after verification by admin.'}
              </Text>
            </View>

            <Input
              label={language === 'hi' ? 'फोलियो नंबर *' : 'Folio Number *'}
              placeholder={language === 'hi' ? 'फोलियो नंबर दर्ज करें' : 'Enter folio number'}
              value={folioNumber}
              onChangeText={setFolioNumber}
            />

            <Input
              label={language === 'hi' ? 'शेयर मूल्य (वैकल्पिक)' : 'Share Value (optional)'}
              placeholder={language === 'hi' ? 'शेयर का मूल्य दर्ज करें' : 'Enter share value'}
              value={shareValue}
              onChangeText={setShareValue}
              keyboardType="numeric"
            />

            <Text style={styles.noteText}>
              {language === 'hi'
                ? 'नोट: शेयरधारकों को विशेष छूट और लाभ मिलते हैं। आपका फोलियो नंबर प्रमाणपत्र पर लिखा होता है।'
                : 'Note: Shareholders receive special discounts and benefits. Your folio number is written on the certificate.'}
            </Text>

            <Button
              title={language === 'hi' ? 'अनुरोध जमा करें' : 'Submit Request'}
              onPress={handleSubmitUpgrade}
              loading={submitting}
              style={{ marginTop: 24 }}
            />
          </ScrollView>
        </SafeAreaView>
      </Modal>
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
  badgeRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
  },
  shareholderBadge: {
    backgroundColor: '#FFF3E0',
  },
  roleText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2E7D32',
  },
  shareholderInfo: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    width: '100%',
    alignItems: 'center',
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
  upgradeCard: {
    marginBottom: 16,
  },
  upgradeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  upgradeTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  upgradeDesc: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  requestStatus: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#F5F5F5',
    borderRadius: 10,
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  requestLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  requestDetail: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
  },
  adminRemark: {
    fontSize: 13,
    color: '#1976D2',
    marginTop: 4,
    fontStyle: 'italic',
  },
  requestDate: {
    fontSize: 12,
    color: '#999',
    marginTop: 8,
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
    gap: 10,
    padding: 16,
    marginTop: 16,
    backgroundColor: '#FFEBEE',
    borderRadius: 12,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#D32F2F',
  },
  versionText: {
    textAlign: 'center',
    color: '#999',
    fontSize: 12,
    marginTop: 20,
    marginBottom: 10,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  modalContent: {
    padding: 16,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#E3F2FD',
    padding: 14,
    borderRadius: 10,
    marginBottom: 20,
    gap: 10,
  },
  infoBoxText: {
    flex: 1,
    fontSize: 14,
    color: '#1976D2',
    lineHeight: 20,
  },
  noteText: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
    marginTop: 16,
    fontStyle: 'italic',
  },
});
