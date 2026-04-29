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
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../../src/components/Card';
import { Button } from '../../src/components/Button';
import { Input } from '../../src/components/Input';
import { useTranslation } from '../../src/utils/useTranslation';
import api from '../../src/utils/api';

interface Customer {
  id: string;
  name: string;
  mobile?: string;
  address?: string;
  village?: string;
  customer_type: string;
  folio_number?: string;
  total_purchases: number;
  total_credit: number;
  total_paid: number;
  outstanding_balance: number;
  transaction_count: number;
  last_transaction_date?: string;
}

interface Transaction {
  id: string;
  type: 'sale' | 'payment';
  date: string;
  reference: string;
  description: string;
  debit: number;
  credit: number;
  payment_mode?: string;
}

interface LedgerData {
  customer: Customer;
  transactions: Transaction[];
  summary: {
    total_transactions: number;
    total_billed: number;
    total_credit_given: number;
    total_payments: number;
    outstanding_balance: number;
  };
}

export default function KhataScreen() {
  const { t, language } = useTranslation();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDues, setFilterDues] = useState(false);
  const [totalDues, setTotalDues] = useState(0);
  
  // Ledger modal state
  const [showLedger, setShowLedger] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [ledgerData, setLedgerData] = useState<LedgerData | null>(null);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  
  // Payment modal state
  const [showPayment, setShowPayment] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState('cash');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [submittingPayment, setSubmittingPayment] = useState(false);
  
  // Add/Edit customer modal state
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [customerForm, setCustomerForm] = useState({
    name: '',
    mobile: '',
    address: '',
    village: '',
    customer_type: 'registered',
    folio_number: '',
  });
  const [submittingCustomer, setSubmittingCustomer] = useState(false);

  const fetchCustomers = async () => {
    try {
      const params: any = {};
      if (searchQuery) params.search = searchQuery;
      if (filterDues) params.has_dues = true;
      
      const response = await api.get('/customers', { params });
      setCustomers(response.data);
      
      // Also get total dues
      const duesResponse = await api.get('/customers/with-dues');
      setTotalDues(duesResponse.data.total_dues || 0);
    } catch (error) {
      console.error('Fetch customers error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, [searchQuery, filterDues]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchCustomers();
  }, [searchQuery, filterDues]);

  const formatCurrency = (amount: number) => `${t('currency')}${amount.toLocaleString('en-IN')}`;

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const getCustomerTypeLabel = (type: string) => {
    const labels: { [key: string]: { en: string; hi: string } } = {
      shareholder: { en: 'Shareholder', hi: 'शेयरधारक' },
      registered: { en: 'Registered', hi: 'पंजीकृत' },
      walk_in: { en: 'Walk-in', hi: 'वॉक-इन' },
    };
    return labels[type]?.[language] || type;
  };

  const getCustomerTypeColor = (type: string) => {
    const colors: { [key: string]: string } = {
      shareholder: '#9C27B0',
      registered: '#2196F3',
      walk_in: '#757575',
    };
    return colors[type] || '#757575';
  };

  const openLedger = async (customer: Customer) => {
    setSelectedCustomer(customer);
    setShowLedger(true);
    setLedgerLoading(true);
    
    try {
      const response = await api.get(`/customers/${customer.id}/ledger`);
      setLedgerData(response.data);
    } catch (error) {
      console.error('Fetch ledger error:', error);
      Alert.alert(t('error'), language === 'hi' ? 'खाता लोड करने में त्रुटि' : 'Error loading ledger');
    } finally {
      setLedgerLoading(false);
    }
  };

  const openPaymentModal = (customer: Customer) => {
    setSelectedCustomer(customer);
    setPaymentAmount('');
    setPaymentMode('cash');
    setPaymentNotes('');
    setShowPayment(true);
  };

  const handleRecordPayment = async () => {
    if (!selectedCustomer || !paymentAmount) {
      Alert.alert(t('error'), language === 'hi' ? 'राशि दर्ज करें' : 'Enter amount');
      return;
    }

    setSubmittingPayment(true);
    try {
      await api.post('/customers/payment', {
        customer_id: selectedCustomer.id,
        amount: parseFloat(paymentAmount),
        payment_mode: paymentMode,
        notes: paymentNotes || null,
      });
      
      Alert.alert(t('success'), language === 'hi' ? 'भुगतान दर्ज हो गया' : 'Payment recorded');
      setShowPayment(false);
      fetchCustomers();
      
      // Refresh ledger if open
      if (showLedger && selectedCustomer) {
        openLedger(selectedCustomer);
      }
    } catch (error: any) {
      Alert.alert(t('error'), error.response?.data?.detail || 'Failed to record payment');
    } finally {
      setSubmittingPayment(false);
    }
  };

  const openAddCustomer = () => {
    setEditingCustomer(null);
    setCustomerForm({
      name: '',
      mobile: '',
      address: '',
      village: '',
      customer_type: 'registered',
      folio_number: '',
    });
    setShowAddCustomer(true);
  };

  const openEditCustomer = (customer: Customer) => {
    setEditingCustomer(customer);
    setCustomerForm({
      name: customer.name,
      mobile: customer.mobile || '',
      address: customer.address || '',
      village: customer.village || '',
      customer_type: customer.customer_type,
      folio_number: customer.folio_number || '',
    });
    setShowAddCustomer(true);
  };

  const handleSaveCustomer = async () => {
    if (!customerForm.name.trim()) {
      Alert.alert(t('error'), language === 'hi' ? 'नाम दर्ज करें' : 'Enter name');
      return;
    }

    setSubmittingCustomer(true);
    try {
      if (editingCustomer) {
        await api.put(`/customers/${editingCustomer.id}`, customerForm);
        Alert.alert(t('success'), language === 'hi' ? 'ग्राहक अपडेट हो गया' : 'Customer updated');
      } else {
        await api.post('/customers', customerForm);
        Alert.alert(t('success'), language === 'hi' ? 'ग्राहक जोड़ा गया' : 'Customer added');
      }
      setShowAddCustomer(false);
      fetchCustomers();
    } catch (error: any) {
      Alert.alert(t('error'), error.response?.data?.detail || 'Failed to save customer');
    } finally {
      setSubmittingCustomer(false);
    }
  };

  const renderCustomerItem = ({ item }: { item: Customer }) => (
    <Card onPress={() => openLedger(item)}>
      <View style={styles.customerRow}>
        <View style={styles.customerInfo}>
          <View style={styles.customerHeader}>
            <Text style={styles.customerName}>{item.name}</Text>
            <View style={[styles.typeBadge, { backgroundColor: getCustomerTypeColor(item.customer_type) + '20' }]}>
              <Text style={[styles.typeText, { color: getCustomerTypeColor(item.customer_type) }]}>
                {getCustomerTypeLabel(item.customer_type)}
              </Text>
            </View>
          </View>
          {item.mobile && (
            <Text style={styles.customerMobile}>
              <Ionicons name="call-outline" size={12} color="#666" /> {item.mobile}
            </Text>
          )}
          {item.village && (
            <Text style={styles.customerVillage}>
              <Ionicons name="location-outline" size={12} color="#666" /> {item.village}
            </Text>
          )}
        </View>
        <View style={styles.customerBalance}>
          <Text style={[
            styles.balanceAmount,
            item.outstanding_balance > 0 ? styles.balanceDue : styles.balanceClear
          ]}>
            {formatCurrency(item.outstanding_balance)}
          </Text>
          <Text style={styles.balanceLabel}>
            {language === 'hi' ? 'बकाया' : 'Due'}
          </Text>
          {item.outstanding_balance > 0 && (
            <TouchableOpacity
              style={styles.payBtn}
              onPress={(e) => {
                e.stopPropagation();
                openPaymentModal(item);
              }}
            >
              <Text style={styles.payBtnText}>
                {language === 'hi' ? 'भुगतान' : 'Pay'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Card>
  );

  const renderTransactionItem = ({ item }: { item: Transaction }) => (
    <View style={styles.transactionRow}>
      <View style={styles.transactionIcon}>
        <Ionicons
          name={item.type === 'sale' ? 'cart' : 'cash'}
          size={20}
          color={item.type === 'sale' ? '#E65100' : '#2E7D32'}
        />
      </View>
      <View style={styles.transactionInfo}>
        <Text style={styles.transactionDesc}>{item.description}</Text>
        <Text style={styles.transactionDate}>{formatDate(item.date)}</Text>
      </View>
      <View style={styles.transactionAmount}>
        {item.debit > 0 && (
          <Text style={styles.debitAmount}>+{formatCurrency(item.debit)}</Text>
        )}
        {item.credit > 0 && (
          <Text style={styles.creditAmount}>-{formatCurrency(item.credit)}</Text>
        )}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>
          {language === 'hi' ? 'खाता (Khata)' : 'Customer Ledger'}
        </Text>
        <TouchableOpacity style={styles.addBtn} onPress={openAddCustomer}>
          <Ionicons name="add" size={24} color="#FFF" />
        </TouchableOpacity>
      </View>

      {/* Total Dues Summary */}
      <View style={styles.summaryCard}>
        <View style={styles.summaryContent}>
          <Text style={styles.summaryLabel}>
            {language === 'hi' ? 'कुल बकाया' : 'Total Outstanding'}
          </Text>
          <Text style={styles.summaryAmount}>{formatCurrency(totalDues)}</Text>
        </View>
        <Ionicons name="wallet" size={32} color="#E65100" />
      </View>

      {/* Search and Filter */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputWrapper}>
          <Ionicons name="search" size={20} color="#999" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder={language === 'hi' ? 'नाम, मोबाइल या गाँव से खोजें...' : 'Search by name, mobile or village...'}
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
        <TouchableOpacity
          style={[styles.filterBtn, filterDues && styles.filterBtnActive]}
          onPress={() => setFilterDues(!filterDues)}
        >
          <Ionicons
            name={filterDues ? 'filter' : 'filter-outline'}
            size={20}
            color={filterDues ? '#FFF' : '#2E7D32'}
          />
        </TouchableOpacity>
      </View>

      {filterDues && (
        <View style={styles.filterTag}>
          <Text style={styles.filterTagText}>
            {language === 'hi' ? 'केवल बकाया वाले' : 'With dues only'}
          </Text>
          <TouchableOpacity onPress={() => setFilterDues(false)}>
            <Ionicons name="close" size={16} color="#E65100" />
          </TouchableOpacity>
        </View>
      )}

      {/* Customer List */}
      <FlatList
        data={customers}
        renderItem={renderCustomerItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#2E7D32']} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="people-outline" size={48} color="#CCC" />
            <Text style={styles.emptyText}>
              {language === 'hi' ? 'कोई ग्राहक नहीं मिला' : 'No customers found'}
            </Text>
          </View>
        }
      />

      {/* Ledger Modal */}
      <Modal visible={showLedger} animationType="slide">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowLedger(false)}>
              <Ionicons name="close" size={28} color="#333" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {selectedCustomer?.name} - {language === 'hi' ? 'खाता' : 'Ledger'}
            </Text>
            <TouchableOpacity onPress={() => selectedCustomer && openEditCustomer(selectedCustomer)}>
              <Ionicons name="create-outline" size={24} color="#2E7D32" />
            </TouchableOpacity>
          </View>

          {ledgerLoading ? (
            <View style={styles.loadingContainer}>
              <Text>{t('loading')}</Text>
            </View>
          ) : ledgerData ? (
            <ScrollView style={styles.ledgerContent}>
              {/* Customer Summary Card */}
              <Card>
                <View style={styles.ledgerSummary}>
                  <View style={styles.summaryRow}>
                    <View style={styles.summaryItem}>
                      <Text style={styles.summaryItemLabel}>
                        {language === 'hi' ? 'कुल बिल' : 'Total Billed'}
                      </Text>
                      <Text style={styles.summaryItemValue}>
                        {formatCurrency(ledgerData.summary.total_billed)}
                      </Text>
                    </View>
                    <View style={styles.summaryItem}>
                      <Text style={styles.summaryItemLabel}>
                        {language === 'hi' ? 'कुल भुगतान' : 'Total Paid'}
                      </Text>
                      <Text style={[styles.summaryItemValue, { color: '#2E7D32' }]}>
                        {formatCurrency(ledgerData.summary.total_payments)}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.balanceHighlight}>
                    <Text style={styles.balanceHighlightLabel}>
                      {language === 'hi' ? 'बकाया राशि' : 'Outstanding Balance'}
                    </Text>
                    <Text style={[
                      styles.balanceHighlightValue,
                      ledgerData.summary.outstanding_balance > 0 ? styles.balanceDue : styles.balanceClear
                    ]}>
                      {formatCurrency(ledgerData.summary.outstanding_balance)}
                    </Text>
                  </View>
                </View>
              </Card>

              {/* Record Payment Button */}
              {ledgerData.summary.outstanding_balance > 0 && (
                <Button
                  title={language === 'hi' ? 'भुगतान दर्ज करें' : 'Record Payment'}
                  onPress={() => openPaymentModal(ledgerData.customer)}
                  style={styles.recordPaymentBtn}
                />
              )}

              {/* Transaction History */}
              <Text style={styles.sectionTitle}>
                {language === 'hi' ? 'लेनदेन इतिहास' : 'Transaction History'}
              </Text>
              
              {ledgerData.transactions.length > 0 ? (
                <Card>
                  <FlatList
                    data={ledgerData.transactions}
                    renderItem={renderTransactionItem}
                    keyExtractor={(item) => item.id}
                    scrollEnabled={false}
                    ItemSeparatorComponent={() => <View style={styles.transactionDivider} />}
                  />
                </Card>
              ) : (
                <View style={styles.noTransactions}>
                  <Text style={styles.noTransactionsText}>
                    {language === 'hi' ? 'कोई लेनदेन नहीं' : 'No transactions yet'}
                  </Text>
                </View>
              )}
            </ScrollView>
          ) : null}
        </SafeAreaView>
      </Modal>

      {/* Payment Modal */}
      <Modal visible={showPayment} animationType="slide" transparent>
        <View style={styles.paymentModalOverlay}>
          <View style={styles.paymentModalContent}>
            <View style={styles.paymentModalHeader}>
              <Text style={styles.paymentModalTitle}>
                {language === 'hi' ? 'भुगतान दर्ज करें' : 'Record Payment'}
              </Text>
              <TouchableOpacity onPress={() => setShowPayment(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <Text style={styles.paymentCustomerName}>{selectedCustomer?.name}</Text>
            <Text style={styles.paymentDueAmount}>
              {language === 'hi' ? 'बकाया:' : 'Due:'} {formatCurrency(selectedCustomer?.outstanding_balance || 0)}
            </Text>

            <Input
              label={language === 'hi' ? 'राशि' : 'Amount'}
              placeholder="0"
              value={paymentAmount}
              onChangeText={setPaymentAmount}
              keyboardType="decimal-pad"
            />

            <Text style={styles.paymentModeLabel}>
              {language === 'hi' ? 'भुगतान मोड' : 'Payment Mode'}
            </Text>
            <View style={styles.paymentModes}>
              {['cash', 'online'].map(mode => (
                <TouchableOpacity
                  key={mode}
                  style={[styles.paymentModeBtn, paymentMode === mode && styles.paymentModeBtnActive]}
                  onPress={() => setPaymentMode(mode)}
                >
                  <Text style={[styles.paymentModeText, paymentMode === mode && styles.paymentModeTextActive]}>
                    {mode === 'cash' ? t('cash') : t('online')}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Input
              label={language === 'hi' ? 'नोट्स (वैकल्पिक)' : 'Notes (optional)'}
              placeholder={language === 'hi' ? 'नोट्स दर्ज करें' : 'Enter notes'}
              value={paymentNotes}
              onChangeText={setPaymentNotes}
              multiline
            />

            <Button
              title={language === 'hi' ? 'भुगतान दर्ज करें' : 'Record Payment'}
              onPress={handleRecordPayment}
              loading={submittingPayment}
              style={styles.submitPaymentBtn}
            />
          </View>
        </View>
      </Modal>

      {/* Add/Edit Customer Modal */}
      <Modal visible={showAddCustomer} animationType="slide">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowAddCustomer(false)}>
              <Ionicons name="close" size={28} color="#333" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {editingCustomer
                ? (language === 'hi' ? 'ग्राहक संपादित करें' : 'Edit Customer')
                : (language === 'hi' ? 'नया ग्राहक' : 'New Customer')
              }
            </Text>
            <View style={{ width: 28 }} />
          </View>

          <ScrollView style={styles.formContent}>
            <Input
              label={t('customerName') + ' *'}
              placeholder={language === 'hi' ? 'नाम दर्ज करें' : 'Enter name'}
              value={customerForm.name}
              onChangeText={(val) => setCustomerForm({ ...customerForm, name: val })}
            />

            <Input
              label={t('mobile')}
              placeholder={language === 'hi' ? 'मोबाइल नंबर' : 'Mobile number'}
              value={customerForm.mobile}
              onChangeText={(val) => setCustomerForm({ ...customerForm, mobile: val })}
              keyboardType="phone-pad"
            />

            <Input
              label={t('village')}
              placeholder={language === 'hi' ? 'गाँव का नाम' : 'Village name'}
              value={customerForm.village}
              onChangeText={(val) => setCustomerForm({ ...customerForm, village: val })}
            />

            <Input
              label={t('address')}
              placeholder={language === 'hi' ? 'पता दर्ज करें' : 'Enter address'}
              value={customerForm.address}
              onChangeText={(val) => setCustomerForm({ ...customerForm, address: val })}
              multiline
            />

            <Text style={styles.formLabel}>
              {language === 'hi' ? 'ग्राहक प्रकार' : 'Customer Type'}
            </Text>
            <View style={styles.customerTypes}>
              {['walk_in', 'registered', 'shareholder'].map(type => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.customerTypeBtn,
                    customerForm.customer_type === type && styles.customerTypeBtnActive
                  ]}
                  onPress={() => setCustomerForm({ ...customerForm, customer_type: type })}
                >
                  <Text style={[
                    styles.customerTypeText,
                    customerForm.customer_type === type && styles.customerTypeTextActive
                  ]}>
                    {getCustomerTypeLabel(type)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {customerForm.customer_type === 'shareholder' && (
              <Input
                label={language === 'hi' ? 'फोलियो नंबर' : 'Folio Number'}
                placeholder={language === 'hi' ? 'शेयर सर्टिफिकेट फोलियो नंबर' : 'Share certificate folio number'}
                value={customerForm.folio_number}
                onChangeText={(val) => setCustomerForm({ ...customerForm, folio_number: val })}
              />
            )}

            <Button
              title={editingCustomer ? t('save') : t('add')}
              onPress={handleSaveCustomer}
              loading={submittingCustomer}
              style={styles.submitBtn}
            />
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
    backgroundColor: '#2E7D32',
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    margin: 16,
    marginBottom: 8,
    padding: 16,
    borderRadius: 12,
  },
  summaryContent: {},
  summaryLabel: {
    fontSize: 14,
    color: '#666',
  },
  summaryAmount: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#E65100',
    marginTop: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 8,
    gap: 8,
  },
  searchInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 44,
    fontSize: 15,
    color: '#333',
  },
  filterBtn: {
    width: 44,
    height: 44,
    backgroundColor: '#FFF',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#2E7D32',
  },
  filterBtnActive: {
    backgroundColor: '#2E7D32',
  },
  filterTag: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginLeft: 16,
    marginBottom: 8,
    gap: 6,
  },
  filterTagText: {
    fontSize: 12,
    color: '#E65100',
    fontWeight: '500',
  },
  listContent: {
    padding: 16,
    paddingTop: 8,
  },
  customerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  customerInfo: {
    flex: 1,
  },
  customerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  customerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  typeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  customerMobile: {
    fontSize: 13,
    color: '#666',
    marginTop: 4,
  },
  customerVillage: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  customerBalance: {
    alignItems: 'flex-end',
  },
  balanceAmount: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  balanceDue: {
    color: '#E65100',
  },
  balanceClear: {
    color: '#2E7D32',
  },
  balanceLabel: {
    fontSize: 11,
    color: '#666',
  },
  payBtn: {
    backgroundColor: '#2E7D32',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    marginTop: 6,
  },
  payBtnText: {
    color: '#FFF',
    fontSize: 12,
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
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ledgerContent: {
    padding: 16,
  },
  ledgerSummary: {},
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  summaryItem: {},
  summaryItemLabel: {
    fontSize: 12,
    color: '#666',
  },
  summaryItemValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginTop: 4,
  },
  balanceHighlight: {
    backgroundColor: '#F5F5F5',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  balanceHighlightLabel: {
    fontSize: 12,
    color: '#666',
  },
  balanceHighlightValue: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 4,
  },
  recordPaymentBtn: {
    marginVertical: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  transactionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  transactionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  transactionInfo: {
    flex: 1,
  },
  transactionDesc: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  transactionDate: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  transactionAmount: {
    alignItems: 'flex-end',
  },
  debitAmount: {
    fontSize: 15,
    fontWeight: '600',
    color: '#E65100',
  },
  creditAmount: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2E7D32',
  },
  transactionDivider: {
    height: 1,
    backgroundColor: '#E0E0E0',
  },
  noTransactions: {
    padding: 24,
    alignItems: 'center',
  },
  noTransactionsText: {
    fontSize: 14,
    color: '#999',
  },
  paymentModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  paymentModalContent: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
  },
  paymentModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  paymentModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  paymentCustomerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  paymentDueAmount: {
    fontSize: 14,
    color: '#E65100',
    marginBottom: 16,
  },
  paymentModeLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  paymentModes: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  paymentModeBtn: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: '#E8E8E8',
    borderRadius: 8,
    alignItems: 'center',
  },
  paymentModeBtnActive: {
    backgroundColor: '#2E7D32',
  },
  paymentModeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  paymentModeTextActive: {
    color: '#FFF',
  },
  submitPaymentBtn: {
    marginTop: 16,
  },
  formContent: {
    padding: 16,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
    marginTop: 8,
  },
  customerTypes: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  customerTypeBtn: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: '#E8E8E8',
    borderRadius: 8,
    alignItems: 'center',
  },
  customerTypeBtnActive: {
    backgroundColor: '#2E7D32',
  },
  customerTypeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  customerTypeTextActive: {
    color: '#FFF',
  },
  submitBtn: {
    marginTop: 24,
    marginBottom: 40,
  },
});
