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
import { useAuthStore } from '../../src/store/authStore';
import api from '../../src/utils/api';

interface Product {
  id: string;
  name: string;
  name_hi?: string;
  unit: string;
}

interface Customer {
  id: string;
  name: string;
  mobile?: string;
  address?: string;
  village?: string;
  customer_type?: string;
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
  customer_name?: string;
  total_amount: number;
  payment_mode: string;
  created_at: string;
  items: SaleItem[];
}

export default function AgentSalesScreen() {
  const { t, language } = useTranslation();
  const { user } = useAuthStore();
  const [sales, setSales] = useState<Sale[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showNewSale, setShowNewSale] = useState(false);

  // New sale state
  const [selectedCustomer, setSelectedCustomer] = useState<string>('');
  const [customerName, setCustomerName] = useState('');
  const [customerMobile, setCustomerMobile] = useState('');  // New: mobile number
  const [saleItems, setSaleItems] = useState<SaleItem[]>([]);
  const [paymentMode, setPaymentMode] = useState('cash');
  const [cashAmount, setCashAmount] = useState('');
  const [onlineAmount, setOnlineAmount] = useState('');
  const [discount, setDiscount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [productSearch, setProductSearch] = useState('');  // New: product search

  // Customer Selection Flow State (same as admin)
  const [customerSelectionMode, setCustomerSelectionMode] = useState<'select' | 'new' | 'existing' | 'confirmed'>('select');
  const [customerSearch, setCustomerSearch] = useState('');
  const [searchResults, setSearchResults] = useState<Customer[]>([]);
  const [searchingCustomers, setSearchingCustomers] = useState(false);
  const [newCustomerData, setNewCustomerData] = useState({
    name: '',
    mobile: '',
    address: '',
    village: '',
  });
  const [creatingCustomer, setCreatingCustomer] = useState(false);
  const [confirmedCustomer, setConfirmedCustomer] = useState<Customer | null>(null);

  // Filter products based on search
  const filteredProducts = React.useMemo(() => {
    if (!productSearch.trim()) return products;
    const query = productSearch.toLowerCase();
    return products.filter(p => 
      p.name.toLowerCase().includes(query) || 
      (p.name_hi && p.name_hi.toLowerCase().includes(query))
    );
  }, [products, productSearch]);

  const fetchData = async () => {
    try {
      const [salesRes, productsRes, customersRes] = await Promise.all([
        api.get('/sales'),
        api.get('/products'),
        api.get('/customers'),
      ]);
      setSales(salesRes.data);
      setProducts(productsRes.data);
      setCustomers(customersRes.data);
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

  // Customer Search Function
  const searchCustomers = async (query: string) => {
    if (!query || query.length < 2) {
      setSearchResults([]);
      return;
    }
    
    setSearchingCustomers(true);
    try {
      const response = await api.get('/customers/search', { params: { q: query } });
      setSearchResults(response.data);
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults([]);
    } finally {
      setSearchingCustomers(false);
    }
  };

  // Create New Customer and auto-create Khata
  const handleCreateNewCustomer = async () => {
    if (!newCustomerData.name.trim()) {
      Alert.alert(t('error'), language === 'hi' ? 'ग्राहक का नाम आवश्यक है' : 'Customer name is required');
      return;
    }

    setCreatingCustomer(true);
    try {
      const response = await api.post('/customers', {
        name: newCustomerData.name.trim(),
        mobile: newCustomerData.mobile.trim() || null,
        address: newCustomerData.address.trim() || null,
        village: newCustomerData.village.trim() || null,
        customer_type: 'registered',
      });
      
      const newCustomer: Customer = response.data;
      setConfirmedCustomer(newCustomer);
      setSelectedCustomer(newCustomer.id);
      setCustomerName(newCustomer.name);
      setCustomerSelectionMode('confirmed');
      
      // Refresh customers list
      fetchData();
      
      Alert.alert(
        t('success'),
        language === 'hi' 
          ? `ग्राहक "${newCustomer.name}" सफलतापूर्वक जोड़ा गया। खाता (Khata) स्वचालित रूप से बन गया।`
          : `Customer "${newCustomer.name}" added successfully. Khata (Ledger) auto-created.`
      );
    } catch (error: any) {
      Alert.alert(t('error'), error.response?.data?.detail || 'Failed to create customer');
    } finally {
      setCreatingCustomer(false);
    }
  };

  // Select existing customer
  const handleSelectExistingCustomer = (customer: Customer) => {
    setConfirmedCustomer(customer);
    setSelectedCustomer(customer.id);
    setCustomerName(customer.name);
    setCustomerSelectionMode('confirmed');
  };

  // Reset customer selection
  const resetCustomerSelection = () => {
    setCustomerSelectionMode('select');
    setConfirmedCustomer(null);
    setSelectedCustomer('');
    setCustomerName('');
    setCustomerSearch('');
    setSearchResults([]);
    setNewCustomerData({ name: '', mobile: '', address: '', village: '' });
  };

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
    setCustomerMobile('');
    setPaymentMode('cash');
    setCashAmount('');
    setOnlineAmount('');
    setDiscount('');
    setProductSearch('');
    // Reset customer selection flow
    setCustomerSelectionMode('select');
    setConfirmedCustomer(null);
    setCustomerSearch('');
    setSearchResults([]);
    setNewCustomerData({ name: '', mobile: '', address: '', village: '' });
  };

  const handleCreateSale = async () => {
    // Mandatory customer selection check
    if (customerSelectionMode !== 'confirmed' || !confirmedCustomer) {
      Alert.alert(
        t('error'), 
        language === 'hi' 
          ? 'कृपया पहले ग्राहक चुनें। बिल बनाने से पहले ग्राहक चयन आवश्यक है।' 
          : 'Please select a customer first. Customer selection is mandatory before creating a bill.'
      );
      return;
    }

    if (saleItems.length === 0) {
      Alert.alert(t('error'), language === 'hi' ? 'कम से कम एक आइटम जोड़ें' : 'Add at least one item');
      return;
    }

    if (saleItems.some(i => i.rate <= 0)) {
      Alert.alert(t('error'), language === 'hi' ? 'सभी आइटम्स की दर दर्ज करें' : 'Enter rate for all items');
      return;
    }

    if (!user?.outlet_id) {
      Alert.alert(t('error'), language === 'hi' ? 'आउटलेट असाइन नहीं है' : 'No outlet assigned');
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
    } else if (paymentMode === 'partial') {
      cash = parseFloat(cashAmount) || 0;
      online = parseFloat(onlineAmount) || 0;
      credit = Math.max(0, total - cash - online);
    }

    setSubmitting(true);
    try {
      // Use confirmed customer from the new flow
      const saleData = {
        outlet_id: user.outlet_id,
        customer_id: confirmedCustomer?.id || null,
        customer_name: confirmedCustomer?.name || null,
        customer_mobile: confirmedCustomer?.mobile || customerMobile || null,
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

  const renderSaleItem = ({ item }: { item: Sale }) => (
    <Card>
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
            {/* Product Search */}
            <Text style={styles.label}>{t('products')}</Text>
            <Input
              placeholder={language === 'hi' ? 'उत्पाद खोजें...' : 'Search products...'}
              value={productSearch}
              onChangeText={setProductSearch}
              containerStyle={{ marginBottom: 10 }}
            />
            <View style={styles.productGrid}>
              {filteredProducts.map(product => (
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

                {/* Customer Selection - MANDATORY */}
                <Text style={styles.label}>{t('selectCustomer')} *</Text>
                
                {/* Customer Selection Flow - Same as Admin */}
                {customerSelectionMode === 'select' && (
                  <View style={styles.customerSelectionContainer}>
                    <Text style={styles.customerSelectionTitle}>
                      {language === 'hi' ? 'ग्राहक चयन (आवश्यक)' : 'Customer Selection (Required)'}
                    </Text>
                    <View style={styles.customerSelectionOptions}>
                      <TouchableOpacity
                        style={styles.customerOptionBtn}
                        onPress={() => setCustomerSelectionMode('new')}
                      >
                        <Ionicons name="person-add" size={28} color="#2E7D32" />
                        <Text style={styles.customerOptionText}>
                          {language === 'hi' ? 'नया ग्राहक' : 'New Customer'}
                        </Text>
                        <Text style={styles.customerOptionSubtext}>
                          {language === 'hi' ? 'नया खाता बनाएं' : 'Create new Khata'}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.customerOptionBtn}
                        onPress={() => setCustomerSelectionMode('existing')}
                      >
                        <Ionicons name="search" size={28} color="#1976D2" />
                        <Text style={styles.customerOptionText}>
                          {language === 'hi' ? 'मौजूदा ग्राहक' : 'Existing Customer'}
                        </Text>
                        <Text style={styles.customerOptionSubtext}>
                          {language === 'hi' ? 'नाम/मोबाइल से खोजें' : 'Search by name/mobile'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {/* New Customer Form */}
                {customerSelectionMode === 'new' && (
                  <View style={styles.customerFormContainer}>
                    <View style={styles.customerFormHeader}>
                      <TouchableOpacity onPress={() => setCustomerSelectionMode('select')}>
                        <Ionicons name="arrow-back" size={24} color="#333" />
                      </TouchableOpacity>
                      <Text style={styles.customerFormTitle}>
                        {language === 'hi' ? 'नया ग्राहक जोड़ें' : 'Add New Customer'}
                      </Text>
                    </View>
                    <Input
                      label={`${t('customerName')} *`}
                      placeholder={language === 'hi' ? 'ग्राहक का नाम दर्ज करें' : 'Enter customer name'}
                      value={newCustomerData.name}
                      onChangeText={(val) => setNewCustomerData({ ...newCustomerData, name: val })}
                    />
                    <Input
                      label={t('mobile')}
                      placeholder={language === 'hi' ? 'मोबाइल नंबर' : 'Mobile number'}
                      value={newCustomerData.mobile}
                      onChangeText={(val) => setNewCustomerData({ ...newCustomerData, mobile: val })}
                      keyboardType="phone-pad"
                    />
                    <Input
                      label={t('address')}
                      placeholder={language === 'hi' ? 'पता दर्ज करें' : 'Enter address'}
                      value={newCustomerData.address}
                      onChangeText={(val) => setNewCustomerData({ ...newCustomerData, address: val })}
                    />
                    <Input
                      label={t('village')}
                      placeholder={language === 'hi' ? 'गाँव का नाम' : 'Village name'}
                      value={newCustomerData.village}
                      onChangeText={(val) => setNewCustomerData({ ...newCustomerData, village: val })}
                    />
                    <Button
                      title={language === 'hi' ? 'ग्राहक जोड़ें और खाता बनाएं' : 'Add Customer & Create Khata'}
                      onPress={handleCreateNewCustomer}
                      loading={creatingCustomer}
                      style={styles.createCustomerBtn}
                    />
                  </View>
                )}

                {/* Existing Customer Search */}
                {customerSelectionMode === 'existing' && (
                  <View style={styles.customerFormContainer}>
                    <View style={styles.customerFormHeader}>
                      <TouchableOpacity onPress={() => setCustomerSelectionMode('select')}>
                        <Ionicons name="arrow-back" size={24} color="#333" />
                      </TouchableOpacity>
                      <Text style={styles.customerFormTitle}>
                        {language === 'hi' ? 'ग्राहक खोजें' : 'Search Customer'}
                      </Text>
                    </View>
                    <View style={styles.searchInputContainer}>
                      <Ionicons name="search" size={20} color="#999" />
                      <TextInput
                        style={styles.customerSearchInput}
                        placeholder={language === 'hi' ? 'नाम या मोबाइल नंबर दर्ज करें' : 'Enter name or mobile number'}
                        value={customerSearch}
                        onChangeText={(val) => {
                          setCustomerSearch(val);
                          searchCustomers(val);
                        }}
                        placeholderTextColor="#999"
                      />
                    </View>
                    
                    {searchingCustomers && (
                      <Text style={styles.searchingText}>
                        {language === 'hi' ? 'खोज रहे हैं...' : 'Searching...'}
                      </Text>
                    )}
                    
                    {searchResults.length > 0 && (
                      <View style={styles.searchResultsContainer}>
                        <Text style={styles.searchResultsTitle}>
                          {language === 'hi' ? 'परिणाम:' : 'Results:'}
                        </Text>
                        {searchResults.map(customer => (
                          <TouchableOpacity
                            key={customer.id}
                            style={styles.searchResultItem}
                            onPress={() => handleSelectExistingCustomer(customer)}
                          >
                            <View style={styles.searchResultInfo}>
                              <Text style={styles.searchResultName}>{customer.name}</Text>
                              {customer.mobile && (
                                <Text style={styles.searchResultMobile}>
                                  <Ionicons name="call-outline" size={12} color="#666" /> {customer.mobile}
                                </Text>
                              )}
                              {customer.village && (
                                <Text style={styles.searchResultVillage}>
                                  <Ionicons name="location-outline" size={12} color="#666" /> {customer.village}
                                </Text>
                              )}
                            </View>
                            <View style={styles.searchResultAction}>
                              <Ionicons name="chevron-forward" size={20} color="#2E7D32" />
                            </View>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                    
                    {customerSearch.length >= 2 && searchResults.length === 0 && !searchingCustomers && (
                      <View style={styles.noResultsContainer}>
                        <Text style={styles.noResultsText}>
                          {language === 'hi' ? 'कोई ग्राहक नहीं मिला' : 'No customer found'}
                        </Text>
                        <Button
                          title={language === 'hi' ? 'नया ग्राहक बनाएं' : 'Create New Customer'}
                          onPress={() => {
                            setNewCustomerData({ ...newCustomerData, name: customerSearch });
                            setCustomerSelectionMode('new');
                          }}
                          variant="outline"
                          style={styles.createNewFromSearchBtn}
                        />
                      </View>
                    )}
                  </View>
                )}

                {/* Confirmed Customer Display */}
                {customerSelectionMode === 'confirmed' && confirmedCustomer && (
                  <View style={styles.confirmedCustomerContainer}>
                    <View style={styles.confirmedCustomerInfo}>
                      <Ionicons name="checkmark-circle" size={24} color="#2E7D32" />
                      <View style={styles.confirmedCustomerDetails}>
                        <Text style={styles.confirmedCustomerName}>{confirmedCustomer.name}</Text>
                        {confirmedCustomer.mobile && (
                          <Text style={styles.confirmedCustomerMobile}>{confirmedCustomer.mobile}</Text>
                        )}
                        {confirmedCustomer.outstanding_balance > 0 && (
                          <Text style={styles.confirmedCustomerDue}>
                            {language === 'hi' ? 'बकाया:' : 'Due:'} {formatCurrency(confirmedCustomer.outstanding_balance)}
                          </Text>
                        )}
                      </View>
                    </View>
                    <TouchableOpacity
                      style={styles.changeCustomerBtn}
                      onPress={resetCustomerSelection}
                    >
                      <Text style={styles.changeCustomerText}>
                        {language === 'hi' ? 'बदलें' : 'Change'}
                      </Text>
                    </TouchableOpacity>
                  </View>
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
  // Customer Selection Flow Styles
  customerSelectionContainer: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
    borderWidth: 2,
    borderColor: '#E65100',
    borderStyle: 'dashed',
  },
  customerSelectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#E65100',
    textAlign: 'center',
    marginBottom: 16,
  },
  customerSelectionOptions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    gap: 12,
  },
  customerOptionBtn: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  customerOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginTop: 8,
  },
  customerOptionSubtext: {
    fontSize: 11,
    color: '#666',
    marginTop: 4,
  },
  customerFormContainer: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
  },
  customerFormHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  customerFormTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  createCustomerBtn: {
    marginTop: 16,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  customerSearchInput: {
    flex: 1,
    height: 44,
    marginLeft: 8,
    fontSize: 15,
    color: '#333',
  },
  searchingText: {
    textAlign: 'center',
    color: '#666',
    marginTop: 12,
  },
  searchResultsContainer: {
    marginTop: 8,
  },
  searchResultsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  searchResultInfo: {
    flex: 1,
  },
  searchResultName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  searchResultMobile: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  searchResultVillage: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  searchResultAction: {
    padding: 4,
  },
  noResultsContainer: {
    alignItems: 'center',
    marginTop: 24,
  },
  noResultsText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  createNewFromSearchBtn: {
    marginTop: 8,
  },
  confirmedCustomerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#E8F5E9',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#2E7D32',
  },
  confirmedCustomerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  confirmedCustomerDetails: {
    flex: 1,
  },
  confirmedCustomerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  confirmedCustomerMobile: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  confirmedCustomerDue: {
    fontSize: 12,
    color: '#E65100',
    fontWeight: '600',
    marginTop: 2,
  },
  changeCustomerBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#FFF',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#2E7D32',
  },
  changeCustomerText: {
    fontSize: 13,
    color: '#2E7D32',
    fontWeight: '600',
  },
});
