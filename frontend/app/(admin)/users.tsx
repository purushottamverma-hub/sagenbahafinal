import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  Modal,
  Alert,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useSettingsStore } from '../../src/store/settingsStore';
import { Card } from '../../src/components/Card';
import { Button } from '../../src/components/Button';
import api from '../../src/utils/api';

interface User {
  id: string;
  username: string;
  full_name: string;
  role: string;
  outlet_id?: string;
  mobile?: string;
  village?: string;
  status?: string;
  is_active: boolean;
  created_at: string;
}

interface Outlet {
  id: string;
  name: string;
}

export default function UsersScreen() {
  const [users, setUsers] = useState<User[]>([]);
  const [pendingUsers, setPendingUsers] = useState<User[]>([]);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'pending'>('all');
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedOutlet, setSelectedOutlet] = useState('');
  const [loading, setLoading] = useState(false);
  const language = useSettingsStore((state) => state.language);

  // Create user form state
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newFullName, setNewFullName] = useState('');
  const [newRole, setNewRole] = useState<'admin' | 'agent' | 'farmer'>('agent');
  const [newMobile, setNewMobile] = useState('');

  const fetchData = async () => {
    try {
      const [usersRes, pendingRes, outletsRes] = await Promise.all([
        api.get('/users'),
        api.get('/users/pending'),
        api.get('/outlets'),
      ]);
      setUsers(usersRes.data);
      setPendingUsers(pendingRes.data);
      setOutlets(outletsRes.data);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const handleApprove = async (approved: boolean) => {
    if (!selectedUser) return;
    if (approved && !selectedOutlet) {
      Alert.alert(
        language === 'hi' ? 'त्रुटि' : 'Error',
        language === 'hi' ? 'कृपया आउटलेट चुनें' : 'Please select an outlet'
      );
      return;
    }

    setLoading(true);
    try {
      await api.post('/users/approve', {
        user_id: selectedUser.id,
        outlet_id: selectedOutlet,
        approved,
      });

      Alert.alert(
        language === 'hi' ? 'सफल' : 'Success',
        approved
          ? (language === 'hi' ? 'एजेंट स्वीकृत' : 'Agent approved successfully')
          : (language === 'hi' ? 'पंजीकरण अस्वीकृत' : 'Registration rejected')
      );

      setShowApprovalModal(false);
      setSelectedUser(null);
      setSelectedOutlet('');
      fetchData();
    } catch (error: any) {
      Alert.alert(
        language === 'hi' ? 'त्रुटि' : 'Error',
        error.response?.data?.detail || (language === 'hi' ? 'कार्रवाई विफल' : 'Action failed')
      );
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async () => {
    if (!newUsername || !newPassword || !newFullName) {
      Alert.alert(
        language === 'hi' ? 'त्रुटि' : 'Error',
        language === 'hi' ? 'कृपया सभी आवश्यक फील्ड भरें' : 'Please fill all required fields'
      );
      return;
    }

    setLoading(true);
    try {
      await api.post('/users', {
        username: newUsername,
        password: newPassword,
        full_name: newFullName,
        role: newRole,
        mobile: newMobile || null,
        outlet_id: newRole === 'agent' ? selectedOutlet || null : null,
      });

      Alert.alert(
        language === 'hi' ? 'सफल' : 'Success',
        language === 'hi' ? 'उपयोगकर्ता बनाया गया' : 'User created successfully'
      );

      setShowCreateModal(false);
      resetCreateForm();
      fetchData();
    } catch (error: any) {
      Alert.alert(
        language === 'hi' ? 'त्रुटि' : 'Error',
        error.response?.data?.detail || (language === 'hi' ? 'उपयोगकर्ता बनाने में विफल' : 'Failed to create user')
      );
    } finally {
      setLoading(false);
    }
  };

  const resetCreateForm = () => {
    setNewUsername('');
    setNewPassword('');
    setNewFullName('');
    setNewRole('agent');
    setNewMobile('');
    setSelectedOutlet('');
  };

  const getRoleBadgeStyle = (role: string) => {
    switch (role) {
      case 'admin': return { bg: '#FFEBEE', color: '#D32F2F' };
      case 'agent': return { bg: '#E3F2FD', color: '#1976D2' };
      default: return { bg: '#E8F5E9', color: '#2E7D32' };
    }
  };

  const getRoleText = (role: string) => {
    const roleMap: Record<string, { en: string; hi: string }> = {
      admin: { en: 'Admin', hi: 'एडमिन' },
      agent: { en: 'Agent', hi: 'एजेंट' },
      farmer: { en: 'Farmer', hi: 'किसान' },
    };
    return roleMap[role]?.[language] || role;
  };

  const renderUser = ({ item }: { item: User }) => {
    const roleStyle = getRoleBadgeStyle(item.role);
    const isPending = item.status === 'pending';

    return (
      <Card style={styles.userCard}>
        <View style={styles.userHeader}>
          <View style={styles.avatarContainer}>
            <Ionicons name="person" size={24} color="#666" />
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{item.full_name}</Text>
            <Text style={styles.userHandle}>@{item.username}</Text>
          </View>
          <View style={[styles.roleBadge, { backgroundColor: roleStyle.bg }]}>
            <Text style={[styles.roleText, { color: roleStyle.color }]}>
              {getRoleText(item.role)}
            </Text>
          </View>
        </View>
        {item.mobile && (
          <View style={styles.infoRow}>
            <Ionicons name="call" size={14} color="#666" />
            <Text style={styles.infoText}>{item.mobile}</Text>
          </View>
        )}
        {item.village && (
          <View style={styles.infoRow}>
            <Ionicons name="location" size={14} color="#666" />
            <Text style={styles.infoText}>{item.village}</Text>
          </View>
        )}
        {isPending && (
          <TouchableOpacity
            style={styles.approveBtn}
            onPress={() => {
              setSelectedUser(item);
              setShowApprovalModal(true);
            }}
          >
            <Text style={styles.approveBtnText}>
              {language === 'hi' ? 'समीक्षा करें' : 'Review'}
            </Text>
          </TouchableOpacity>
        )}
      </Card>
    );
  };

  const currentData = activeTab === 'pending' ? pendingUsers : users;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>
          {language === 'hi' ? 'उपयोगकर्ता प्रबंधन' : 'User Management'}
        </Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowCreateModal(true)}>
          <Ionicons name="person-add" size={22} color="#FFF" />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'all' && styles.tabActive]}
          onPress={() => setActiveTab('all')}
        >
          <Text style={[styles.tabText, activeTab === 'all' && styles.tabTextActive]}>
            {language === 'hi' ? 'सभी उपयोगकर्ता' : 'All Users'}
          </Text>
          <View style={styles.tabBadge}>
            <Text style={styles.tabBadgeText}>{users.length}</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'pending' && styles.tabActive]}
          onPress={() => setActiveTab('pending')}
        >
          <Text style={[styles.tabText, activeTab === 'pending' && styles.tabTextActive]}>
            {language === 'hi' ? 'लंबित' : 'Pending'}
          </Text>
          {pendingUsers.length > 0 && (
            <View style={[styles.tabBadge, { backgroundColor: '#F57C00' }]}>
              <Text style={styles.tabBadgeText}>{pendingUsers.length}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <FlatList
        data={currentData}
        renderItem={renderUser}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={64} color="#CCC" />
            <Text style={styles.emptyText}>
              {activeTab === 'pending'
                ? (language === 'hi' ? 'कोई लंबित अनुरोध नहीं' : 'No pending requests')
                : (language === 'hi' ? 'कोई उपयोगकर्ता नहीं' : 'No users found')}
            </Text>
          </View>
        }
      />

      {/* Approval Modal */}
      <Modal visible={showApprovalModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {language === 'hi' ? 'एजेंट अनुमोदन' : 'Agent Approval'}
              </Text>
              <TouchableOpacity onPress={() => setShowApprovalModal(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            {selectedUser && (
              <View style={styles.userPreview}>
                <Text style={styles.previewName}>{selectedUser.full_name}</Text>
                <Text style={styles.previewHandle}>@{selectedUser.username}</Text>
                {selectedUser.mobile && (
                  <Text style={styles.previewInfo}>☎ {selectedUser.mobile}</Text>
                )}
                {selectedUser.village && (
                  <Text style={styles.previewInfo}>📍 {selectedUser.village}</Text>
                )}
              </View>
            )}

            <Text style={styles.label}>
              {language === 'hi' ? 'आउटलेट आवंटित करें' : 'Assign Outlet'} *
            </Text>
            <View style={styles.outletGrid}>
              {outlets.map((outlet) => (
                <TouchableOpacity
                  key={outlet.id}
                  style={[
                    styles.outletBtn,
                    selectedOutlet === outlet.id && styles.outletBtnActive,
                  ]}
                  onPress={() => setSelectedOutlet(outlet.id)}
                >
                  <Text style={[
                    styles.outletText,
                    selectedOutlet === outlet.id && styles.outletTextActive,
                  ]}>
                    {outlet.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.actionRow}>
              <TouchableOpacity
                style={styles.rejectBtn}
                onPress={() => handleApprove(false)}
                disabled={loading}
              >
                <Text style={styles.rejectBtnText}>
                  {language === 'hi' ? 'अस्वीकार' : 'Reject'}
                </Text>
              </TouchableOpacity>
              <Button
                title={language === 'hi' ? 'स्वीकृत करें' : 'Approve'}
                onPress={() => handleApprove(true)}
                loading={loading}
                style={styles.approveActionBtn}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Create User Modal */}
      <Modal visible={showCreateModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {language === 'hi' ? 'नया उपयोगकर्ता' : 'Create User'}
              </Text>
              <TouchableOpacity onPress={() => setShowCreateModal(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            {/* Role Selection */}
            <Text style={styles.label}>
              {language === 'hi' ? 'भूमिका' : 'Role'}
            </Text>
            <View style={styles.roleToggle}>
              {(['admin', 'agent', 'farmer'] as const).map((role) => (
                <TouchableOpacity
                  key={role}
                  style={[
                    styles.roleBtn,
                    newRole === role && styles.roleBtnActive,
                  ]}
                  onPress={() => setNewRole(role)}
                >
                  <Text style={[
                    styles.roleBtnText,
                    newRole === role && styles.roleBtnTextActive,
                  ]}>
                    {getRoleText(role)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>
              {language === 'hi' ? 'पूरा नाम' : 'Full Name'} *
            </Text>
            <TextInput
              style={styles.input}
              value={newFullName}
              onChangeText={setNewFullName}
              placeholder={language === 'hi' ? 'नाम दर्ज करें' : 'Enter full name'}
            />

            <Text style={styles.label}>
              {language === 'hi' ? 'उपयोगकर्ता नाम' : 'Username'} *
            </Text>
            <TextInput
              style={styles.input}
              value={newUsername}
              onChangeText={setNewUsername}
              placeholder={language === 'hi' ? 'उपयोगकर्ता नाम दर्ज करें' : 'Enter username'}
              autoCapitalize="none"
            />

            <Text style={styles.label}>
              {language === 'hi' ? 'पासवर्ड' : 'Password'} *
            </Text>
            <TextInput
              style={styles.input}
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder={language === 'hi' ? 'पासवर्ड दर्ज करें' : 'Enter password'}
              secureTextEntry
            />

            <Text style={styles.label}>
              {language === 'hi' ? 'मोबाइल' : 'Mobile'}
            </Text>
            <TextInput
              style={styles.input}
              value={newMobile}
              onChangeText={setNewMobile}
              placeholder={language === 'hi' ? 'मोबाइल नंबर' : 'Mobile number'}
              keyboardType="phone-pad"
            />

            {newRole === 'agent' && (
              <>
                <Text style={styles.label}>
                  {language === 'hi' ? 'आउटलेट' : 'Outlet'}
                </Text>
                <View style={styles.outletGrid}>
                  {outlets.map((outlet) => (
                    <TouchableOpacity
                      key={outlet.id}
                      style={[
                        styles.outletBtn,
                        selectedOutlet === outlet.id && styles.outletBtnActive,
                      ]}
                      onPress={() => setSelectedOutlet(outlet.id)}
                    >
                      <Text style={[
                        styles.outletText,
                        selectedOutlet === outlet.id && styles.outletTextActive,
                      ]}>
                        {outlet.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            <Button
              title={language === 'hi' ? 'उपयोगकर्ता बनाएं' : 'Create User'}
              onPress={handleCreateUser}
              loading={loading}
              style={styles.submitBtn}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  addBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#2E7D32',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 12,
    marginBottom: 8,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#E8E8E8',
  },
  tabActive: {
    backgroundColor: '#2E7D32',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  tabTextActive: {
    color: '#FFF',
  },
  tabBadge: {
    backgroundColor: '#666',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  tabBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFF',
  },
  listContent: {
    padding: 16,
    paddingTop: 8,
  },
  userCard: {
    marginBottom: 12,
  },
  userHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E8E8E8',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  userHandle: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  roleBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  roleText: {
    fontSize: 12,
    fontWeight: '600',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  infoText: {
    fontSize: 13,
    color: '#666',
  },
  approveBtn: {
    backgroundColor: '#E3F2FD',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 12,
  },
  approveBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1976D2',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    marginTop: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  userPreview: {
    backgroundColor: '#F5F5F5',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  previewName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  previewHandle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  previewInfo: {
    fontSize: 14,
    color: '#666',
    marginTop: 6,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    marginTop: 12,
  },
  outletGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  outletBtn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DDD',
    backgroundColor: '#F9F9F9',
  },
  outletBtnActive: {
    backgroundColor: '#2E7D32',
    borderColor: '#2E7D32',
  },
  outletText: {
    fontSize: 14,
    color: '#333',
  },
  outletTextActive: {
    color: '#FFF',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  rejectBtn: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: '#FFEBEE',
    alignItems: 'center',
  },
  rejectBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#D32F2F',
  },
  approveActionBtn: {
    flex: 1,
  },
  roleToggle: {
    flexDirection: 'row',
    gap: 8,
  },
  roleBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DDD',
    alignItems: 'center',
  },
  roleBtnActive: {
    backgroundColor: '#2E7D32',
    borderColor: '#2E7D32',
  },
  roleBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  roleBtnTextActive: {
    color: '#FFF',
  },
  input: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    backgroundColor: '#F9F9F9',
  },
  submitBtn: {
    marginTop: 20,
  },
});
