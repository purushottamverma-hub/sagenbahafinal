import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
  Modal,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { Card } from '../../src/components/Card';
import { Button } from '../../src/components/Button';
import { useSettingsStore } from '../../src/store/settingsStore';
import api from '../../src/utils/api';
import * as XLSX from 'xlsx';

type ReportType = 'sales' | 'stock' | 'customers' | 'farmers' | 'purchases' | 'transactions' | 'raw_sales' | 'raw_purchases';

interface ReportOption {
  id: ReportType;
  title: { en: string; hi: string };
  description: { en: string; hi: string };
  icon: string;
  color: string;
  hasDateFilter: boolean;
}

const reportOptions: ReportOption[] = [
  {
    id: 'sales',
    title: { en: 'Sales Report', hi: 'बिक्री रिपोर्ट' },
    description: { en: 'All sales transactions', hi: 'सभी बिक्री लेनदेन' },
    icon: 'cart',
    color: '#2E7D32',
    hasDateFilter: true,
  },
  {
    id: 'stock',
    title: { en: 'Stock Report', hi: 'स्टॉक रिपोर्ट' },
    description: { en: 'Current inventory status', hi: 'वर्तमान स्टॉक स्थिति' },
    icon: 'cube',
    color: '#1976D2',
    hasDateFilter: false,
  },
  {
    id: 'customers',
    title: { en: 'Customer Report', hi: 'ग्राहक रिपोर्ट' },
    description: { en: 'Customer details and ledger', hi: 'ग्राहक विवरण और खाता' },
    icon: 'people',
    color: '#7B1FA2',
    hasDateFilter: false,
  },
  {
    id: 'farmers',
    title: { en: 'Farmer Report', hi: 'किसान रिपोर्ट' },
    description: { en: 'Farmer details and payments', hi: 'किसान विवरण और भुगतान' },
    icon: 'leaf',
    color: '#388E3C',
    hasDateFilter: false,
  },
  {
    id: 'purchases',
    title: { en: 'Purchase Report', hi: 'खरीद रिपोर्ट' },
    description: { en: 'Farmer produce purchases', hi: 'किसानों से खरीद' },
    icon: 'basket',
    color: '#F57C00',
    hasDateFilter: true,
  },
  {
    id: 'transactions',
    title: { en: 'Unified Transactions (CSV)', hi: 'एकीकृत लेन-देन (CSV)' },
    description: { en: 'Sales + Purchases combined, with variety, qty, rate, total', hi: 'बिक्री + खरीद एक साथ' },
    icon: 'documents',
    color: '#00838F',
    hasDateFilter: true,
  },
  {
    id: 'raw_sales',
    title: { en: 'Raw Sales Data (CSV)', hi: 'कच्चा बिक्री डेटा (CSV)' },
    description: { en: 'Full-payload sales dump for audit', hi: 'पूरा बिक्री डंप' },
    icon: 'analytics',
    color: '#5E35B1',
    hasDateFilter: true,
  },
  {
    id: 'raw_purchases',
    title: { en: 'Raw Purchase Data (CSV)', hi: 'कच्चा खरीद डेटा (CSV)' },
    description: { en: 'Full-payload procurement dump for audit', hi: 'पूरा खरीद डंप' },
    icon: 'archive',
    color: '#6D4C41',
    hasDateFilter: true,
  },
];

// Quick date filter options
const datePresets = [
  { id: 'today', label: { en: 'Today', hi: 'आज' } },
  { id: 'yesterday', label: { en: 'Yesterday', hi: 'कल' } },
  { id: 'week', label: { en: 'Last 7 Days', hi: 'पिछले 7 दिन' } },
  { id: 'month', label: { en: 'This Month', hi: 'इस महीने' } },
  { id: 'lastMonth', label: { en: 'Last Month', hi: 'पिछला महीना' } },
  { id: 'custom', label: { en: 'Custom', hi: 'कस्टम' } },
];

