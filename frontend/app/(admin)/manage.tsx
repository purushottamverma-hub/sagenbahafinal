import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Modal,
  Alert,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../../src/components/Card';
import { Button } from '../../src/components/Button';
import { Input } from '../../src/components/Input';
import { useTranslation } from '../../src/utils/useTranslation';
import api from '../../src/utils/api';

type TabType = 'outlets' | 'products' | 'customers' | 'farmers' | 'users';

interface Outlet {
  id: string;
  name: string;
  address: string;
  contact_person: string;
  mobile?: string;
  is_central: boolean;
}

interface Product {
  id: string;
  name: string;
  name_hi?: string;
  unit: string;
  category: string;
}

interface Customer {
  id: string;
  name: string;
  mobile?: string;
  village?: string;
  outstanding_balance: number;
}

interface Farmer {
  id: string;
  name: string;
  village: string;
  mobile?: string;
  is_member: boolean;
  outstanding_dues: number;
}

interface User {
  id: string;
  username: string;
  full_name: string;
  role: string;
  outlet_id?: string;
  is_active: boolean;
}

export default function ManageScreen() {
  const { t, language } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabType>('outlets');
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form states
  const [formData, setFormData] = useState<any>({});

  const tabs: { key: TabType; icon: string; label: string }[] = [
    { key: 'outlets', icon: 'business', label: t('outlets') },
    { key: 'products', icon: 'cube', label: t('products') },
    { key: 'customers', icon: 'people', label: t('customers') },
    { key: 'farmers', icon: 'person', label: t('farmers') },
    { key: 'users', icon: 'key', label: language === 'hi' ? 'एजेंट' : 'Agents' },
  ];

  const fetchData = async () => {
    try {
      const [outletsRes, productsRes, customersRes, farmersRes, usersRes] = await Promise.all([
        api.get('/outlets'),
        api.get('/products'),
        api.get('/customers'),
        api.get('/farmers'),
        api.get('/users'),
      ]);
      setOutlets(outletsRes.data);
      setProducts(productsRes.data);
      setCustomers(customersRes.data);
      setFarmers(farmersRes.data);
      setUsers(usersRes.data);
    } catch (error) {
      console.error('Fetch error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, []);

  const resetForm = () => {
    setFormData({});
    setShowModal(false);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      let endpoint = '';
      let data = { ...formData };

      switch (activeTab) {
        case 'outlets':
          endpoint = '/outlets';
          break;
        case 'products':
          endpoint = '/products';
          break;
        case 'customers':
          endpoint = '/customers';
          break;
        case 'farmers':
          endpoint = '/farmers';
          data.is_member = formData.is_member || false;
          break;
        case 'users':
          endpoint = '/users';
          data.role = 'agent';
          break;
      }

      await api.post(endpoint, data);
      Alert.alert(t('success'), language === 'hi' ? 'सफलतापूर्वक जोड़ा गया' : 'Successfully added');
      resetForm();
      fetchData();
    } catch (error: any) {
      Alert.alert(t('error'), error.response?.data?.detail || 'Failed');
    } finally {
      setSubmitting(false);
    }
  };

  const formatCurrency = (amount: number) => `${t('currency')}${amount.toLocaleString('en-IN')}`;

  const renderOutlets = () => (
    <FlatList
      data={outlets}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <Card>
          <View style={styles.cardHeader}>
            <View style={styles.cardInfo}>
              <Text style={styles.cardTitle}>{item.name}</Text>
              {item.is_central && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{t('centralOffice')}</Text>
                </View>
              )}
            </View>
          </View>
          <Text style={styles.cardSubtext}>{item.address}</Text>
          <Text style={styles.cardSubtext}>{t('contactPerson')}: {item.contact_person}</Text>
          {item.mobile && <Text style={styles.cardSubtext}>{t('mobile')}: {item.mobile}</Text>}
        </Card>
      )}
      contentContainerStyle={styles.listContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      ListEmptyComponent={<Text style={styles.emptyText}>{language === 'hi' ? 'कोई आउटलेट नहीं' : 'No outlets'}</Text>}
    />
  );

  const renderProducts = () => (
    <FlatList
      data={products}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <Card>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>
              {language === 'hi' && item.name_hi ? item.name_hi : item.name}
            </Text>
            <View style={[styles.badge, { backgroundColor: item.category === 'input' ? '#E3F2FD' : '#FFF3E0' }]}>
              <Text style={[styles.badgeText, { color: item.category === 'input' ? '#1565C0' : '#E65100' }]}>
                {item.category === 'input' ? (language === 'hi' ? 'इनपुट' : 'Input') : (language === 'hi' ? 'आउटपुट' : 'Output')}
              </Text>
            </View>
          </View>
          <Text style={styles.cardSubtext}>{t('unit')}: {item.unit}</Text>
        </Card>
      )}
      contentContainerStyle={styles.listContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      ListEmptyComponent={<Text style={styles.emptyText}>{language === 'hi' ? 'कोई उत्पाद नहीं' : 'No products'}</Text>}
    />
  );

  const renderCustomers = () => (
    <FlatList
      data={customers}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <Card>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>{item.name}</Text>
            {item.outstanding_balance > 0 && (
              <Text style={styles.dueAmount}>{formatCurrency(item.outstanding_balance)}</Text>
            )}
          </View>
          {item.mobile && <Text style={styles.cardSubtext}>{t('mobile')}: {item.mobile}</Text>}
          {item.village && <Text style={styles.cardSubtext}>{t('village')}: {item.village}</Text>}
        </Card>
      )}
      contentContainerStyle={styles.listContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      ListEmptyComponent={<Text style={styles.emptyText}>{language === 'hi' ? 'कोई ग्राहक नहीं' : 'No customers'}</Text>}
    />
  );

  const renderFarmers = () => (
    <FlatList
      data={farmers}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <Card>
          <View style={styles.cardHeader}>
            <View>
              <Text style={styles.cardTitle}>{item.name}</Text>
              {item.is_member && (
                <View style={[styles.badge, { backgroundColor: '#E8F5E9' }]}>
                  <Text style={[styles.badgeText, { color: '#2E7D32' }]}>
                    {language === 'hi' ? 'FPO सदस्य' : 'Member'}
                  </Text>
                </View>
              )}
            </View>
            {item.outstanding_dues > 0 && (
              <Text style={[styles.dueAmount, { color: '#1565C0' }]}>
                {formatCurrency(item.outstanding_dues)}
              </Text>
            )}
          </View>
          <Text style={styles.cardSubtext}>{t('village')}: {item.village}</Text>
          {item.mobile && <Text style={styles.cardSubtext}>{t('mobile')}: {item.mobile}</Text>}
        </Card>
      )}
      contentContainerStyle={styles.listContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      ListEmptyComponent={<Text style={styles.emptyText}>{language === 'hi' ? 'कोई किसान नहीं' : 'No farmers'}</Text>}
    />
  );

  const renderUsers = () => (
    <FlatList
      data={users}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <Card>
          <View style={styles.cardHeader}>
            <View>
              <Text style={styles.cardTitle}>{item.full_name}</Text>
              <Text style={styles.username}>@{item.username}</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: item.role === 'admin' ? '#FFF3E0' : '#E3F2FD' }]}>
              <Text style={[styles.badgeText, { color: item.role === 'admin' ? '#E65100' : '#1565C0' }]}>
                {item.role === 'admin' ? 'Admin' : 'Agent'}
              </Text>
            </View>
          </View>
          {item.outlet_id && (
            <Text style={styles.cardSubtext}>
              {t('outlets')}: {outlets.find(o => o.id === item.outlet_id)?.name || 'N/A'}
            </Text>
          )}
        </Card>
      )}
      contentContainerStyle={styles.listContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      ListEmptyComponent={<Text style={styles.emptyText}>{language === 'hi' ? 'कोई एजेंट नहीं' : 'No agents'}</Text>}
    />
  );

  const renderForm = () => {
    switch (activeTab) {
      case 'outlets':
        return (
          <>
            <Input
              label={t('outletName')}
              placeholder={language === 'hi' ? 'आउटलेट का नाम' : 'Enter outlet name'}
              value={formData.name || ''}
              onChangeText={(val) => setFormData({ ...formData, name: val })}
              required
            />
            <Input
              label={t('address')}
              placeholder={language === 'hi' ? 'पता' : 'Enter address'}
              value={formData.address || ''}
              onChangeText={(val) => setFormData({ ...formData, address: val })}
              required
            />
            <Input
              label={t('contactPerson')}
              placeholder={language === 'hi' ? 'संपर्क व्यक्ति' : 'Contact person name'}
              value={formData.contact_person || ''}
              onChangeText={(val) => setFormData({ ...formData, contact_person: val })}
              required
            />
            <Input
              label={t('mobile')}
              placeholder="9876543210"
              value={formData.mobile || ''}
              onChangeText={(val) => setFormData({ ...formData, mobile: val })}
              keyboardType="phone-pad"
            />
          </>
        );
      case 'products':
        return (
          <>
            <Input
              label={`${t('productName')} (English)`}
              placeholder="Product name"
              value={formData.name || ''}
              onChangeText={(val) => setFormData({ ...formData, name: val })}
              required
            />
            <Input
              label={`${t('productName')} (हिंदी)`}
              placeholder="उत्पाद का नाम"
              value={formData.name_hi || ''}
              onChangeText={(val) => setFormData({ ...formData, name_hi: val })}
            />
            <Text style={styles.label}>{t('unit')}</Text>
            <View style={styles.chipRow}>
              {['kg', 'litre', 'piece', 'packet'].map(unit => (
                <TouchableOpacity
                  key={unit}
                  style={[styles.chip, formData.unit === unit && styles.chipActive]}
                  onPress={() => setFormData({ ...formData, unit })}
                >
                  <Text style={[styles.chipText, formData.unit === unit && styles.chipTextActive]}>
                    {unit}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.label}>{t('category')}</Text>
            <View style={styles.chipRow}>
              <TouchableOpacity
                style={[styles.chip, formData.category === 'input' && styles.chipActive]}
                onPress={() => setFormData({ ...formData, category: 'input' })}
              >
                <Text style={[styles.chipText, formData.category === 'input' && styles.chipTextActive]}>
                  {language === 'hi' ? 'इनपुट' : 'Input'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.chip, formData.category === 'output' && styles.chipActive]}
                onPress={() => setFormData({ ...formData, category: 'output' })}
              >
                <Text style={[styles.chipText, formData.category === 'output' && styles.chipTextActive]}>
                  {language === 'hi' ? 'आउटपुट' : 'Output'}
                </Text>
              </TouchableOpacity>
            </View>
          </>
        );
      case 'customers':
        return (
          <>
            <Input
              label={t('customerName')}
              placeholder={language === 'hi' ? 'ग्राहक का नाम' : 'Customer name'}
              value={formData.name || ''}
              onChangeText={(val) => setFormData({ ...formData, name: val })}
              required
            />
            <Input
              label={t('mobile')}
              placeholder="9876543210"
              value={formData.mobile || ''}
              onChangeText={(val) => setFormData({ ...formData, mobile: val })}
              keyboardType="phone-pad"
            />
            <Input
              label={t('village')}
              placeholder={language === 'hi' ? 'गाँव' : 'Village'}
              value={formData.village || ''}
              onChangeText={(val) => setFormData({ ...formData, village: val })}
            />
          </>
        );
      case 'farmers':
        return (
          <>
            <Input
              label={t('farmerName')}
              placeholder={language === 'hi' ? 'किसान का नाम' : 'Farmer name'}
              value={formData.name || ''}
              onChangeText={(val) => setFormData({ ...formData, name: val })}
              required
            />
            <Input
              label={t('village')}
              placeholder={language === 'hi' ? 'गाँव' : 'Village'}
              value={formData.village || ''}
              onChangeText={(val) => setFormData({ ...formData, village: val })}
              required
            />
            <Input
              label={t('mobile')}
              placeholder="9876543210"
              value={formData.mobile || ''}
              onChangeText={(val) => setFormData({ ...formData, mobile: val })}
              keyboardType="phone-pad"
            />
            <TouchableOpacity
              style={styles.checkboxRow}
              onPress={() => setFormData({ ...formData, is_member: !formData.is_member })}
            >
              <Ionicons
                name={formData.is_member ? 'checkbox' : 'square-outline'}
                size={24}
                color="#2E7D32"
              />
              <Text style={styles.checkboxLabel}>{t('isMember')}</Text>
            </TouchableOpacity>
          </>
        );
      case 'users':
        return (
          <>
            <Input
              label={t('username')}
              placeholder="username"
              value={formData.username || ''}
              onChangeText={(val) => setFormData({ ...formData, username: val.toLowerCase().replace(/\s/g, '') })}
              autoCapitalize="none"
              required
            />
            <Input
              label={language === 'hi' ? 'पूरा नाम' : 'Full Name'}
              placeholder={language === 'hi' ? 'एजेंट का नाम' : 'Agent name'}
              value={formData.full_name || ''}
              onChangeText={(val) => setFormData({ ...formData, full_name: val })}
              required
            />
            <Input
              label={t('password')}
              placeholder="********"
              value={formData.password || ''}
              onChangeText={(val) => setFormData({ ...formData, password: val })}
              secureTextEntry
              required
            />
            <Text style={styles.label}>{t('outlets')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.selectScroll}>
              {outlets.map(o => (
                <TouchableOpacity
                  key={o.id}
                  style={[styles.chip, formData.outlet_id === o.id && styles.chipActive]}
                  onPress={() => setFormData({ ...formData, outlet_id: o.id })}
                >
                  <Text style={[styles.chipText, formData.outlet_id === o.id && styles.chipTextActive]}>
                    {o.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </>
        );
    }
  };

  const getModalTitle = () => {
    switch (activeTab) {
      case 'outlets': return language === 'hi' ? 'नया आउटलेट' : 'New Outlet';
      case 'products': return language === 'hi' ? 'नया उत्पाद' : 'New Product';
      case 'customers': return language === 'hi' ? 'नया ग्राहक' : 'New Customer';
      case 'farmers': return language === 'hi' ? 'नया किसान' : 'New Farmer';
      case 'users': return language === 'hi' ? 'नया एजेंट' : 'New Agent';
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{language === 'hi' ? 'प्रबंधन' : 'Manage'}</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowModal(true)}>
          <Ionicons name="add" size={24} color="#FFF" />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScroll}>
        {tabs.map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Ionicons
              name={tab.icon as any}
              size={20}
              color={activeTab === tab.key ? '#2E7D32' : '#666'}
            />
            <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Content */}
      {activeTab === 'outlets' && renderOutlets()}
      {activeTab === 'products' && renderProducts()}
      {activeTab === 'customers' && renderCustomers()}
      {activeTab === 'farmers' && renderFarmers()}
      {activeTab === 'users' && renderUsers()}

      {/* Add Modal */}
      <Modal visible={showModal} animationType="slide">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={resetForm}>
              <Ionicons name="close" size={28} color="#333" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{getModalTitle()}</Text>
            <View style={{ width: 28 }} />
          </View>
          <ScrollView style={styles.modalContent}>
            {renderForm()}
            <Button
              title={t('save')}
              onPress={handleSubmit}
              loading={submitting}
              size="large"
              style={styles.submitBtn}
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  addBtn: {
    backgroundColor: '#2E7D32',
    padding: 8,
    borderRadius: 8,
  },
  tabsScroll: {
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: '#2E7D32',
  },
  tabText: {
    marginLeft: 6,
    color: '#666',
    fontWeight: '500',
  },
  tabTextActive: {
    color: '#2E7D32',
  },
  listContent: {
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  cardInfo: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  cardSubtext: {
    fontSize: 13,
    color: '#666',
    marginTop: 4,
  },
  badge: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#2E7D32',
  },
  dueAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#E65100',
  },
  username: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  emptyText: {
    textAlign: 'center',
    color: '#999',
    marginTop: 40,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    marginTop: 16,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#E8E8E8',
    borderRadius: 20,
    marginRight: 8,
  },
  chipActive: {
    backgroundColor: '#2E7D32',
  },
  chipText: {
    color: '#666',
    fontWeight: '500',
  },
  chipTextActive: {
    color: '#FFF',
  },
  selectScroll: {
    marginBottom: 16,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
  },
  checkboxLabel: {
    marginLeft: 8,
    fontSize: 16,
    color: '#333',
  },
  submitBtn: {
    marginTop: 24,
    marginBottom: 40,
  },
});
