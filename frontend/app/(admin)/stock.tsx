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

export default function StockScreen() {
  const { t, language } = useTranslation();
  const [stock, setStock] = useState<StockItem[]>([]);
  const [consolidatedStock, setConsolidatedStock] = useState<ConsolidatedStock[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [transferRequests, setTransferRequests] = useState<TransferRequest[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedOutlet, setSelectedOutlet] = useState<string>('all');
  const [showAddStock, setShowAddStock] = useState(false);
  const [showAllocate, setShowAllocate] = useState(false);
  const [showDamage, setShowDamage] = useState(false);
  const [showTransferRequests, setShowTransferRequests] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [activeRequestTab, setActiveRequestTab] = useState<'pending' | 'all'>('pending');

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

  // Approval modal states
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [approvalRequest, setApprovalRequest] = useState<TransferRequest | null>(null);
  const [approvalQuantity, setApprovalQuantity] = useState('');
  const [approvalRemark, setApprovalRemark] = useState('');

  // Remark for approval/rejection
  const [adminRemark, setAdminRemark] = useState('');

  const fetchData = async () => {
    try {
      const [stockRes, consolidatedRes, productsRes, outletsRes, pendingRes] = await Promise.all([
        api.get('/stock'),
        api.get('/stock/consolidated'),
        api.get('/products'),
        api.get('/outlets'),
        api.get('/stock/transfer-requests/pending-count'),
      ]);
      setStock(stockRes.data);
      setConsolidatedStock(consolidatedRes.data);
      setProducts(productsRes.data);
      setOutlets(outletsRes.data);
      setPendingCount(pendingRes.data.count || 0);
      
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

  const fetchTransferRequests = async (status?: string) => {
    try {
      const url = status ? `/stock/transfer-requests?status=${status}` : '/stock/transfer-requests';
      const res = await api.get(url);
      setTransferRequests(res.data);
    } catch (error) {
      console.error('Fetch transfer requests error:', error);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (showTransferRequests) {
      fetchTransferRequests(activeRequestTab === 'pending' ? 'pending' : undefined);
    }
  }, [showTransferRequests, activeRequestTab]);

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

  const handleApproveRequest = async (requestId: string) => {
    Alert.prompt(
      language === 'hi' ? 'अनुमोदन टिप्पणी' : 'Approval Remark',
      language === 'hi' ? 'वैकल्पिक टिप्पणी दर्ज करें' : 'Enter optional remark',
      [
        { text: language === 'hi' ? 'रद्द करें' : 'Cancel', style: 'cancel' },
        {
          text: language === 'hi' ? 'अनुमोदित करें' : 'Approve',
          onPress: async (remark) => {
            setSubmitting(true);
            try {
              await api.put(`/stock/transfer-requests/${requestId}/approve${remark ? `?remark=${encodeURIComponent(remark)}` : ''}`);
              Alert.alert(t('success'), language === 'hi' ? 'अनुरोध अनुमोदित और स्टॉक स्थानांतरित' : 'Request approved and stock transferred');
              fetchTransferRequests(activeRequestTab === 'pending' ? 'pending' : undefined);
              fetchData();
            } catch (error: any) {
              Alert.alert(t('error'), error.response?.data?.detail || 'Failed to approve');
            } finally {
              setSubmitting(false);
            }
          },
        },
      ],
      'plain-text',
      ''
    );
  };

  const handleRejectRequest = async (requestId: string) => {
    Alert.prompt(
      language === 'hi' ? 'अस्वीकृति कारण' : 'Rejection Reason',
      language === 'hi' ? 'कारण दर्ज करें' : 'Enter reason for rejection',
      [
        { text: language === 'hi' ? 'रद्द करें' : 'Cancel', style: 'cancel' },
        {
          text: language === 'hi' ? 'अस्वीकार करें' : 'Reject',
          style: 'destructive',
          onPress: async (remark) => {
            setSubmitting(true);
            try {
              await api.put(`/stock/transfer-requests/${requestId}/reject?remark=${encodeURIComponent(remark || 'Rejected by admin')}`);
              Alert.alert(t('success'), language === 'hi' ? 'अनुरोध अस्वीकृत' : 'Request rejected');
              fetchTransferRequests(activeRequestTab === 'pending' ? 'pending' : undefined);
              fetchData();
            } catch (error: any) {
              Alert.alert(t('error'), error.response?.data?.detail || 'Failed to reject');
            } finally {
              setSubmitting(false);
            }
          },
        },
      ],
      'plain-text',
      ''
    );
  };

  // Fallback for platforms that don't support Alert.prompt
  const handleApproveSimple = async (request: TransferRequest) => {
    setApprovalRequest(request);
    setApprovalQuantity(request.quantity.toString());
    setApprovalRemark('');
    setShowApprovalModal(true);
  };

  const submitApproval = async () => {
    if (!approvalRequest) return;
    
    const qty = parseFloat(approvalQuantity);
    if (isNaN(qty) || qty <= 0) {
      Alert.alert(t('error'), language === 'hi' ? 'वैध मात्रा दर्ज करें' : 'Enter valid quantity');
      return;
    }
    
    setSubmitting(true);
    try {
      const params = new URLSearchParams();
      if (approvalRemark) params.append('remark', approvalRemark);
      if (qty !== approvalRequest.quantity) params.append('approved_quantity', qty.toString());
      
      const url = `/stock/transfer-requests/${approvalRequest.id}/approve${params.toString() ? '?' + params.toString() : ''}`;
      await api.put(url);
      
      let message = language === 'hi' ? 'अनुरोध अनुमोदित और स्टॉक स्थानांतरित' : 'Request approved and stock transferred';
      if (qty !== approvalRequest.quantity) {
        message = language === 'hi' 
          ? `${qty} इकाई अनुमोदित (अनुरोधित: ${approvalRequest.quantity})`
          : `Approved ${qty} units (requested: ${approvalRequest.quantity})`;
      }
      
      Alert.alert(t('success'), message);
      setShowApprovalModal(false);
      setApprovalRequest(null);
      fetchTransferRequests(activeRequestTab === 'pending' ? 'pending' : undefined);
      fetchData();
    } catch (error: any) {
      Alert.alert(t('error'), error.response?.data?.detail || 'Failed to approve');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRejectSimple = async (requestId: string) => {
    Alert.alert(
      language === 'hi' ? 'स्थानांतरण अस्वीकार करें?' : 'Reject Transfer?',
      language === 'hi' ? 'क्या आप इस स्थानांतरण अनुरोध को अस्वीकार करना चाहते हैं?' : 'Do you want to reject this transfer request?',
      [
        { text: language === 'hi' ? 'रद्द करें' : 'Cancel', style: 'cancel' },
        {
          text: language === 'hi' ? 'अस्वीकार करें' : 'Reject',
          style: 'destructive',
          onPress: async () => {
            setSubmitting(true);
            try {
              await api.put(`/stock/transfer-requests/${requestId}/reject?remark=Rejected`);
              Alert.alert(t('success'), language === 'hi' ? 'अनुरोध अस्वीकृत' : 'Request rejected');
              fetchTransferRequests(activeRequestTab === 'pending' ? 'pending' : undefined);
              fetchData();
            } catch (error: any) {
              Alert.alert(t('error'), error.response?.data?.detail || 'Failed to reject');
            } finally {
              setSubmitting(false);
            }
          },
        },
      ]
    );
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

  const renderTransferRequest = ({ item }: { item: TransferRequest }) => (
    <Card style={styles.requestCard}>
      <View style={styles.requestHeader}>
        <View style={styles.requestInfo}>
          <Text style={styles.requestProduct}>{item.product_name}</Text>
          <Text style={styles.requestQty}>{item.quantity} units</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
          <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
            {getStatusLabel(item.status)}
          </Text>
        </View>
      </View>
      
      <View style={styles.transferFlow}>
        <View style={styles.outletBox}>
          <Text style={styles.outletLabel}>{language === 'hi' ? 'से' : 'From'}</Text>
          <Text style={styles.outletText}>{item.from_outlet_name}</Text>
        </View>
        <Ionicons name="arrow-forward" size={20} color="#666" />
        <View style={styles.outletBox}>
          <Text style={styles.outletLabel}>{language === 'hi' ? 'को' : 'To'}</Text>
          <Text style={styles.outletText}>{item.to_outlet_name}</Text>
        </View>
      </View>
      
      <Text style={styles.requestMeta}>
        {language === 'hi' ? 'द्वारा: ' : 'By: '}{item.requested_by_name} • {new Date(item.created_at).toLocaleDateString('en-IN')}
      </Text>
      
      {item.reason && (
        <Text style={styles.requestReason}>
          {language === 'hi' ? 'कारण: ' : 'Reason: '}{item.reason}
        </Text>
      )}
      
      {item.admin_remark && (
        <Text style={styles.adminRemark}>
          {language === 'hi' ? 'एडमिन टिप्पणी: ' : 'Admin Remark: '}{item.admin_remark}
        </Text>
      )}
      
      {item.status === 'pending' && (
        <View style={styles.actionButtons}>
          <TouchableOpacity 
            style={[styles.actionBtn, styles.approveBtn]}
            onPress={() => handleApproveSimple(item)}
          >
            <Ionicons name="checkmark" size={18} color="#FFF" />
            <Text style={styles.actionBtnText}>{language === 'hi' ? 'अनुमोदित' : 'Approve'}</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.actionBtn, styles.rejectBtn]}
            onPress={() => handleRejectSimple(item.id)}
          >
            <Ionicons name="close" size={18} color="#FFF" />
            <Text style={styles.actionBtnText}>{language === 'hi' ? 'अस्वीकार' : 'Reject'}</Text>
          </TouchableOpacity>
        </View>
      )}
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
          <TouchableOpacity 
            style={styles.iconBtn} 
            onPress={() => setShowTransferRequests(true)}
          >
            <Ionicons name="git-pull-request" size={28} color="#7B1FA2" />
            {pendingCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{pendingCount}</Text>
              </View>
            )}
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

      {/* Allocate Stock Modal (Direct Admin Transfer) */}
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

      {/* Transfer Requests Modal */}
      <Modal visible={showTransferRequests} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { maxHeight: '85%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {language === 'hi' ? 'स्थानांतरण अनुरोध' : 'Transfer Requests'}
              </Text>
              <TouchableOpacity onPress={() => setShowTransferRequests(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.tabBar}>
              <TouchableOpacity 
                style={[styles.tab, activeRequestTab === 'pending' && styles.tabActive]}
                onPress={() => setActiveRequestTab('pending')}
              >
                <Text style={[styles.tabText, activeRequestTab === 'pending' && styles.tabTextActive]}>
                  {language === 'hi' ? 'लंबित' : 'Pending'}
                  {pendingCount > 0 && ` (${pendingCount})`}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.tab, activeRequestTab === 'all' && styles.tabActive]}
                onPress={() => setActiveRequestTab('all')}
              >
                <Text style={[styles.tabText, activeRequestTab === 'all' && styles.tabTextActive]}>
                  {language === 'hi' ? 'सभी' : 'All'}
                </Text>
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

      {/* Approval Modal with Quantity Modification */}
      <Modal visible={showApprovalModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {language === 'hi' ? 'अनुरोध अनुमोदित करें' : 'Approve Request'}
              </Text>
              <TouchableOpacity onPress={() => setShowApprovalModal(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            {approvalRequest && (
              <>
                <View style={styles.approvalInfo}>
                  <Text style={styles.approvalProduct}>{approvalRequest.product_name}</Text>
                  <View style={styles.transferFlow}>
                    <View style={styles.outletBox}>
                      <Text style={styles.outletLabel}>{language === 'hi' ? 'से' : 'From'}</Text>
                      <Text style={styles.outletText}>{approvalRequest.from_outlet_name}</Text>
                    </View>
                    <Ionicons name="arrow-forward" size={20} color="#666" />
                    <View style={styles.outletBox}>
                      <Text style={styles.outletLabel}>{language === 'hi' ? 'को' : 'To'}</Text>
                      <Text style={styles.outletText}>{approvalRequest.to_outlet_name}</Text>
                    </View>
                  </View>
                  <Text style={styles.requestedQtyLabel}>
                    {language === 'hi' ? 'अनुरोधित मात्रा:' : 'Requested Quantity:'} 
                    <Text style={styles.requestedQtyValue}> {approvalRequest.quantity}</Text>
                  </Text>
                </View>

                <Input
                  label={language === 'hi' ? 'अनुमोदित मात्रा' : 'Approved Quantity'}
                  placeholder="0"
                  value={approvalQuantity}
                  onChangeText={setApprovalQuantity}
                  keyboardType="decimal-pad"
                />
                <Text style={styles.quantityHint}>
                  {language === 'hi' 
                    ? 'आप आंशिक, पूर्ण या अधिक मात्रा अनुमोदित कर सकते हैं' 
                    : 'You can approve partial, full, or more quantity'}
                </Text>

                <Input
                  label={language === 'hi' ? 'टिप्पणी (वैकल्पिक)' : 'Remark (optional)'}
                  placeholder={language === 'hi' ? 'टिप्पणी दर्ज करें...' : 'Enter remark...'}
                  value={approvalRemark}
                  onChangeText={setApprovalRemark}
                />

                <View style={styles.modalButtons}>
                  <Button 
                    title={t('cancel')} 
                    variant="outline" 
                    onPress={() => setShowApprovalModal(false)} 
                    style={{ flex: 1, marginRight: 8 }} 
                  />
                  <Button 
                    title={language === 'hi' ? 'अनुमोदित करें' : 'Approve'} 
                    onPress={submitApproval} 
                    loading={submitting} 
                    style={{ flex: 1 }} 
                  />
                </View>
              </>
            )}
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
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#D32F2F',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: 'bold',
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
  // Transfer Request Styles
  tabBar: {
    flexDirection: 'row',
    marginBottom: 16,
    borderRadius: 8,
    backgroundColor: '#E8E8E8',
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 6,
  },
  tabActive: {
    backgroundColor: '#FFF',
  },
  tabText: {
    color: '#666',
    fontWeight: '500',
  },
  tabTextActive: {
    color: '#2E7D32',
    fontWeight: '600',
  },
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
  requestReason: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    fontStyle: 'italic',
  },
  adminRemark: {
    fontSize: 12,
    color: '#1976D2',
    marginTop: 4,
    fontWeight: '500',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  approveBtn: {
    backgroundColor: '#4CAF50',
  },
  rejectBtn: {
    backgroundColor: '#D32F2F',
  },
  actionBtnText: {
    color: '#FFF',
    fontWeight: '600',
  },
  // Approval Modal Styles
  approvalInfo: {
    backgroundColor: '#F5F5F5',
    padding: 14,
    borderRadius: 10,
    marginBottom: 16,
  },
  approvalProduct: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
  },
  requestedQtyLabel: {
    fontSize: 14,
    color: '#666',
    marginTop: 12,
    textAlign: 'center',
  },
  requestedQtyValue: {
    fontWeight: 'bold',
    color: '#333',
  },
  quantityHint: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
    marginTop: 4,
    marginBottom: 8,
  },
});
