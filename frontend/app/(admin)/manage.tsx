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
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../../src/components/Card';
import { Button } from '../../src/components/Button';
import { useSettingsStore } from '../../src/store/settingsStore';
import api from '../../src/utils/api';

type TabType = 'outlets' | 'products' | 'vendors' | 'customers' | 'farmers';

interface Outlet {
  id: string;
  name: string;
  address?: string;
  contact_person?: string;
  mobile?: string;
  is_central: boolean;
  is_active: boolean;
}

interface Product {
  id: string;
  name: string;
  name_hi?: string;
  unit: string;
  category: string;
  description?: string;
}

interface Vendor {
  id: string;
  name: string;
  mobile?: string;
  address?: string;
  products?: string[];
}

interface Customer {
  id: string;
  name: string;
  mobile?: string;
  village?: string;
  outstanding_dues: number;
}

interface Farmer {
  id: string;
  name: string;
  village?: string;
  mobile?: string;
  is_member: boolean;
  is_shareholder: boolean;
  outstanding_dues: number;
}

export default function ManageScreen() {
  const language = useSettingsStore((state) => state.language);
  const [activeTab, setActiveTab] = useState<TabType>('outlets');
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);

  // Form states for outlets
  const [outletName, setOutletName] = useState('');
  const [outletAddress, setOutletAddress] = useState('');
  const [outletContact, setOutletContact] = useState('');
  const [outletMobile, setOutletMobile] = useState('');
  const [isCentral, setIsCentral] = useState(false);

  // Form states for products
  const [productName, setProductName] = useState('');
  const [productNameHi, setProductNameHi] = useState('');
  const [productUnit, setProductUnit] = useState('kg');
  const [productCategory, setProductCategory] = useState('produce');
  const [productDescription, setProductDescription] = useState('');

  // Form states for vendors
  const [vendorName, setVendorName] = useState('');
  const [vendorMobile, setVendorMobile] = useState('');
  const [vendorAddress, setVendorAddress] = useState('');

  // Form states for customers
  const [customerName, setCustomerName] = useState('');
  const [customerMobile, setCustomerMobile] = useState('');
  const [customerVillage, setCustomerVillage] = useState('');

  // Form states for farmers
  const [farmerName, setFarmerName] = useState('');
  const [farmerMobile, setFarmerMobile] = useState('');
  const [farmerVillage, setFarmerVillage] = useState('');
  const [isMember, setIsMember] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [outletsRes, productsRes, customersRes, farmersRes] = await Promise.all([
        api.get('/outlets'),
        api.get('/products'),
        api.get('/customers'),
        api.get('/farmers'),
      ]);
      setOutlets(outletsRes.data);
      setProducts(productsRes.data);
      setCustomers(customersRes.data);
      setFarmers(farmersRes.data);
      
      // Try to fetch vendors if endpoint exists
      try {
        const vendorsRes = await api.get('/vendors');
        setVendors(vendorsRes.data);
      } catch {
        setVendors([]);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const resetForm = () => {
    setOutletName('');
    setOutletAddress('');
    setOutletContact('');
    setOutletMobile('');
    setIsCentral(false);
    setProductName('');
    setProductNameHi('');
    setProductUnit('kg');
    setProductCategory('produce');
    setProductDescription('');
    setVendorName('');
    setVendorMobile('');
    setVendorAddress('');
    setCustomerName('');
    setCustomerMobile('');
    setCustomerVillage('');
    setFarmerName('');
    setFarmerMobile('');
    setFarmerVillage('');
    setIsMember(false);
    setEditItem(null);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      switch (activeTab) {
        case 'outlets':
          if (!outletName.trim()) {
            Alert.alert(language === 'hi' ? 'त्रुटि' : 'Error', language === 'hi' ? 'आउटलेट का नाम आवश्यक है' : 'Outlet name is required');
            return;
          }
          if (editItem) {
            await api.put(`/outlets/${editItem.id}`, {
              name: outletName,
              address: outletAddress,
              contact_person: outletContact,
              mobile: outletMobile,
              is_central: isCentral,
            });
          } else {
            await api.post('/outlets', {
              name: outletName,
              address: outletAddress,
              contact_person: outletContact,
              mobile: outletMobile,
              is_central: isCentral,
            });
          }
          break;

        case 'products':
          if (!productName.trim()) {
            Alert.alert(language === 'hi' ? 'त्रुटि' : 'Error', language === 'hi' ? 'उत्पाद का नाम आवश्यक है' : 'Product name is required');
            return;
          }
          if (editItem) {
            await api.put(`/products/${editItem.id}`, {
              name: productName,
              name_hi: productNameHi,
              unit: productUnit,
              category: productCategory,
              description: productDescription,
            });
          } else {
            await api.post('/products', {
              name: productName,
              name_hi: productNameHi,
              unit: productUnit,
              category: productCategory,
              description: productDescription,
            });
          }
          break;

        case 'vendors':
          if (!vendorName.trim()) {
            Alert.alert(language === 'hi' ? 'त्रुटि' : 'Error', language === 'hi' ? 'विक्रेता का नाम आवश्यक है' : 'Vendor name is required');
            return;
          }
          if (editItem) {
            await api.put(`/vendors/${editItem.id}`, {
              name: vendorName,
              mobile: vendorMobile,
              address: vendorAddress,
            });
          } else {
            await api.post('/vendors', {
              name: vendorName,
              mobile: vendorMobile,
              address: vendorAddress,
            });
          }
          break;

        case 'customers':
          if (!customerName.trim()) {
            Alert.alert(language === 'hi' ? 'त्रुटि' : 'Error', language === 'hi' ? 'ग्राहक का नाम आवश्यक है' : 'Customer name is required');
            return;
          }
          await api.post('/customers', {
            name: customerName,
            mobile: customerMobile,
            village: customerVillage,
          });
          break;

        case 'farmers':
          if (!farmerName.trim()) {
            Alert.alert(language === 'hi' ? 'त्रुटि' : 'Error', language === 'hi' ? 'किसान का नाम आवश्यक है' : 'Farmer name is required');
            return;
          }
          await api.post('/farmers', {
            name: farmerName,
            mobile: farmerMobile,
            village: farmerVillage,
            is_member: isMember,
          });
          break;
      }

      Alert.alert(
        language === 'hi' ? 'सफल' : 'Success',
        language === 'hi' ? 'सफलतापूर्वक जोड़ा गया' : 'Added successfully'
      );
      setShowModal(false);
      resetForm();
      fetchData();
    } catch (error: any) {
      Alert.alert(
        language === 'hi' ? 'त्रुटि' : 'Error',
        error.response?.data?.detail || (language === 'hi' ? 'जोड़ने में विफल' : 'Failed to add')
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (type: string, id: string) => {
    Alert.alert(
      language === 'hi' ? 'पुष्टि करें' : 'Confirm',
      language === 'hi' ? 'क्या आप इसे हटाना चाहते हैं?' : 'Are you sure you want to delete this?',
      [
        { text: language === 'hi' ? 'रद्द करें' : 'Cancel', style: 'cancel' },
        {
          text: language === 'hi' ? 'हटाएं' : 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/${type}/${id}`);
              Alert.alert(language === 'hi' ? 'सफल' : 'Success', language === 'hi' ? 'हटाया गया' : 'Deleted successfully');
              fetchData();
            } catch (error: any) {
              Alert.alert(language === 'hi' ? 'त्रुटि' : 'Error', error.response?.data?.detail || 'Delete failed');
            }
          },
        },
      ]
    );
  };

  const handleEdit = (item: any) => {
    setEditItem(item);
    if (activeTab === 'outlets') {
      setOutletName(item.name || '');
      setOutletAddress(item.address || '');
      setOutletContact(item.contact_person || '');
      setOutletMobile(item.mobile || '');
      setIsCentral(item.is_central || false);
    } else if (activeTab === 'products') {
      setProductName(item.name || '');
      setProductNameHi(item.name_hi || '');
      setProductUnit(item.unit || 'kg');
      setProductCategory(item.category || 'produce');
      setProductDescription(item.description || '');
    } else if (activeTab === 'vendors') {
      setVendorName(item.name || '');
      setVendorMobile(item.mobile || '');
      setVendorAddress(item.address || '');
    }
    setShowModal(true);
  };

  const tabs = [
    { id: 'outlets', label: language === 'hi' ? 'आउटलेट' : 'Outlets', icon: 'business' },
    { id: 'products', label: language === 'hi' ? 'उत्पाद' : 'Products', icon: 'cube' },
    { id: 'vendors', label: language === 'hi' ? 'विक्रेता' : 'Vendors', icon: 'storefront' },
    { id: 'customers', label: language === 'hi' ? 'ग्राहक' : 'Customers', icon: 'people' },
    { id: 'farmers', label: language === 'hi' ? 'किसान' : 'Farmers', icon: 'leaf' },
  ];

  const renderOutletItem = ({ item }: { item: Outlet }) => (
    <Card style={styles.itemCard}>
      <View style={styles.itemRow}>
        <View style={[styles.itemIcon, { backgroundColor: item.is_central ? '#E3F2FD' : '#E8F5E9' }]}>
          <Ionicons name="business" size={24} color={item.is_central ? '#1976D2' : '#2E7D32'} />
        </View>
        <View style={styles.itemInfo}>
          <Text style={styles.itemName}>{item.name}</Text>
          {item.address && <Text style={styles.itemMeta}>{item.address}</Text>}
          {item.is_central && (
            <View style={styles.centralBadge}>
              <Text style={styles.centralText}>{language === 'hi' ? 'केंद्रीय' : 'Central'}</Text>
            </View>
          )}
        </View>
        <View style={styles.itemActions}>
          <TouchableOpacity onPress={() => handleEdit(item)} style={styles.actionBtn}>
            <Ionicons name="pencil" size={18} color="#1976D2" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => handleDelete('outlets', item.id)} style={styles.actionBtn}>
            <Ionicons name="trash" size={18} color="#D32F2F" />
          </TouchableOpacity>
        </View>
      </View>
    </Card>
  );

  const renderProductItem = ({ item }: { item: Product }) => (
    <Card style={styles.itemCard}>
      <View style={styles.itemRow}>
        <View style={[styles.itemIcon, { backgroundColor: item.category === 'input' ? '#FFF3E0' : '#E8F5E9' }]}>
          <Ionicons name="cube" size={24} color={item.category === 'input' ? '#F57C00' : '#2E7D32'} />
        </View>
        <View style={styles.itemInfo}>
          <Text style={styles.itemName}>{language === 'hi' && item.name_hi ? item.name_hi : item.name}</Text>
          <Text style={styles.itemMeta}>{item.unit} • {item.category}</Text>
        </View>
        <View style={styles.itemActions}>
          <TouchableOpacity onPress={() => handleEdit(item)} style={styles.actionBtn}>
            <Ionicons name="pencil" size={18} color="#1976D2" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => handleDelete('products', item.id)} style={styles.actionBtn}>
            <Ionicons name="trash" size={18} color="#D32F2F" />
          </TouchableOpacity>
        </View>
      </View>
    </Card>
  );

  const renderVendorItem = ({ item }: { item: Vendor }) => (
    <Card style={styles.itemCard}>
      <View style={styles.itemRow}>
        <View style={[styles.itemIcon, { backgroundColor: '#F3E5F5' }]}>
          <Ionicons name="storefront" size={24} color="#7B1FA2" />
        </View>
        <View style={styles.itemInfo}>
          <Text style={styles.itemName}>{item.name}</Text>
          {item.mobile && <Text style={styles.itemMeta}>{item.mobile}</Text>}
          {item.address && <Text style={styles.itemMeta}>{item.address}</Text>}
        </View>
        <View style={styles.itemActions}>
          <TouchableOpacity onPress={() => handleEdit(item)} style={styles.actionBtn}>
            <Ionicons name="pencil" size={18} color="#1976D2" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => handleDelete('vendors', item.id)} style={styles.actionBtn}>
            <Ionicons name="trash" size={18} color="#D32F2F" />
          </TouchableOpacity>
        </View>
      </View>
    </Card>
  );

  const renderCustomerItem = ({ item }: { item: Customer }) => (
    <Card style={styles.itemCard}>
      <View style={styles.itemRow}>
        <View style={[styles.itemIcon, { backgroundColor: '#E3F2FD' }]}>
          <Ionicons name="person" size={24} color="#1976D2" />
        </View>
        <View style={styles.itemInfo}>
          <Text style={styles.itemName}>{item.name}</Text>
          <Text style={styles.itemMeta}>{item.village || item.mobile || '-'}</Text>
        </View>
        {item.outstanding_dues > 0 && (
          <Text style={styles.dueAmount}>₹{item.outstanding_dues}</Text>
        )}
      </View>
    </Card>
  );

  const renderFarmerItem = ({ item }: { item: Farmer }) => (
    <Card style={styles.itemCard}>
      <View style={styles.itemRow}>
        <View style={[styles.itemIcon, { backgroundColor: '#E8F5E9' }]}>
          <Ionicons name="leaf" size={24} color="#2E7D32" />
        </View>
        <View style={styles.itemInfo}>
          <Text style={styles.itemName}>{item.name}</Text>
          <Text style={styles.itemMeta}>{item.village || item.mobile || '-'}</Text>
          <View style={styles.badgeRow}>
            {item.is_member && (
              <View style={[styles.badge, { backgroundColor: '#E8F5E9' }]}>
                <Text style={[styles.badgeText, { color: '#2E7D32' }]}>
                  {language === 'hi' ? 'सदस्य' : 'Member'}
                </Text>
              </View>
            )}
            {item.is_shareholder && (
              <View style={[styles.badge, { backgroundColor: '#FFF3E0' }]}>
                <Text style={[styles.badgeText, { color: '#F57C00' }]}>
                  {language === 'hi' ? 'शेयरधारक' : 'Shareholder'}
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </Card>
  );

  const getDataForTab = () => {
    switch (activeTab) {
      case 'outlets': return outlets;
      case 'products': return products;
      case 'vendors': return vendors;
      case 'customers': return customers;
      case 'farmers': return farmers;
      default: return [];
    }
  };

  const getRenderItem = () => {
    switch (activeTab) {
      case 'outlets': return renderOutletItem;
      case 'products': return renderProductItem;
      case 'vendors': return renderVendorItem;
      case 'customers': return renderCustomerItem;
      case 'farmers': return renderFarmerItem;
      default: return renderOutletItem;
    }
  };

  const renderModalContent = () => {
    switch (activeTab) {
      case 'outlets':
        return (
          <>
            <Text style={styles.label}>{language === 'hi' ? 'आउटलेट का नाम' : 'Outlet Name'} *</Text>
            <TextInput style={styles.input} value={outletName} onChangeText={setOutletName} placeholder={language === 'hi' ? 'नाम दर्ज करें' : 'Enter name'} />
            
            <Text style={styles.label}>{language === 'hi' ? 'पता' : 'Address'}</Text>
            <TextInput style={styles.input} value={outletAddress} onChangeText={setOutletAddress} placeholder={language === 'hi' ? 'पता दर्ज करें' : 'Enter address'} />
            
            <Text style={styles.label}>{language === 'hi' ? 'संपर्क व्यक्ति' : 'Contact Person'}</Text>
            <TextInput style={styles.input} value={outletContact} onChangeText={setOutletContact} placeholder={language === 'hi' ? 'नाम दर्ज करें' : 'Enter name'} />
            
            <Text style={styles.label}>{language === 'hi' ? 'मोबाइल' : 'Mobile'}</Text>
            <TextInput style={styles.input} value={outletMobile} onChangeText={setOutletMobile} keyboardType="phone-pad" placeholder={language === 'hi' ? 'मोबाइल नंबर' : 'Mobile number'} />
            
            <TouchableOpacity style={styles.checkboxRow} onPress={() => setIsCentral(!isCentral)}>
              <Ionicons name={isCentral ? 'checkbox' : 'square-outline'} size={24} color="#2E7D32" />
              <Text style={styles.checkboxLabel}>{language === 'hi' ? 'केंद्रीय आउटलेट' : 'Central Outlet'}</Text>
            </TouchableOpacity>
          </>
        );

      case 'products':
        return (
          <>
            <Text style={styles.label}>{language === 'hi' ? 'उत्पाद का नाम (English)' : 'Product Name (English)'} *</Text>
            <TextInput style={styles.input} value={productName} onChangeText={setProductName} placeholder="Enter product name" />
            
            <Text style={styles.label}>{language === 'hi' ? 'उत्पाद का नाम (हिंदी)' : 'Product Name (Hindi)'}</Text>
            <TextInput style={styles.input} value={productNameHi} onChangeText={setProductNameHi} placeholder="हिंदी में नाम" />
            
            <Text style={styles.label}>{language === 'hi' ? 'इकाई' : 'Unit'}</Text>
            <View style={styles.unitOptions}>
              {['kg', 'Litre', 'piece', 'pack'].map((unit) => (
                <TouchableOpacity
                  key={unit}
                  style={[styles.unitBtn, productUnit === unit && styles.unitBtnActive]}
                  onPress={() => setProductUnit(unit)}
                >
                  <Text style={[styles.unitText, productUnit === unit && styles.unitTextActive]}>{unit}</Text>
                </TouchableOpacity>
              ))}
            </View>
            
            <Text style={styles.label}>{language === 'hi' ? 'श्रेणी' : 'Category'}</Text>
            <View style={styles.unitOptions}>
              {[
                { id: 'produce', label: language === 'hi' ? 'उपज' : 'Produce' },
                { id: 'input', label: language === 'hi' ? 'इनपुट' : 'Input' },
              ].map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  style={[styles.unitBtn, productCategory === cat.id && styles.unitBtnActive]}
                  onPress={() => setProductCategory(cat.id)}
                >
                  <Text style={[styles.unitText, productCategory === cat.id && styles.unitTextActive]}>{cat.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        );

      case 'vendors':
        return (
          <>
            <Text style={styles.label}>{language === 'hi' ? 'विक्रेता का नाम' : 'Vendor Name'} *</Text>
            <TextInput style={styles.input} value={vendorName} onChangeText={setVendorName} placeholder={language === 'hi' ? 'नाम दर्ज करें' : 'Enter name'} />
            
            <Text style={styles.label}>{language === 'hi' ? 'मोबाइल' : 'Mobile'}</Text>
            <TextInput style={styles.input} value={vendorMobile} onChangeText={setVendorMobile} keyboardType="phone-pad" />
            
            <Text style={styles.label}>{language === 'hi' ? 'पता' : 'Address'}</Text>
            <TextInput style={styles.input} value={vendorAddress} onChangeText={setVendorAddress} />
          </>
        );

      case 'customers':
        return (
          <>
            <Text style={styles.label}>{language === 'hi' ? 'ग्राहक का नाम' : 'Customer Name'} *</Text>
            <TextInput style={styles.input} value={customerName} onChangeText={setCustomerName} placeholder={language === 'hi' ? 'नाम दर्ज करें' : 'Enter name'} />
            
            <Text style={styles.label}>{language === 'hi' ? 'मोबाइल' : 'Mobile'}</Text>
            <TextInput style={styles.input} value={customerMobile} onChangeText={setCustomerMobile} keyboardType="phone-pad" />
            
            <Text style={styles.label}>{language === 'hi' ? 'गाँव' : 'Village'}</Text>
            <TextInput style={styles.input} value={customerVillage} onChangeText={setCustomerVillage} />
          </>
        );

      case 'farmers':
        return (
          <>
            <Text style={styles.label}>{language === 'hi' ? 'किसान का नाम' : 'Farmer Name'} *</Text>
            <TextInput style={styles.input} value={farmerName} onChangeText={setFarmerName} placeholder={language === 'hi' ? 'नाम दर्ज करें' : 'Enter name'} />
            
            <Text style={styles.label}>{language === 'hi' ? 'मोबाइल' : 'Mobile'}</Text>
            <TextInput style={styles.input} value={farmerMobile} onChangeText={setFarmerMobile} keyboardType="phone-pad" />
            
            <Text style={styles.label}>{language === 'hi' ? 'गाँव' : 'Village'}</Text>
            <TextInput style={styles.input} value={farmerVillage} onChangeText={setFarmerVillage} />
            
            <TouchableOpacity style={styles.checkboxRow} onPress={() => setIsMember(!isMember)}>
              <Ionicons name={isMember ? 'checkbox' : 'square-outline'} size={24} color="#2E7D32" />
              <Text style={styles.checkboxLabel}>{language === 'hi' ? 'FPO सदस्य' : 'FPO Member'}</Text>
            </TouchableOpacity>
          </>
        );
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{language === 'hi' ? 'प्रबंधन' : 'Management'}</Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => {
            resetForm();
            setShowModal(true);
          }}
        >
          <Ionicons name="add" size={24} color="#FFF" />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsContainer}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.id}
            style={[styles.tab, activeTab === tab.id && styles.tabActive]}
            onPress={() => setActiveTab(tab.id as TabType)}
          >
            <Ionicons name={tab.icon as any} size={18} color={activeTab === tab.id ? '#FFF' : '#666'} />
            <Text style={[styles.tabText, activeTab === tab.id && styles.tabTextActive]}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* List */}
      <FlatList
        data={getDataForTab()}
        renderItem={getRenderItem() as any}
        keyExtractor={(item: any) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="folder-open-outline" size={64} color="#CCC" />
            <Text style={styles.emptyText}>
              {language === 'hi' ? 'कोई डेटा नहीं' : 'No data found'}
            </Text>
          </View>
        }
      />

      {/* Add/Edit Modal */}
      <Modal visible={showModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {editItem
                    ? (language === 'hi' ? 'संपादित करें' : 'Edit')
                    : (language === 'hi' ? 'नया जोड़ें' : 'Add New')}
                </Text>
                <TouchableOpacity onPress={() => { setShowModal(false); resetForm(); }}>
                  <Ionicons name="close" size={24} color="#666" />
                </TouchableOpacity>
              </View>

              {renderModalContent()}

              <Button
                title={editItem ? (language === 'hi' ? 'अपडेट करें' : 'Update') : (language === 'hi' ? 'जोड़ें' : 'Add')}
                onPress={handleSubmit}
                loading={submitting}
                style={styles.submitBtn}
              />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#333' },
  addBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#2E7D32', justifyContent: 'center', alignItems: 'center' },
  tabsContainer: { paddingHorizontal: 12, maxHeight: 50 },
  tab: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 16, marginHorizontal: 4, borderRadius: 20, backgroundColor: '#E8E8E8', gap: 6 },
  tabActive: { backgroundColor: '#2E7D32' },
  tabText: { fontSize: 13, fontWeight: '600', color: '#666' },
  tabTextActive: { color: '#FFF' },
  listContent: { padding: 16, paddingTop: 12 },
  itemCard: { marginBottom: 10 },
  itemRow: { flexDirection: 'row', alignItems: 'center' },
  itemIcon: { width: 44, height: 44, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 15, fontWeight: '600', color: '#333' },
  itemMeta: { fontSize: 13, color: '#666', marginTop: 2 },
  itemActions: { flexDirection: 'row', gap: 8 },
  actionBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F5F5F5', justifyContent: 'center', alignItems: 'center' },
  centralBadge: { alignSelf: 'flex-start', backgroundColor: '#E3F2FD', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, marginTop: 4 },
  centralText: { fontSize: 11, color: '#1976D2', fontWeight: '600' },
  dueAmount: { fontSize: 16, fontWeight: '700', color: '#D32F2F' },
  badgeRow: { flexDirection: 'row', gap: 6, marginTop: 4 },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  badgeText: { fontSize: 11, fontWeight: '600' },
  emptyState: { alignItems: 'center', paddingVertical: 48 },
  emptyText: { fontSize: 16, color: '#999', marginTop: 12 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#FFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#333' },
  label: { fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 6, marginTop: 12 },
  input: { borderWidth: 1, borderColor: '#DDD', borderRadius: 10, padding: 12, fontSize: 16, backgroundColor: '#F9F9F9' },
  unitOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  unitBtn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, borderWidth: 1, borderColor: '#DDD', backgroundColor: '#F9F9F9' },
  unitBtnActive: { backgroundColor: '#2E7D32', borderColor: '#2E7D32' },
  unitText: { fontSize: 14, color: '#666' },
  unitTextActive: { color: '#FFF' },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 16 },
  checkboxLabel: { fontSize: 15, color: '#333' },
  submitBtn: { marginTop: 24 },
});
