import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  Modal,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../../src/components/Button';
import { Input } from '../../src/components/Input';
import { useSettingsStore } from '../../src/store/settingsStore';
import api from '../../src/utils/api';

interface Vendor {
  id: string;
  name: string;
  mobile?: string;
  address?: string;
  village?: string;
  outstanding_dues: number;
  total_purchases?: number;
  total_paid?: number;
  transaction_count?: number;
}

interface Transaction {
  id: string;
  type: string;
  date: string;
  reference: string;
  description: string;
  debit: number;
  credit: number;
  payment_mode?: string;
  is_cancelled?: boolean;
  deleted_at?: string;
  deletion_reason?: string;
  total_amount?: number;
  product_name?: string;
  quantity?: number;
  rate?: number;
}

interface LedgerData {
  vendor: Vendor;
  summary: {
    total_purchases: number;
    total_credit_given: number;
    total_payments: number;
    outstanding_dues: number;
  };
  transactions: Transaction[];
}

export default function VendorKhataScreen() {
  const lang = useSettingsStore((s) => s.language);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDues, setFilterDues] = useState(false);

  // Ledger modal
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [ledger, setLedger] = useState<LedgerData | null>(null);
  const [ledgerLoading, setLedgerLoading] = useState(false);

  // Payment modal
  const [showPayment, setShowPayment] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState<'cash' | 'online'>('cash');
  const [paymentNote, setPaymentNote] = useState('');
  const [submittingPayment, setSubmittingPayment] = useState(false);

  const formatCurrency = (n: number) =>
    `₹${(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

  const formatDate = (s: string) => {
    if (!s) return '';
    try {
      const d = new Date(s);
      return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) +
        ' ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return s;
    }
  };

  const fetchVendors = useCallback(async () => {
    try {
      setLoading(true);
      const res = filterDues
        ? await api.get('/vendors/with-dues')
        : await api.get('/vendors');
      let list: Vendor[] = res.data || [];
      const q = searchQuery.trim().toLowerCase();
      if (q) {
        list = list.filter(v =>
          (v.name || '').toLowerCase().includes(q) ||
          (v.mobile || '').toLowerCase().includes(q) ||
          (v.address || '').toLowerCase().includes(q) ||
          (v.village || '').toLowerCase().includes(q));
      }
      setVendors(list);
    } catch (e) {
      console.error('vendors fetch error', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [searchQuery, filterDues]);

  useEffect(() => { fetchVendors(); }, [fetchVendors]);

  const openLedger = async (vendor: Vendor) => {
    setSelectedVendor(vendor);
    setLedger(null);
    setLedgerLoading(true);
    try {
      const res = await api.get(`/vendors/${vendor.id}/ledger`);
      setLedger(res.data);
    } catch (e: any) {
      Alert.alert(
        lang === 'hi' ? 'त्रुटि' : 'Error',
        e?.response?.data?.detail || (lang === 'hi' ? 'खाता लोड नहीं हो सका' : 'Failed to load ledger')
      );
    } finally {
      setLedgerLoading(false);
    }
  };

  const recordPayment = async () => {
    if (!selectedVendor) return;
    const amt = parseFloat(paymentAmount);
    if (!amt || amt <= 0) {
      Alert.alert(lang === 'hi' ? 'त्रुटि' : 'Error', lang === 'hi' ? 'कृपया वैध राशि दर्ज करें' : 'Please enter a valid amount');
      return;
    }
    setSubmittingPayment(true);
    try {
      await api.post('/vendors/payment', {
        vendor_id: selectedVendor.id,
        amount: amt,
        payment_mode: paymentMode,
        notes: paymentNote.trim() || null,
      });
      setShowPayment(false);
      setPaymentAmount('');
      setPaymentNote('');
      // Reload ledger and list
      await openLedger(selectedVendor);
      fetchVendors();
      Alert.alert(
        lang === 'hi' ? 'सफल' : 'Success',
        lang === 'hi' ? 'भुगतान दर्ज किया गया' : 'Payment recorded'
      );
    } catch (e: any) {
      Alert.alert(
        lang === 'hi' ? 'त्रुटि' : 'Error',
        e?.response?.data?.detail || (lang === 'hi' ? 'भुगतान दर्ज नहीं हुआ' : 'Failed to record payment')
      );
    } finally {
      setSubmittingPayment(false);
    }
  };

  const renderVendor = ({ item }: { item: Vendor }) => (
    <TouchableOpacity style={styles.row} onPress={() => openLedger(item)} activeOpacity={0.7}>
      <View style={[styles.avatar, { backgroundColor: item.outstanding_dues > 0 ? '#FFEBEE' : '#E8F5E9' }]}>
        <Ionicons name="storefront" size={22} color={item.outstanding_dues > 0 ? '#D32F2F' : '#2E7D32'} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.name}>{item.name}</Text>
        <Text style={styles.meta}>
          {item.mobile ? `${item.mobile} · ` : ''}{item.village || item.address || ''}
        </Text>
        {item.outstanding_dues > 0 ? (
          <Text style={styles.dueText}>
            {lang === 'hi' ? 'देय:' : 'Dues:'} {formatCurrency(item.outstanding_dues)}
          </Text>
        ) : (
          <Text style={styles.noDueText}>
            {lang === 'hi' ? '✓ कोई बकाया नहीं' : '✓ No dues'}
          </Text>
        )}
      </View>
      <Ionicons name="chevron-forward" size={20} color="#999" />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          {lang === 'hi' ? 'विक्रेता खाता' : 'Vendor Khata'}
        </Text>
        <Text style={styles.headerSub}>
          {lang === 'hi' ? 'विक्रेता खाते और देय राशि' : 'Vendor ledgers and outstanding dues'}
        </Text>
      </View>

      <View style={styles.searchRow}>
        <Ionicons name="search" size={18} color="#999" />
        <TextInput
          style={styles.searchInput}
          placeholder={lang === 'hi' ? 'नाम / मोबाइल / पता खोजें...' : 'Search name / mobile / address...'}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor="#999"
        />
      </View>

      <View style={styles.filterRow}>
        <TouchableOpacity
          style={[styles.filterChip, !filterDues && styles.filterChipActive]}
          onPress={() => setFilterDues(false)}
        >
          <Text style={[styles.filterChipText, !filterDues && styles.filterChipTextActive]}>
            {lang === 'hi' ? 'सभी' : 'All'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterChip, filterDues && styles.filterChipActive]}
          onPress={() => setFilterDues(true)}
        >
          <Text style={[styles.filterChipText, filterDues && styles.filterChipTextActive]}>
            {lang === 'hi' ? 'देय वाले' : 'With Dues'}
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={vendors}
        keyExtractor={(v) => v.id}
        renderItem={renderVendor}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchVendors(); }} />
        }
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <Ionicons name="people-outline" size={42} color="#BDBDBD" />
              <Text style={styles.emptyText}>
                {lang === 'hi' ? 'कोई विक्रेता नहीं' : 'No vendors found'}
              </Text>
            </View>
          ) : null
        }
        contentContainerStyle={{ paddingBottom: 30 }}
      />

      {/* Ledger Modal */}
      <Modal visible={!!selectedVendor} animationType="slide" onRequestClose={() => setSelectedVendor(null)}>
        <SafeAreaView style={styles.container}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setSelectedVendor(null)}>
              <Ionicons name="arrow-back" size={24} color="#333" />
            </TouchableOpacity>
            <View style={{ flex: 1, marginLeft: 14 }}>
              <Text style={styles.modalTitle}>{selectedVendor?.name}</Text>
              <Text style={styles.modalSub}>{lang === 'hi' ? 'खाता विवरण' : 'Ledger detail'}</Text>
            </View>
            {ledger?.summary && ledger.summary.outstanding_dues > 0 ? (
              <TouchableOpacity
                style={styles.payBtn}
                onPress={() => { setShowPayment(true); setPaymentAmount(String(ledger.summary.outstanding_dues)); }}
              >
                <Ionicons name="cash" size={16} color="#FFF" />
                <Text style={styles.payBtnText}>{lang === 'hi' ? 'भुगतान' : 'Pay'}</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {ledgerLoading ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>{lang === 'hi' ? 'लोड हो रहा है...' : 'Loading...'}</Text>
            </View>
          ) : ledger ? (
            <>
              <View style={styles.summaryCard}>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>{lang === 'hi' ? 'कुल खरीद' : 'Total Purchased'}</Text>
                  <Text style={styles.summaryVal}>{formatCurrency(ledger.summary.total_purchases)}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>{lang === 'hi' ? 'कुल भुगतान' : 'Total Paid'}</Text>
                  <Text style={styles.summaryVal}>{formatCurrency(ledger.summary.total_payments)}</Text>
                </View>
                <View style={[styles.summaryRow, { borderTopWidth: 1, borderTopColor: '#E0E0E0', paddingTop: 8, marginTop: 6 }]}>
                  <Text style={[styles.summaryLabel, { fontWeight: '700' }]}>{lang === 'hi' ? 'बकाया' : 'Outstanding'}</Text>
                  <Text style={[styles.summaryVal, { fontWeight: '700', color: ledger.summary.outstanding_dues > 0 ? '#D32F2F' : '#2E7D32' }]}>
                    {formatCurrency(ledger.summary.outstanding_dues)}
                  </Text>
                </View>
              </View>

              <FlatList
                data={ledger.transactions}
                keyExtractor={(t) => t.id}
                renderItem={({ item }) => {
                  const isCancelled = !!item.is_cancelled;
                  return (
                    <View style={[styles.txnRow, isCancelled && { backgroundColor: '#FFF5F5' }]}>
                      <View style={[styles.txnIcon, isCancelled && { backgroundColor: '#FFEBEE' }]}>
                        <Ionicons
                          name={item.type === 'purchase' ? 'cart' : 'cash'}
                          size={18}
                          color={isCancelled ? '#D32F2F' : (item.type === 'purchase' ? '#7B1FA2' : '#2E7D32')}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <Text style={[styles.txnDesc, isCancelled && { textDecorationLine: 'line-through', color: '#999' }]}>
                            {item.description.replace(' (CANCELLED)', '')}
                          </Text>
                          {isCancelled && (
                            <View style={styles.cancelBadge}>
                              <Text style={styles.cancelBadgeText}>{lang === 'hi' ? 'रद्द' : 'CANCELLED'}</Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.txnDate}>{formatDate(item.date)}</Text>
                        {item.quantity && item.rate ? (
                          <Text style={styles.txnMeta}>
                            {item.quantity} × {formatCurrency(item.rate)} {item.payment_mode ? `· ${item.payment_mode}` : ''}
                          </Text>
                        ) : null}
                        {isCancelled && item.deletion_reason ? (
                          <Text style={styles.cancelReason}>
                            {lang === 'hi' ? 'कारण:' : 'Reason:'} {item.deletion_reason}
                          </Text>
                        ) : null}
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        {isCancelled && item.total_amount ? (
                          <Text style={[styles.txnAmount, { textDecorationLine: 'line-through', color: '#999' }]}>
                            {formatCurrency(item.total_amount)}
                          </Text>
                        ) : item.debit > 0 ? (
                          <Text style={[styles.txnAmount, { color: '#D32F2F' }]}>+{formatCurrency(item.debit)}</Text>
                        ) : item.credit > 0 ? (
                          <Text style={[styles.txnAmount, { color: '#2E7D32' }]}>-{formatCurrency(item.credit)}</Text>
                        ) : null}
                      </View>
                    </View>
                  );
                }}
                ListEmptyComponent={
                  <View style={styles.empty}>
                    <Text style={styles.emptyText}>
                      {lang === 'hi' ? 'कोई लेन-देन नहीं' : 'No transactions yet'}
                    </Text>
                  </View>
                }
                contentContainerStyle={{ paddingBottom: 30 }}
              />
            </>
          ) : null}
        </SafeAreaView>
      </Modal>

      {/* Payment Modal */}
      <Modal visible={showPayment} animationType="slide" transparent onRequestClose={() => setShowPayment(false)}>
        <View style={styles.payOverlay}>
          <View style={styles.payCard}>
            <View style={styles.payHeader}>
              <Text style={styles.modalTitle}>{lang === 'hi' ? 'भुगतान दर्ज करें' : 'Record Payment'}</Text>
              <TouchableOpacity onPress={() => setShowPayment(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSub}>{selectedVendor?.name}</Text>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Input
                label={lang === 'hi' ? 'राशि *' : 'Amount *'}
                placeholder="0.00"
                value={paymentAmount}
                onChangeText={setPaymentAmount}
                keyboardType="decimal-pad"
              />
              <Text style={[styles.summaryLabel, { marginTop: 6, marginBottom: 6 }]}>
                {lang === 'hi' ? 'भुगतान मोड' : 'Payment Mode'}
              </Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity
                  style={[styles.payModeBtn, paymentMode === 'cash' && styles.payModeBtnActive]}
                  onPress={() => setPaymentMode('cash')}
                >
                  <Text style={[styles.payModeText, paymentMode === 'cash' && styles.payModeTextActive]}>
                    {lang === 'hi' ? 'नकद' : 'Cash'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.payModeBtn, paymentMode === 'online' && styles.payModeBtnActive]}
                  onPress={() => setPaymentMode('online')}
                >
                  <Text style={[styles.payModeText, paymentMode === 'online' && styles.payModeTextActive]}>
                    {lang === 'hi' ? 'ऑनलाइन' : 'Online'}
                  </Text>
                </TouchableOpacity>
              </View>
              <Input
                label={lang === 'hi' ? 'टिप्पणी (वैकल्पिक)' : 'Note (optional)'}
                placeholder={lang === 'hi' ? 'भुगतान विवरण' : 'Payment details'}
                value={paymentNote}
                onChangeText={setPaymentNote}
                multiline
              />
              <Button
                title={lang === 'hi' ? 'भुगतान सहेजें' : 'Save Payment'}
                onPress={recordPayment}
                loading={submittingPayment}
                style={{ marginTop: 12 }}
              />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  header: {
    backgroundColor: '#FFF',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#333' },
  headerSub: { fontSize: 12, color: '#666', marginTop: 2 },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    paddingHorizontal: 14,
    marginHorizontal: 14,
    marginTop: 12,
    borderRadius: 10,
    gap: 8,
    height: 42,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  searchInput: { flex: 1, fontSize: 14, color: '#333' },
  filterRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 14, paddingVertical: 10 },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: '#FFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  filterChipActive: { backgroundColor: '#2E7D32', borderColor: '#2E7D32' },
  filterChipText: { fontSize: 12, color: '#666', fontWeight: '600' },
  filterChipTextActive: { color: '#FFF' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#FFF',
    marginHorizontal: 14,
    marginTop: 8,
    borderRadius: 10,
    gap: 12,
  },
  avatar: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 15, fontWeight: '700', color: '#333' },
  meta: { fontSize: 12, color: '#666', marginTop: 2 },
  dueText: { fontSize: 13, color: '#D32F2F', fontWeight: '700', marginTop: 4 },
  noDueText: { fontSize: 12, color: '#2E7D32', fontWeight: '500', marginTop: 4 },
  empty: { padding: 40, alignItems: 'center' },
  emptyText: { fontSize: 14, color: '#999', marginTop: 8 },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: '#333' },
  modalSub: { fontSize: 12, color: '#666' },
  payBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2E7D32',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 18,
    gap: 4,
  },
  payBtnText: { color: '#FFF', fontSize: 13, fontWeight: '700' },
  summaryCard: { backgroundColor: '#FFF', margin: 14, padding: 14, borderRadius: 10 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  summaryLabel: { fontSize: 14, color: '#666' },
  summaryVal: { fontSize: 14, color: '#333', fontWeight: '600' },
  txnRow: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#FFF',
    marginHorizontal: 14,
    marginBottom: 6,
    borderRadius: 10,
    gap: 12,
    alignItems: 'flex-start',
  },
  txnIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F3E5F5' },
  txnDesc: { fontSize: 14, color: '#333', fontWeight: '600' },
  txnDate: { fontSize: 11, color: '#666', marginTop: 2 },
  txnMeta: { fontSize: 11, color: '#666', marginTop: 2 },
  txnAmount: { fontSize: 14, fontWeight: '700', color: '#333' },
  cancelBadge: { backgroundColor: '#D32F2F', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4 },
  cancelBadgeText: { color: '#FFF', fontSize: 9, fontWeight: '700' },
  cancelReason: { fontSize: 11, color: '#D32F2F', marginTop: 2, fontStyle: 'italic' },
  payOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  payCard: { backgroundColor: '#FFF', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 18, maxHeight: '85%' },
  payHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  payModeBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: '#E0E0E0', alignItems: 'center', backgroundColor: '#FFF' },
  payModeBtnActive: { backgroundColor: '#2E7D32', borderColor: '#2E7D32' },
  payModeText: { fontSize: 14, color: '#666', fontWeight: '600' },
  payModeTextActive: { color: '#FFF' },
});
