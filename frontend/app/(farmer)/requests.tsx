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
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useSettingsStore } from '../../src/store/settingsStore';
import { Card } from '../../src/components/Card';
import { Button } from '../../src/components/Button';
import api from '../../src/utils/api';

interface Product {
  id: string;
  name: string;
  name_hi?: string;
  unit: string;
}

interface Outlet {
  id: string;
  name: string;
  address?: string;
}

interface StockItem {
  product_id: string;
  product_name: string;
  product_unit: string;
  outlet_id: string;
  outlet_name: string;
  quantity: number;
}

interface ProductRequest {
  id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  request_type: 'buy' | 'sell';
  preferred_rate?: number;
  notes?: string;
  status: string;
  outlet_id?: string;
  outlet_name?: string;
  created_at: string;
  cancel_reason?: string;
  admin_remark?: string;
}

export default function RequestsScreen() {
  const [requests, setRequests] = useState<ProductRequest[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [stock, setStock] = useState<StockItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showStockModal, setShowStockModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const language = useSettingsStore((state) => state.language);

  // Form state
  const [requestType, setRequestType] = useState<'buy' | 'sell'>('sell');
  const [selectedProduct, setSelectedProduct] = useState<string>('');
  const [selectedOutlet, setSelectedOutlet] = useState<string>('');
  const [quantity, setQuantity] = useState('');
  const [rate, setRate] = useState('');
  const [notes, setNotes] = useState('');
  const [customProduct, setCustomProduct] = useState('');
  const [isCustomProduct, setIsCustomProduct] = useState(false);
  const [outletSearch, setOutletSearch] = useState('');

  // Filtered outlets based on search
  const filteredOutlets = React.useMemo(() => {
    if (!outletSearch.trim()) return outlets;
    const query = outletSearch.toLowerCase();
    return outlets.filter(o => 
      o.name.toLowerCase().includes(query) ||
      o.address?.toLowerCase().includes(query)
    );
  }, [outlets, outletSearch]);

  const fetchData = async () => {
    try {
      const [reqRes, prodRes, outletRes, stockRes] = await Promise.all([
        api.get('/product-requests'),
        api.get('/products'),
        api.get('/outlets'),
        api.get('/stock'),
      ]);
      setRequests(reqRes.data);
      setProducts(prodRes.data);
      setOutlets(outletRes.data);
      setStock(stockRes.data);
      if (outletRes.data.length > 0) {
        setSelectedOutlet(outletRes.data[0].id);
      }
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

  // Filter products by search query
  const filteredProducts = products.filter(p => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return p.name.toLowerCase().includes(query) || 
           (p.name_hi && p.name_hi.includes(searchQuery));
  });

  // Get stock for selected outlet
  const outletStock = stock.filter(s => s.outlet_id === selectedOutlet);

  const handleSubmit = async () => {
    if (!selectedOutlet) {
      Alert.alert(
        language === 'hi' ? 'त्रुटि' : 'Error',
        language === 'hi' ? 'कृपया आउटलेट चुनें' : 'Please select an outlet'
      );
      return;
    }

    if (requestType === 'buy' && !selectedProduct) {
      Alert.alert(
        language === 'hi' ? 'त्रुटि' : 'Error',
        language === 'hi' ? 'कृपया उत्पाद चुनें' : 'Please select a product'
      );
      return;
    }

    if (requestType === 'sell' && !selectedProduct && !customProduct.trim()) {
      Alert.alert(
        language === 'hi' ? 'त्रुटि' : 'Error',
        language === 'hi' ? 'कृपया उत्पाद चुनें या नाम दर्ज करें' : 'Please select a product or enter custom name'
      );
      return;
    }

    if (!quantity) {
      Alert.alert(
        language === 'hi' ? 'त्रुटि' : 'Error',
        language === 'hi' ? 'कृपया मात्रा दर्ज करें' : 'Please enter quantity'
      );
      return;
    }

    setLoading(true);
    try {
      const payload: any = {
        quantity: parseFloat(quantity),
        request_type: requestType,
        preferred_rate: rate ? parseFloat(rate) : null,
        notes: notes || null,
        outlet_id: selectedOutlet,
      };

      if (isCustomProduct && customProduct.trim()) {
        payload.custom_product_name = customProduct.trim();
        payload.product_id = 'custom';
      } else {
        payload.product_id = selectedProduct;
      }

      await api.post('/product-requests', payload);

      Alert.alert(
        language === 'hi' ? 'सफल' : 'Success',
        language === 'hi' 
          ? 'अनुरोध सफलतापूर्वक जमा किया गया। संबंधित एजेंट और एडमिन को सूचित कर दिया गया है।' 
          : 'Request submitted successfully. The relevant agent and admin have been notified.'
      );

      setShowModal(false);
      resetForm();
      fetchData();
    } catch (error: any) {
      Alert.alert(
        language === 'hi' ? 'त्रुटि' : 'Error',
        error.response?.data?.detail || (language === 'hi' ? 'अनुरोध विफल' : 'Request failed')
      );
    } finally {
      setLoading(false);
    }
  };

  const handleCancelRequest = (requestId: string) => {
    Alert.alert(
      language === 'hi' ? 'अनुरोध रद्द करें?' : 'Cancel Request?',
      language === 'hi' ? 'क्या आप इस अनुरोध को रद्द करना चाहते हैं?' : 'Are you sure you want to cancel this request?',
      [
        { text: language === 'hi' ? 'नहीं' : 'No', style: 'cancel' },
        {
          text: language === 'hi' ? 'हां, रद्द करें' : 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.put(`/product-requests/${requestId}`, {
                status: 'cancelled',
                cancel_reason: 'Cancelled by farmer',
              });
              Alert.alert(
                language === 'hi' ? 'सफल' : 'Success',
                language === 'hi' ? 'अनुरोध रद्द कर दिया गया' : 'Request cancelled'
              );
              fetchData();
            } catch (error: any) {
              Alert.alert(
                language === 'hi' ? 'त्रुटि' : 'Error',
                error.response?.data?.detail || 'Failed to cancel'
              );
            }
          },
        },
      ]
    );
  };

  const resetForm = () => {
    setSelectedProduct('');
    setSelectedOutlet('');
    setQuantity('');
    setRate('');
    setNotes('');
    setCustomProduct('');
    setIsCustomProduct(false);
    setSearchQuery('');
    setOutletSearch('');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return '#2E7D32';
      case 'rejected': return '#D32F2F';
      case 'completed': return '#1976D2';
      case 'cancelled': return '#757575';
      default: return '#F57C00';
    }
  };

  const getStatusText = (status: string) => {
    const statusMap: Record<string, { en: string; hi: string }> = {
      pending: { en: 'Pending', hi: 'लंबित' },
      approved: { en: 'Approved', hi: 'स्वीकृत' },
      rejected: { en: 'Rejected', hi: 'अस्वीकृत' },
      completed: { en: 'Completed', hi: 'पूर्ण' },
      cancelled: { en: 'Cancelled', hi: 'रद्द' },
    };
    return statusMap[status]?.[language] || status;
  };

  const renderRequest = ({ item }: { item: ProductRequest }) => (
    <Card style={styles.requestCard}>
      <View style={styles.requestHeader}>
        <View style={[styles.typeIcon, { backgroundColor: item.request_type === 'sell' ? '#E8F5E9' : '#E3F2FD' }]}>
          <Ionicons
            name={item.request_type === 'sell' ? 'arrow-up' : 'arrow-down'}
            size={20}
            color={item.request_type === 'sell' ? '#2E7D32' : '#1976D2'}
          />
        </View>
        <View style={styles.requestInfo}>
          <Text style={styles.productName}>{item.product_name}</Text>
          <Text style={styles.requestMeta}>
            {item.request_type === 'sell'
              ? (language === 'hi' ? 'बेचना' : 'Sell')
              : (language === 'hi' ? 'खरीदना' : 'Buy')}
            {' - '}{item.quantity} kg
          </Text>
          {item.outlet_name && (
            <Text style={styles.outletText}>
              <Ionicons name="location-outline" size={12} color="#666" /> {item.outlet_name}
            </Text>
          )}
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
          <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
            {getStatusText(item.status)}
          </Text>
        </View>
      </View>
      {item.preferred_rate && (
        <Text style={styles.rateText}>
          {language === 'hi' ? 'प्रस्तावित दर' : 'Proposed Rate'}: ₹{item.preferred_rate}/kg
        </Text>
      )}
      {item.admin_remark && (
        <Text style={styles.remarkText}>
          {language === 'hi' ? 'टिप्पणी' : 'Remark'}: {item.admin_remark}
        </Text>
      )}
      <View style={styles.requestFooter}>
        <Text style={styles.dateText}>
          {new Date(item.created_at).toLocaleDateString()}
        </Text>
        {item.status === 'pending' && (
          <TouchableOpacity 
            style={styles.cancelBtn}
            onPress={() => handleCancelRequest(item.id)}
          >
            <Ionicons name="close-circle-outline" size={16} color="#D32F2F" />
            <Text style={styles.cancelText}>
              {language === 'hi' ? 'रद्द करें' : 'Cancel'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </Card>
  );

  const renderStockItem = ({ item }: { item: StockItem }) => (
    <Card style={styles.stockCard}>
      <View style={styles.stockRow}>
        <Text style={styles.stockProduct}>{item.product_name}</Text>
        <Text style={[styles.stockQty, item.quantity < 10 && { color: '#D32F2F' }]}>
          {item.quantity} {item.product_unit}
        </Text>
      </View>
      <Text style={styles.stockOutlet}>{item.outlet_name}</Text>
    </Card>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>
          {language === 'hi' ? 'मेरे अनुरोध' : 'My Requests'}
        </Text>
        <View style={styles.headerButtons}>
          <TouchableOpacity
            style={styles.stockBtn}
            onPress={() => setShowStockModal(true)}
          >
            <Ionicons name="cube-outline" size={24} color="#1976D2" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => setShowModal(true)}
          >
            <Ionicons name="add" size={24} color="#FFF" />
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={requests}
        renderItem={renderRequest}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="document-text-outline" size={64} color="#CCC" />
            <Text style={styles.emptyText}>
              {language === 'hi' ? 'कोई अनुरोध नहीं' : 'No requests yet'}
            </Text>
            <Text style={styles.emptySubtext}>
              {language === 'hi'
                ? 'नया अनुरोध बनाने के लिए + बटन दबाएं'
                : 'Tap + button to create a new request'}
            </Text>
          </View>
        }
      />

      {/* View Stock Modal */}
      <Modal visible={showStockModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '80%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {language === 'hi' ? 'आउटलेट स्टॉक देखें' : 'View Outlet Stock'}
              </Text>
              <TouchableOpacity onPress={() => setShowStockModal(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>
              {language === 'hi' ? 'आउटलेट चुनें' : 'Select Outlet'}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.outletScroll}>
              {outlets.map((outlet) => (
                <TouchableOpacity
                  key={outlet.id}
                  style={[
                    styles.outletChip,
                    selectedOutlet === outlet.id && styles.outletChipActive,
                  ]}
                  onPress={() => setSelectedOutlet(outlet.id)}
                >
                  <Text
                    style={[
                      styles.outletChipText,
                      selectedOutlet === outlet.id && styles.outletChipTextActive,
                    ]}
                  >
                    {outlet.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <FlatList
              data={outletStock}
              renderItem={renderStockItem}
              keyExtractor={(item) => `${item.product_id}-${item.outlet_id}`}
              ListEmptyComponent={
                <View style={styles.emptyStock}>
                  <Ionicons name="cube-outline" size={40} color="#CCC" />
                  <Text style={styles.emptyStockText}>
                    {language === 'hi' ? 'इस आउटलेट में कोई स्टॉक नहीं' : 'No stock in this outlet'}
                  </Text>
                </View>
              }
            />
          </View>
        </View>
      </Modal>

      {/* New Request Modal */}
      <Modal visible={showModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={styles.modalScrollContent}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {language === 'hi' ? 'नया अनुरोध' : 'New Request'}
                </Text>
                <TouchableOpacity onPress={() => { setShowModal(false); resetForm(); }}>
                  <Ionicons name="close" size={24} color="#666" />
                </TouchableOpacity>
              </View>

              {/* Request Type */}
              <Text style={styles.label}>
                {language === 'hi' ? 'अनुरोध प्रकार' : 'Request Type'}
              </Text>
              <View style={styles.typeToggle}>
                <TouchableOpacity
                  style={[styles.typeBtn, requestType === 'sell' && styles.typeBtnActive]}
                  onPress={() => { setRequestType('sell'); setIsCustomProduct(false); }}
                >
                  <Ionicons
                    name="arrow-up-circle"
                    size={20}
                    color={requestType === 'sell' ? '#FFF' : '#2E7D32'}
                  />
                  <Text style={[styles.typeText, requestType === 'sell' && styles.typeTextActive]}>
                    {language === 'hi' ? 'बेचना' : 'Sell'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.typeBtn, requestType === 'buy' && styles.typeBtnActiveBuy]}
                  onPress={() => { setRequestType('buy'); setIsCustomProduct(false); }}
                >
                  <Ionicons
                    name="arrow-down-circle"
                    size={20}
                    color={requestType === 'buy' ? '#FFF' : '#1976D2'}
                  />
                  <Text style={[styles.typeText, requestType === 'buy' && styles.typeTextActive]}>
                    {language === 'hi' ? 'खरीदना' : 'Buy'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Outlet Selection */}
              <Text style={styles.label}>
                {language === 'hi' ? 'आउटलेट चुनें' : 'Select Outlet'} *
              </Text>
              <TextInput
                style={[styles.input, { marginBottom: 8 }]}
                placeholder={language === 'hi' ? 'आउटलेट खोजें...' : 'Search outlets...'}
                value={outletSearch}
                onChangeText={setOutletSearch}
              />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.outletScroll}>
                {filteredOutlets.map((outlet) => (
                  <TouchableOpacity
                    key={outlet.id}
                    style={[
                      styles.outletChip,
                      selectedOutlet === outlet.id && styles.outletChipActive,
                    ]}
                    onPress={() => setSelectedOutlet(outlet.id)}
                  >
                    <Text
                      style={[
                        styles.outletChipText,
                        selectedOutlet === outlet.id && styles.outletChipTextActive,
                      ]}
                    >
                      {outlet.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Product Selection */}
              <View style={styles.productHeader}>
                <Text style={styles.label}>
                  {language === 'hi' ? 'उत्पाद चुनें' : 'Select Product'} *
                </Text>
                {requestType === 'sell' && (
                  <TouchableOpacity 
                    style={styles.customToggle}
                    onPress={() => setIsCustomProduct(!isCustomProduct)}
                  >
                    <Ionicons 
                      name={isCustomProduct ? 'checkbox' : 'square-outline'} 
                      size={18} 
                      color="#2E7D32" 
                    />
                    <Text style={styles.customToggleText}>
                      {language === 'hi' ? 'कस्टम उत्पाद' : 'Custom Product'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              {isCustomProduct ? (
                <TextInput
                  style={styles.input}
                  placeholder={language === 'hi' ? 'उत्पाद का नाम दर्ज करें' : 'Enter product name'}
                  value={customProduct}
                  onChangeText={setCustomProduct}
                />
              ) : (
                <>
                  <TextInput
                    style={styles.searchInput}
                    placeholder={language === 'hi' ? 'उत्पाद खोजें...' : 'Search products...'}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                  />
                  <View style={styles.productGrid}>
                    {filteredProducts.map((product) => (
                      <TouchableOpacity
                        key={product.id}
                        style={[
                          styles.productOption,
                          selectedProduct === product.id && styles.productOptionActive,
                        ]}
                        onPress={() => setSelectedProduct(product.id)}
                      >
                        <Text
                          style={[
                            styles.productOptionText,
                            selectedProduct === product.id && styles.productOptionTextActive,
                          ]}
                          numberOfLines={2}
                        >
                          {language === 'hi' && product.name_hi ? product.name_hi : product.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}

              {/* Quantity */}
              <Text style={styles.label}>
                {language === 'hi' ? 'मात्रा (kg)' : 'Quantity (kg)'} *
              </Text>
              <TextInput
                style={styles.input}
                placeholder={language === 'hi' ? 'मात्रा दर्ज करें' : 'Enter quantity'}
                value={quantity}
                onChangeText={setQuantity}
                keyboardType="numeric"
              />

              {/* Rate */}
              <Text style={styles.label}>
                {language === 'hi' ? 'प्रस्तावित दर (₹/kg)' : 'Proposed Rate (₹/kg)'}
              </Text>
              <TextInput
                style={styles.input}
                placeholder={language === 'hi' ? 'दर दर्ज करें (वैकल्पिक)' : 'Enter rate (optional)'}
                value={rate}
                onChangeText={setRate}
                keyboardType="numeric"
              />

              {/* Notes */}
              <Text style={styles.label}>
                {language === 'hi' ? 'टिप्पणी' : 'Notes'}
              </Text>
              <TextInput
                style={[styles.input, styles.notesInput]}
                placeholder={language === 'hi' ? 'अतिरिक्त जानकारी...' : 'Additional information...'}
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={3}
              />

              <Button
                title={language === 'hi' ? 'अनुरोध जमा करें' : 'Submit Request'}
                onPress={handleSubmit}
                loading={loading}
                style={styles.submitBtn}
              />
            </View>
          </ScrollView>
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
  headerButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  stockBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#2E7D32',
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 16,
    paddingTop: 0,
  },
  requestCard: {
    marginBottom: 12,
  },
  requestHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  typeIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  requestInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  requestMeta: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  outletText: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
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
  rateText: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
  },
  remarkText: {
    fontSize: 13,
    color: '#1976D2',
    marginTop: 4,
    fontStyle: 'italic',
  },
  requestFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  dateText: {
    fontSize: 12,
    color: '#999',
  },
  cancelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cancelText: {
    fontSize: 12,
    color: '#D32F2F',
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
  emptySubtext: {
    fontSize: 14,
    color: '#BBB',
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalScrollContent: {
    flexGrow: 1,
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
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    marginTop: 12,
  },
  typeToggle: {
    flexDirection: 'row',
    gap: 12,
  },
  typeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#2E7D32',
    backgroundColor: '#FFF',
  },
  typeBtnActive: {
    backgroundColor: '#2E7D32',
  },
  typeBtnActiveBuy: {
    backgroundColor: '#1976D2',
    borderColor: '#1976D2',
  },
  typeText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  typeTextActive: {
    color: '#FFF',
  },
  outletScroll: {
    marginBottom: 8,
  },
  outletChip: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DDD',
    backgroundColor: '#F9F9F9',
    marginRight: 8,
  },
  outletChipActive: {
    backgroundColor: '#2E7D32',
    borderColor: '#2E7D32',
  },
  outletChipText: {
    fontSize: 14,
    color: '#333',
  },
  outletChipTextActive: {
    color: '#FFF',
    fontWeight: '600',
  },
  productHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  customToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  customToggleText: {
    fontSize: 13,
    color: '#2E7D32',
  },
  searchInput: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    backgroundColor: '#F9F9F9',
    marginBottom: 10,
  },
  productGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  productOption: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DDD',
    backgroundColor: '#F9F9F9',
  },
  productOptionActive: {
    backgroundColor: '#2E7D32',
    borderColor: '#2E7D32',
  },
  productOptionText: {
    fontSize: 13,
    color: '#333',
  },
  productOptionTextActive: {
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
  notesInput: {
    height: 80,
    textAlignVertical: 'top',
  },
  submitBtn: {
    marginTop: 20,
  },
  // Stock modal styles
  stockCard: {
    marginBottom: 8,
    padding: 12,
  },
  stockRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stockProduct: {
    fontSize: 15,
    fontWeight: '500',
    color: '#333',
  },
  stockQty: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2E7D32',
  },
  stockOutlet: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  emptyStock: {
    alignItems: 'center',
    padding: 40,
  },
  emptyStockText: {
    color: '#999',
    marginTop: 12,
  },
});
