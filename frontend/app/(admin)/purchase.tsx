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

interface Farmer {
  id: string;
  name: string;
  mobile?: string;
  village?: string;
}

interface Product {
  id: string;
  name: string;
  name_hi?: string;
  unit: string;
}

interface Purchase {
  id: string;
  farmer_id: string;
  farmer_name: string;
  product_id: string;
  product_name: string;
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
  const [products, setProducts] = useState<Product[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const language = useSettingsStore((state) => state.language);

  // Form state
  const [selectedFarmer, setSelectedFarmer] = useState('');
  const [selectedProduct, setSelectedProduct] = useState('');
  const [quantity, setQuantity] = useState('');
  const [rate, setRate] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<'paid' | 'credit'>('paid');

  const fetchData = async () => {
    try {
      const [purchaseRes, farmerRes, productRes] = await Promise.all([
        api.get('/farmer-purchases'),
        api.get('/farmers'),
        api.get('/products'),
      ]);
      setPurchases(purchaseRes.data);
      setFarmers(farmerRes.data);
      setProducts(productRes.data);
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

  const handleSubmit = async () => {
    if (!selectedFarmer || !selectedProduct || !quantity || !rate) {
      Alert.alert(
        language === 'hi' ? 'त्रुटि' : 'Error',
        language === 'hi' ? 'कृपया सभी आवश्यक फील्ड भरें' : 'Please fill all required fields'
      );
      return;
    }

    setLoading(true);
    try {
      await api.post('/farmer-purchases', {
        farmer_id: selectedFarmer,
        product_id: selectedProduct,
        quantity: parseFloat(quantity),
        rate: parseFloat(rate),
        payment_status: paymentStatus,
      });

      Alert.alert(
        language === 'hi' ? 'सफल' : 'Success',
        language === 'hi' ? 'खरीद दर्ज की गई' : 'Purchase recorded successfully'
      );

      setShowModal(false);
      resetForm();
      fetchData();
    } catch (error: any) {
      Alert.alert(
        language === 'hi' ? 'त्रुटि' : 'Error',
        error.response?.data?.detail || (language === 'hi' ? 'खरीद विफल' : 'Purchase failed')
      );
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setSelectedFarmer('');
    setSelectedProduct('');
    setQuantity('');
    setRate('');
    setPaymentStatus('paid');
  };

  const renderPurchase = ({ item }: { item: Purchase }) => (
    <Card style={styles.purchaseCard}>
      <View style={styles.purchaseHeader}>
        <View style={styles.purchaseIcon}>
          <Ionicons name="arrow-down-circle" size={24} color="#1976D2" />
        </View>
        <View style={styles.purchaseInfo}>
          <Text style={styles.farmerName}>{item.farmer_name}</Text>
          <Text style={styles.productName}>{item.product_name}</Text>
        </View>
        <Text style={styles.amount}>₹{item.total_amount}</Text>
      </View>
      <View style={styles.purchaseDetails}>
        <Text style={styles.detailText}>
          {item.quantity} kg @ ₹{item.rate}/kg
        </Text>
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
              : (language === 'hi' ? 'उधार' : 'Credit')}
          </Text>
        </View>
      </View>
      <Text style={styles.receiptText}>{item.receipt_number}</Text>
    </Card>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>
            {language === 'hi' ? 'किसानों से खरीद' : 'Farmer Procurement'}
          </Text>
          <Text style={styles.subtitle}>
            {language === 'hi' ? 'किसानों से उपज की खरीद दर्ज करें' : 'Record produce purchases from farmers'}
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
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
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
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {language === 'hi' ? 'नई खरीद' : 'New Purchase'}
              </Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            {/* Farmer Selection */}
            <Text style={styles.label}>
              {language === 'hi' ? 'किसान चुनें' : 'Select Farmer'} *
            </Text>
            <View style={styles.optionGrid}>
              {farmers.slice(0, 6).map((farmer) => (
                <TouchableOpacity
                  key={farmer.id}
                  style={[
                    styles.optionBtn,
                    selectedFarmer === farmer.id && styles.optionBtnActive,
                  ]}
                  onPress={() => setSelectedFarmer(farmer.id)}
                >
                  <Text style={[
                    styles.optionText,
                    selectedFarmer === farmer.id && styles.optionTextActive,
                  ]} numberOfLines={1}>
                    {farmer.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Product Selection */}
            <Text style={styles.label}>
              {language === 'hi' ? 'उत्पाद चुनें' : 'Select Product'} *
            </Text>
            <View style={styles.optionGrid}>
              {products.map((product) => (
                <TouchableOpacity
                  key={product.id}
                  style={[
                    styles.optionBtn,
                    selectedProduct === product.id && styles.optionBtnActive,
                  ]}
                  onPress={() => setSelectedProduct(product.id)}
                >
                  <Text style={[
                    styles.optionText,
                    selectedProduct === product.id && styles.optionTextActive,
                  ]} numberOfLines={1}>
                    {language === 'hi' && product.name_hi ? product.name_hi : product.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Quantity & Rate */}
            <View style={styles.row}>
              <View style={styles.halfWidth}>
                <Text style={styles.label}>
                  {language === 'hi' ? 'मात्रा (kg)' : 'Quantity (kg)'} *
                </Text>
                <TextInput
                  style={styles.input}
                  value={quantity}
                  onChangeText={setQuantity}
                  keyboardType="numeric"
                  placeholder="0"
                />
              </View>
              <View style={styles.halfWidth}>
                <Text style={styles.label}>
                  {language === 'hi' ? 'दर (₹/kg)' : 'Rate (₹/kg)'} *
                </Text>
                <TextInput
                  style={styles.input}
                  value={rate}
                  onChangeText={setRate}
                  keyboardType="numeric"
                  placeholder="0"
                />
              </View>
            </View>

            {/* Total */}
            {quantity && rate && (
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>
                  {language === 'hi' ? 'कुल' : 'Total'}:
                </Text>
                <Text style={styles.totalAmount}>
                  ₹{(parseFloat(quantity) * parseFloat(rate)).toFixed(2)}
                </Text>
              </View>
            )}

            {/* Payment Status */}
            <Text style={styles.label}>
              {language === 'hi' ? 'भुगतान स्थिति' : 'Payment Status'}
            </Text>
            <View style={styles.paymentToggle}>
              <TouchableOpacity
                style={[styles.paymentBtn, paymentStatus === 'paid' && styles.paymentBtnActive]}
                onPress={() => setPaymentStatus('paid')}
              >
                <Text style={[styles.paymentText, paymentStatus === 'paid' && styles.paymentTextActive]}>
                  {language === 'hi' ? 'भुगतान' : 'Paid'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.paymentBtn, paymentStatus === 'credit' && styles.paymentBtnActiveCredit]}
                onPress={() => setPaymentStatus('credit')}
              >
                <Text style={[styles.paymentText, paymentStatus === 'credit' && styles.paymentTextActive]}>
                  {language === 'hi' ? 'उधार' : 'Credit'}
                </Text>
              </TouchableOpacity>
            </View>

            <Button
              title={language === 'hi' ? 'खरीद दर्ज करें' : 'Record Purchase'}
              onPress={handleSubmit}
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
  subtitle: {
    fontSize: 14,
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
    paddingTop: 0,
  },
  purchaseCard: {
    marginBottom: 12,
  },
  purchaseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  purchaseIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  purchaseInfo: {
    flex: 1,
  },
  farmerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  productName: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  amount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1976D2',
  },
  purchaseDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  detailText: {
    fontSize: 14,
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
  receiptText: {
    fontSize: 12,
    color: '#999',
    marginTop: 8,
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
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    marginTop: 12,
  },
  optionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DDD',
    backgroundColor: '#F9F9F9',
  },
  optionBtnActive: {
    backgroundColor: '#2E7D32',
    borderColor: '#2E7D32',
  },
  optionText: {
    fontSize: 13,
    color: '#333',
  },
  optionTextActive: {
    color: '#FFF',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfWidth: {
    flex: 1,
  },
  input: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    backgroundColor: '#F9F9F9',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    padding: 12,
    backgroundColor: '#E8F5E9',
    borderRadius: 8,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  totalAmount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2E7D32',
  },
  paymentToggle: {
    flexDirection: 'row',
    gap: 12,
  },
  paymentBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#DDD',
    alignItems: 'center',
  },
  paymentBtnActive: {
    backgroundColor: '#2E7D32',
    borderColor: '#2E7D32',
  },
  paymentBtnActiveCredit: {
    backgroundColor: '#F57C00',
    borderColor: '#F57C00',
  },
  paymentText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#666',
  },
  paymentTextActive: {
    color: '#FFF',
  },
  submitBtn: {
    marginTop: 20,
  },
});
