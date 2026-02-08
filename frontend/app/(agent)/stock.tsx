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
  TextInput,
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

interface Outlet {
  id: string;
  name: string;
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

interface TransferRequest {
  id: string;
  product_name: string;
  from_outlet_name: string;
  to_outlet_name: string;
  quantity: number;
  reason?: string;
  status: string;
  requested_by_name: string;
  created_at: string;
  admin_remark?: string;
}

export default function AgentStockScreen() {
  const { t, language } = useTranslation();
  const { user } = useAuthStore();
  const [stock, setStock] = useState<StockItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [transferRequests, setTransferRequests] = useState<TransferRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddStock, setShowAddStock] = useState(false);
  const [showDamage, setShowDamage] = useState(false);
  const [showTransferRequest, setShowTransferRequest] = useState(false);
  const [showMyRequests, setShowMyRequests] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Form states
  const [addProduct, setAddProduct] = useState('');
  const [addQuantity, setAddQuantity] = useState('');
  const [damageProduct, setDamageProduct] = useState('');
  const [damageQuantity, setDamageQuantity] = useState('');
  const [damageReason, setDamageReason] = useState('');

  // Transfer request form
  const [transferProduct, setTransferProduct] = useState('');
  const [transferFromOutlet, setTransferFromOutlet] = useState('');
  const [transferQuantity, setTransferQuantity] = useState('');
  const [transferReason, setTransferReason] = useState('');

  const fetchData = async () => {
    try {
      const [stockRes, productsRes, outletsRes] = await Promise.all([
        api.get('/stock'),
        api.get('/products'),
        api.get('/outlets'),
      ]);
      setStock(stockRes.data);
      setProducts(productsRes.data);
      setOutlets(outletsRes.data);
      if (productsRes.data.length > 0) {
        setAddProduct(productsRes.data[0].id);
        setDamageProduct(productsRes.data[0].id);
        setTransferProduct(productsRes.data[0].id);
      }
      // Set default from outlet (any outlet that's not the agent's outlet)
      if (outletsRes.data.length > 0 && user?.outlet_id) {
        const otherOutlet = outletsRes.data.find((o: Outlet) => o.id !== user.outlet_id);
        if (otherOutlet) {
          setTransferFromOutlet(otherOutlet.id);
        }
      }
    } catch (error) {
      console.error('Fetch error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchMyRequests = async () => {
    try {
      const res = await api.get('/stock/transfer-requests');
      setTransferRequests(res.data);
    } catch (error) {
      console.error('Fetch requests error:', error);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (showMyRequests) {
      fetchMyRequests();
    }
  }, [showMyRequests]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, []);

  // Filter products by search query
  const filteredProducts = products.filter(p => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return p.name.toLowerCase().includes(query) || 
           (p.name_hi && p.name_hi.includes(searchQuery));
  });

  // Filter stock by search query
  const filteredStock = stock.filter(s => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return s.product_name.toLowerCase().includes(query);
  });

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