export default function ReportsScreen() {
  const [loading, setLoading] = useState<string | null>(null);
  const [showDateModal, setShowDateModal] = useState(false);
  const [selectedReport, setSelectedReport] = useState<ReportType | null>(null);
  const [selectedPreset, setSelectedPreset] = useState('month');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const language = useSettingsStore((state) => state.language);

  const getDateRange = (preset: string): { start: string; end: string } => {
    const today = new Date();
    const formatDate = (d: Date) => d.toISOString().split('T')[0];
    
    switch (preset) {
      case 'today':
        return { start: formatDate(today), end: formatDate(today) };
      case 'yesterday':
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        return { start: formatDate(yesterday), end: formatDate(yesterday) };
      case 'week':
        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 7);
        return { start: formatDate(weekAgo), end: formatDate(today) };
      case 'month':
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        return { start: formatDate(monthStart), end: formatDate(today) };
      case 'lastMonth':
        const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
        return { start: formatDate(lastMonthStart), end: formatDate(lastMonthEnd) };
      case 'custom':
        return { start: startDate, end: endDate };
      default:
        return { start: '', end: '' };
    }
  };

  const generateExcel = async (data: any[], filename: string) => {
    try {
      // Create worksheet
      const ws = XLSX.utils.json_to_sheet(data);
      
      // Create workbook
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Report');

      // Generate base64 string
      const wbout = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });

      if (Platform.OS === 'web') {
        // Web download
        const blob = new Blob(
          [Uint8Array.from(atob(wbout), c => c.charCodeAt(0))],
          { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }
        );
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${filename}.xlsx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        // Native share
        const fileUri = FileSystem.documentDirectory + `${filename}.xlsx`;
        await FileSystem.writeAsStringAsync(fileUri, wbout, {
          encoding: FileSystem.EncodingType.Base64,
        });

        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(fileUri, {
            mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            dialogTitle: filename,
          });
        }
      }

      Alert.alert(
        language === 'hi' ? 'सफल' : 'Success',
        language === 'hi' ? 'रिपोर्ट डाउनलोड हो गई' : 'Report downloaded successfully'
      );
    } catch (error) {
      console.error('Excel generation error:', error);
      throw error;
    }
  };

  const handleReportClick = (reportType: ReportType) => {
    const report = reportOptions.find(r => r.id === reportType);
    if (report?.hasDateFilter) {
      setSelectedReport(reportType);
      setShowDateModal(true);
    } else {
      handleGenerateReport(reportType);
    }
  };

  const handleGenerateWithDates = () => {
    if (selectedReport) {
      setShowDateModal(false);
      handleGenerateReport(selectedReport, getDateRange(selectedPreset));
    }
  };

  const handleGenerateReport = async (reportType: ReportType, dateRange?: { start: string; end: string }) => {
    setLoading(reportType);
    
    try {
      switch (reportType) {
        case 'sales': {
          let url = '/sales';
          const params = new URLSearchParams();
          if (dateRange?.start) params.append('start_date', dateRange.start);
          if (dateRange?.end) params.append('end_date', dateRange.end);
          if (params.toString()) url += `?${params.toString()}`;
          
          const res = await api.get(url);
          const salesData = Array.isArray(res.data) ? res.data : res.data.sales || [];
          
          const data = salesData.map((sale: any) => ({
            'Bill Number': sale.bill_number,
            'Date': new Date(sale.created_at).toLocaleDateString('en-IN'),
            'Customer': sale.customer_name || 'Walk-in',
            'Outlet': sale.outlet_name || '',
            'Items': sale.items?.length || 0,
            'Total Amount (₹)': sale.total_amount,
            'Cash (₹)': sale.cash_amount,
            'Online (₹)': sale.online_amount,
            'Credit (₹)': sale.credit_amount,
            'Payment Mode': sale.payment_mode,
          }));
          
          const dateStr = dateRange?.start 
            ? `${dateRange.start}_to_${dateRange.end}` 
            : 'All';
          await generateExcel(data, `Sales_Report_${dateStr}_${Date.now()}`);
          break;
        }
        
        case 'stock': {
          const res = await api.get('/stock');
          
          const data = res.data.map((stock: any) => ({
            'Product': stock.product_name,
            'Outlet': stock.outlet_name,
            'Opening Stock': stock.opening_stock || 0,
            'Received': stock.stock_received || 0,
            'Sold': stock.stock_sold || 0,
            'Damaged': stock.stock_damaged || 0,
            'Current Quantity': stock.quantity,
            'Unit': stock.product_unit,
          }));
          await generateExcel(data, `Stock_Report_${Date.now()}`);
          break;
        }
        
        case 'customers': {
          const res = await api.get('/customers');
          const data = res.data.map((customer: any) => ({
            'Name': customer.name,
            'Mobile': customer.mobile || '',
            'Village': customer.village || '',
            'Total Purchases (₹)': customer.total_purchases || 0,
            'Total Paid (₹)': customer.total_paid || 0,
            'Outstanding (₹)': customer.outstanding_dues || 0,
            'Last Purchase': customer.last_purchase_date 
              ? new Date(customer.last_purchase_date).toLocaleDateString('en-IN')
              : 'N/A',
          }));
          await generateExcel(data, `Customer_Report_${Date.now()}`);
          break;
        }
        
        case 'farmers': {
          const res = await api.get('/farmers');
          const data = res.data.map((farmer: any) => ({
            'Name': farmer.name,
            'Mobile': farmer.mobile || '',
            'Village': farmer.village || '',
            'Member': farmer.is_member ? 'Yes' : 'No',
            'Shareholder': farmer.is_shareholder ? 'Yes' : 'No',
            'Total Supplied (kg)': farmer.total_supplied || 0,
            'Total Payable (₹)': farmer.total_payable || 0,
            'Total Paid (₹)': farmer.total_paid || 0,
            'Outstanding Dues (₹)': farmer.outstanding_dues || 0,
          }));
          await generateExcel(data, `Farmer_Report_${Date.now()}`);
          break;
        }
        
        case 'purchases': {
          let url = '/farmer-purchases';
          const params = new URLSearchParams();
          if (dateRange?.start) params.append('start_date', dateRange.start);
          if (dateRange?.end) params.append('end_date', dateRange.end);
          if (params.toString()) url += `?${params.toString()}`;
          
          const res = await api.get(url);
          const purchasesData = Array.isArray(res.data) ? res.data : res.data.purchases || [];
          
          const data = purchasesData.map((purchase: any) => ({
            'Receipt Number': purchase.receipt_number,
            'Date': new Date(purchase.created_at).toLocaleDateString('en-IN'),
            'Farmer': purchase.farmer_name,
            'Product': purchase.product_name,
            'Quantity': purchase.quantity,
            'Rate (₹/kg)': purchase.rate,
            'Total Amount (₹)': purchase.total_amount,
            'Payment Status': purchase.payment_status === 'paid' ? 'Paid' : 'Credit',
          }));
          
          const dateStr = dateRange?.start 
            ? `${dateRange.start}_to_${dateRange.end}` 
            : 'All';
          await generateExcel(data, `Purchase_Report_${dateStr}_${Date.now()}`);
          break;
        }
      }
    } catch (error: any) {
      console.error('Report error:', error);
      Alert.alert(
        language === 'hi' ? 'त्रुटि' : 'Error',
        error.response?.data?.detail || (language === 'hi' ? 'रिपोर्ट बनाने में विफल' : 'Failed to generate report')
      );
    } finally {
      setLoading(null);
    }
  };

  const formatDisplayDate = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>
          {language === 'hi' ? 'रिपोर्ट्स' : 'Reports'}
        </Text>
        <Text style={styles.subtitle}>
          {language === 'hi' 
            ? 'Excel में डाउनलोड करें' 
            : 'Download reports in Excel format'}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {reportOptions.map((report) => (
          <TouchableOpacity
            key={report.id}
            onPress={() => handleReportClick(report.id)}
            disabled={loading !== null}
          >
            <Card style={styles.reportCard}>
              <View style={[styles.iconContainer, { backgroundColor: report.color + '20' }]}>
                <Ionicons name={report.icon as any} size={28} color={report.color} />
              </View>
              <View style={styles.reportInfo}>
                <Text style={styles.reportTitle}>
                  {report.title[language]}
                </Text>
                <Text style={styles.reportDesc}>
                  {report.description[language]}
                </Text>
                {report.hasDateFilter && (
                  <View style={styles.dateFilterBadge}>
                    <Ionicons name="calendar-outline" size={12} color="#1976D2" />
                    <Text style={styles.dateFilterText}>
                      {language === 'hi' ? 'तारीख फ़िल्टर' : 'Date Filter'}
                    </Text>
                  </View>
                )}
              </View>
              <View style={styles.downloadBtn}>
                {loading === report.id ? (
                  <Ionicons name="hourglass" size={24} color="#666" />
                ) : (
                  <Ionicons name="download" size={24} color={report.color} />
                )}
              </View>
            </Card>
          </TouchableOpacity>
        ))}

        <View style={styles.infoBox}>
          <Ionicons name="information-circle" size={20} color="#1976D2" />
          <Text style={styles.infoText}>
            {language === 'hi'
              ? 'रिपोर्ट Excel (.xlsx) फॉर्मेट में डाउनलोड होगी। Sales और Purchase रिपोर्ट में तारीख फ़िल्टर उपलब्ध है।'
              : 'Reports download in Excel (.xlsx) format. Sales and Purchase reports support date filtering.'}
          </Text>
        </View>
      </ScrollView>

      {/* Date Filter Modal */}
      <Modal visible={showDateModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {language === 'hi' ? 'तारीख चुनें' : 'Select Date Range'}
              </Text>
              <TouchableOpacity onPress={() => setShowDateModal(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <Text style={styles.sectionLabel}>
              {language === 'hi' ? 'त्वरित विकल्प' : 'Quick Options'}
            </Text>
            <View style={styles.presetGrid}>
              {datePresets.map((preset) => (
                <TouchableOpacity
                  key={preset.id}
                  style={[
                    styles.presetBtn,
                    selectedPreset === preset.id && styles.presetBtnActive,
                  ]}
                  onPress={() => setSelectedPreset(preset.id)}
                >
                  <Text style={[
                    styles.presetText,
                    selectedPreset === preset.id && styles.presetTextActive,
                  ]}>
                    {preset.label[language]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {selectedPreset === 'custom' && (
              <View style={styles.customDateSection}>
                <Text style={styles.sectionLabel}>
                  {language === 'hi' ? 'कस्टम तारीख (YYYY-MM-DD)' : 'Custom Date (YYYY-MM-DD)'}
                </Text>
                <View style={styles.dateInputRow}>
                  <View style={styles.dateInputContainer}>
                    <Text style={styles.dateLabel}>
                      {language === 'hi' ? 'से' : 'From'}
                    </Text>
                    <TextInput
                      style={styles.dateInput}
                      value={startDate}
                      onChangeText={setStartDate}
                      placeholder="2025-01-01"
                      placeholderTextColor="#999"
                    />
                  </View>
                  <View style={styles.dateInputContainer}>
                    <Text style={styles.dateLabel}>
                      {language === 'hi' ? 'तक' : 'To'}
                    </Text>
                    <TextInput
                      style={styles.dateInput}
                      value={endDate}
                      onChangeText={setEndDate}
                      placeholder="2025-01-31"
                      placeholderTextColor="#999"
                    />
                  </View>
                </View>
              </View>
            )}

            {selectedPreset !== 'custom' && (
              <View style={styles.selectedDateDisplay}>
                <Ionicons name="calendar" size={18} color="#2E7D32" />
                <Text style={styles.selectedDateText}>
                  {formatDisplayDate(getDateRange(selectedPreset).start)} - {formatDisplayDate(getDateRange(selectedPreset).end)}
                </Text>
              </View>
            )}

            <Button
              title={language === 'hi' ? 'रिपोर्ट डाउनलोड करें' : 'Download Report'}
              onPress={handleGenerateWithDates}
              style={styles.downloadButton}
            />
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
    padding: 16,
    paddingBottom: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  scrollContent: {
    padding: 16,
    paddingTop: 8,
  },
  reportCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  reportInfo: {
    flex: 1,
  },
  reportTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  reportDesc: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  dateFilterBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    marginTop: 6,
    alignSelf: 'flex-start',
    gap: 4,
  },
  dateFilterText: {
    fontSize: 11,
    color: '#1976D2',
    fontWeight: '500',
  },
  downloadBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#E3F2FD',
    padding: 14,
    borderRadius: 10,
    marginTop: 8,
    gap: 10,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#1976D2',
    lineHeight: 18,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 12,
  },
  presetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  presetBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DDD',
    backgroundColor: '#F9F9F9',
  },
  presetBtnActive: {
    backgroundColor: '#2E7D32',
    borderColor: '#2E7D32',
  },
  presetText: {
    fontSize: 14,
    color: '#666',
  },
  presetTextActive: {
    color: '#FFF',
    fontWeight: '600',
  },
  customDateSection: {
    marginBottom: 20,
  },
  dateInputRow: {
    flexDirection: 'row',
    gap: 12,
  },
  dateInputContainer: {
    flex: 1,
  },
  dateLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 6,
  },
  dateInput: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#F9F9F9',
  },
  selectedDateDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    padding: 12,
    borderRadius: 8,
    gap: 10,
    marginBottom: 20,
  },
  selectedDateText: {
    fontSize: 14,
    color: '#2E7D32',
    fontWeight: '500',
  },
  downloadButton: {
    marginTop: 10,
  },
});
