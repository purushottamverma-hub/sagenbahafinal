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
import GlobalSearchModal from '../../src/components/GlobalSearchModal';

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
    products: number;
  };
  low_stock_count: number;
}

export default function AgentDashboard() {
  const { t, language } = useTranslation();
  const { user, logout } = useAuthStore();
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

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
          <Text style={styles.userName}>{user?.full_name || 'Agent'}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <TouchableOpacity onPress={() => setShowSearch(true)} style={styles.logoutBtn} accessibilityLabel="Search">
            <Ionicons name="search" size={24} color="#2E7D32" />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
            <Ionicons name="log-out-outline" size={24} color="#D32F2F" />
          </TouchableOpacity>
        </View>
      </View>

      <GlobalSearchModal visible={showSearch} onClose={() => setShowSearch(false)} />

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

        {/* Quick Actions */}
        <Text style={styles.sectionTitle}>
          {language === 'hi' ? 'त्वरित क्रिया' : 'Quick Actions'}
        </Text>
        <View style={styles.actionsRow}>
          <Card style={styles.actionCard} onPress={() => router.push('/(agent)/sales')}>
            <Ionicons name="add-circle" size={32} color="#2E7D32" />
            <Text style={styles.actionText}>{t('newSale')}</Text>
          </Card>
          <Card style={styles.actionCard} onPress={() => router.push('/(agent)/stock')}>
            <Ionicons name="cube" size={32} color="#1976D2" />
            <Text style={styles.actionText}>{t('stock')}</Text>
          </Card>
        </View>

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
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionCard: {
    width: '48%',
    alignItems: 'center',
    paddingVertical: 24,
  },
  actionText: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  bottomPadding: {
    height: 20,
  },
});