  const handleTransferRequest = async () => {
    if (!transferProduct || !transferFromOutlet || !transferQuantity || !user?.outlet_id) {
      Alert.alert(t('error'), language === 'hi' ? 'सभी फील्ड भरें' : 'Fill all fields');
      return;
    }

    if (transferFromOutlet === user.outlet_id) {
      Alert.alert(t('error'), language === 'hi' ? 'स्रोत आउटलेट अलग होना चाहिए' : 'Source outlet must be different from your outlet');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/stock/transfer-request', {
        product_id: transferProduct,
        from_outlet_id: transferFromOutlet,
        to_outlet_id: user.outlet_id,
        quantity: parseFloat(transferQuantity),
        reason: transferReason || null,
      });
      Alert.alert(
        t('success'), 
        language === 'hi' 
          ? 'स्थानांतरण अनुरोध भेजा गया। एडमिन द्वारा अनुमोदन के बाद स्टॉक आएगा।' 
          : 'Transfer request sent. Stock will be transferred after admin approval.'
      );
      setShowTransferRequest(false);
      setTransferQuantity('');
      setTransferReason('');
    } catch (error: any) {
      Alert.alert(t('error'), error.response?.data?.detail || 'Failed to create request');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return '#FFA000';
      case 'approved': return '#4CAF50';
      case 'rejected': return '#D32F2F';
      default: return '#666';
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, { en: string; hi: string }> = {
      pending: { en: 'Pending', hi: 'लंबित' },
      approved: { en: 'Approved', hi: 'अनुमोदित' },
      rejected: { en: 'Rejected', hi: 'अस्वीकृत' },
    };
    return labels[status]?.[language] || status;
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

  const renderTransferRequest = ({ item }: { item: TransferRequest }) => {
    // Determine if this is stock coming IN or going OUT from current user's outlet
    const isIncoming = item.to_outlet_id === user?.outlet_id;
    const isOutgoing = item.from_outlet_id === user?.outlet_id;
    
    return (
      <Card style={styles.requestCard}>
        <View style={styles.requestHeader}>
          <View style={styles.requestInfo}>
            <Text style={styles.requestProduct}>{item.product_name}</Text>
            <Text style={styles.requestQty}>{item.quantity} units</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {/* IN/OUT Badge */}
            {isIncoming && (
              <View style={[styles.directionBadge, { backgroundColor: '#E8F5E9', marginRight: 8 }]}>
                <Ionicons name="arrow-down-circle" size={14} color="#4CAF50" />
                <Text style={{ color: '#4CAF50', fontSize: 12, fontWeight: '600', marginLeft: 4 }}>
                  {language === 'hi' ? 'IN' : 'IN'}
                </Text>
              </View>
            )}
            {isOutgoing && (
              <View style={[styles.directionBadge, { backgroundColor: '#FFF3E0', marginRight: 8 }]}>
                <Ionicons name="arrow-up-circle" size={14} color="#FF9800" />
                <Text style={{ color: '#FF9800', fontSize: 12, fontWeight: '600', marginLeft: 4 }}>
                  {language === 'hi' ? 'OUT' : 'OUT'}
                </Text>
              </View>
            )}
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
              <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
                {getStatusLabel(item.status)}
              </Text>
            </View>
          </View>
        </View>
        
        <View style={styles.transferFlow}>
          <View style={[styles.outletBox, isOutgoing && { borderColor: '#FF9800', borderWidth: 1 }]}>
            <Text style={styles.outletLabel}>{language === 'hi' ? 'से' : 'From'}</Text>
            <Text style={styles.outletText}>{item.from_outlet_name}</Text>
          </View>
          <Ionicons name="arrow-forward" size={20} color="#666" />
          <View style={[styles.outletBox, isIncoming && { borderColor: '#4CAF50', borderWidth: 1 }]}>
            <Text style={styles.outletLabel}>{language === 'hi' ? 'को' : 'To'}</Text>
            <Text style={styles.outletText}>{item.to_outlet_name}</Text>
          </View>
        </View>
        
        <Text style={styles.requestMeta}>
          {new Date(item.created_at).toLocaleDateString('en-IN')}
        </Text>
        
        {item.admin_remark && (
          <Text style={styles.adminRemark}>
            {language === 'hi' ? 'एडमिन टिप्पणी: ' : 'Admin Remark: '}{item.admin_remark}
          </Text>
        )}
      </Card>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('stock')}</Text>
        <View style={styles.headerButtons}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => setShowAddStock(true)}>
            <Ionicons name="add-circle" size={28} color="#2E7D32" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={() => setShowTransferRequest(true)}>
            <Ionicons name="git-pull-request" size={28} color="#1976D2" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={() => setShowMyRequests(true)}>
            <Ionicons name="list" size={28} color="#7B1FA2" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={() => setShowDamage(true)}>
            <Ionicons name="warning" size={28} color="#D32F2F" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#999" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder={language === 'hi' ? 'उत्पाद खोजें...' : 'Search products...'}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor="#999"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={20} color="#999" />
          </TouchableOpacity>
        )}
      </View>

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
              {searchQuery 
                ? (language === 'hi' ? 'कोई परिणाम नहीं' : 'No results found')
                : (language === 'hi' ? 'कोई स्टॉक नहीं' : 'No stock found')
              }
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
              {filteredProducts.map(p => (
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

      {/* Request Stock Transfer Modal */}
      <Modal visible={showTransferRequest} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {language === 'hi' ? 'स्टॉक अनुरोध' : 'Request Stock'}
              </Text>
              <TouchableOpacity onPress={() => setShowTransferRequest(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            
            <Text style={styles.label}>{t('products')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.selectScroll}>
              {products.map(p => (
                <TouchableOpacity
                  key={p.id}
                  style={[styles.selectChip, transferProduct === p.id && styles.selectChipActive]}
                  onPress={() => setTransferProduct(p.id)}
                >
                  <Text style={[styles.selectText, transferProduct === p.id && styles.selectTextActive]}>
                    {language === 'hi' && p.name_hi ? p.name_hi : p.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.label}>
              {language === 'hi' ? 'स्रोत आउटलेट (जहां से स्टॉक आएगा)' : 'Source Outlet (where stock comes from)'}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.selectScroll}>
              {outlets.filter(o => o.id !== user?.outlet_id).map(o => (
                <TouchableOpacity
                  key={o.id}
                  style={[styles.selectChip, transferFromOutlet === o.id && styles.selectChipActive]}
                  onPress={() => setTransferFromOutlet(o.id)}
                >
                  <Text style={[styles.selectText, transferFromOutlet === o.id && styles.selectTextActive]}>
                    {o.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.destinationInfo}>
              <Ionicons name="location" size={18} color="#2E7D32" />
              <Text style={styles.destinationText}>
                {language === 'hi' ? 'गंतव्य: आपका आउटलेट' : 'Destination: Your Outlet'}
              </Text>
            </View>

            <Input
              label={t('quantity')}
              placeholder="0"
              value={transferQuantity}
              onChangeText={setTransferQuantity}
              keyboardType="decimal-pad"
            />

            <Input
              label={language === 'hi' ? 'कारण (वैकल्पिक)' : 'Reason (optional)'}
              placeholder={language === 'hi' ? 'अनुरोध का कारण...' : 'Reason for request...'}
              value={transferReason}
              onChangeText={setTransferReason}
              multiline
            />

            <View style={styles.modalButtons}>
              <Button title={t('cancel')} variant="outline" onPress={() => setShowTransferRequest(false)} style={{ flex: 1, marginRight: 8 }} />
              <Button 
                title={language === 'hi' ? 'अनुरोध भेजें' : 'Send Request'} 
                onPress={handleTransferRequest} 
                loading={submitting} 
                style={{ flex: 1 }} 
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* My Transfer Requests Modal */}
      <Modal visible={showMyRequests} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { maxHeight: '85%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {language === 'hi' ? 'मेरे अनुरोध' : 'My Requests'}
              </Text>
              <TouchableOpacity onPress={() => setShowMyRequests(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <FlatList
              data={transferRequests}
              renderItem={renderTransferRequest}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ padding: 4 }}
              ListEmptyComponent={
                <View style={styles.empty}>
                  <Ionicons name="git-pull-request-outline" size={48} color="#CCC" />
                  <Text style={styles.emptyText}>
                    {language === 'hi' ? 'कोई अनुरोध नहीं' : 'No requests found'}
                  </Text>
                </View>
              }
            />
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    margin: 16,
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  listContent: {
    padding: 16,
    paddingTop: 8,
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
  destinationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
    gap: 8,
  },
  destinationText: {
    color: '#2E7D32',
    fontWeight: '500',
  },
  // Request card styles
  requestCard: {
    marginBottom: 12,
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  requestInfo: {
    flex: 1,
  },
  requestProduct: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  requestQty: {
    fontSize: 14,
    color: '#2E7D32',
    fontWeight: '500',
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
  transferFlow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
  },
  outletBox: {
    flex: 1,
    alignItems: 'center',
  },
  outletLabel: {
    fontSize: 11,
    color: '#999',
    marginBottom: 2,
  },
  outletText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#333',
    textAlign: 'center',
  },
  requestMeta: {
    fontSize: 12,
    color: '#666',
  },
  adminRemark: {
    fontSize: 12,
    color: '#1976D2',
    marginTop: 4,
    fontWeight: '500',
  },
  directionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
});
