import React, { useEffect, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { api } from '../services/api';
import { useSettingsStore } from '../store/settingsStore';

interface Props {
  visible: boolean;
  onClose: () => void;
}

interface GlobalResults {
  query: string;
  customers: any[];
  vendors: any[];
  products: any[];
  sales: any[];
  outlets: any[];
  total: number;
}

const EMPTY: GlobalResults = {
  query: '',
  customers: [],
  vendors: [],
  products: [],
  sales: [],
  outlets: [],
  total: 0,
};

export default function GlobalSearchModal({ visible, onClose }: Props) {
  const language = useSettingsStore((s) => s.language);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GlobalResults>(EMPTY);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const formatCurrency = (v: number) => `₹${(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

  const runSearch = async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) {
      setResults(EMPTY);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await api.get('/search/global', { params: { q: trimmed } });
      setResults(res.data || EMPTY);
    } catch (e) {
      console.error('Global search error', e);
      setResults(EMPTY);
    } finally {
      setLoading(false);
    }
  };

  const onChangeText = (val: string) => {
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (val.trim()) setLoading(true);
    else setResults(EMPTY);
    debounceRef.current = setTimeout(() => runSearch(val), 300);
  };

  useEffect(() => {
    if (!visible) {
      setQuery('');
      setResults(EMPTY);
      setLoading(false);
    }
  }, [visible]);

  const navigateAndClose = (path: string) => {
    Keyboard.dismiss();
    onClose();
    setTimeout(() => router.push(path as any), 200);
  };

  const handleCustomerTap = (c: any) => {
    navigateAndClose(`/(admin)/khata?customerId=${c.id}`);
  };
  const handleVendorTap = () => {
    navigateAndClose('/(admin)/purchase');
  };
  const handleProductTap = () => {
    navigateAndClose('/(admin)/manage?tab=products');
  };
  const handleSaleTap = (s: any) => {
    // Customer khata — user can click into the ledger then tap the sale
    if (s.customer_id) {
      navigateAndClose(`/(admin)/khata?customerId=${s.customer_id}`);
    } else {
      navigateAndClose('/(admin)/sales');
    }
  };
  const handleOutletTap = () => {
    navigateAndClose('/(admin)/manage?tab=outlets');
  };

  const hasAny = results.total > 0;
  const showEmptyState = query.trim().length > 0 && !loading && !hasAny;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.container} edges={['top']}>
        {/* Search Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <View style={styles.searchWrap}>
            <Ionicons name="search" size={18} color="#999" />
            <TextInput
              autoFocus
              value={query}
              onChangeText={onChangeText}
              placeholder={language === 'hi' ? 'सब कुछ खोजें...' : 'Search everything...'}
              placeholderTextColor="#999"
              style={styles.searchInput}
              returnKeyType="search"
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => onChangeText('')}>
                <Ionicons name="close-circle" size={18} color="#999" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Results */}
        {query.trim().length === 0 ? (
          <View style={styles.hintBox}>
            <Ionicons name="search-outline" size={48} color="#BDBDBD" />
            <Text style={styles.hintTitle}>
              {language === 'hi' ? 'ग्लोबल सर्च' : 'Global Search'}
            </Text>
            <Text style={styles.hintText}>
              {language === 'hi'
                ? 'ग्राहक, विक्रेता, उत्पाद, बिल, दुकान — एक साथ खोजें'
                : 'Customers, vendors, products, bills, outlets — all in one place'}
            </Text>
          </View>
        ) : (
          <ScrollView keyboardShouldPersistTaps="handled" style={styles.results}>
            {loading && !hasAny && (
              <View style={{ padding: 30, alignItems: 'center' }}>
                <ActivityIndicator color="#2E7D32" size="small" />
                <Text style={{ color: '#666', marginTop: 8 }}>
                  {language === 'hi' ? 'खोज रहे हैं...' : 'Searching...'}
                </Text>
              </View>
            )}

            {showEmptyState && (
              <View style={styles.emptyState}>
                <Ionicons name="cloud-offline-outline" size={42} color="#BDBDBD" />
                <Text style={styles.emptyText}>
                  {language === 'hi' ? 'कोई परिणाम नहीं मिला' : 'No results found'}
                </Text>
                <Text style={styles.emptySub}>
                  {language === 'hi' ? 'कोई और कीवर्ड आज़माएं' : 'Try a different keyword'}
                </Text>
              </View>
            )}

            {results.customers.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>
                  {language === 'hi' ? 'ग्राहक' : 'Customers'} · {results.customers.length}
                </Text>
                {results.customers.map((c) => (
                  <TouchableOpacity key={c.id} style={styles.resultRow} onPress={() => handleCustomerTap(c)}>
                    <View style={[styles.icon, { backgroundColor: '#E3F2FD' }]}>
                      <Ionicons name="person" size={18} color="#1976D2" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.resultTitle}>{c.name}</Text>
                      <Text style={styles.resultSub}>
                        {c.mobile ? `${c.mobile} · ` : ''}
                        {c.village || c.address || (c.customer_type || '')}
                      </Text>
                      {c.outstanding_balance > 0 && (
                        <Text style={styles.dueText}>
                          {language === 'hi' ? 'बकाया: ' : 'Due: '}{formatCurrency(c.outstanding_balance)}
                        </Text>
                      )}
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="#999" />
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {results.vendors.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>
                  {language === 'hi' ? 'विक्रेता' : 'Vendors'} · {results.vendors.length}
                </Text>
                {results.vendors.map((v) => (
                  <TouchableOpacity key={v.id} style={styles.resultRow} onPress={handleVendorTap}>
                    <View style={[styles.icon, { backgroundColor: '#FFF3E0' }]}>
                      <Ionicons name="storefront" size={18} color="#E65100" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.resultTitle}>{v.name}</Text>
                      <Text style={styles.resultSub}>
                        {v.mobile ? `${v.mobile} · ` : ''}
                        {v.village || v.address || ''}
                      </Text>
                      {v.outstanding_dues > 0 && (
                        <Text style={styles.dueText}>
                          {language === 'hi' ? 'देय: ' : 'Dues: '}{formatCurrency(v.outstanding_dues)}
                        </Text>
                      )}
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="#999" />
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {results.products.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>
                  {language === 'hi' ? 'उत्पाद' : 'Products'} · {results.products.length}
                </Text>
                {results.products.map((p) => (
                  <TouchableOpacity key={p.id} style={styles.resultRow} onPress={handleProductTap}>
                    <View style={[styles.icon, { backgroundColor: '#E8F5E9' }]}>
                      <Ionicons name="leaf" size={18} color="#2E7D32" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.resultTitle}>
                        {language === 'hi' && p.name_hi ? p.name_hi : p.name}
                      </Text>
                      <Text style={styles.resultSub}>
                        {p.unit} · {p.category}
                        {p.varieties_count > 0
                          ? ` · ${p.varieties_count} ${language === 'hi' ? 'किस्में' : 'varieties'}`
                          : ''}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="#999" />
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {results.sales.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>
                  {language === 'hi' ? 'बिक्री' : 'Sales'} · {results.sales.length}
                </Text>
                {results.sales.map((s) => (
                  <TouchableOpacity key={s.id} style={styles.resultRow} onPress={() => handleSaleTap(s)}>
                    <View style={[styles.icon, { backgroundColor: s.is_deleted ? '#FFEBEE' : '#F3E5F5' }]}>
                      <Ionicons
                        name={s.is_deleted ? 'close-circle' : 'receipt'}
                        size={18}
                        color={s.is_deleted ? '#D32F2F' : '#7B1FA2'}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={[styles.resultTitle, s.is_deleted && styles.strikeThrough]}>
                          #{s.bill_number}
                        </Text>
                        {s.is_deleted && (
                          <View style={styles.cancelTag}>
                            <Text style={styles.cancelTagText}>
                              {language === 'hi' ? 'रद्द' : 'CANCELLED'}
                            </Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.resultSub}>
                        {s.customer_name || (language === 'hi' ? 'ग्राहक नहीं' : 'No customer')} · {formatCurrency(s.total_amount)}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="#999" />
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {results.outlets.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>
                  {language === 'hi' ? 'दुकानें' : 'Outlets'} · {results.outlets.length}
                </Text>
                {results.outlets.map((o) => (
                  <TouchableOpacity key={o.id} style={styles.resultRow} onPress={handleOutletTap}>
                    <View style={[styles.icon, { backgroundColor: '#E0F7FA' }]}>
                      <Ionicons name="business" size={18} color="#00838F" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.resultTitle}>{o.name}</Text>
                      <Text style={styles.resultSub}>
                        {o.address || ''}{o.manager_name ? ` · ${o.manager_name}` : ''}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="#999" />
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <View style={{ height: 40 }} />
          </ScrollView>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    gap: 8,
  },
  backBtn: { padding: 6 },
  searchWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F0F0',
    borderRadius: 10,
    paddingHorizontal: 10,
    gap: 8,
    height: 42,
  },
  searchInput: { flex: 1, fontSize: 15, color: '#333', paddingVertical: 0 },
  results: { flex: 1 },
  section: {
    backgroundColor: '#FFF',
    marginTop: 10,
    paddingVertical: 6,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#666',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#FAFAFA',
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    gap: 12,
  },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultTitle: { fontSize: 15, fontWeight: '600', color: '#333' },
  resultSub: { fontSize: 12, color: '#666', marginTop: 2 },
  dueText: { fontSize: 12, color: '#E65100', fontWeight: '600', marginTop: 2 },
  strikeThrough: { textDecorationLine: 'line-through', color: '#999' },
  cancelTag: {
    backgroundColor: '#D32F2F',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  cancelTagText: { color: '#FFF', fontSize: 9, fontWeight: '700', letterSpacing: 0.4 },
  hintBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
  },
  hintTitle: { fontSize: 18, fontWeight: '700', color: '#333', marginTop: 16 },
  hintText: { fontSize: 14, color: '#666', marginTop: 8, textAlign: 'center' },
  emptyState: { padding: 40, alignItems: 'center' },
  emptyText: { fontSize: 16, color: '#666', fontWeight: '600', marginTop: 10 },
  emptySub: { fontSize: 13, color: '#999', marginTop: 4 },
});
