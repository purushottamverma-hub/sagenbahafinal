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
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../../src/components/Card';
import { Button } from '../../src/components/Button';
import { Input } from '../../src/components/Input';
import { useTranslation } from '../../src/utils/useTranslation';
import { useAuthStore } from '../../src/store/authStore';
import { useSettingsStore } from '../../src/store/settingsStore';
import api from '../../src/utils/api';
import { printBill, shareBillAsPDF } from '../../src/utils/billGenerator';

interface Product {
  id: string;
  name: string;
  name_hi?: string;
  unit: string;
  category: string;
}

interface Outlet {
  id: string;
  name: string;
}

interface Customer {
  id: string;
  name: string;
  mobile?: string;
  outstanding_balance: number;
}

interface SaleItem {
  product_id: string;
  product_name: string;
  quantity: number;
  rate: number;
  amount: number;
}

interface Sale {
  id: string;
  bill_number: string;
  outlet_id: string;
  outlet_name?: string;
  customer_name?: string;
  total_amount: number;
  payment_mode: string;
  cash_amount: number;
  online_amount: number;
  credit_amount: number;
  created_at: string;
  items: SaleItem[];
}

export default function SalesScreen() {
  const { t, language } = useTranslation();
  const { user } = useAuthStore();
  const settingsLanguage = useSettingsStore((state) => state.language);
  const [sales, setSales] = useState<Sale[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showNewSale, setShowNewSale] = useState(false);
  const [showBillDetails, setShowBillDetails] = useState(false);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [isPrinting, setIsPrinting] = useState(false);

  // New sale state
  const [selectedOutlet, setSelectedOutlet] = useState<string>('');
  const [selectedCustomer, setSelectedCustomer] = useState<string>('');
  const [customerName, setCustomerName] = useState('');
  const [saleItems, setSaleItems] = useState<SaleItem[]>([]);
  const [paymentMode, setPaymentMode] = useState('cash');
  const [cashAmount, setCashAmount] = useState('');
  const [onlineAmount, setOnlineAmount] = useState('');
  const [discount, setDiscount] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchData = async () => {
    try {
      const [salesRes, productsRes, outletsRes, customersRes] = await Promise.all([
        api.get('/sales'),
        api.get('/products'),
        api.get('/outlets'),
        api.get('/customers'),
      ]);
      setSales(salesRes.data);
      setProducts(productsRes.data);
      setOutlets(outletsRes.data);
      setCustomers(customersRes.data);
      if (outletsRes.data.length > 0) {
        setSelectedOutlet(outletsRes.data[0].id);
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

  const formatCurrency = (amount: number) => `${t('currency')}${amount.toLocaleString('en-IN')}`;

  const getSubtotal = () => saleItems.reduce((sum, item) => sum + item.amount, 0);
  const getTotal = () => Math.max(0, getSubtotal() - (parseFloat(discount) || 0));

  const addItem = (product: Product) => {
    const existing = saleItems.find(i => i.product_id === product.id);
    if (existing) {
      setSaleItems(saleItems.map(i =>
        i.product_id === product.id
          ? { ...i, quantity: i.quantity + 1, amount: (i.quantity + 1) * i.rate }
          : i
      ));
    } else {
      setSaleItems([...saleItems, {
        product_id: product.id,
        product_name: language === 'hi' && product.name_hi ? product.name_hi : product.name,
        quantity: 1,
        rate: 0,
        amount: 0,
      }]);
    }
  };

  const updateItemRate = (productId: string, rate: string) => {
    const rateNum = parseFloat(rate) || 0;
    setSaleItems(saleItems.map(i =>
      i.product_id === productId
        ? { ...i, rate: rateNum, amount: i.quantity * rateNum }
        : i
    ));
  };

  const updateItemQty = (productId: string, qty: string) => {
    const qtyNum = parseFloat(qty) || 0;
    setSaleItems(saleItems.map(i =>
      i.product_id === productId
        ? { ...i, quantity: qtyNum, amount: qtyNum * i.rate }
        : i
    ));
  };

  const removeItem = (productId: string) => {
    setSaleItems(saleItems.filter(i => i.product_id !== productId));
  };

  const resetSaleForm = () => {
    setSaleItems([]);
    setSelectedCustomer('');
    setCustomerName('');
    setPaymentMode('cash');
    setCashAmount('');
    setOnlineAmount('');
    setDiscount('');
  };

  const handleCreateSale = async () => {
    if (saleItems.length === 0) {
      Alert.alert(t('error'), language === 'hi' ? 'कम से कम एक आइटम जोड़ें' : 'Add at least one item');
      return;
    }

    if (saleItems.some(i => i.rate <= 0)) {
      Alert.alert(t('error'), language === 'hi' ? 'सभी आइटम्स की दर दर्ज करें' : 'Enter rate for all items');
      return;
    }

    const total = getTotal();
    let cash = 0, online = 0, credit = 0;

    if (paymentMode === 'cash') {
      cash = total;
    } else if (paymentMode === 'online') {
      online = total;
    } else if (paymentMode === 'credit') {
      credit = total;
      if (!selectedCustomer && !customerName.trim()) {
        Alert.alert(t('error'), language === 'hi' ? 'उधार के लिए ग्राहक चुनें' : 'Select customer for credit sale');
        return;
      }
    } else if (paymentMode === 'partial') {
      cash = parseFloat(cashAmount) || 0;
      online = parseFloat(onlineAmount) || 0;
      credit = Math.max(0, total - cash - online);
      if (credit > 0 && !selectedCustomer && !customerName.trim()) {
        Alert.alert(t('error'), language === 'hi' ? 'उधार के लिए ग्राहक चुनें' : 'Select customer for credit sale');
        return;
      }
    }

    setSubmitting(true);
    try {
      const customer = customers.find(c => c.id === selectedCustomer);
      const saleData = {
        outlet_id: selectedOutlet,
        customer_id: selectedCustomer || null,
        customer_name: selectedCustomer ? customer?.name : customerName || null,
        items: saleItems,
        subtotal: getSubtotal(),
        discount: parseFloat(discount) || 0,
        total_amount: total,
        payment_mode: paymentMode,
        cash_amount: cash,
        online_amount: online,
        credit_amount: credit,
      };

      const response = await api.post('/sales', saleData);
      Alert.alert(
        t('success'),
        `${t('billNumber')}: ${response.data.bill_number}`,
        [{ text: t('ok'), onPress: () => {
          setShowNewSale(false);
          resetSaleForm();
          fetchData();
        }}]
      );
    } catch (error: any) {
      Alert.alert(t('error'), error.response?.data?.detail || 'Failed to create sale');
    } finally {
      setSubmitting(false);
    }
  };

  const viewBill = (sale: Sale) => {
    setSelectedSale(sale);
    setShowBillDetails(true);
  };

  const renderSaleItem = ({ item }: { item: Sale }) => (
    <Card onPress={() => viewBill(item)}>
      <View style={styles.saleRow}>
        <View>
          <Text style={styles.billNumber}>{item.bill_number}</Text>
          <Text style={styles.saleDate}>
            {new Date(item.created_at).toLocaleDateString('en-IN')}
          </Text>
          {item.customer_name && (
            <Text style={styles.customerText}>{item.customer_name}</Text>
          )}
        </View>
        <View style={styles.saleRight}>
          <Text style={styles.saleAmount}>{formatCurrency(item.total_amount)}</Text>
          <View style={[
            styles.paymentBadge,
            { backgroundColor: item.payment_mode === 'credit' ? '#FFF3E0' : '#E8F5E9' }
          ]}>
            <Text style={[
              styles.paymentText,
              { color: item.payment_mode === 'credit' ? '#E65100' : '#2E7D32' }
            ]}>
              {item.payment_mode === 'cash' ? t('cash') :
               item.payment_mode === 'online' ? t('online') :
               item.payment_mode === 'credit' ? t('credit') : t('partial')}
            </Text>
          </View>
        </View>
      </View>
    </Card>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('sales')}</Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => setShowNewSale(true)}
        >
          <Ionicons name="add" size={24} color="#FFF" />
          <Text style={styles.addBtnText}>{t('newSale')}</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={sales}
        renderItem={renderSaleItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#2E7D32']} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="receipt-outline" size={48} color="#CCC" />
            <Text style={styles.emptyText}>
              {language === 'hi' ? 'कोई बिक्री नहीं' : 'No sales yet'}
            </Text>
          </View>
        }
      />

      {/* New Sale Modal */}
      <Modal visible={showNewSale} animationType="slide">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => { setShowNewSale(false); resetSaleForm(); }}>
              <Ionicons name="close" size={28} color="#333" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{t('newSale')}</Text>
            <View style={{ width: 28 }} />
          </View>

          <ScrollView style={styles.modalContent}>
            {/* Outlet Selection */}
            <Text style={styles.label}>{t('outlets')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.outletScroll}>
              {outlets.map(outlet => (
                <TouchableOpacity
                  key={outlet.id}
                  style={[
                    styles.outletChip,
                    selectedOutlet === outlet.id && styles.outletChipActive
                  ]}
                  onPress={() => setSelectedOutlet(outlet.id)}
                >
                  <Text style={[
                    styles.outletChipText,
                    selectedOutlet === outlet.id && styles.outletChipTextActive
                  ]}>
                    {outlet.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Products */}
            <Text style={styles.label}>{t('products')}</Text>
            <View style={styles.productGrid}>
              {products.map(product => (
                <TouchableOpacity
                  key={product.id}
                  style={styles.productChip}
                  onPress={() => addItem(product)}
                >
                  <Text style={styles.productChipText}>
                    {language === 'hi' && product.name_hi ? product.name_hi : product.name}
                  </Text>
                  <Text style={styles.productUnit}>({product.unit})</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Sale Items */}
            {saleItems.length > 0 && (
              <View style={styles.itemsSection}>
                <Text style={styles.label}>{language === 'hi' ? 'आइटम्स' : 'Items'}</Text>
                {saleItems.map(item => (
                  <View key={item.product_id} style={styles.itemRow}>
                    <View style={styles.itemInfo}>
                      <Text style={styles.itemName}>{item.product_name}</Text>
                      <TouchableOpacity onPress={() => removeItem(item.product_id)}>
                        <Ionicons name="trash-outline" size={18} color="#D32F2F" />
                      </TouchableOpacity>
                    </View>
                    <View style={styles.itemInputs}>
                      <Input
                        placeholder={t('quantity')}
                        value={item.quantity.toString()}
                        onChangeText={(val) => updateItemQty(item.product_id, val)}
                        keyboardType="decimal-pad"
                        containerStyle={styles.qtyInput}
                      />
                      <Text style={styles.multiply}>×</Text>
                      <Input
                        placeholder={t('rate')}
                        value={item.rate > 0 ? item.rate.toString() : ''}
                        onChangeText={(val) => updateItemRate(item.product_id, val)}
                        keyboardType="decimal-pad"
                        containerStyle={styles.rateInput}
                      />
                      <Text style={styles.equals}>=</Text>
                      <Text style={styles.itemAmount}>{formatCurrency(item.amount)}</Text>
                    </View>
                  </View>
                ))}

                {/* Totals */}
                <View style={styles.totalsSection}>
                  <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>{t('subtotal')}</Text>
                    <Text style={styles.totalValue}>{formatCurrency(getSubtotal())}</Text>
                  </View>
                  <Input
                    label={t('discount')}
                    placeholder="0"
                    value={discount}
                    onChangeText={setDiscount}
                    keyboardType="decimal-pad"
                    containerStyle={styles.discountInput}
                  />
                  <View style={styles.totalRow}>
                    <Text style={styles.grandTotalLabel}>{t('total')}</Text>
                    <Text style={styles.grandTotalValue}>{formatCurrency(getTotal())}</Text>
                  </View>
                </View>

                {/* Customer */}
                <Text style={styles.label}>{t('selectCustomer')}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.customerScroll}>
                  <TouchableOpacity
                    style={[
                      styles.customerChip,
                      !selectedCustomer && styles.customerChipActive
                    ]}
                    onPress={() => setSelectedCustomer('')}
                  >
                    <Text style={[
                      styles.customerChipText,
                      !selectedCustomer && styles.customerChipTextActive
                    ]}>
                      {t('walkInCustomer')}
                    </Text>
                  </TouchableOpacity>
                  {customers.map(customer => (
                    <TouchableOpacity
                      key={customer.id}
                      style={[
                        styles.customerChip,
                        selectedCustomer === customer.id && styles.customerChipActive
                      ]}
                      onPress={() => setSelectedCustomer(customer.id)}
                    >
                      <Text style={[
                        styles.customerChipText,
                        selectedCustomer === customer.id && styles.customerChipTextActive
                      ]}>
                        {customer.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {!selectedCustomer && (
                  <Input
                    label={language === 'hi' ? 'ग्राहक का नाम (वैकल्पिक)' : 'Customer Name (optional)'}
                    placeholder={language === 'hi' ? 'नाम दर्ज करें' : 'Enter name'}
                    value={customerName}
                    onChangeText={setCustomerName}
                  />
                )}

                {/* Payment Mode */}
                <Text style={styles.label}>{t('paymentMode')}</Text>
                <View style={styles.paymentModes}>
                  {['cash', 'online', 'credit', 'partial'].map(mode => (
                    <TouchableOpacity
                      key={mode}
                      style={[
                        styles.paymentModeBtn,
                        paymentMode === mode && styles.paymentModeBtnActive
                      ]}
                      onPress={() => setPaymentMode(mode)}
                    >
                      <Text style={[
                        styles.paymentModeText,
                        paymentMode === mode && styles.paymentModeTextActive
                      ]}>
                        {mode === 'cash' ? t('cash') :
                         mode === 'online' ? t('online') :
                         mode === 'credit' ? t('credit') : t('partial')}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {paymentMode === 'partial' && (
                  <View style={styles.partialInputs}>
                    <Input
                      label={t('cashAmount')}
                      placeholder="0"
                      value={cashAmount}
                      onChangeText={setCashAmount}
                      keyboardType="decimal-pad"
                      containerStyle={styles.partialInput}
                    />
                    <Input
                      label={t('onlineAmount')}
                      placeholder="0"
                      value={onlineAmount}
                      onChangeText={setOnlineAmount}
                      keyboardType="decimal-pad"
                      containerStyle={styles.partialInput}
                    />
                    <Text style={styles.creditCalc}>
                      {t('creditAmount')}: {formatCurrency(Math.max(0, getTotal() - (parseFloat(cashAmount) || 0) - (parseFloat(onlineAmount) || 0)))}
                    </Text>
                  </View>
                )}

                <Button
                  title={t('generateBill')}
                  onPress={handleCreateSale}
                  loading={submitting}
                  size="large"
                  style={styles.generateBtn}
                />
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Bill Details Modal */}
      <Modal visible={showBillDetails} animationType="slide">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowBillDetails(false)}>
              <Ionicons name="close" size={28} color="#333" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{t('billNumber')} {selectedSale?.bill_number}</Text>
            <View style={{ width: 28 }} />
          </View>

          {selectedSale && (
            <ScrollView style={styles.billContent}>
              <Card>
                <Text style={styles.billHeader}>{t('appName')}</Text>
                <Text style={styles.billSubheader}>
                  {language === 'hi'
                    ? 'पोरैयाहाट ब्लॉक, गोड्डा'
                    : 'Poraiyahat Block, Godda'
                  }
                </Text>
                <View style={styles.billDivider} />
                
                <View style={styles.billInfo}>
                  <Text>{t('billNumber')}: {selectedSale.bill_number}</Text>
                  <Text>{language === 'hi' ? 'तारीख' : 'Date'}: {new Date(selectedSale.created_at).toLocaleDateString('en-IN')}</Text>
                  {selectedSale.customer_name && (
                    <Text>{t('customerName')}: {selectedSale.customer_name}</Text>
                  )}
                </View>

                <View style={styles.billDivider} />

                <View style={styles.billItems}>
                  <View style={styles.billItemHeader}>
                    <Text style={styles.billColItem}>{language === 'hi' ? 'आइटम' : 'Item'}</Text>
                    <Text style={styles.billColQty}>{t('quantity')}</Text>
                    <Text style={styles.billColRate}>{t('rate')}</Text>
                    <Text style={styles.billColAmt}>{t('amount')}</Text>
                  </View>
                  {selectedSale.items.map((item, idx) => (
                    <View key={idx} style={styles.billItemRow}>
                      <Text style={styles.billColItem}>{item.product_name}</Text>
                      <Text style={styles.billColQty}>{item.quantity}</Text>
                      <Text style={styles.billColRate}>{item.rate}</Text>
                      <Text style={styles.billColAmt}>{item.amount}</Text>
                    </View>
                  ))}
                </View>

                <View style={styles.billDivider} />

                <View style={styles.billTotals}>
                  <View style={styles.billTotalRow}>
                    <Text>{t('total')}</Text>
                    <Text style={styles.billTotalAmt}>{formatCurrency(selectedSale.total_amount)}</Text>
                  </View>
                  <View style={styles.billTotalRow}>
                    <Text>{t('cash')}</Text>
                    <Text>{formatCurrency(selectedSale.cash_amount)}</Text>
                  </View>
                  <View style={styles.billTotalRow}>
                    <Text>{t('online')}</Text>
                    <Text>{formatCurrency(selectedSale.online_amount)}</Text>
                  </View>
                  <View style={styles.billTotalRow}>
                    <Text>{t('credit')}</Text>
                    <Text>{formatCurrency(selectedSale.credit_amount)}</Text>
                  </View>
                </View>

                <View style={styles.billDivider} />
                <Text style={styles.billFooter}>
                  {language === 'hi' ? 'धन्यवाद!' : 'Thank you!'}
                </Text>
              </Card>
            </ScrollView>
          )}
        </SafeAreaView>
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
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2E7D32',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  addBtnText: {
    color: '#FFF',
    fontWeight: '600',
    marginLeft: 4,
  },
  listContent: {
    padding: 16,
  },
  saleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  billNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  saleDate: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  customerText: {
    fontSize: 13,
    color: '#2E7D32',
    marginTop: 4,
  },
  saleRight: {
    alignItems: 'flex-end',
  },
  saleAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  paymentBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
  },
  paymentText: {
    fontSize: 11,
    fontWeight: '600',
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
  modalContainer: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    marginTop: 16,
  },
  outletScroll: {
    marginBottom: 8,
  },
  outletChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#E8E8E8',
    borderRadius: 20,
    marginRight: 8,
  },
  outletChipActive: {
    backgroundColor: '#2E7D32',
  },
  outletChipText: {
    color: '#666',
    fontWeight: '500',
  },
  outletChipTextActive: {
    color: '#FFF',
  },
  productGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  productChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
    marginBottom: 8,
  },
  productChipText: {
    color: '#1565C0',
    fontWeight: '500',
  },
  productUnit: {
    fontSize: 11,
    color: '#666',
  },
  itemsSection: {
    marginTop: 16,
  },
  itemRow: {
    backgroundColor: '#FFF',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  itemInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  itemInputs: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  qtyInput: {
    width: 60,
    marginBottom: 0,
  },
  multiply: {
    marginHorizontal: 8,
    fontSize: 16,
    color: '#666',
  },
  rateInput: {
    width: 80,
    marginBottom: 0,
  },
  equals: {
    marginHorizontal: 8,
    fontSize: 16,
    color: '#666',
  },
  itemAmount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2E7D32',
    minWidth: 80,
    textAlign: 'right',
  },
  totalsSection: {
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 8,
    marginTop: 16,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  totalLabel: {
    fontSize: 14,
    color: '#666',
  },
  totalValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  discountInput: {
    marginBottom: 8,
  },
  grandTotalLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  grandTotalValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2E7D32',
  },
  customerScroll: {
    marginBottom: 8,
  },
  customerChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#E8E8E8',
    borderRadius: 20,
    marginRight: 8,
  },
  customerChipActive: {
    backgroundColor: '#2E7D32',
  },
  customerChipText: {
    color: '#666',
    fontWeight: '500',
  },
  customerChipTextActive: {
    color: '#FFF',
  },
  paymentModes: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  paymentModeBtn: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#E8E8E8',
    borderRadius: 8,
  },
  paymentModeBtnActive: {
    backgroundColor: '#2E7D32',
  },
  paymentModeText: {
    color: '#666',
    fontWeight: '600',
  },
  paymentModeTextActive: {
    color: '#FFF',
  },
  partialInputs: {
    marginTop: 16,
  },
  partialInput: {
    marginBottom: 8,
  },
  creditCalc: {
    fontSize: 14,
    color: '#E65100',
    fontWeight: '500',
    marginTop: 8,
  },
  generateBtn: {
    marginTop: 24,
    marginBottom: 40,
  },
  billContent: {
    padding: 16,
  },
  billHeader: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#2E7D32',
  },
  billSubheader: {
    fontSize: 12,
    textAlign: 'center',
    color: '#666',
    marginTop: 4,
  },
  billDivider: {
    height: 1,
    backgroundColor: '#E0E0E0',
    marginVertical: 12,
  },
  billInfo: {
    gap: 4,
  },
  billItems: {
    marginTop: 8,
  },
  billItemHeader: {
    flexDirection: 'row',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  billItemRow: {
    flexDirection: 'row',
    paddingVertical: 6,
  },
  billColItem: {
    flex: 2,
    fontSize: 13,
  },
  billColQty: {
    flex: 1,
    textAlign: 'center',
    fontSize: 13,
  },
  billColRate: {
    flex: 1,
    textAlign: 'right',
    fontSize: 13,
  },
  billColAmt: {
    flex: 1,
    textAlign: 'right',
    fontSize: 13,
  },
  billTotals: {
    marginTop: 8,
  },
  billTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  billTotalAmt: {
    fontWeight: 'bold',
    fontSize: 16,
  },
  billFooter: {
    textAlign: 'center',
    marginTop: 12,
    fontStyle: 'italic',
    color: '#666',
  },
});
