import React, { useEffect, useState, useCallback, useRef } from 'react';
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

interface ProductVariety {
  id?: string;
  name: string;
  name_hi?: string;
}

interface Product {
  id: string;
  name: string;
  name_hi?: string;
  unit: string;
  category: string;
  varieties?: ProductVariety[];
}

interface Outlet {
  id: string;
  name: string;
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
  variety_id?: string;
  variety_name?: string;
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

  // Customer Selection Flow State
  const [customerSelectionMode, setCustomerSelectionMode] = useState<'select' | 'new' | 'existing' | 'confirmed'>('select');
  const [customerSearch, setCustomerSearch] = useState('');
  const [searchResults, setSearchResults] = useState<Customer[]>([]);
  const [searchingCustomers, setSearchingCustomers] = useState(false);
  const [newCustomerData, setNewCustomerData] = useState({
    name: '',
    mobile: '',
    address: '',
    is_shareholder: false,
    folio_number: '',
  });
  const [creatingCustomer, setCreatingCustomer] = useState(false);
  const [confirmedCustomer, setConfirmedCustomer] = useState<Customer | null>(null);

  // Delete transaction state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteReason, setDeleteReason] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [canDeleteInfo, setCanDeleteInfo] = useState<{
    can_delete: boolean;
    reason?: string;
    days_old?: number;
    days_remaining?: number;
  } | null>(null);

  // Auto-scroll refs & positions
  const modalScrollRef = useRef<ScrollView>(null);
  const productsSectionY = useRef<number>(0);
  const itemsSectionY = useRef<number>(0);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Product variety selector state
  const [varietyPickerProduct, setVarietyPickerProduct] = useState<Product | null>(null);

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

  // Customer Search Function (debounced inside the onChange handler below)
  const searchCustomers = async (query: string) => {
    const trimmed = (query || '').trim();
    if (!trimmed) {
      setSearchResults([]);
      setSearchingCustomers(false);
      return;
    }

    setSearchingCustomers(true);
    try {
      const response = await api.get('/customers/search', { params: { q: trimmed } });
      setSearchResults(response.data);
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults([]);
    } finally {
      setSearchingCustomers(false);
    }
  };

  // Debounced search trigger (300ms) — call this from the input onChange
  const onCustomerSearchChange = (val: string) => {
    setCustomerSearch(val);
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }
    // Show loader instantly for responsive feel
    if (val.trim()) setSearchingCustomers(true);
    else setSearchResults([]);
    searchDebounceRef.current = setTimeout(() => {
      searchCustomers(val);
    }, 300);
  };

  // Auto-scroll when customer is confirmed → jump to products section
  useEffect(() => {
    if (customerSelectionMode === 'confirmed' && modalScrollRef.current) {
      setTimeout(() => {
        modalScrollRef.current?.scrollTo({ y: Math.max(0, productsSectionY.current - 16), animated: true });
      }, 150);
    }
  }, [customerSelectionMode]);

  // Auto-scroll when first item is added → jump to items/totals section
  useEffect(() => {
    if (saleItems.length === 1 && modalScrollRef.current) {
      setTimeout(() => {
        modalScrollRef.current?.scrollTo({ y: Math.max(0, itemsSectionY.current - 16), animated: true });
      }, 200);
    }
  }, [saleItems.length]);

  // Create New Customer and auto-create Khata
  const handleCreateNewCustomer = async () => {
    if (!newCustomerData.name.trim()) {
      Alert.alert(t('error'), language === 'hi' ? 'ग्राहक का नाम आवश्यक है' : 'Customer name is required');
      return;
    }

    // Validate shareholder folio number if shareholder is checked
    if (newCustomerData.is_shareholder && !newCustomerData.folio_number.trim()) {
      Alert.alert(t('error'), language === 'hi' ? 'शेयरधारक पहचान संख्या आवश्यक है' : 'Shareholder ID number is required');
      return;
    }

    setCreatingCustomer(true);
    try {
      const response = await api.post('/customers', {
        name: newCustomerData.name.trim(),
        mobile: newCustomerData.mobile.trim() || null,
        address: newCustomerData.address.trim() || null,
        customer_type: newCustomerData.is_shareholder ? 'shareholder' : 'registered',
        folio_number: newCustomerData.is_shareholder ? newCustomerData.folio_number.trim() : null,
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
    setNewCustomerData({ name: '', mobile: '', address: '', is_shareholder: false, folio_number: '' });
  };

  const formatCurrency = (amount: number) => `${t('currency')}${amount.toLocaleString('en-IN')}`;

  const getSubtotal = () => saleItems.reduce((sum, item) => sum + item.amount, 0);
  const getTotal = () => Math.max(0, getSubtotal() - (parseFloat(discount) || 0));

  // Core add logic (used both for products with and without varieties)
  const addItemToCart = (product: Product, variety?: ProductVariety) => {
    const baseName = language === 'hi' && product.name_hi ? product.name_hi : product.name;
    const varietyLabel = variety ? (language === 'hi' && variety.name_hi ? variety.name_hi : variety.name) : '';
    const displayName = varietyLabel ? `${baseName} - ${varietyLabel}` : baseName;
    // Cart-key is product+variety so same product with different varieties stays separate
    const cartKey = variety?.id ? `${product.id}__${variety.id}` : product.id;

    const existing = saleItems.find(i => `${i.product_id}${i.variety_id ? '__' + i.variety_id : ''}` === cartKey);
    if (existing) {
      setSaleItems(saleItems.map(i =>
        `${i.product_id}${i.variety_id ? '__' + i.variety_id : ''}` === cartKey
          ? { ...i, quantity: i.quantity + 1, amount: (i.quantity + 1) * i.rate }
          : i
      ));
    } else {
      setSaleItems([...saleItems, {
        product_id: product.id,
        product_name: displayName,
        quantity: 1,
        rate: 0,
        amount: 0,
        variety_id: variety?.id,
        variety_name: variety ? (variety.name_hi || variety.name) : undefined,
      }]);
    }
  };

  const addItem = (product: Product) => {
    // If product has varieties, prompt user to pick one first
    if (product.varieties && product.varieties.length > 0) {
      setVarietyPickerProduct(product);
      return;
    }
    addItemToCart(product);
  };

  const updateItemRate = (productId: string, rate: string, varietyId?: string) => {
    const rateNum = parseFloat(rate) || 0;
    setSaleItems(saleItems.map(i =>
      (i.product_id === productId && (i.variety_id || '') === (varietyId || ''))
        ? { ...i, rate: rateNum, amount: i.quantity * rateNum }
        : i
    ));
  };

  const updateItemQty = (productId: string, qty: string, varietyId?: string) => {
    const qtyNum = parseFloat(qty) || 0;
    setSaleItems(saleItems.map(i =>
      (i.product_id === productId && (i.variety_id || '') === (varietyId || ''))
        ? { ...i, quantity: qtyNum, amount: qtyNum * i.rate }
        : i
    ));
  };

  const removeItem = (productId: string, varietyId?: string) => {
    setSaleItems(saleItems.filter(i =>
      !(i.product_id === productId && (i.variety_id || '') === (varietyId || ''))
    ));
  };

  const resetSaleForm = () => {
    setSaleItems([]);
    setSelectedCustomer('');
    setCustomerName('');
    setPaymentMode('cash');
    setCashAmount('');
    setOnlineAmount('');
    setDiscount('');
    // Reset customer selection flow
    setCustomerSelectionMode('select');
    setConfirmedCustomer(null);
    setCustomerSearch('');
    setSearchResults([]);
    setNewCustomerData({ name: '', mobile: '', address: '', is_shareholder: false, folio_number: '' });
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
        outlet_id: selectedOutlet,
        customer_id: confirmedCustomer?.id || null,
        customer_name: confirmedCustomer?.name || null,
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

  const handlePrintBill = async () => {
    if (!selectedSale) return;
    
    setIsPrinting(true);
    try {
      const outlet = outlets.find(o => o.id === selectedSale.outlet_id);
      
      const billData = {
        billNumber: selectedSale.bill_number,
        date: new Date(selectedSale.created_at).toLocaleDateString('en-IN'),
        customerName: selectedSale.customer_name || (language === 'hi' ? 'वॉक-इन ग्राहक' : 'Walk-in Customer'),
        customerMobile: undefined,
        outletName: outlet?.name || selectedSale.outlet_name || '',
        items: selectedSale.items.map(item => ({
          name: item.product_name,
          quantity: item.quantity,
          unit: 'unit',
          rate: item.rate,
          amount: item.amount,
        })),
        subtotal: selectedSale.items.reduce((sum, i) => sum + i.amount, 0),
        discount: 0,
        total: selectedSale.total_amount,
        paidAmount: selectedSale.cash_amount + selectedSale.online_amount,
        dueAmount: selectedSale.credit_amount,
        paymentMode: selectedSale.payment_mode,
        language: settingsLanguage,
      };

      await printBill(billData);
    } catch (error) {
      console.error('Print error:', error);
      Alert.alert(
        t('error'),
        language === 'hi' ? 'प्रिंट करने में त्रुटि' : 'Failed to print bill'
      );
    } finally {
      setIsPrinting(false);
    }
  };

  const handleShareBill = async () => {
    if (!selectedSale) return;
    
    setIsPrinting(true);
    try {
      const outlet = outlets.find(o => o.id === selectedSale.outlet_id);
      
      const billData = {
        billNumber: selectedSale.bill_number,
        date: new Date(selectedSale.created_at).toLocaleDateString('en-IN'),
        customerName: selectedSale.customer_name || (language === 'hi' ? 'वॉक-इन ग्राहक' : 'Walk-in Customer'),
        customerMobile: undefined,
        outletName: outlet?.name || selectedSale.outlet_name || '',
        items: selectedSale.items.map(item => ({
          name: item.product_name,
          quantity: item.quantity,
          unit: 'unit',
          rate: item.rate,
          amount: item.amount,
        })),
        subtotal: selectedSale.items.reduce((sum, i) => sum + i.amount, 0),
        discount: 0,
        total: selectedSale.total_amount,
        paidAmount: selectedSale.cash_amount + selectedSale.online_amount,
        dueAmount: selectedSale.credit_amount,
        paymentMode: selectedSale.payment_mode,
        language: settingsLanguage,
      };

      await shareBillAsPDF(billData);
    } catch (error) {
      console.error('Share error:', error);
      Alert.alert(
        t('error'),
        language === 'hi' ? 'शेयर करने में त्रुटि' : 'Failed to share bill'
      );
    } finally {
      setIsPrinting(false);
    }
  };

  // Check if sale can be deleted
  const checkCanDelete = async (saleId: string) => {
    try {
      const response = await api.get(`/sales/${saleId}/can-delete`);
      setCanDeleteInfo(response.data);
    } catch (error) {
      setCanDeleteInfo({ can_delete: false, reason: 'Error checking delete status' });
    }
  };

  // Initiate delete process
  const initiateDelete = async () => {
    if (!selectedSale) return;
    await checkCanDelete(selectedSale.id);
    setDeleteReason('');
    setShowDeleteConfirm(true);
  };

  // Execute delete with auto-reversal
  const handleDeleteTransaction = async () => {
    if (!selectedSale) return;
    
    if (!canDeleteInfo?.can_delete) {
      Alert.alert(
        t('error'),
        canDeleteInfo?.reason || (language === 'hi' ? 'इस लेनदेन को हटाया नहीं जा सकता' : 'Cannot delete this transaction')
      );
      return;
    }

    setIsDeleting(true);
    try {
      const response = await api.delete(`/sales/${selectedSale.id}`, {
        params: { reason: deleteReason || null }
      });
      
      const reversal = response.data.reversal_details;
      
      // Build success message with reversal details
      let message = language === 'hi' 
        ? `बिल ${selectedSale.bill_number} सफलतापूर्वक हटा दिया गया।\n\n`
        : `Bill ${selectedSale.bill_number} deleted successfully.\n\n`;
      
      if (reversal.stock_restored?.length > 0) {
        message += language === 'hi' ? 'स्टॉक वापस:\n' : 'Stock Restored:\n';
        reversal.stock_restored.forEach((item: any) => {
          message += `• ${item.product_name}: +${item.quantity_restored}\n`;
        });
      }
      
      if (reversal.customer_ledger_adjusted) {
        message += language === 'hi' 
          ? '\nग्राहक खाता समायोजित किया गया।'
          : '\nCustomer ledger adjusted.';
        if (reversal.credit_reversed > 0) {
          message += language === 'hi'
            ? ` (₹${reversal.credit_reversed} उधार हटाया)`
            : ` (₹${reversal.credit_reversed} credit reversed)`;
        }
      }
      
      Alert.alert(
        language === 'hi' ? 'हटाया गया' : 'Deleted',
        message
      );
      
      setShowDeleteConfirm(false);
      setShowBillDetails(false);
      setSelectedSale(null);
      fetchData();
    } catch (error: any) {
      Alert.alert(
        t('error'),
        error.response?.data?.detail || (language === 'hi' ? 'हटाने में त्रुटि' : 'Failed to delete')
      );
    } finally {
      setIsDeleting(false);
    }
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

          <ScrollView ref={modalScrollRef} style={styles.modalContent}>
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

            {/* 1. CUSTOMER DETAILS (moved to top) */}
            <Text style={styles.label}>{t('selectCustomer')} *</Text>

            {/* Customer Selection Flow - MANDATORY */}
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

                {/* Shareholder Checkbox */}
                <TouchableOpacity
                  style={styles.shareholderCheckbox}
                  onPress={() => setNewCustomerData({
                    ...newCustomerData,
                    is_shareholder: !newCustomerData.is_shareholder,
                    folio_number: !newCustomerData.is_shareholder ? newCustomerData.folio_number : ''
                  })}
                >
                  <View style={[
                    styles.checkbox,
                    newCustomerData.is_shareholder && styles.checkboxChecked
                  ]}>
                    {newCustomerData.is_shareholder && (
                      <Ionicons name="checkmark" size={16} color="#FFF" />
                    )}
                  </View>
                  <Text style={styles.shareholderLabel}>
                    {language === 'hi' ? 'शेयरधारक (FPO सदस्य)' : 'Shareholder (FPO Member)'}
                  </Text>
                </TouchableOpacity>

                {/* Shareholder ID Number - only visible if shareholder is checked */}
                {newCustomerData.is_shareholder && (
                  <Input
                    label={language === 'hi' ? 'शेयरधारक पहचान संख्या *' : 'Shareholder ID Number *'}
                    placeholder={language === 'hi' ? 'फोलियो/पहचान नंबर दर्ज करें' : 'Enter folio/ID number'}
                    value={newCustomerData.folio_number}
                    onChangeText={(val) => setNewCustomerData({ ...newCustomerData, folio_number: val })}
                  />
                )}

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
                  <Ionicons name="search" size={20} color="#999" style={styles.searchIconInner} />
                  <Input
                    placeholder={language === 'hi' ? 'नाम या मोबाइल नंबर दर्ज करें' : 'Enter name or mobile number'}
                    value={customerSearch}
                    onChangeText={onCustomerSearchChange}
                    containerStyle={styles.searchInputWrapper}
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
                          {customer.outstanding_balance > 0 && (
                            <Text style={styles.searchResultDue}>
                              <Ionicons name="wallet-outline" size={12} color="#E65100" /> {language === 'hi' ? 'बकाया:' : 'Due:'} {formatCurrency(customer.outstanding_balance)}
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

                {customerSearch.trim().length >= 1 && searchResults.length === 0 && !searchingCustomers && (
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

            {/* Confirmed Customer Display - with outstanding dues */}
            {customerSelectionMode === 'confirmed' && confirmedCustomer && (
              <View style={styles.confirmedCustomerContainer}>
                <View style={styles.confirmedCustomerInfo}>
                  <Ionicons name="checkmark-circle" size={24} color="#2E7D32" />
                  <View style={styles.confirmedCustomerDetails}>
                    <Text style={styles.confirmedCustomerName}>{confirmedCustomer.name}</Text>
                    {confirmedCustomer.mobile && (
                      <Text style={styles.confirmedCustomerMobile}>
                        <Ionicons name="call-outline" size={12} color="#666" /> {confirmedCustomer.mobile}
                      </Text>
                    )}
                    {confirmedCustomer.outstanding_balance > 0 ? (
                      <View style={styles.duesBanner}>
                        <Ionicons name="alert-circle" size={16} color="#D32F2F" />
                        <Text style={styles.duesBannerText}>
                          {language === 'hi' ? 'पिछला बकाया:' : 'Outstanding Due:'} {formatCurrency(confirmedCustomer.outstanding_balance)}
                        </Text>
                      </View>
                    ) : (
                      <Text style={styles.noDuesText}>
                        {language === 'hi' ? '✓ कोई बकाया नहीं' : '✓ No outstanding dues'}
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

            {/* 2. ITEMS - Products only shown after customer confirmed */}
            {customerSelectionMode === 'confirmed' && (
              <View onLayout={(e) => { productsSectionY.current = e.nativeEvent.layout.y; }}>
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
                      {product.varieties && product.varieties.length > 0 && (
                        <View style={styles.varietyBadge}>
                          <Ionicons name="layers-outline" size={10} color="#FFF" />
                          <Text style={styles.varietyBadgeText}>{product.varieties.length}</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Sale Items */}
                {saleItems.length > 0 && (
                  <View style={styles.itemsSection} onLayout={(e) => { itemsSectionY.current = productsSectionY.current + e.nativeEvent.layout.y; }}>
                    <Text style={styles.label}>{language === 'hi' ? 'आइटम्स' : 'Items'}</Text>
                    {saleItems.map(item => (
                      <View key={`${item.product_id}${item.variety_id ? '__' + item.variety_id : ''}`} style={styles.itemRow}>
                        <View style={styles.itemInfo}>
                          <Text style={styles.itemName}>{item.product_name}</Text>
                          <TouchableOpacity onPress={() => removeItem(item.product_id, item.variety_id)}>
                            <Ionicons name="trash-outline" size={18} color="#D32F2F" />
                          </TouchableOpacity>
                        </View>
                        <View style={styles.itemInputs}>
                          <Input
                            placeholder={t('quantity')}
                            value={item.quantity.toString()}
                            onChangeText={(val) => updateItemQty(item.product_id, val, item.variety_id)}
                            keyboardType="decimal-pad"
                            containerStyle={styles.qtyInput}
                          />
                          <Text style={styles.multiply}>×</Text>
                          <Input
                            placeholder={t('rate')}
                            value={item.rate > 0 ? item.rate.toString() : ''}
                            onChangeText={(val) => updateItemRate(item.product_id, val, item.variety_id)}
                            keyboardType="decimal-pad"
                            containerStyle={styles.rateInput}
                          />
                          <Text style={styles.equals}>=</Text>
                          <Text style={styles.itemAmount}>{formatCurrency(item.amount)}</Text>
                        </View>
                      </View>
                    ))}

                    {/* 3. DISCOUNT + Totals */}
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

                    {/* 4. PAYMENT MODE */}
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
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Product Variety Picker Modal */}
      <Modal visible={!!varietyPickerProduct} animationType="fade" transparent onRequestClose={() => setVarietyPickerProduct(null)}>
        <View style={styles.varietyModalOverlay}>
          <View style={styles.varietyModalCard}>
            <View style={styles.varietyModalHeader}>
              <Text style={styles.varietyModalTitle}>
                {language === 'hi' ? 'किस्म चुनें' : 'Select Variety'}
              </Text>
              <TouchableOpacity onPress={() => setVarietyPickerProduct(null)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            <Text style={styles.varietyModalSubtitle}>
              {varietyPickerProduct ? (language === 'hi' && varietyPickerProduct.name_hi ? varietyPickerProduct.name_hi : varietyPickerProduct.name) : ''}
            </Text>
            <ScrollView style={{ maxHeight: 360 }}>
              {varietyPickerProduct?.varieties?.map((v, idx) => (
                <TouchableOpacity
                  key={v.id || idx}
                  style={styles.varietyOption}
                  onPress={() => {
                    if (varietyPickerProduct) {
                      addItemToCart(varietyPickerProduct, v);
                      setVarietyPickerProduct(null);
                    }
                  }}
                >
                  <Ionicons name="leaf-outline" size={22} color="#2E7D32" />
                  <Text style={styles.varietyOptionText}>
                    {language === 'hi' && v.name_hi ? v.name_hi : v.name}
                  </Text>
                  <Ionicons name="chevron-forward" size={20} color="#999" />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
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

              {/* Print/Share/Delete Actions */}
              <View style={styles.billActions}>
                <TouchableOpacity
                  style={[styles.billActionBtn, styles.printBtn]}
                  onPress={handlePrintBill}
                  disabled={isPrinting}
                >
                  <Ionicons name="print" size={22} color="#FFF" />
                  <Text style={styles.billActionText}>
                    {language === 'hi' ? 'प्रिंट करें' : 'Print'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.billActionBtn, styles.shareBtn]}
                  onPress={handleShareBill}
                  disabled={isPrinting}
                >
                  <Ionicons name="share-social" size={22} color="#FFF" />
                  <Text style={styles.billActionText}>
                    {language === 'hi' ? 'शेयर' : 'Share'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.billActionBtn, styles.deleteBtn]}
                  onPress={initiateDelete}
                >
                  <Ionicons name="trash" size={22} color="#FFF" />
                  <Text style={styles.billActionText}>
                    {language === 'hi' ? 'हटाएं' : 'Delete'}
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal visible={showDeleteConfirm} animationType="slide" transparent>
        <View style={styles.deleteModalOverlay}>
          <View style={styles.deleteModalContent}>
            <View style={styles.deleteModalHeader}>
              <Ionicons name="warning" size={40} color="#D32F2F" />
              <Text style={styles.deleteModalTitle}>
                {language === 'hi' ? 'लेनदेन हटाएं?' : 'Delete Transaction?'}
              </Text>
            </View>

            {selectedSale && (
              <View style={styles.deleteTransactionInfo}>
                <Text style={styles.deleteTransactionBill}>{selectedSale.bill_number}</Text>
                <Text style={styles.deleteTransactionAmount}>
                  {formatCurrency(selectedSale.total_amount)}
                </Text>
                {selectedSale.customer_name && (
                  <Text style={styles.deleteTransactionCustomer}>
                    {selectedSale.customer_name}
                  </Text>
                )}
              </View>
            )}

            {canDeleteInfo && !canDeleteInfo.can_delete ? (
              <View style={styles.deleteWarningBox}>
                <Ionicons name="close-circle" size={24} color="#D32F2F" />
                <Text style={styles.deleteWarningText}>{canDeleteInfo.reason}</Text>
              </View>
            ) : canDeleteInfo ? (
              <>
                <View style={styles.deleteInfoBox}>
                  <Text style={styles.deleteInfoText}>
                    {language === 'hi' 
                      ? `यह लेनदेन ${canDeleteInfo.days_old} दिन पुराना है। हटाने के लिए ${canDeleteInfo.days_remaining} दिन बचे हैं।`
                      : `This transaction is ${canDeleteInfo.days_old} days old. ${canDeleteInfo.days_remaining} days remaining to delete.`
                    }
                  </Text>
                </View>

                <View style={styles.deleteReversalInfo}>
                  <Text style={styles.deleteReversalTitle}>
                    {language === 'hi' ? 'हटाने पर:' : 'On deletion:'}
                  </Text>
                  <Text style={styles.deleteReversalItem}>
                    • {language === 'hi' ? 'स्टॉक वापस किया जाएगा' : 'Stock will be restored'}
                  </Text>
                  <Text style={styles.deleteReversalItem}>
                    • {language === 'hi' ? 'ग्राहक खाता समायोजित होगा' : 'Customer ledger will be adjusted'}
                  </Text>
                  <Text style={styles.deleteReversalItem}>
                    • {language === 'hi' ? 'ऑडिट लॉग में दर्ज होगा' : 'Will be logged for audit'}
                  </Text>
                </View>

                <Input
                  label={language === 'hi' ? 'हटाने का कारण (वैकल्पिक)' : 'Reason for deletion (optional)'}
                  placeholder={language === 'hi' ? 'कारण दर्ज करें' : 'Enter reason'}
                  value={deleteReason}
                  onChangeText={setDeleteReason}
                  multiline
                />
              </>
            ) : (
              <Text style={styles.loadingText}>{t('loading')}</Text>
            )}

            <View style={styles.deleteModalActions}>
              <Button
                title={language === 'hi' ? 'रद्द करें' : 'Cancel'}
                onPress={() => setShowDeleteConfirm(false)}
                variant="outline"
                style={styles.cancelDeleteBtn}
              />
              {canDeleteInfo?.can_delete && (
                <Button
                  title={language === 'hi' ? 'हटाएं' : 'Delete'}
                  onPress={handleDeleteTransaction}
                  loading={isDeleting}
                  style={styles.confirmDeleteBtn}
                />
              )}
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
  billActions: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    paddingTop: 8,
  },
  billActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 10,
  },
  printBtn: {
    backgroundColor: '#2E7D32',
  },
  shareBtn: {
    backgroundColor: '#1976D2',
  },
  deleteBtn: {
    backgroundColor: '#D32F2F',
  },
  billActionText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '600',
  },
  // Delete Modal Styles
  deleteModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  deleteModalContent: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  deleteModalHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  deleteModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#D32F2F',
    marginTop: 8,
  },
  deleteTransactionInfo: {
    backgroundColor: '#F5F5F5',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
  deleteTransactionBill: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  deleteTransactionAmount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2E7D32',
    marginTop: 4,
  },
  deleteTransactionCustomer: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  deleteWarningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFEBEE',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    gap: 8,
  },
  deleteWarningText: {
    flex: 1,
    color: '#D32F2F',
    fontSize: 14,
  },
  deleteInfoBox: {
    backgroundColor: '#FFF3E0',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  deleteInfoText: {
    color: '#E65100',
    fontSize: 13,
    textAlign: 'center',
  },
  deleteReversalInfo: {
    backgroundColor: '#E3F2FD',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  deleteReversalTitle: {
    fontWeight: '600',
    color: '#1565C0',
    marginBottom: 8,
  },
  deleteReversalItem: {
    color: '#1565C0',
    fontSize: 13,
    marginTop: 4,
  },
  loadingText: {
    textAlign: 'center',
    color: '#666',
    marginVertical: 16,
  },
  deleteModalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  cancelDeleteBtn: {
    flex: 1,
  },
  confirmDeleteBtn: {
    flex: 1,
    backgroundColor: '#D32F2F',
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
  },
  searchIconInner: {
    position: 'absolute',
    left: 12,
    zIndex: 1,
  },
  searchInputWrapper: {
    flex: 1,
    marginBottom: 0,
  },
  searchingText: {
    textAlign: 'center',
    color: '#666',
    marginTop: 12,
  },
  searchResultsContainer: {
    marginTop: 16,
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
  // Shareholder checkbox styles
  shareholderCheckbox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    marginTop: 4,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#2E7D32',
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFF',
  },
  checkboxChecked: {
    backgroundColor: '#2E7D32',
    borderColor: '#2E7D32',
  },
  shareholderLabel: {
    fontSize: 15,
    color: '#333',
    fontWeight: '500',
    flex: 1,
  },
  // Dues banner styles
  duesBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFEBEE',
    borderLeftWidth: 3,
    borderLeftColor: '#D32F2F',
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 8,
    marginTop: 6,
    gap: 6,
  },
  duesBannerText: {
    fontSize: 13,
    color: '#D32F2F',
    fontWeight: '700',
    flex: 1,
  },
  noDuesText: {
    fontSize: 12,
    color: '#2E7D32',
    marginTop: 4,
    fontWeight: '500',
  },
  searchResultDue: {
    fontSize: 12,
    color: '#E65100',
    fontWeight: '600',
    marginTop: 2,
  },
  // Variety picker modal
  varietyBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#1976D2',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    gap: 2,
  },
  varietyBadgeText: { fontSize: 10, color: '#FFF', fontWeight: '700' },
  varietyModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  varietyModalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
  },
  varietyModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  varietyModalTitle: { fontSize: 17, fontWeight: '700', color: '#333' },
  varietyModalSubtitle: { fontSize: 13, color: '#666', marginBottom: 12 },
  varietyOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    marginBottom: 8,
    gap: 12,
    backgroundColor: '#FAFAFA',
  },
  varietyOptionText: { flex: 1, fontSize: 15, fontWeight: '600', color: '#333' },
});
