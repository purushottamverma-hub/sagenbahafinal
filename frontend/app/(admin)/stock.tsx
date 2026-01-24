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

interface StockItem {
  id: string;
  product_id: string;
  product_name: string;
  product_unit: string;
  outlet_id: string;
  outlet_name: string;
  quantity: number;
  opening_stock: number;
  stock_received: number;
  stock_sold: number;
  stock_damaged: number;
}

interface ConsolidatedStock {
  product_id: string;
  product_name: string;
  product_unit: string;
  total_quantity: number;
}

export default function StockScreen() {
  const { t, language } = useTranslation();
  const [stock, setStock] = useState<StockItem[]>([]);
  const [consolidatedStock, setConsolidatedStock] = useState<ConsolidatedStock[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedOutlet, setSelectedOutlet] = useState<string>('all');
  const [showAddStock, setShowAddStock] = useState(false);
  const [showAllocate, setShowAllocate] = useState(false);
  const [showDamage, setShowDamage] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form states
  const [addProduct, setAddProduct] = useState('');
  const [addOutlet, setAddOutlet] = useState('');
  const [addQuantity, setAddQuantity] = useState('');

  const [allocateProduct, setAllocateProduct] = useState('');
  const [fromOutlet, setFromOutlet] = useState('');
  const [toOutlet, setToOutlet] = useState('');
  const [allocateQuantity, setAllocateQuantity] = useState('');

  const [damageProduct, setDamageProduct] = useState('');
  const [damageOutlet, setDamageOutlet] = useState('');
  const [damageQuantity, setDamageQuantity] = useState('');
  const [damageReason, setDamageReason] = useState('');

  const fetchData = async () => {
    try {
      const [stockRes, consolidatedRes, productsRes, outletsRes] = await Promise.all([
        api.get('/stock'),
        api.get('/stock/consolidated'),
        api.get('/products'),
        api.get('/outlets'),
      ]);
      setStock(stockRes.data);
      setConsolidatedStock(consolidatedRes.data);
      setProducts(productsRes.data);
      setOutlets(outletsRes.data);
      if (outletsRes.data.length > 0) {
        setAddOutlet(outletsRes.data[0].id);
        setFromOutlet(outletsRes.data[0].id);
        setDamageOutlet(outletsRes.data[0].id);
        if (outletsRes.data.length > 1) {
          setToOutlet(outletsRes.data[1].id);
        }
      }
      if (productsRes.data.length > 0) {
        setAddProduct(productsRes.data[0].id);
        setAllocateProduct(productsRes.data[0].id);
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

  const filteredStock = selectedOutlet === 'all'
    ? stock
    : stock.filter(s => s.outlet_id === selectedOutlet);

  const handleAddStock = async () => {
    if (!addProduct || !addOutlet || !addQuantity) {
      Alert.alert(t('error'), language === 'hi' ? 'सभी फील्ड भरें' : 'Fill all fields');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/stock/add', {
        product_id: addProduct,
        outlet_id: addOutlet,
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

  const handleAllocate = async () => {
    if (!allocateProduct || !fromOutlet || !toOutlet || !allocateQuantity) {
      Alert.alert(t('error'), language === 'hi' ? 'सभी फील्ड भरें' : 'Fill all fields');
      return;
    }

    if (fromOutlet === toOutlet) {
      Alert.alert(t('error'), language === 'hi' ? 'अलग-अलग आउटलेट चुनें' : 'Select different outlets');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/stock/allocate', {
        product_id: allocateProduct,
        from_outlet_id: fromOutlet,
        to_outlet_id: toOutlet,
        quantity: parseFloat(allocateQuantity),
      });
      Alert.alert(t('success'), language === 'hi' ? 'स्टॉक आवंटित' : 'Stock allocated');
      setShowAllocate(false);
      setAllocateQuantity('');
      fetchData();
    } catch (error: any) {
      Alert.alert(t('error'), error.response?.data?.detail || 'Failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDamage = async () => {
    if (!damageProduct || !damageOutlet || !damageQuantity || !damageReason.trim()) {
      Alert.alert(t('error'), language === 'hi' ? 'सभी फील्ड भरें (कारण आवश्यक)' : 'Fill all fields (reason required)');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/stock/damage', {
        product_id: damageProduct,
        outlet_id: damageOutlet,
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
          <Text style={styles.outletName}>{item.outlet_name}</Text>
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
          <TouchableOpacity style={styles.iconBtn} onPress={() => setShowAllocate(true)}>
            <Ionicons name="swap-horizontal" size={28} color="#1976D2" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={() => setShowDamage(true)}>
            <Ionicons name="warning" size={28} color="#D32F2F" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Outlet Filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
        <TouchableOpacity
          style={[styles.filterChip, selectedOutlet === 'all' && styles.filterChipActive]}
          onPress={() => setSelectedOutlet('all')}
        >
          <Text style={[styles.filterText, selectedOutlet === 'all' && styles.filterTextActive]}>
            {language === 'hi' ? 'सभी' : 'All'}
          </Text>
        </TouchableOpacity>
        {outlets.map(outlet => (
          <TouchableOpacity
            key={outlet.id}
            style={[styles.filterChip, selectedOutlet === outlet.id && styles.filterChipActive]}
            onPress={() => setSelectedOutlet(outlet.id)}
          >
            <Text style={[styles.filterText, selectedOutlet === outlet.id && styles.filterTextActive]}>
              {outlet.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Consolidated View */}
      {selectedOutlet === 'all' && (
        <View style={styles.consolidatedSection}>
          <Text style={styles.sectionTitle}>
            {language === 'hi' ? 'कुल स्टॉक' : 'Total Stock'}
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {consolidatedStock.map(item => (
              <Card key={item.product_id} style={styles.consolidatedCard}>
                <Text style={styles.consolidatedName}>{item.product_name}</Text>
                <Text style={styles.consolidatedQty}>
                  {item.total_quantity} {item.product_unit}
                </Text>
              </Card>
            ))}
          </ScrollView>
        </View>
      )}

      <FlatList
        data={filteredStock}
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

            <Text style={styles.label}>{t('outlets')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.selectScroll}>
              {outlets.map(o => (
                <TouchableOpacity
                  key={o.id}
                  style={[styles.selectChip, addOutlet === o.id && styles.selectChipActive]}
                  onPress={() => setAddOutlet(o.id)}
                >
                  <Text style={[styles.selectText, addOutlet === o.id && styles.selectTextActive]}>
                    {o.name}
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

      {/* Allocate Stock Modal */}
      <Modal visible={showAllocate} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>{t('allocateStock')}</Text>
            
            <Text style={styles.label}>{t('products')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.selectScroll}>
              {products.map(p => (
                <TouchableOpacity
                  key={p.id}
                  style={[styles.selectChip, allocateProduct === p.id && styles.selectChipActive]}
                  onPress={() => setAllocateProduct(p.id)}
                >
                  <Text style={[styles.selectText, allocateProduct === p.id && styles.selectTextActive]}>
                    {language === 'hi' && p.name_hi ? p.name_hi : p.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.label}>{t('fromOutlet')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.selectScroll}>
              {outlets.map(o => (
                <TouchableOpacity
                  key={o.id}
                  style={[styles.selectChip, fromOutlet === o.id && styles.selectChipActive]}
                  onPress={() => setFromOutlet(o.id)}
                >
                  <Text style={[styles.selectText, fromOutlet === o.id && styles.selectTextActive]}>
                    {o.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.label}>{t('toOutlet')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.selectScroll}>
              {outlets.map(o => (
                <TouchableOpacity
                  key={o.id}
                  style={[styles.selectChip, toOutlet === o.id && styles.selectChipActive]}
                  onPress={() => setToOutlet(o.id)}
                >
                  <Text style={[styles.selectText, toOutlet === o.id && styles.selectTextActive]}>
                    {o.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Input
              label={t('quantity')}
              placeholder="0"
              value={allocateQuantity}
              onChangeText={setAllocateQuantity}
              keyboardType="decimal-pad"
            />

            <View style={styles.modalButtons}>
              <Button title={t('cancel')} variant="outline" onPress={() => setShowAllocate(false)} style={{ flex: 1, marginRight: 8 }} />
              <Button title={t('allocateStock')} onPress={handleAllocate} loading={submitting} style={{ flex: 1 }} />
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

            <Text style={styles.label}>{t('outlets')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.selectScroll}>
              {outlets.map(o => (
                <TouchableOpacity
                  key={o.id}
                  style={[styles.selectChip, damageOutlet === o.id && styles.selectChipActive]}
                  onPress={() => setDamageOutlet(o.id)}
                >
                  <Text style={[styles.selectText, damageOutlet === o.id && styles.selectTextActive]}>
                    {o.name}
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
  filterScroll: {
    backgroundColor: '#FFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#E8E8E8',
    borderRadius: 20,
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: '#2E7D32',
  },
  filterText: {
    color: '#666',
    fontWeight: '500',
  },
  filterTextActive: {
    color: '#FFF',
  },
  consolidatedSection: {
    padding: 16,
    paddingBottom: 0,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  consolidatedCard: {
    minWidth: 120,
    marginRight: 12,
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
  },
  consolidatedName: {
    fontSize: 13,
    color: '#333',
    marginBottom: 4,
  },
  consolidatedQty: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2E7D32',
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
  outletName: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
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
