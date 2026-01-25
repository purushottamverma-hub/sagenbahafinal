import React, { useEffect, useState, useMemo } from 'react';
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
import { Input } from '../../src/components/Input';
import api from '../../src/utils/api';

interface Farmer {
  id: string;
  name: string;
  mobile?: string;
  village?: string;
}

interface Vendor {
  id: string;
  name: string;
  mobile?: string;
  address?: string;
}

interface Product {
  id: string;
  name: string;
  name_hi?: string;
  unit: string;
}

interface Outlet {
  id: string;
  name: string;
}

interface Purchase {
  id: string;
  source_type: string;
  source_name: string;
  product_name: string;
  outlet_name: string;
  quantity: number;
  rate: number;
  total_amount: number;
  payment_status: string;
  receipt_number: string;
  created_at: string;
}

export default function PurchaseScreen() {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const language = useSettingsStore((state) => state.language);

  // Search states
  const [sourceSearch, setSourceSearch] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [outletSearch, setOutletSearch] = useState('');

  // Form state
  const [sourceType, setSourceType] = useState<'farmer' | 'vendor'>('farmer');
  const [selectedSource, setSelectedSource] = useState('');
  const [selectedProduct, setSelectedProduct] = useState('');
  const [selectedOutlet, setSelectedOutlet] = useState('');
  const [quantity, setQuantity] = useState('');
  const [rate, setRate] = useState('');
  const [paymentMode, setPaymentMode] = useState<'cash' | 'online' | 'credit' | 'partial'>('cash');
  const [cashAmount, setCashAmount] = useState('');
  const [onlineAmount, setOnlineAmount] = useState('');
  const [notes, setNotes] = useState('');

  // Manual entry states
  const [useManualSource, setUseManualSource] = useState(false);
  const [manualSourceName, setManualSourceName] = useState('');
  const [manualSourceMobile, setManualSourceMobile] = useState('');
  const [useManualProduct, setUseManualProduct] = useState(false);
  const [manualProductName, setManualProductName] = useState('');
  const [manualProductUnit, setManualProductUnit] = useState('kg');

  const fetchData = async () => {
    try {
      const [farmerPurchaseRes, vendorPurchaseRes, farmerRes, vendorRes, productRes, outletRes] = await Promise.all([
        api.get('/farmer-purchases'),
        api.get('/vendor-procurement'),
        api.get('/farmers'),
        api.get('/vendors'),
        api.get('/products'),
        api.get('/outlets'),
      ]);
      
      // Combine and format purchases
      const allPurchases: Purchase[] = [
        ...farmerPurchaseRes.data.map((p: any) => ({
          ...p,
          source_type: 'farmer',
          source_name: p.farmer_name,
          outlet_name: p.outlet_name || 'N/A',
        })),
        ...vendorPurchaseRes.data.map((p: any) => ({
          ...p,
          source_type: 'vendor',
          source_name: p.vendor_name,
        })),
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      
      setPurchases(allPurchases);
      setFarmers(farmerRes.data);
      setVendors(vendorRes.data);
      setProducts(productRes.data);
      setOutlets(outletRes.data);
      
      // Set defaults
      if (outletRes.data.length > 0) setSelectedOutlet(outletRes.data[0].id);
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

  // Filtered lists based on search
  const filteredSources = useMemo(() => {
    const sources = sourceType === 'farmer' ? farmers : vendors;
    if (!sourceSearch.trim()) return sources;
    const query = sourceSearch.toLowerCase();
    return sources.filter(s => 
      s.name.toLowerCase().includes(query) || 
      (s.mobile && s.mobile.includes(query))
    );
  }, [sourceType, farmers, vendors, sourceSearch]);

  const filteredProducts = useMemo(() => {
    if (!productSearch.trim()) return products;
    const query = productSearch.toLowerCase();
    return products.filter(p => 
      p.name.toLowerCase().includes(query) || 
      (p.name_hi && p.name_hi.includes(productSearch))
    );
  }, [products, productSearch]);

  const filteredOutlets = useMemo(() => {
    if (!outletSearch.trim()) return outlets;
    const query = outletSearch.toLowerCase();
    return outlets.filter(o => o.name.toLowerCase().includes(query));
  }, [outlets, outletSearch]);

  const totalAmount = parseFloat(quantity || '0') * parseFloat(rate || '0');

  const calculateAmounts = () => {
    const total = totalAmount;
    const cash = parseFloat(cashAmount || '0');
    const online = parseFloat(onlineAmount || '0');
    
    switch (paymentMode) {
      case 'cash':
        return { cash: total, online: 0, credit: 0 };
      case 'online':
        return { cash: 0, online: total, credit: 0 };
      case 'credit':
        return { cash: 0, online: 0, credit: total };
      case 'partial':
        return { cash, online, credit: Math.max(0, total - cash - online) };
    }
  };

  const handleSubmit = async () => {
    if (!selectedSource || !selectedProduct || !selectedOutlet || !quantity || !rate) {
      Alert.alert(
        language === 'hi' ? 'त्रुटि' : 'Error',
        language === 'hi' ? 'सभी आवश्यक फील्ड भरें' : 'Please fill all required fields'
      );
      return;
    }

    const amounts = calculateAmounts();
    setLoading(true);

    try {
      if (sourceType === 'farmer') {
        // Farmer purchase
        await api.post('/farmer-purchases', {
          farmer_id: selectedSource,
          product_id: selectedProduct,
          quantity: parseFloat(quantity),
          rate: parseFloat(rate),
          payment_status: paymentMode === 'credit' ? 'credit' : 'paid',
          outlet_id: selectedOutlet,
        });
      } else {
        // Vendor procurement
        await api.post('/vendor-procurement', {
          vendor_id: selectedSource,
          product_id: selectedProduct,
          outlet_id: selectedOutlet,
          quantity: parseFloat(quantity),
          rate: parseFloat(rate),
          payment_mode: paymentMode,
          cash_amount: amounts.cash,
          online_amount: amounts.online,
          notes: notes || null,
        });
      }

      Alert.alert(
        language === 'hi' ? 'सफल' : 'Success',
        language === 'hi' ? 'खरीद दर्ज हो गई' : 'Purchase recorded successfully'
      );

      setShowModal(false);
      resetForm();
      fetchData();
    } catch (error: any) {
      Alert.alert(
        language === 'hi' ? 'त्रुटि' : 'Error',
        error.response?.data?.detail || (language === 'hi' ? 'खरीद दर्ज करने में विफल' : 'Failed to record purchase')
      );
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setSelectedSource('');
    setSelectedProduct('');
    setQuantity('');
    setRate('');
    setPaymentMode('cash');
    setCashAmount('');
    setOnlineAmount('');
    setNotes('');
    setSourceSearch('');
    setProductSearch('');
    setOutletSearch('');
  };

  const renderPurchase = ({ item }: { item: Purchase }) => (
    <Card style={styles.purchaseCard}>
      <View style={styles.purchaseHeader}>
        <View style={styles.sourceInfo}>
          <View style={[
            styles.sourceIcon,
            { backgroundColor: item.source_type === 'farmer' ? '#E8F5E9' : '#F3E5F5' }
          ]}>
            <Ionicons
              name={item.source_type === 'farmer' ? 'leaf' : 'storefront'}
              size={20}
              color={item.source_type === 'farmer' ? '#2E7D32' : '#7B1FA2'}
            />
          </View>
          <View>
            <Text style={styles.sourceName}>{item.source_name}</Text>
            <Text style={styles.sourceType}>
              {item.source_type === 'farmer' 
                ? (language === 'hi' ? 'किसान' : 'Farmer')
                : (language === 'hi' ? 'विक्रेता' : 'Vendor')
              }
            </Text>
          </View>
        </View>
        <View style={[
          styles.statusBadge,
          { backgroundColor: item.payment_status === 'paid' ? '#E8F5E9' : '#FFF3E0' }
        ]}>
          <Text style={[
            styles.statusText,
            { color: item.payment_status === 'paid' ? '#2E7D32' : '#F57C00' }
          ]}>
            {item.payment_status === 'paid' 
              ? (language === 'hi' ? 'भुगतान' : 'Paid')
              : (language === 'hi' ? 'उधार' : 'Credit')
            }
          </Text>
        </View>
      </View>

      <View style={styles.purchaseDetails}>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>{language === 'hi' ? 'उत्पाद' : 'Product'}</Text>
          <Text style={styles.detailValue}>{item.product_name}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>{language === 'hi' ? 'मात्रा' : 'Qty'}</Text>
          <Text style={styles.detailValue}>{item.quantity}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>{language === 'hi' ? 'दर' : 'Rate'}</Text>
          <Text style={styles.detailValue}>₹{item.rate}</Text>
        </View>
        {item.outlet_name && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>{language === 'hi' ? 'आउटलेट' : 'Outlet'}</Text>
            <Text style={styles.detailValue}>{item.outlet_name}</Text>
          </View>
        )}
      </View>

      <View style={styles.purchaseFooter}>
        <Text style={styles.receiptNum}>{item.receipt_number}</Text>
        <Text style={styles.totalAmount}>₹{item.total_amount?.toFixed(2) || '0.00'}</Text>
      </View>
    </Card>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>
            {language === 'hi' ? 'खरीद' : 'Procurement'}
          </Text>
          <Text style={styles.subtitle}>
            {language === 'hi' ? 'किसान और विक्रेता से खरीद' : 'From Farmers & Vendors'}
          </Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowModal(true)}>
          <Ionicons name="add" size={24} color="#FFF" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={purchases}
        renderItem={renderPurchase}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#2E7D32']} />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="basket-outline" size={64} color="#CCC" />
            <Text style={styles.emptyText}>
              {language === 'hi' ? 'कोई खरीद नहीं' : 'No purchases yet'}
            </Text>
          </View>
        }
      />

      {/* New Purchase Modal */}
      <Modal visible={showModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={styles.modalScrollContent}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {language === 'hi' ? 'नई खरीद' : 'New Purchase'}
                </Text>
                <TouchableOpacity onPress={() => { setShowModal(false); resetForm(); }}>
                  <Ionicons name="close" size={24} color="#666" />
                </TouchableOpacity>
              </View>

              {/* Source Type Toggle */}
              <Text style={styles.label}>
                {language === 'hi' ? 'खरीद स्रोत' : 'Purchase From'} *
              </Text>
              <View style={styles.sourceToggle}>
                <TouchableOpacity
                  style={[styles.sourceBtn, sourceType === 'farmer' && styles.sourceBtnActive]}
                  onPress={() => { setSourceType('farmer'); setSelectedSource(''); setSourceSearch(''); }}
                >
                  <Ionicons name="leaf" size={20} color={sourceType === 'farmer' ? '#FFF' : '#2E7D32'} />
                  <Text style={[styles.sourceBtnText, sourceType === 'farmer' && styles.sourceBtnTextActive]}>
                    {language === 'hi' ? 'किसान' : 'Farmer'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.sourceBtn, styles.vendorBtn, sourceType === 'vendor' && styles.vendorBtnActive]}
                  onPress={() => { setSourceType('vendor'); setSelectedSource(''); setSourceSearch(''); }}
                >
                  <Ionicons name="storefront" size={20} color={sourceType === 'vendor' ? '#FFF' : '#7B1FA2'} />
                  <Text style={[styles.sourceBtnText, sourceType === 'vendor' && styles.sourceBtnTextActive]}>
                    {language === 'hi' ? 'विक्रेता' : 'Vendor'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Source Search & Selection */}
              <Text style={styles.label}>
                {sourceType === 'farmer' 
                  ? (language === 'hi' ? 'किसान चुनें' : 'Select Farmer')
                  : (language === 'hi' ? 'विक्रेता चुनें' : 'Select Vendor')
                } *
              </Text>
              <View style={styles.searchBox}>
                <Ionicons name="search" size={18} color="#999" />
                <TextInput
                  style={styles.searchInput}
                  placeholder={language === 'hi' ? 'नाम या मोबाइल से खोजें...' : 'Search by name or mobile...'}
                  value={sourceSearch}
                  onChangeText={setSourceSearch}
                  placeholderTextColor="#999"
                />
                {sourceSearch.length > 0 && (
                  <TouchableOpacity onPress={() => setSourceSearch('')}>
                    <Ionicons name="close-circle" size={18} color="#999" />
                  </TouchableOpacity>
                )}
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.selectScroll}>
                {filteredSources.map((s) => (
                  <TouchableOpacity
                    key={s.id}
                    style={[
                      styles.selectChip,
                      selectedSource === s.id && (sourceType === 'farmer' ? styles.farmerChipActive : styles.vendorChipActive)
                    ]}
                    onPress={() => setSelectedSource(s.id)}
                  >
                    <Text style={[
                      styles.selectText,
                      selectedSource === s.id && styles.selectTextActive
                    ]}>
                      {s.name}
                    </Text>
                    {s.mobile && (
                      <Text style={[
                        styles.selectSubtext,
                        selectedSource === s.id && styles.selectTextActive
                      ]}>
                        {s.mobile}
                      </Text>
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Product Search & Selection */}
              <Text style={styles.label}>
                {language === 'hi' ? 'उत्पाद चुनें' : 'Select Product'} *
              </Text>
              <View style={styles.searchBox}>
                <Ionicons name="search" size={18} color="#999" />
                <TextInput
                  style={styles.searchInput}
                  placeholder={language === 'hi' ? 'उत्पाद खोजें...' : 'Search products...'}
                  value={productSearch}
                  onChangeText={setProductSearch}
                  placeholderTextColor="#999"
                />
                {productSearch.length > 0 && (
                  <TouchableOpacity onPress={() => setProductSearch('')}>
                    <Ionicons name="close-circle" size={18} color="#999" />
                  </TouchableOpacity>
                )}
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.selectScroll}>
                {filteredProducts.map((p) => (
                  <TouchableOpacity
                    key={p.id}
                    style={[styles.selectChip, selectedProduct === p.id && styles.productChipActive]}
                    onPress={() => setSelectedProduct(p.id)}
                  >
                    <Text style={[styles.selectText, selectedProduct === p.id && styles.selectTextActive]}>
                      {language === 'hi' && p.name_hi ? p.name_hi : p.name}
                    </Text>
                    <Text style={[styles.selectSubtext, selectedProduct === p.id && styles.selectTextActive]}>
                      {p.unit}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Outlet Search & Selection */}
              <Text style={styles.label}>
                {language === 'hi' ? 'आउटलेट (स्टॉक यहां जाएगा)' : 'Outlet (stock goes here)'} *
              </Text>
              <View style={styles.searchBox}>
                <Ionicons name="search" size={18} color="#999" />
                <TextInput
                  style={styles.searchInput}
                  placeholder={language === 'hi' ? 'आउटलेट खोजें...' : 'Search outlets...'}
                  value={outletSearch}
                  onChangeText={setOutletSearch}
                  placeholderTextColor="#999"
                />
                {outletSearch.length > 0 && (
                  <TouchableOpacity onPress={() => setOutletSearch('')}>
                    <Ionicons name="close-circle" size={18} color="#999" />
                  </TouchableOpacity>
                )}
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.selectScroll}>
                {filteredOutlets.map((o) => (
                  <TouchableOpacity
                    key={o.id}
                    style={[styles.selectChip, selectedOutlet === o.id && styles.outletChipActive]}
                    onPress={() => setSelectedOutlet(o.id)}
                  >
                    <Text style={[styles.selectText, selectedOutlet === o.id && styles.selectTextActive]}>
                      {o.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Quantity & Rate */}
              <View style={styles.row}>
                <View style={styles.halfInput}>
                  <Input
                    label={`${language === 'hi' ? 'मात्रा' : 'Quantity'} *`}
                    placeholder="0"
                    value={quantity}
                    onChangeText={setQuantity}
                    keyboardType="decimal-pad"
                  />
                </View>
                <View style={styles.halfInput}>
                  <Input
                    label={`${language === 'hi' ? 'दर (₹)' : 'Rate (₹)'} *`}
                    placeholder="0"
                    value={rate}
                    onChangeText={setRate}
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>

              {/* Total Display */}
              <View style={styles.totalDisplay}>
                <Text style={styles.totalDisplayLabel}>
                  {language === 'hi' ? 'कुल राशि' : 'Total Amount'}
                </Text>
                <Text style={styles.totalDisplayValue}>₹{totalAmount.toFixed(2)}</Text>
              </View>

              {/* Payment Mode */}
              <Text style={styles.label}>
                {language === 'hi' ? 'भुगतान मोड' : 'Payment Mode'}
              </Text>
              <View style={styles.paymentModes}>
                {[
                  { id: 'cash', label: language === 'hi' ? 'नकद' : 'Cash' },
                  { id: 'online', label: language === 'hi' ? 'ऑनलाइन' : 'Online' },
                  { id: 'credit', label: language === 'hi' ? 'उधार' : 'Credit' },
                  { id: 'partial', label: language === 'hi' ? 'आंशिक' : 'Partial' },
                ].map((mode) => (
                  <TouchableOpacity
                    key={mode.id}
                    style={[styles.modeBtn, paymentMode === mode.id && styles.modeBtnActive]}
                    onPress={() => setPaymentMode(mode.id as any)}
                  >
                    <Text style={[styles.modeText, paymentMode === mode.id && styles.modeTextActive]}>
                      {mode.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {paymentMode === 'partial' && (
                <View style={styles.row}>
                  <View style={styles.halfInput}>
                    <Input
                      label={language === 'hi' ? 'नकद (₹)' : 'Cash (₹)'}
                      placeholder="0"
                      value={cashAmount}
                      onChangeText={setCashAmount}
                      keyboardType="decimal-pad"
                    />
                  </View>
                  <View style={styles.halfInput}>
                    <Input
                      label={language === 'hi' ? 'ऑनलाइन (₹)' : 'Online (₹)'}
                      placeholder="0"
                      value={onlineAmount}
                      onChangeText={setOnlineAmount}
                      keyboardType="decimal-pad"
                    />
                  </View>
                </View>
              )}

              <Button
                title={language === 'hi' ? 'खरीद दर्ज करें' : 'Record Purchase'}
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
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  subtitle: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  addBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#2E7D32',
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 16,
  },
  purchaseCard: {
    marginBottom: 12,
  },
  purchaseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sourceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sourceIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sourceName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  sourceType: {
    fontSize: 12,
    color: '#666',
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
  purchaseDetails: {
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    paddingTop: 12,
    gap: 6,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  detailLabel: {
    fontSize: 13,
    color: '#666',
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '500',
    color: '#333',
  },
  purchaseFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    paddingTop: 12,
    marginTop: 8,
  },
  receiptNum: {
    fontSize: 12,
    color: '#666',
  },
  totalAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2E7D32',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    marginTop: 16,
  },
  // Modal styles
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
    maxHeight: '95%',
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
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    marginTop: 12,
  },
  sourceToggle: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
  },
  sourceBtn: {
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
  sourceBtnActive: {
    backgroundColor: '#2E7D32',
  },
  vendorBtn: {
    borderColor: '#7B1FA2',
  },
  vendorBtnActive: {
    backgroundColor: '#7B1FA2',
  },
  sourceBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  sourceBtnTextActive: {
    color: '#FFF',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#333',
  },
  selectScroll: {
    marginBottom: 8,
    maxHeight: 70,
  },
  selectChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#E8E8E8',
    borderRadius: 10,
    marginRight: 8,
    minWidth: 80,
  },
  farmerChipActive: {
    backgroundColor: '#2E7D32',
  },
  vendorChipActive: {
    backgroundColor: '#7B1FA2',
  },
  productChipActive: {
    backgroundColor: '#1976D2',
  },
  outletChipActive: {
    backgroundColor: '#F57C00',
  },
  selectText: {
    color: '#333',
    fontWeight: '500',
    fontSize: 13,
  },
  selectSubtext: {
    color: '#666',
    fontSize: 11,
    marginTop: 2,
  },
  selectTextActive: {
    color: '#FFF',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfInput: {
    flex: 1,
  },
  totalDisplay: {
    backgroundColor: '#E8F5E9',
    padding: 16,
    borderRadius: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 12,
  },
  totalDisplayLabel: {
    fontSize: 15,
    color: '#2E7D32',
    fontWeight: '500',
  },
  totalDisplayValue: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#2E7D32',
  },
  paymentModes: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  modeBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DDD',
    backgroundColor: '#F9F9F9',
  },
  modeBtnActive: {
    backgroundColor: '#2E7D32',
    borderColor: '#2E7D32',
  },
  modeText: {
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
  },
  modeTextActive: {
    color: '#FFF',
  },
  submitBtn: {
    marginTop: 20,
  },
});
