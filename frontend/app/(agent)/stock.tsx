import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  RefreshControl,
  FlatList,
  TouchableOpacity,
  Modal,
  Alert,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../../src/components/Card';
import { Button } from '../../src/components/Button';
import { Input } from '../../src/components/Input';
import { useTranslation } from '../../src/utils/useTranslation';
import { useAuthStore } from '../../src/store/authStore';
import api from '../../src/utils/api';

interface Product {
  id: string;
  name: string;
  name_hi?: string;
  unit: string;
}

interface StockItem {
  id: string;
  product_id: string;
  product_name: string;
  product_unit: string;
  quantity: number;
  opening_stock: number;
  stock_received: number;
  stock_sold: number;
  stock_damaged: number;
}

export default function AgentStockScreen() {
  const { t, language } = useTranslation();
  const { user } = useAuthStore();
  const [stock, setStock] = useState<StockItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddStock, setShowAddStock] = useState(false);
  const [showDamage, setShowDamage] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form states
  const [addProduct, setAddProduct] = useState('');
  const [addQuantity, setAddQuantity] = useState('');
  const [damageProduct, setDamageProduct] = useState('');
  const [damageQuantity, setDamageQuantity] = useState('');
  const [damageReason, setDamageReason] = useState('');

  const fetchData = async () => {
    try {
      const [stockRes, productsRes] = await Promise.all([
        api.get('/stock'),
        api.get('/products'),
      ]);
      setStock(stockRes.data);
      setProducts(productsRes.data);
      if (productsRes.data.length > 0) {
        setAddProduct(productsRes.data[0].id);
        setDamageProduct(productsRes.data[0].id);
      }
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

  const handleAddStock = async () => {
    if (!addProduct || !addQuantity || !user?.outlet_id) {
      Alert.alert(t('error'), language === 'hi' ? 'सभी फील्ड भरें' : 'Fill all fields');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/stock/add', {
        product_id: addProduct,
        outlet_id: user.outlet_id,
        quantity: parseFloat(addQuantity),
      });
      Alert.alert(t('success'), language === 'hi' ? 'स्टॉक जोड़ा गया' : 'Stock added');
      setShowAddStock(false);
      setAddQuantity('');
      fetchData();
    } catch (error: any) {
      Alert.alert(t('error'), error.response?.data?.detail || 'Failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDamage = async () => {
    if (!damageProduct || !damageQuantity || !damageReason.trim() || !user?.outlet_id) {
      Alert.alert(t('error'), language === 'hi' ? 'सभी फील्ड भरें (कारण आवश्यक)' : 'Fill all fields (reason required)');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/stock/damage', {
        product_id: damageProduct,
        outlet_id: user.outlet_id,
        quantity: parseFloat(damageQuantity),
        reason: damageReason,
      });
      Alert.alert(t('success'), language === 'hi' ? 'नुकसान रिपोर्ट दर्ज' : 'Damage reported');
      setShowDamage(false);
      setDamageQuantity('');
      setDamageReason('');
      fetchData();
    } catch (error: any) {
      Alert.alert(t('error'), error.response?.data?.detail || 'Failed');
    } finally {
      setSubmitting(false);
    }
  };

  const renderStockItem = ({ item }: { item: StockItem }) => (
    <Card>
      <View style={styles.stockRow}>
        <View style={styles.stockInfo}>
          <Text style={styles.productName}>
            {language === 'hi' ? products.find(p => p.id === item.product_id)?.name_hi || item.product_name : item.product_name}
          </Text>
        </View>
        <View style={styles.stockQty}>
          <Text style={[
            styles.qtyValue,
            item.quantity < 10 && styles.lowStock
          ]}>
            {item.quantity} {item.product_unit}
          </Text>
        </View>
      </View>
      <View style={styles.stockDetails}>
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>{t('openingStock')}</Text>
          <Text style={styles.detailValue}>{item.opening_stock}</Text>
        </View>
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>{t('received')}</Text>
          <Text style={[styles.detailValue, { color: '#4CAF50' }]}>+{item.stock_received}</Text>
        </View>
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>{t('sold')}</Text>
          <Text style={[styles.detailValue, { color: '#2196F3' }]}>-{item.stock_sold}</Text>
        </View>
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>{t('damaged')}</Text>
          <Text style={[styles.detailValue, { color: '#D32F2F' }]}>-{item.stock_damaged}</Text>
        </View>
      </View>
    </Card>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('stock')}</Text>
        <View style={styles.headerButtons}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => setShowAddStock(true)}>
            <Ionicons name="add-circle" size={28} color="#2E7D32" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={() => setShowDamage(true)}>
            <Ionicons name="warning" size={28} color="#D32F2F" />
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={stock}
        renderItem={renderStockItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#2E7D32']} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="cube-outline" size={48} color="#CCC" />
            <Text style={styles.emptyText}>
              {language === 'hi' ? 'कोई स्टॉक नहीं' : 'No stock found'}
            </Text>
          </View>
        }
      />

      {/* Add Stock Modal */}
      <Modal visible={showAddStock} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>{t('addStock')}</Text>
            
            <Text style={styles.label}>{t('products')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.selectScroll}>
              {products.map(p => (
                <TouchableOpacity
                  key={p.id}
                  style={[styles.selectChip, addProduct === p.id && styles.selectChipActive]}
                  onPress={() => setAddProduct(p.id)}
                >
                  <Text style={[styles.selectText, addProduct === p.id && styles.selectTextActive]}>
                    {language === 'hi' && p.name_hi ? p.name_hi : p.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Input
              label={t('quantity')}
              placeholder="0"
              value={addQuantity}
              onChangeText={setAddQuantity}
              keyboardType="decimal-pad"
            />

            <View style={styles.modalButtons}>
              <Button title={t('cancel')} variant="outline" onPress={() => setShowAddStock(false)} style={{ flex: 1, marginRight: 8 }} />
              <Button title={t('add')} onPress={handleAddStock} loading={submitting} style={{ flex: 1 }} />
            </View>
          </View>
        </View>
      </Modal>

      {/* Report Damage Modal */}
      <Modal visible={showDamage} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>{t('reportDamage')}</Text>
            
            <Text style={styles.label}>{t('products')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.selectScroll}>
              {products.map(p => (
                <TouchableOpacity
                  key={p.id}
                  style={[styles.selectChip, damageProduct === p.id && styles.selectChipActive]}
                  onPress={() => setDamageProduct(p.id)}
                >
                  <Text style={[styles.selectText, damageProduct === p.id && styles.selectTextActive]}>
                    {language === 'hi' && p.name_hi ? p.name_hi : p.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Input
              label={t('quantity')}
              placeholder="0"
              value={damageQuantity}
              onChangeText={setDamageQuantity}
              keyboardType="decimal-pad"
            />

            <Input
              label={`${t('reason')} *`}
              placeholder={language === 'hi' ? 'कारण दर्ज करें' : 'Enter reason'}
              value={damageReason}
              onChangeText={setDamageReason}
              multiline
            />

            <View style={styles.modalButtons}>
              <Button title={t('cancel')} variant="outline" onPress={() => setShowDamage(false)} style={{ flex: 1, marginRight: 8 }} />
              <Button title={t('reportDamage')} variant="danger" onPress={handleDamage} loading={submitting} style={{ flex: 1 }} />
            </View>
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
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
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
  iconBtn: {
    padding: 4,
  },
  listContent: {
    padding: 16,
  },
  stockRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  stockInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  stockQty: {
    alignItems: 'flex-end',
  },
  qtyValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2E7D32',
  },
  lowStock: {
    color: '#D32F2F',
  },
  stockDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    paddingTop: 12,
  },
  detailItem: {
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 11,
    color: '#999',
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  empty: {
    alignItems: 'center',
    marginTop: 60,
  },
  emptyText: {
    marginTop: 12,
    color: '#999',
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalBox: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 20,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
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
    backgroundColor: '#2E7D32',
  },
  selectText: {
    color: '#666',
    fontWeight: '500',
  },
  selectTextActive: {
    color: '#FFF',
  },
  modalButtons: {
    flexDirection: 'row',
    marginTop: 20,
  },
});
