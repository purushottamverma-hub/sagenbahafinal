import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  Modal,
  Alert,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useSettingsStore } from '../../src/store/settingsStore';
import { Card } from '../../src/components/Card';
import { Button } from '../../src/components/Button';
import { Input } from '../../src/components/Input';
import api from '../../src/utils/api';

interface Vendor {
  id: string;
  name: string;
  mobile?: string;
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

interface VendorProcurement {
  id: string;
  receipt_number: string;
  vendor_name: string;
  product_name: string;
  outlet_name: string;
  quantity: number;
  rate: number;
  total_amount: number;
  payment_status: string;
  cash_amount: number;
  online_amount: number;
  credit_amount: number;
  created_at: string;
}

export default function VendorPurchaseScreen() {
  const [procurements, setProcurements] = useState<VendorProcurement[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const language = useSettingsStore((state) => state.language);

  // Form state
  const [selectedVendor, setSelectedVendor] = useState('');
  const [selectedProduct, setSelectedProduct] = useState('');
  const [selectedOutlet, setSelectedOutlet] = useState('');
  const [quantity, setQuantity] = useState('');
  const [rate, setRate] = useState('');
  const [paymentMode, setPaymentMode] = useState<'cash' | 'online' | 'credit' | 'partial'>('cash');
  const [cashAmount, setCashAmount] = useState('');
  const [onlineAmount, setOnlineAmount] = useState('');
  const [notes, setNotes] = useState('');

  const fetchData = async () => {
    try {
      const [procRes, vendorRes, productRes, outletRes] = await Promise.all([
        api.get('/vendor-procurement'),
        api.get('/vendors'),
        api.get('/products'),
        api.get('/outlets'),
      ]);
      setProcurements(procRes.data);
      setVendors(vendorRes.data);
      setProducts(productRes.data);
      setOutlets(outletRes.data);
      
      // Set defaults
      if (vendorRes.data.length > 0) setSelectedVendor(vendorRes.data[0].id);
      if (productRes.data.length > 0) setSelectedProduct(productRes.data[0].id);
      if (outletRes.data.length > 0) setSelectedOutlet(outletRes.data[0].id);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, []);

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
    if (!selectedVendor || !selectedProduct || !selectedOutlet || !quantity || !rate) {
      Alert.alert(
        language === 'hi' ? 'त्रुटि' : 'Error',
        language === 'hi' ? 'सभी आवश्यक फील्ड भरें' : 'Please fill all required fields'
      );
      return;
    }

    const amounts = calculateAmounts();
    
    setLoading(true);
    try {
      const res = await api.post('/vendor-procurement', {
        vendor_id: selectedVendor,
        product_id: selectedProduct,
        outlet_id: selectedOutlet,
        quantity: parseFloat(quantity),
        rate: parseFloat(rate),
        payment_mode: paymentMode,
        cash_amount: amounts.cash,
        online_amount: amounts.online,
        notes: notes || null,
      });

      Alert.alert(
        language === 'hi' ? 'सफल' : 'Success',
        `${language === 'hi' ? 'खरीद दर्ज हो गई। रसीद नंबर:' : 'Procurement recorded. Receipt:'} ${res.data.receipt_number}`
      );

      setShowModal(false);
      resetForm();
      fetchData();
    } catch (error: any) {
      Alert.alert(
        language === 'hi' ? 'त्रुटि' : 'Error',
        error.response?.data?.detail || (language === 'hi' ? 'खरीद दर्ज करने में विफल' : 'Failed to record procurement')
      );
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setQuantity('');
    setRate('');
    setPaymentMode('cash');
    setCashAmount('');
    setOnlineAmount('');
    setNotes('');
  };

  const renderProcurement = ({ item }: { item: VendorProcurement }) => (
    <Card style={styles.procCard}>
      <View style={styles.procHeader}>
        <View>
          <Text style={styles.receiptNum}>{item.receipt_number}</Text>
          <Text style={styles.procDate}>
            {new Date(item.created_at).toLocaleDateString('en-IN')}
          </Text>
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
              ? (language === 'hi' ? 'भुगतान हुआ' : 'Paid')
              : (language === 'hi' ? 'उधार' : 'Credit')
            }
          </Text>
        </View>
      </View>
      
      <View style={styles.procDetails}>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>{language === 'hi' ? 'विक्रेता' : 'Vendor'}</Text>
          <Text style={styles.detailValue}>{item.vendor_name}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>{language === 'hi' ? 'उत्पाद' : 'Product'}</Text>
          <Text style={styles.detailValue}>{item.product_name}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>{language === 'hi' ? 'आउटलेट' : 'Outlet'}</Text>
          <Text style={styles.detailValue}>{item.outlet_name}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>{language === 'hi' ? 'मात्रा' : 'Quantity'}</Text>
          <Text style={styles.detailValue}>{item.quantity}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>{language === 'hi' ? 'दर' : 'Rate'}</Text>
          <Text style={styles.detailValue}>₹{item.rate}</Text>
        </View>
      </View>
      
      <View style={styles.procFooter}>
        <Text style={styles.totalLabel}>{language === 'hi' ? 'कुल' : 'Total'}</Text>
        <Text style={styles.totalValue}>₹{item.total_amount.toFixed(2)}</Text>
      </View>
      
      {item.credit_amount > 0 && (
        <Text style={styles.creditText}>
          {language === 'hi' ? 'बकाया' : 'Outstanding'}: ₹{item.credit_amount.toFixed(2)}
        </Text>
      )}
    </Card>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>
            {language === 'hi' ? 'विक्रेता खरीद' : 'Vendor Purchase'}
          </Text>
          <Text style={styles.subtitle}>
            {language === 'hi' ? 'विक्रेताओं से माल खरीदें' : 'Record purchases from vendors'}
          </Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowModal(true)}>
          <Ionicons name="add" size={24} color="#FFF" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={procurements}
        renderItem={renderProcurement}
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

      {/* New Procurement Modal */}
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

              {/* Vendor Selection */}
              <Text style={styles.label}>
                {language === 'hi' ? 'विक्रेता' : 'Vendor'} *
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.selectScroll}>
                {vendors.map((v) => (
                  <TouchableOpacity
                    key={v.id}
                    style={[styles.selectChip, selectedVendor === v.id && styles.selectChipActive]}
                    onPress={() => setSelectedVendor(v.id)}
                  >
                    <Text style={[styles.selectText, selectedVendor === v.id && styles.selectTextActive]}>
                      {v.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Product Selection */}
              <Text style={styles.label}>
                {language === 'hi' ? 'उत्पाद' : 'Product'} *
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.selectScroll}>
                {products.map((p) => (
                  <TouchableOpacity
                    key={p.id}
                    style={[styles.selectChip, selectedProduct === p.id && styles.selectChipActive]}
                    onPress={() => setSelectedProduct(p.id)}
                  >
                    <Text style={[styles.selectText, selectedProduct === p.id && styles.selectTextActive]}>
                      {language === 'hi' && p.name_hi ? p.name_hi : p.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Outlet Selection */}
              <Text style={styles.label}>
                {language === 'hi' ? 'आउटलेट (स्टॉक यहां जाएगा)' : 'Outlet (stock will go here)'} *
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.selectScroll}>
                {outlets.map((o) => (
                  <TouchableOpacity
                    key={o.id}
                    style={[styles.selectChip, selectedOutlet === o.id && styles.selectChipActive]}
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

              <Input
                label={language === 'hi' ? 'नोट्स (वैकल्पिक)' : 'Notes (optional)'}
                placeholder={language === 'hi' ? 'अतिरिक्त जानकारी...' : 'Additional info...'}
                value={notes}
                onChangeText={setNotes}
                multiline
              />

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
    backgroundColor: '#F57C00',
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 16,
  },
  procCard: {
    marginBottom: 12,
  },
  procHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  receiptNum: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  procDate: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
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
  procDetails: {
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    paddingTop: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
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
  procFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    paddingTop: 12,
    marginTop: 8,
  },
  totalLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2E7D32',
  },
  creditText: {
    fontSize: 13,
    color: '#F57C00',
    marginTop: 8,
    fontWeight: '500',
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
  selectScroll: {
    marginBottom: 8,
  },
  selectChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#E8E8E8',
    borderRadius: 20,
    marginRight: 8,
  },
  selectChipActive: {
    backgroundColor: '#F57C00',
  },
  selectText: {
    color: '#666',
    fontWeight: '500',
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
    backgroundColor: '#F57C00',
    borderColor: '#F57C00',
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
