import React, { useEffect, useState, useMemo, useRef } from 'react';
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
  ScrollView,
  Switch,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useSettingsStore } from '../../src/store/settingsStore';
import { Card } from '../../src/components/Card';
import { Button } from '../../src/components/Button';
import { Input } from '../../src/components/Input';
import api from '../../src/utils/api';

interface Farmer {
  id: string;
  name: string;
  mobile?: string;
  village?: string;
}

interface Vendor {
  id: string;
  name: string;
  mobile?: string;
  address?: string;
  village?: string;
  outstanding_dues?: number;
}

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
  varieties?: ProductVariety[];
}

interface Outlet {
  id: string;
  name: string;
}

interface Purchase {
  id: string;
  source_type: string;
  source_name: string;
  product_name: string;
  outlet_name: string;
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
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const language = useSettingsStore((state) => state.language);

  // Search states
  const [sourceSearch, setSourceSearch] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [outletSearch, setOutletSearch] = useState('');

  // Form state
  const [sourceType, setSourceType] = useState<'farmer' | 'vendor'>('farmer');
  const [selectedSource, setSelectedSource] = useState('');
  const [selectedProduct, setSelectedProduct] = useState('');
  const [selectedVariety, setSelectedVariety] = useState<ProductVariety | null>(null);
  const [selectedOutlet, setSelectedOutlet] = useState('');
  const [quantity, setQuantity] = useState('');
  const [rate, setRate] = useState('');
  const [paymentMode, setPaymentMode] = useState<'cash' | 'online' | 'credit' | 'partial'>('cash');
  const [cashAmount, setCashAmount] = useState('');
  const [onlineAmount, setOnlineAmount] = useState('');
  const [notes, setNotes] = useState('');

  // Manual entry states - for quick transactions
  const [useManualSource, setUseManualSource] = useState(false);
  const [manualSourceName, setManualSourceName] = useState('');
  const [manualSourceMobile, setManualSourceMobile] = useState('');
  const [useManualProduct, setUseManualProduct] = useState(false);
  const [manualProductName, setManualProductName] = useState('');
  const [manualProductUnit, setManualProductUnit] = useState('kg');

  // Vendor Selection Flow State (similar to Customer in Sales)
  const [vendorSelectionMode, setVendorSelectionMode] = useState<'select' | 'new' | 'existing' | 'confirmed'>('select');
  const [vendorSearch, setVendorSearch] = useState('');
  const [vendorSearchResults, setVendorSearchResults] = useState<Vendor[]>([]);
  const [searchingVendors, setSearchingVendors] = useState(false);
  const [newVendorData, setNewVendorData] = useState({
    name: '',
    mobile: '',
    address: '',
    village: '',
  });
  const [creatingVendor, setCreatingVendor] = useState(false);
  const [confirmedVendor, setConfirmedVendor] = useState<Vendor | null>(null);

