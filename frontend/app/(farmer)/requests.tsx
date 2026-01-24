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

interface Product {
  id: string;
  name: string;
  name_hi?: string;
  unit: string;
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
  created_at: string;
}

export default function RequestsScreen() {
  const [requests, setRequests] = useState<ProductRequest[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const language = useSettingsStore((state) => state.language);

  // Form state
  const [requestType, setRequestType] = useState<'buy' | 'sell'>('sell');
  const [selectedProduct, setSelectedProduct] = useState<string>('');
  const [quantity, setQuantity] = useState('');
  const [rate, setRate] = useState('');
  const [notes, setNotes] = useState('');

  const fetchData = async () => {
    try {
      const [reqRes, prodRes] = await Promise.all([
        api.get('/product-requests'),
        api.get('/products'),
      ]);
      setRequests(reqRes.data);
      setProducts(prodRes.data);
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
    if (!selectedProduct || !quantity) {
      Alert.alert(
        language === 'hi' ? 'त्रुटि' : 'Error',
        language === 'hi' ? 'कृपया सभी आवश्यक फील्ड भरें' : 'Please fill all required fields'
      );
      return;
    }

    setLoading(true);
    try {
      await api.post('/product-requests', {
        product_id: selectedProduct,
        quantity: parseFloat(quantity),
        request_type: requestType,
        preferred_rate: rate ? parseFloat(rate) : null,
        notes: notes || null,
      });

      Alert.alert(
        language === 'hi' ? 'सफल' : 'Success',
        language === 'hi' ? 'अनुरोध सफलतापूर्वक जमा किया गया' : 'Request submitted successfully'
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

  const resetForm = () => {
    setSelectedProduct('');
    setQuantity('');
    setRate('');
    setNotes('');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return '#2E7D32';
      case 'rejected': return '#D32F2F';
      case 'completed': return '#1976D2';
      default: return '#F57C00';
    }
  };

  const getStatusText = (status: string) => {
    const statusMap: Record<string, { en: string; hi: string }> = {
      pending: { en: 'Pending', hi: 'लंबित' },
      approved: { en: 'Approved', hi: 'स्वीकृत' },
      rejected: { en: 'Rejected', hi: 'अस्वीकृत' },
      completed: { en: 'Completed', hi: 'पूर्ण' },
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
      <Text style={styles.dateText}>
        {new Date(item.created_at).toLocaleDateString()}
      </Text>
    </Card>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>
          {language === 'hi' ? 'मेरे अनुरोध' : 'My Requests'}
        </Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => setShowModal(true)}
        >
          <Ionicons name="add" size={24} color="#FFF" />
        </TouchableOpacity>
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

      {/* New Request Modal */}
      <Modal visible={showModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {language === 'hi' ? 'नया अनुरोध' : 'New Request'}
              </Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
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
                onPress={() => setRequestType('sell')}
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
                onPress={() => setRequestType('buy')}
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

            {/* Product Selection */}
            <Text style={styles.label}>
              {language === 'hi' ? 'उत्पाद चुनें' : 'Select Product'} *
            </Text>
            <View style={styles.productGrid}>
              {products.map((product) => (
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
  dateText: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
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
});
