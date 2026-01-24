import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Card } from '../../src/components/Card';
import { useTranslation } from '../../src/utils/useTranslation';
import { useAuthStore } from '../../src/store/authStore';
import api from '../../src/utils/api';

interface DashboardData {
  today: {
    sales_count: number;
    total: number;
    cash: number;
    credit: number;
    online: number;
  };
  month: {
    sales_count: number;
    total: number;
    cash: number;
    credit: number;
    online: number;
  };
  counts: {
    customers: number;
    farmers: number;
    products: number;
    outlets: number;
  };
  outstanding: {
    customer_dues: number;
    farmer_dues: number;
  };
  low_stock_count: number;
}

export default function AdminDashboard() {
  const { t, language } = useTranslation();
  const { user, logout } = useAuthStore();
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDashboard = async () => {
    try {
      const response = await api.get('/dashboard');
      setData(response.data);
    } catch (error) {
      console.error('Dashboard error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchDashboard();
  }, []);

  const formatCurrency = (amount: number) => {
    return `${t('currency')}${amount.toLocaleString('en-IN')}`;
  };

  const handleLogout = () => {
    Alert.alert(
      t('logout'),
      language === 'hi' ? 'क्या आप लॉगआउट करना चाहते हैं?' : 'Are you sure you want to logout?',
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('logout'),
          style: 'destructive',
          onPress: () => {
            logout();
            router.replace('/(auth)/login');
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>
            {language === 'hi' ? 'नमस्ते' : 'Welcome'},
          </Text>
          <Text style={styles.userName}>{user?.full_name || 'Admin'}</Text>
        </View>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
          <Ionicons name="log-out-outline" size={24} color="#D32F2F" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#2E7D32']} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Today's Summary */}
        <Text style={styles.sectionTitle}>{t('todaySales')}</Text>
        <Card style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>{t('totalSales')}</Text>
              <Text style={styles.summaryValue}>
                {formatCurrency(data?.today?.total || 0)}
              </Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>
                {language === 'hi' ? 'बिल' : 'Bills'}
              </Text>
              <Text style={styles.summaryValue}>{data?.today?.sales_count || 0}</Text>
            </View>
          </View>
          <View style={styles.divider} />
          <View style={styles.paymentBreakdown}>
            <View style={styles.paymentItem}>
              <View style={[styles.paymentDot, { backgroundColor: '#4CAF50' }]} />
              <Text style={styles.paymentLabel}>{t('cash')}</Text>
              <Text style={styles.paymentValue}>{formatCurrency(data?.today?.cash || 0)}</Text>
            </View>
            <View style={styles.paymentItem}>
              <View style={[styles.paymentDot, { backgroundColor: '#2196F3' }]} />
              <Text style={styles.paymentLabel}>{t('online')}</Text>
              <Text style={styles.paymentValue}>{formatCurrency(data?.today?.online || 0)}</Text>
            </View>
            <View style={styles.paymentItem}>
              <View style={[styles.paymentDot, { backgroundColor: '#FF9800' }]} />
              <Text style={styles.paymentLabel}>{t('credit')}</Text>
              <Text style={styles.paymentValue}>{formatCurrency(data?.today?.credit || 0)}</Text>
            </View>
          </View>
        </Card>

        {/* Monthly Summary */}
        <Text style={styles.sectionTitle}>{t('monthSales')}</Text>
        <Card style={styles.monthCard}>
          <View style={styles.monthRow}>
            <Text style={styles.monthTotal}>{formatCurrency(data?.month?.total || 0)}</Text>
            <Text style={styles.monthCount}>
              {data?.month?.sales_count || 0} {language === 'hi' ? 'बिल' : 'bills'}
            </Text>
          </View>
        </Card>

        {/* Quick Stats */}
        <Text style={styles.sectionTitle}>
          {language === 'hi' ? 'त्वरित सारांश' : 'Quick Stats'}
        </Text>
        <View style={styles.statsGrid}>
          <Card style={styles.statCard}>
            <Ionicons name="people" size={28} color="#2E7D32" />
            <Text style={styles.statValue}>{data?.counts?.customers || 0}</Text>
            <Text style={styles.statLabel}>{t('customers')}</Text>
          </Card>
          <Card style={styles.statCard}>
            <Ionicons name="person" size={28} color="#FF9800" />
            <Text style={styles.statValue}>{data?.counts?.farmers || 0}</Text>
            <Text style={styles.statLabel}>{t('farmers')}</Text>
          </Card>
          <Card style={styles.statCard}>
            <Ionicons name="cube" size={28} color="#2196F3" />
            <Text style={styles.statValue}>{data?.counts?.products || 0}</Text>
            <Text style={styles.statLabel}>{t('products')}</Text>
          </Card>
          <Card style={styles.statCard}>
            <Ionicons name="business" size={28} color="#9C27B0" />
            <Text style={styles.statValue}>{data?.counts?.outlets || 0}</Text>
            <Text style={styles.statLabel}>{t('outlets')}</Text>
          </Card>
        </View>

        {/* Outstanding Dues */}
        <Text style={styles.sectionTitle}>{t('outstandingDues')}</Text>
        <View style={styles.duesRow}>
          <Card style={[styles.dueCard, { backgroundColor: '#FFF3E0' }]}>
            <Text style={styles.dueLabel}>{t('customerDues')}</Text>
            <Text style={[styles.dueValue, { color: '#E65100' }]}>
              {formatCurrency(data?.outstanding?.customer_dues || 0)}
            </Text>
          </Card>
          <Card style={[styles.dueCard, { backgroundColor: '#E3F2FD' }]}>
            <Text style={styles.dueLabel}>{t('farmerDues')}</Text>
            <Text style={[styles.dueValue, { color: '#1565C0' }]}>
              {formatCurrency(data?.outstanding?.farmer_dues || 0)}
            </Text>
          </Card>
        </View>

        {/* Low Stock Alert */}
        {(data?.low_stock_count || 0) > 0 && (
          <Card style={styles.alertCard}>
            <View style={styles.alertRow}>
              <Ionicons name="warning" size={24} color="#D32F2F" />
              <Text style={styles.alertText}>
                {data?.low_stock_count} {t('lowStock')}
              </Text>
            </View>
          </Card>
        )}

        <View style={styles.bottomPadding} />
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  greeting: {
    fontSize: 14,
    color: '#666',
  },
  userName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  logoutBtn: {
    padding: 8,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
    marginTop: 8,
  },
  summaryCard: {
    backgroundColor: '#FFF',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2E7D32',
  },
  divider: {
    height: 1,
    backgroundColor: '#E0E0E0',
    marginVertical: 16,
  },
  paymentBreakdown: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  paymentItem: {
    alignItems: 'center',
  },
  paymentDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginBottom: 4,
  },
  paymentLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  paymentValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  monthCard: {
    backgroundColor: '#E8F5E9',
  },
  monthRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  monthTotal: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2E7D32',
  },
  monthCount: {
    fontSize: 14,
    color: '#666',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statCard: {
    width: '48%',
    alignItems: 'center',
    paddingVertical: 20,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  duesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dueCard: {
    width: '48%',
    padding: 16,
  },
  dueLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
  },
  dueValue: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  alertCard: {
    backgroundColor: '#FFEBEE',
    marginTop: 16,
  },
  alertRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  alertText: {
    fontSize: 14,
    color: '#D32F2F',
    marginLeft: 12,
    fontWeight: '500',
  },
  bottomPadding: {
    height: 20,
  },
});