  // Auto-scroll refs & positions
  const modalScrollRef = useRef<ScrollView>(null);
  const afterVendorSectionY = useRef<number>(0);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchData = async () => {
    try {
      const [farmerPurchaseRes, vendorPurchaseRes, farmerRes, vendorRes, productRes, outletRes] = await Promise.all([
        api.get('/farmer-purchases'),
        api.get('/vendor-procurement'),
        api.get('/farmers'),
        api.get('/vendors'),
        api.get('/products'),
        api.get('/outlets'),
      ]);
      
      // Combine and format purchases
      const allPurchases: Purchase[] = [
        ...farmerPurchaseRes.data.map((p: any) => ({
          ...p,
          source_type: 'farmer',
          source_name: p.farmer_name,
          outlet_name: p.outlet_name || 'N/A',
        })),
        ...vendorPurchaseRes.data.map((p: any) => ({
          ...p,
          source_type: 'vendor',
          source_name: p.vendor_name,
        })),
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      
      setPurchases(allPurchases);
      setFarmers(farmerRes.data);
      setVendors(vendorRes.data);
      setProducts(productRes.data);
      setOutlets(outletRes.data);
      
      if (outletRes.data.length > 0) setSelectedOutlet(outletRes.data[0].id);
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

  // Vendor Search Function
  const searchVendors = async (query: string) => {
    const trimmed = (query || '').trim();
    if (!trimmed) {
      setVendorSearchResults([]);
      setSearchingVendors(false);
      return;
    }

    setSearchingVendors(true);
    try {
      const response = await api.get('/vendors/search', { params: { q: trimmed } });
      setVendorSearchResults(response.data);
    } catch (error) {
      console.error('Vendor search error:', error);
      setVendorSearchResults([]);
    } finally {
      setSearchingVendors(false);
    }
  };

  // Debounced vendor search handler
  const onVendorSearchChange = (val: string) => {
    setVendorSearch(val);
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }
    if (val.trim()) setSearchingVendors(true);
    else setVendorSearchResults([]);
    searchDebounceRef.current = setTimeout(() => {
      searchVendors(val);
    }, 300);
  };

  // Auto-scroll when vendor is confirmed → jump below to next section
  useEffect(() => {
    if (vendorSelectionMode === 'confirmed' && modalScrollRef.current) {
      setTimeout(() => {
        modalScrollRef.current?.scrollTo({ y: Math.max(0, afterVendorSectionY.current - 16), animated: true });
      }, 150);
    }
  }, [vendorSelectionMode]);

  // Create New Vendor and auto-create Khata
  const handleCreateNewVendor = async () => {
    if (!newVendorData.name.trim()) {
      Alert.alert(language === 'hi' ? 'त्रुटि' : 'Error', language === 'hi' ? 'विक्रेता का नाम आवश्यक है' : 'Vendor name is required');
      return;
    }

    setCreatingVendor(true);
    try {
      const response = await api.post('/vendors', {
        name: newVendorData.name.trim(),
        mobile: newVendorData.mobile.trim() || null,
        address: newVendorData.address.trim() || null,
        village: newVendorData.village.trim() || null,
      });
      
      const newVendor: Vendor = response.data;
      setConfirmedVendor(newVendor);
      setSelectedSource(newVendor.id);
      setVendorSelectionMode('confirmed');
      
      // Refresh vendors list
      fetchData();
      
      Alert.alert(
        language === 'hi' ? 'सफल' : 'Success',
        language === 'hi' 
          ? `विक्रेता "${newVendor.name}" सफलतापूर्वक जोड़ा गया। खाता (Khata) स्वचालित रूप से बन गया।`
          : `Vendor "${newVendor.name}" added successfully. Khata (Ledger) auto-created.`
      );
    } catch (error: any) {
      Alert.alert(language === 'hi' ? 'त्रुटि' : 'Error', error.response?.data?.detail || 'Failed to create vendor');
    } finally {
      setCreatingVendor(false);
    }
  };

  // Select existing vendor
  const handleSelectExistingVendor = (vendor: Vendor) => {
    setConfirmedVendor(vendor);
    setSelectedSource(vendor.id);
    setVendorSelectionMode('confirmed');
  };

  // Reset vendor selection
  const resetVendorSelection = () => {
    setVendorSelectionMode('select');
    setConfirmedVendor(null);
    setSelectedSource('');
    setVendorSearch('');
    setVendorSearchResults([]);
    setNewVendorData({ name: '', mobile: '', address: '', village: '' });
  };

  // Filtered lists based on search
  const filteredSources = useMemo(() => {
    const sources = sourceType === 'farmer' ? farmers : vendors;
    if (!sourceSearch.trim()) return sources;
    const query = sourceSearch.toLowerCase();
    return sources.filter(s => 
      s.name.toLowerCase().includes(query) || 
      (s.mobile && s.mobile.includes(query))
    );
  }, [sourceType, farmers, vendors, sourceSearch]);

  const filteredProducts = useMemo(() => {
    if (!productSearch.trim()) return products;
    const query = productSearch.toLowerCase();
    return products.filter(p => 
      p.name.toLowerCase().includes(query) || 
      (p.name_hi && p.name_hi.includes(productSearch))
    );
  }, [products, productSearch]);

  const filteredOutlets = useMemo(() => {
    if (!outletSearch.trim()) return outlets;
    const query = outletSearch.toLowerCase();
    return outlets.filter(o => o.name.toLowerCase().includes(query));
  }, [outlets, outletSearch]);

  const totalAmount = parseFloat(quantity || '0') * parseFloat(rate || '0');

  const calculateAmounts = () => {
    const total = totalAmount;
    const cash = parseFloat(cashAmount || '0');
    const online = parseFloat(onlineAmount || '0');
    
    switch (paymentMode) {
      case 'cash': return { cash: total, online: 0, credit: 0 };
      case 'online': return { cash: 0, online: total, credit: 0 };
      case 'credit': return { cash: 0, online: 0, credit: total };
      case 'partial': return { cash, online, credit: Math.max(0, total - cash - online) };
    }
  };

  const handleSubmit = async () => {
    // Validate outlet (always required)
    if (!selectedOutlet) {
      Alert.alert(language === 'hi' ? 'त्रुटि' : 'Error', language === 'hi' ? 'आउटलेट चुनें' : 'Select outlet');
      return;
    }

    // For vendor purchases, require mandatory vendor selection (new flow)
    if (sourceType === 'vendor' && !useManualSource) {
      if (vendorSelectionMode !== 'confirmed' || !confirmedVendor) {
        Alert.alert(
          language === 'hi' ? 'त्रुटि' : 'Error', 
          language === 'hi' 
            ? 'कृपया पहले विक्रेता चुनें। खरीद से पहले विक्रेता चयन आवश्यक है।' 
            : 'Please select a vendor first. Vendor selection is mandatory before purchase.'
        );
        return;
      }
    }

    // Validate source (for farmer purchases or manual entry)
    if (sourceType === 'farmer' || useManualSource) {
      if (!useManualSource && !selectedSource) {
        Alert.alert(language === 'hi' ? 'त्रुटि' : 'Error', language === 'hi' ? 'किसान/विक्रेता चुनें' : 'Select farmer/vendor');
        return;
      }
      if (useManualSource && !manualSourceName.trim()) {
        Alert.alert(language === 'hi' ? 'त्रुटि' : 'Error', language === 'hi' ? 'नाम दर्ज करें' : 'Enter name');
        return;
      }
    }

    // Validate product
    if (!useManualProduct && !selectedProduct) {
      Alert.alert(language === 'hi' ? 'त्रुटि' : 'Error', language === 'hi' ? 'उत्पाद चुनें' : 'Select product');
      return;
    }
    if (useManualProduct && !manualProductName.trim()) {
      Alert.alert(language === 'hi' ? 'त्रुटि' : 'Error', language === 'hi' ? 'उत्पाद नाम दर्ज करें' : 'Enter product name');
      return;
    }

    if (!quantity || !rate) {
      Alert.alert(language === 'hi' ? 'त्रुटि' : 'Error', language === 'hi' ? 'मात्रा और दर दर्ज करें' : 'Enter quantity and rate');
      return;
    }

    // If chosen product has varieties, require one to be selected
    if (!useManualProduct && selectedProduct) {
      const prod = products.find((p) => p.id === selectedProduct);
      if (prod?.varieties && prod.varieties.length > 0 && !selectedVariety) {
        Alert.alert(
          language === 'hi' ? 'त्रुटि' : 'Error',
          language === 'hi' ? 'कृपया उत्पाद की किस्म चुनें' : 'Please select a product variety'
        );
        return;
      }
    }

    const amounts = calculateAmounts();
    setLoading(true);

    try {
      if (sourceType === 'farmer') {
        // Farmer purchase with optional manual entries
        await api.post('/farmer-purchases', {
          farmer_id: useManualSource ? 'manual' : selectedSource,
          manual_farmer_name: useManualSource ? manualSourceName : null,
          manual_farmer_mobile: useManualSource ? manualSourceMobile : null,
          product_id: useManualProduct ? 'manual' : selectedProduct,
          manual_product_name: useManualProduct ? manualProductName : null,
          manual_product_unit: useManualProduct ? manualProductUnit : null,
          quantity: parseFloat(quantity),
          rate: parseFloat(rate),
          payment_status: paymentMode === 'credit' ? 'credit' : 'paid',
          outlet_id: selectedOutlet,
        });
      } else {
        // Vendor procurement - use confirmedVendor from selection flow or manual entry
        const vendorId = useManualSource ? 'manual' : (confirmedVendor?.id || selectedSource);
        await api.post('/vendor-procurement', {
          vendor_id: vendorId,
          manual_vendor_name: useManualSource ? manualSourceName : null,
          manual_vendor_mobile: useManualSource ? manualSourceMobile : null,
          product_id: useManualProduct ? 'manual' : selectedProduct,
          manual_product_name: useManualProduct ? manualProductName : null,
          manual_product_unit: useManualProduct ? manualProductUnit : null,
          variety_id: selectedVariety?.id || null,
          variety_name: selectedVariety ? (selectedVariety.name_hi || selectedVariety.name) : null,
          outlet_id: selectedOutlet,
          quantity: parseFloat(quantity),
          rate: parseFloat(rate),
          payment_mode: paymentMode,
          cash_amount: amounts.cash,
          online_amount: amounts.online,
          notes: notes || null,
        });
      }

      Alert.alert(
        language === 'hi' ? 'सफल' : 'Success',
        language === 'hi' ? 'खरीद दर्ज हो गई' : 'Purchase recorded successfully'
      );

      setShowModal(false);
      resetForm();
      fetchData();
    } catch (error: any) {
      Alert.alert(
        language === 'hi' ? 'त्रुटि' : 'Error',
        error.response?.data?.detail || (language === 'hi' ? 'खरीद दर्ज करने में विफल' : 'Failed to record purchase')
      );
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setSelectedSource('');
    setSelectedProduct('');
    setSelectedVariety(null);
    setQuantity('');
    setRate('');
    setPaymentMode('cash');
    setCashAmount('');
    setOnlineAmount('');
    setNotes('');
    setSourceSearch('');
    setProductSearch('');
    setOutletSearch('');
    setUseManualSource(false);
    setManualSourceName('');
    setManualSourceMobile('');
    setUseManualProduct(false);
    setManualProductName('');
    setManualProductUnit('kg');
    // Reset vendor selection flow
    setVendorSelectionMode('select');
    setConfirmedVendor(null);
    setVendorSearch('');
    setVendorSearchResults([]);
    setNewVendorData({ name: '', mobile: '', address: '', village: '' });
  };

  const renderPurchase = ({ item }: { item: Purchase }) => (
    <Card style={styles.purchaseCard}>
      <View style={styles.purchaseHeader}>
        <View style={styles.sourceInfo}>
          <View style={[
            styles.sourceIcon,
            { backgroundColor: item.source_type === 'farmer' ? '#E8F5E9' : '#F3E5F5' }
          ]}>
            <Ionicons
              name={item.source_type === 'farmer' ? 'leaf' : 'storefront'}
              size={20}
              color={item.source_type === 'farmer' ? '#2E7D32' : '#7B1FA2'}
            />
          </View>
          <View>
            <Text style={styles.sourceName}>{item.source_name}</Text>
            <Text style={styles.sourceType}>
              {item.source_type === 'farmer' 
                ? (language === 'hi' ? 'किसान' : 'Farmer')
                : (language === 'hi' ? 'विक्रेता' : 'Vendor')
              }
            </Text>
          </View>
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
              ? (language === 'hi' ? 'भुगतान' : 'Paid')
              : (language === 'hi' ? 'उधार' : 'Credit')
            }
          </Text>
        </View>
      </View>

      <View style={styles.purchaseDetails}>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>{language === 'hi' ? 'उत्पाद' : 'Product'}</Text>
          <Text style={styles.detailValue}>{item.product_name}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>{language === 'hi' ? 'मात्रा' : 'Qty'}</Text>
          <Text style={styles.detailValue}>{item.quantity}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>{language === 'hi' ? 'दर' : 'Rate'}</Text>
          <Text style={styles.detailValue}>₹{item.rate}</Text>
        </View>
        {item.outlet_name && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>{language === 'hi' ? 'आउटलेट' : 'Outlet'}</Text>
            <Text style={styles.detailValue}>{item.outlet_name}</Text>
          </View>
        )}
      </View>

      <View style={styles.purchaseFooter}>
        <Text style={styles.receiptNum}>{item.receipt_number}</Text>
        <Text style={styles.totalAmount}>₹{item.total_amount?.toFixed(2) || '0.00'}</Text>
      </View>
    </Card>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>
            {language === 'hi' ? 'खरीद' : 'Procurement'}
          </Text>
          <Text style={styles.subtitle}>
            {language === 'hi' ? 'किसान और विक्रेता से खरीद' : 'From Farmers & Vendors'}
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

      {/* New Purchase Modal */}
      <Modal visible={showModal} animationType="slide" onRequestClose={() => { setShowModal(false); resetForm(); }}>
        <SafeAreaView style={styles.modalSafe} edges={['top']}>
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={0}
          >
            <ScrollView
              ref={modalScrollRef}
              style={{ flex: 1 }}
              contentContainerStyle={styles.modalScrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>
                    {language === 'hi' ? 'नई खरीद' : 'New Purchase'}
                  </Text>
                  <TouchableOpacity
                    onPress={() => { setShowModal(false); resetForm(); }}
                    style={styles.closeBtn}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons name="close" size={26} color="#666" />
                  </TouchableOpacity>
                </View>

              {/* Source Type Toggle */}
              <Text style={styles.label}>
                {language === 'hi' ? 'खरीद स्रोत' : 'Purchase From'} *
              </Text>
              <View style={styles.sourceToggle}>
                <TouchableOpacity
                  style={[styles.sourceBtn, sourceType === 'farmer' && styles.sourceBtnActive]}
                  onPress={() => {
                    setSourceType('farmer');
                    setSelectedSource('');
                    setSourceSearch('');
                    setVendorSelectionMode('select');
                    setConfirmedVendor(null);
                    setVendorSearch('');
                    setVendorSearchResults([]);
                  }}
                >
                  <Ionicons name="leaf" size={20} color={sourceType === 'farmer' ? '#FFF' : '#2E7D32'} />
                  <Text style={[styles.sourceBtnText, sourceType === 'farmer' && styles.sourceBtnTextActive]}>
                    {language === 'hi' ? 'किसान' : 'Farmer'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.sourceBtn, styles.vendorBtn, sourceType === 'vendor' && styles.vendorBtnActive]}
                  onPress={() => {
                    setSourceType('vendor');
                    setSelectedSource('');
                    setSourceSearch('');
                    setVendorSelectionMode('select');
                    setConfirmedVendor(null);
                    setVendorSearch('');
                    setVendorSearchResults([]);
                  }}
                >
                  <Ionicons name="storefront" size={20} color={sourceType === 'vendor' ? '#FFF' : '#7B1FA2'} />
                  <Text style={[styles.sourceBtnText, sourceType === 'vendor' && styles.sourceBtnTextActive]}>
                    {language === 'hi' ? 'विक्रेता' : 'Vendor'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Manual Entry Toggle for Source */}
              <View style={styles.manualToggle}>
                <Text style={styles.manualToggleText}>
                  {language === 'hi' ? 'नाम मैन्युअल लिखें (जल्दी लेनदेन)' : 'Write name manually (quick transaction)'}
                </Text>
                <Switch
                  value={useManualSource}
                  onValueChange={(v) => { setUseManualSource(v); setSelectedSource(''); }}
                  trackColor={{ false: '#DDD', true: '#81C784' }}
                  thumbColor={useManualSource ? '#2E7D32' : '#999'}
                />
              </View>

              {useManualSource ? (
                <View style={styles.manualInputs}>
                  <Input
                    label={sourceType === 'farmer' 
                      ? (language === 'hi' ? 'किसान का नाम' : 'Farmer Name')
                      : (language === 'hi' ? 'विक्रेता का नाम' : 'Vendor Name')
                    }
                    placeholder={language === 'hi' ? 'नाम दर्ज करें' : 'Enter name'}
                    value={manualSourceName}
                    onChangeText={setManualSourceName}
                  />
                  <Input
                    label={language === 'hi' ? 'मोबाइल (वैकल्पिक)' : 'Mobile (optional)'}
                    placeholder="9876543210"
                    value={manualSourceMobile}
                    onChangeText={setManualSourceMobile}
                    keyboardType="phone-pad"
                  />
                </View>
              ) : sourceType === 'farmer' ? (
                <>
                  {/* Farmer Search & Selection - Original flow */}
                  <Text style={styles.label}>
                    {language === 'hi' ? 'किसान चुनें' : 'Select Farmer'} *
                  </Text>
                  <View style={styles.searchBox}>
                    <Ionicons name="search" size={18} color="#999" />
                    <TextInput
                      style={styles.searchInput}
                      placeholder={language === 'hi' ? 'नाम या मोबाइल से खोजें...' : 'Search by name or mobile...'}
                      value={sourceSearch}
                      onChangeText={setSourceSearch}
                      placeholderTextColor="#999"
                    />
                    {sourceSearch.length > 0 && (
                      <TouchableOpacity onPress={() => setSourceSearch('')}>
                        <Ionicons name="close-circle" size={18} color="#999" />
                      </TouchableOpacity>
                    )}
                  </View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.selectScroll}>
                    {filteredSources.map((s) => (
                      <TouchableOpacity
                        key={s.id}
                        style={[
                          styles.selectChip,
                          selectedSource === s.id && styles.farmerChipActive
                        ]}
                        onPress={() => setSelectedSource(s.id)}
                      >
                        <Text style={[styles.selectText, selectedSource === s.id && styles.selectTextActive]}>
                          {s.name}
                        </Text>
                        {s.mobile && (
                          <Text style={[styles.selectSubtext, selectedSource === s.id && styles.selectTextActive]}>
                            {s.mobile}
                          </Text>
                        )}
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </>
              ) : (
                <>
                  {/* VENDOR SELECTION FLOW - Mandatory with Khata auto-creation */}
                  <Text style={styles.label}>
                    {language === 'hi' ? 'विक्रेता चुनें' : 'Select Vendor'} *
                  </Text>

                  {/* Select Mode - New or Existing */}
                  {vendorSelectionMode === 'select' && (
                    <View style={styles.vendorSelectionContainer}>
                      <Text style={styles.vendorSelectionTitle}>
                        {language === 'hi' ? 'विक्रेता चयन (आवश्यक)' : 'Vendor Selection (Required)'}
                      </Text>
                      <View style={styles.vendorSelectionOptions}>
                        <TouchableOpacity
                          style={styles.vendorOptionBtn}
                          onPress={() => setVendorSelectionMode('new')}
                        >
                          <Ionicons name="person-add" size={28} color="#7B1FA2" />
                          <Text style={styles.vendorOptionText}>
                            {language === 'hi' ? 'नया विक्रेता' : 'New Vendor'}
                          </Text>
                          <Text style={styles.vendorOptionSubtext}>
                            {language === 'hi' ? 'नया खाता बनाएं' : 'Create new Khata'}
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.vendorOptionBtn}
                          onPress={() => setVendorSelectionMode('existing')}
                        >
                          <Ionicons name="search" size={28} color="#1976D2" />
                          <Text style={styles.vendorOptionText}>
                            {language === 'hi' ? 'मौजूदा विक्रेता' : 'Existing Vendor'}
                          </Text>
                          <Text style={styles.vendorOptionSubtext}>
                            {language === 'hi' ? 'नाम/मोबाइल से खोजें' : 'Search by name/mobile'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}

                  {/* New Vendor Form */}
                  {vendorSelectionMode === 'new' && (
                    <View style={styles.vendorFormContainer}>
                      <View style={styles.vendorFormHeader}>
                        <TouchableOpacity onPress={() => setVendorSelectionMode('select')}>
                          <Ionicons name="arrow-back" size={24} color="#333" />
                        </TouchableOpacity>
                        <Text style={styles.vendorFormTitle}>
                          {language === 'hi' ? 'नया विक्रेता जोड़ें' : 'Add New Vendor'}
                        </Text>
                      </View>
                      <Input
                        label={`${language === 'hi' ? 'विक्रेता का नाम' : 'Vendor Name'} *`}
                        placeholder={language === 'hi' ? 'नाम दर्ज करें' : 'Enter name'}
                        value={newVendorData.name}
                        onChangeText={(val) => setNewVendorData({ ...newVendorData, name: val })}
                      />
                      <Input
                        label={language === 'hi' ? 'मोबाइल' : 'Mobile'}
                        placeholder={language === 'hi' ? 'मोबाइल नंबर' : 'Mobile number'}
                        value={newVendorData.mobile}
                        onChangeText={(val) => setNewVendorData({ ...newVendorData, mobile: val })}
                        keyboardType="phone-pad"
                      />
                      <Input
                        label={language === 'hi' ? 'पता' : 'Address'}
                        placeholder={language === 'hi' ? 'पता दर्ज करें' : 'Enter address'}
                        value={newVendorData.address}
                        onChangeText={(val) => setNewVendorData({ ...newVendorData, address: val })}
                      />
                      <Button
                        title={language === 'hi' ? 'विक्रेता जोड़ें और खाता बनाएं' : 'Add Vendor & Create Khata'}
                        onPress={handleCreateNewVendor}
                        loading={creatingVendor}
                        style={styles.createVendorBtn}
                      />
                    </View>
                  )}

                  {/* Existing Vendor Search */}
                  {vendorSelectionMode === 'existing' && (
                    <View style={styles.vendorFormContainer}>
                      <View style={styles.vendorFormHeader}>
                        <TouchableOpacity onPress={() => setVendorSelectionMode('select')}>
                          <Ionicons name="arrow-back" size={24} color="#333" />
                        </TouchableOpacity>
                        <Text style={styles.vendorFormTitle}>
                          {language === 'hi' ? 'विक्रेता खोजें' : 'Search Vendor'}
                        </Text>
                      </View>
                      <View style={styles.searchBox}>
                        <Ionicons name="search" size={18} color="#999" />
                        <TextInput
                          style={styles.searchInput}
                          placeholder={language === 'hi' ? 'नाम या मोबाइल दर्ज करें' : 'Enter name or mobile'}
                          value={vendorSearch}
                          onChangeText={onVendorSearchChange}
                          placeholderTextColor="#999"
                        />
                      </View>
                      
                      {searchingVendors && (
                        <Text style={styles.searchingText}>
                          {language === 'hi' ? 'खोज रहे हैं...' : 'Searching...'}
                        </Text>
                      )}
                      
                      {vendorSearchResults.length > 0 && (
                        <View style={styles.searchResultsContainer}>
                          <Text style={styles.searchResultsTitle}>
                            {language === 'hi' ? 'परिणाम:' : 'Results:'}
                          </Text>
                          {vendorSearchResults.map(vendor => (
                            <TouchableOpacity
                              key={vendor.id}
                              style={styles.searchResultItem}
                              onPress={() => handleSelectExistingVendor(vendor)}
                            >
                              <View style={styles.searchResultInfo}>
                                <Text style={styles.searchResultName}>{vendor.name}</Text>
                                {vendor.mobile && (
                                  <Text style={styles.searchResultMobile}>
                                    <Ionicons name="call-outline" size={12} color="#666" /> {vendor.mobile}
                                  </Text>
                                )}
                                {vendor.address && (
                                  <Text style={styles.searchResultAddress}>
                                    <Ionicons name="location-outline" size={12} color="#666" /> {vendor.address}
                                  </Text>
                                )}
                              </View>
                              <View style={styles.searchResultAction}>
                                <Ionicons name="chevron-forward" size={20} color="#7B1FA2" />
                              </View>
                            </TouchableOpacity>
                          ))}
                        </View>
                      )}
                      
                      {vendorSearch.trim().length >= 1 && vendorSearchResults.length === 0 && !searchingVendors && (
                        <View style={styles.noResultsContainer}>
                          <Text style={styles.noResultsText}>
                            {language === 'hi' ? 'कोई विक्रेता नहीं मिला' : 'No vendor found'}
                          </Text>
                          <Button
                            title={language === 'hi' ? 'नया विक्रेता बनाएं' : 'Create New Vendor'}
                            onPress={() => {
                              setNewVendorData({ ...newVendorData, name: vendorSearch });
                              setVendorSelectionMode('new');
                            }}
                            variant="outline"
                            style={styles.createNewFromSearchBtn}
                          />
                        </View>
                      )}
                    </View>
                  )}

                  {/* Confirmed Vendor Display */}
                  {vendorSelectionMode === 'confirmed' && confirmedVendor && (
                    <View style={styles.confirmedVendorContainer}>
                      <View style={styles.confirmedVendorInfo}>
                        <Ionicons name="checkmark-circle" size={24} color="#7B1FA2" />
                        <View style={styles.confirmedVendorDetails}>
                          <Text style={styles.confirmedVendorName}>{confirmedVendor.name}</Text>
                          {confirmedVendor.mobile && (
                            <Text style={styles.confirmedVendorMobile}>{confirmedVendor.mobile}</Text>
                          )}
                          {(confirmedVendor.outstanding_dues || 0) > 0 && (
                            <Text style={styles.confirmedVendorDue}>
                              {language === 'hi' ? 'देय:' : 'Due:'} ₹{confirmedVendor.outstanding_dues?.toLocaleString('en-IN')}
                            </Text>
                          )}
                        </View>
                      </View>
                      <TouchableOpacity
                        style={styles.changeVendorBtn}
                        onPress={resetVendorSelection}
                      >
                        <Text style={styles.changeVendorText}>
                          {language === 'hi' ? 'बदलें' : 'Change'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </>
              )}

              {/* Manual Entry Toggle for Product */}
              <View
                style={styles.manualToggle}
                onLayout={(e) => { afterVendorSectionY.current = e.nativeEvent.layout.y; }}
              >
                <Text style={styles.manualToggleText}>
                  {language === 'hi' ? 'उत्पाद मैन्युअल लिखें' : 'Write product manually'}
                </Text>
                <Switch
                  value={useManualProduct}
                  onValueChange={(v) => { setUseManualProduct(v); setSelectedProduct(''); }}
                  trackColor={{ false: '#DDD', true: '#64B5F6' }}
                  thumbColor={useManualProduct ? '#1976D2' : '#999'}
                />
              </View>

              {useManualProduct ? (
                <View style={styles.manualInputs}>
                  <Input
                    label={language === 'hi' ? 'उत्पाद का नाम' : 'Product Name'}
                    placeholder={language === 'hi' ? 'उत्पाद नाम दर्ज करें' : 'Enter product name'}
                    value={manualProductName}
                    onChangeText={setManualProductName}
                  />
                  <View style={styles.unitRow}>
                    <Text style={styles.unitLabel}>{language === 'hi' ? 'इकाई' : 'Unit'}:</Text>
                    {['kg', 'quintal', 'piece', 'litre'].map((unit) => (
                      <TouchableOpacity
                        key={unit}
                        style={[styles.unitChip, manualProductUnit === unit && styles.unitChipActive]}
                        onPress={() => setManualProductUnit(unit)}
                      >
                        <Text style={[styles.unitText, manualProductUnit === unit && styles.unitTextActive]}>
                          {unit}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              ) : (
                <>
                  {/* Product Search & Selection */}
                  <Text style={styles.label}>
                    {language === 'hi' ? 'उत्पाद चुनें' : 'Select Product'} *
                  </Text>
                  <View style={styles.searchBox}>
                    <Ionicons name="search" size={18} color="#999" />
                    <TextInput
                      style={styles.searchInput}
                      placeholder={language === 'hi' ? 'उत्पाद खोजें...' : 'Search products...'}
                      value={productSearch}
                      onChangeText={setProductSearch}
                      placeholderTextColor="#999"
                    />
                    {productSearch.length > 0 && (
                      <TouchableOpacity onPress={() => setProductSearch('')}>
                        <Ionicons name="close-circle" size={18} color="#999" />
                      </TouchableOpacity>
                    )}
                  </View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.selectScroll}>
                    {filteredProducts.map((p) => (
                      <TouchableOpacity
                        key={p.id}
                        style={[styles.selectChip, selectedProduct === p.id && styles.productChipActive]}
                        onPress={() => { setSelectedProduct(p.id); setSelectedVariety(null); }}
                      >
                        <Text style={[styles.selectText, selectedProduct === p.id && styles.selectTextActive]}>
                          {language === 'hi' && p.name_hi ? p.name_hi : p.name}
                          {p.varieties && p.varieties.length > 0 ? `  · ${p.varieties.length}` : ''}
                        </Text>
                        <Text style={[styles.selectSubtext, selectedProduct === p.id && styles.selectTextActive]}>
                          {p.unit}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>

                  {/* Variety picker — only shown when chosen product has varieties */}
                  {(() => {
                    const p = products.find((x) => x.id === selectedProduct);
                    if (!p || !p.varieties || p.varieties.length === 0) return null;
                    return (
                      <View style={{ marginTop: 8 }}>
                        <Text style={[styles.label, { marginBottom: 6 }]}>
                          {language === 'hi' ? 'किस्म चुनें *' : 'Select Variety *'}
                        </Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                          {p.varieties.map((v, idx) => {
                            const active = selectedVariety?.id === v.id || selectedVariety?.name === v.name;
                            return (
                              <TouchableOpacity
                                key={v.id || idx}
                                style={[styles.selectChip, active && styles.productChipActive]}
                                onPress={() => setSelectedVariety(v)}
                              >
                                <Ionicons name="leaf-outline" size={14} color={active ? '#FFF' : '#2E7D32'} />
                                <Text style={[styles.selectText, active && styles.selectTextActive, { marginLeft: 4 }]}>
                                  {language === 'hi' && v.name_hi ? v.name_hi : v.name}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </ScrollView>
                      </View>
                    );
                  })()}
                </>
              )}

              {/* Outlet Search & Selection */}
              <Text style={styles.label}>
                {language === 'hi' ? 'आउटलेट (स्टॉक यहां जाएगा)' : 'Outlet (stock goes here)'} *
              </Text>
              <View style={styles.searchBox}>
                <Ionicons name="search" size={18} color="#999" />
                <TextInput
                  style={styles.searchInput}
                  placeholder={language === 'hi' ? 'आउटलेट खोजें...' : 'Search outlets...'}
                  value={outletSearch}
                  onChangeText={setOutletSearch}
                  placeholderTextColor="#999"
                />
                {outletSearch.length > 0 && (
                  <TouchableOpacity onPress={() => setOutletSearch('')}>
                    <Ionicons name="close-circle" size={18} color="#999" />
                  </TouchableOpacity>
                )}
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.selectScroll}>
                {filteredOutlets.map((o) => (
                  <TouchableOpacity
                    key={o.id}
                    style={[styles.selectChip, selectedOutlet === o.id && styles.outletChipActive]}
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

              <Button
                title={language === 'hi' ? 'खरीद दर्ज करें' : 'Record Purchase'}
                onPress={handleSubmit}
                loading={loading}
                style={styles.submitBtn}
              />
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E0E0E0' },
  title: { fontSize: 24, fontWeight: 'bold', color: '#333' },
  subtitle: { fontSize: 13, color: '#666', marginTop: 2 },
  addBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#2E7D32', justifyContent: 'center', alignItems: 'center' },
  listContent: { padding: 16 },
  purchaseCard: { marginBottom: 12 },
  purchaseHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sourceInfo: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sourceIcon: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  sourceName: { fontSize: 16, fontWeight: '600', color: '#333' },
  sourceType: { fontSize: 12, color: '#666' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusText: { fontSize: 12, fontWeight: '600' },
  purchaseDetails: { borderTopWidth: 1, borderTopColor: '#E0E0E0', paddingTop: 12, gap: 6 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between' },
  detailLabel: { fontSize: 13, color: '#666' },
  detailValue: { fontSize: 13, fontWeight: '500', color: '#333' },
  purchaseFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#E0E0E0', paddingTop: 12, marginTop: 8 },
  receiptNum: { fontSize: 12, color: '#666' },
  totalAmount: { fontSize: 18, fontWeight: 'bold', color: '#2E7D32' },
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { fontSize: 16, color: '#999', marginTop: 16 },
  modalSafe: { flex: 1, backgroundColor: '#F5F5F5' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalScrollContent: { flexGrow: 1 },
  modalContent: { backgroundColor: '#FFF', padding: 20, flex: 1 },
  closeBtn: { padding: 4 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#333' },
  label: { fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 8, marginTop: 12 },
  sourceToggle: { flexDirection: 'row', gap: 12, marginBottom: 8 },
  sourceBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 10, borderWidth: 2, borderColor: '#2E7D32', backgroundColor: '#FFF' },
  sourceBtnActive: { backgroundColor: '#2E7D32' },
  vendorBtn: { borderColor: '#7B1FA2' },
  vendorBtnActive: { backgroundColor: '#7B1FA2' },
  sourceBtnText: { fontSize: 15, fontWeight: '600', color: '#333' },
  sourceBtnTextActive: { color: '#FFF' },
  manualToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#F5F5F5', padding: 12, borderRadius: 8, marginTop: 8 },
  manualToggleText: { fontSize: 13, color: '#666', flex: 1 },
  manualInputs: { backgroundColor: '#FAFAFA', padding: 12, borderRadius: 8, marginTop: 8 },
  unitRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  unitLabel: { fontSize: 13, color: '#666' },
  unitChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, backgroundColor: '#E8E8E8' },
  unitChipActive: { backgroundColor: '#1976D2' },
  unitText: { fontSize: 13, color: '#666' },
  unitTextActive: { color: '#FFF' },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F5F5F5', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 8, gap: 8 },
  searchInput: { flex: 1, fontSize: 14, color: '#333' },
  selectScroll: { marginBottom: 8, maxHeight: 70 },
  selectChip: { paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#E8E8E8', borderRadius: 10, marginRight: 8, minWidth: 80 },
  farmerChipActive: { backgroundColor: '#2E7D32' },
  vendorChipActive: { backgroundColor: '#7B1FA2' },
  productChipActive: { backgroundColor: '#1976D2' },
  outletChipActive: { backgroundColor: '#F57C00' },
  selectText: { color: '#333', fontWeight: '500', fontSize: 13 },
  selectSubtext: { color: '#666', fontSize: 11, marginTop: 2 },
  selectTextActive: { color: '#FFF' },
  row: { flexDirection: 'row', gap: 12 },
  halfInput: { flex: 1 },
  totalDisplay: { backgroundColor: '#E8F5E9', padding: 16, borderRadius: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 12 },
  totalDisplayLabel: { fontSize: 15, color: '#2E7D32', fontWeight: '500' },
  totalDisplayValue: { fontSize: 22, fontWeight: 'bold', color: '#2E7D32' },
  paymentModes: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  modeBtn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: '#DDD', backgroundColor: '#F9F9F9' },
  modeBtnActive: { backgroundColor: '#2E7D32', borderColor: '#2E7D32' },
  modeText: { fontSize: 13, color: '#666', fontWeight: '500' },
  modeTextActive: { color: '#FFF' },
  submitBtn: { marginTop: 20 },
  // Vendor Selection Flow Styles
  vendorSelectionContainer: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
    borderWidth: 2,
    borderColor: '#7B1FA2',
    borderStyle: 'dashed',
  },
  vendorSelectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#7B1FA2',
    textAlign: 'center',
    marginBottom: 16,
  },
  vendorSelectionOptions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    gap: 12,
  },
  vendorOptionBtn: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  vendorOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginTop: 8,
  },
  vendorOptionSubtext: {
    fontSize: 11,
    color: '#666',
    marginTop: 4,
  },
  vendorFormContainer: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
  },
  vendorFormHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  vendorFormTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  createVendorBtn: {
    marginTop: 16,
    backgroundColor: '#7B1FA2',
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
  searchResultAddress: {
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
  confirmedVendorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F3E5F5',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#7B1FA2',
  },
  confirmedVendorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  confirmedVendorDetails: {
    flex: 1,
  },
  confirmedVendorName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  confirmedVendorMobile: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  confirmedVendorDue: {
    fontSize: 12,
    color: '#E65100',
    fontWeight: '600',
    marginTop: 2,
  },
  changeVendorBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#FFF',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#7B1FA2',
  },
  changeVendorText: {
    fontSize: 13,
    color: '#7B1FA2',
    fontWeight: '600',
  },
});
