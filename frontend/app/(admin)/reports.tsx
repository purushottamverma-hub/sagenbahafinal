import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { Card } from '../../src/components/Card';
import { useSettingsStore } from '../../src/store/settingsStore';
import api from '../../src/utils/api';
import * as XLSX from 'xlsx';

type ReportType = 'sales' | 'stock' | 'customers' | 'farmers' | 'purchases';

interface ReportOption {
  id: ReportType;
  title: { en: string; hi: string };
  description: { en: string; hi: string };
  icon: string;
  color: string;
}

const reportOptions: ReportOption[] = [
  {
    id: 'sales',
    title: { en: 'Sales Report', hi: 'बिक्री रिपोर्ट' },
    description: { en: 'All sales transactions', hi: 'सभी बिक्री लेनदेन' },
    icon: 'cart',
    color: '#2E7D32',
  },
  {
    id: 'stock',
    title: { en: 'Stock Report', hi: 'स्टॉक रिपोर्ट' },
    description: { en: 'Current inventory status', hi: 'वर्तमान स्टॉक स्थिति' },
    icon: 'cube',
    color: '#1976D2',
  },
  {
    id: 'customers',
    title: { en: 'Customer Report', hi: 'ग्राहक रिपोर्ट' },
    description: { en: 'Customer details and ledger', hi: 'ग्राहक विवरण और खाता' },
    icon: 'people',
    color: '#7B1FA2',
  },
  {
    id: 'farmers',
    title: { en: 'Farmer Report', hi: 'किसान रिपोर्ट' },
    description: { en: 'Farmer details and payments', hi: 'किसान विवरण और भुगतान' },
    icon: 'leaf',
    color: '#388E3C',
  },
  {
    id: 'purchases',
    title: { en: 'Purchase Report', hi: 'खरीद रिपोर्ट' },
    description: { en: 'Farmer produce purchases', hi: 'किसानों से खरीद' },
    icon: 'basket',
    color: '#F57C00',
  },
];

export default function ReportsScreen() {
  const [loading, setLoading] = useState<string | null>(null);
  const language = useSettingsStore((state) => state.language);

  const generateExcel = async (data: any[], filename: string, headers: string[]) => {
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

  const handleGenerateReport = async (reportType: ReportType) => {
    setLoading(reportType);
    
    try {
      switch (reportType) {
        case 'sales': {
          const res = await api.get('/sales');
          const data = res.data.map((sale: any) => ({
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
          await generateExcel(data, `Sales_Report_${Date.now()}`, []);
          break;
        }
        
        case 'stock': {
          const res = await api.get('/stock');
          const consolidated = await api.get('/stock/consolidated');
          
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
          await generateExcel(data, `Stock_Report_${Date.now()}`, []);
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
          await generateExcel(data, `Customer_Report_${Date.now()}`, []);
          break;
        }
        
        case 'farmers': {
          const res = await api.get('/farmers');
          const data = res.data.map((farmer: any) => ({
            'Name': farmer.name,
            'Mobile': farmer.mobile || '',
            'Village': farmer.village || '',
            'Total Supplied (kg)': farmer.total_supplied || 0,
            'Total Payable (₹)': farmer.total_payable || 0,
            'Total Paid (₹)': farmer.total_paid || 0,
            'Outstanding Dues (₹)': farmer.outstanding_dues || 0,
          }));
          await generateExcel(data, `Farmer_Report_${Date.now()}`, []);
          break;
        }
        
        case 'purchases': {
          const res = await api.get('/farmer-purchases');
          const data = res.data.map((purchase: any) => ({
            'Receipt Number': purchase.receipt_number,
            'Date': new Date(purchase.created_at).toLocaleDateString('en-IN'),
            'Farmer': purchase.farmer_name,
            'Product': purchase.product_name,
            'Quantity': purchase.quantity,
            'Rate (₹/kg)': purchase.rate,
            'Total Amount (₹)': purchase.total_amount,
            'Payment Status': purchase.payment_status === 'paid' ? 'Paid' : 'Credit',
          }));
          await generateExcel(data, `Purchase_Report_${Date.now()}`, []);
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
            onPress={() => handleGenerateReport(report.id)}
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
              ? 'रिपोर्ट Excel (.xlsx) फॉर्मेट में डाउनलोड होगी। आप इसे Microsoft Excel, Google Sheets या किसी भी स्प्रेडशीट एप्लिकेशन में खोल सकते हैं।'
              : 'Reports will be downloaded in Excel (.xlsx) format. You can open them in Microsoft Excel, Google Sheets, or any spreadsheet application.'}
          </Text>
        </View>
      </ScrollView>
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
});
