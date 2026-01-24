import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../src/store/authStore';
import { useSettingsStore } from '../../src/store/settingsStore';
import { Card } from '../../src/components/Card';
import api from '../../src/utils/api';

export default function FarmerDashboard() {
  const [refreshing, setRefreshing] = useState(false);
  const [transactions, setTransactions] = useState<any>(null);
  const user = useAuthStore((state) => state.user);
  const language = useSettingsStore((state) => state.language);
  const router = useRouter();

  const fetchData = async () => {
    try {
      const res = await api.get('/my-transactions');
      setTransactions(res.data);
    } catch (error) {
      console.error('Failed to fetch transactions:', error);
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

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>
              {language === 'hi' ? 'नमस्ते,' : 'Hello,'}
            </Text>
            <Text style={styles.userName}>{user?.full_name}</Text>
            {user?.village && (
              <Text style={styles.village}>
                <Ionicons name="location" size={14} color="#666" /> {user.village}
              </Text>
            )}
          </View>
          <View style={styles.avatarContainer}>
            <Ionicons name="person-circle" size={50} color="#2E7D32" />
          </View>
        </View>

        {/* Quick Actions */}
        <Text style={styles.sectionTitle}>
          {language === 'hi' ? 'त्वरित कार्रवाई' : 'Quick Actions'}
        </Text>
        <View style={styles.quickActions}>
          <TouchableOpacity
            style={[styles.actionCard, { backgroundColor: '#E8F5E9' }]}
            onPress={() => router.push('/(farmer)/requests')}
          >
            <Ionicons name="add-circle" size={32} color="#2E7D32" />
            <Text style={styles.actionText}>
              {language === 'hi' ? 'बेचने का अनुरोध' : 'Sell Request'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionCard, { backgroundColor: '#E3F2FD' }]}
            onPress={() => router.push('/(farmer)/requests')}
          >
            <Ionicons name="cart" size={32} color="#1976D2" />
            <Text style={styles.actionText}>
              {language === 'hi' ? 'खरीदने का अनुरोध' : 'Buy Request'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Recent Transactions */}
        <Text style={styles.sectionTitle}>
          {language === 'hi' ? 'हाल के लेनदेन' : 'Recent Transactions'}
        </Text>
        <Card>
          {transactions?.purchases?.length > 0 ? (
            transactions.purchases.slice(0, 5).map((tx: any, index: number) => (
              <View key={tx.id || index} style={styles.txItem}>
                <View style={styles.txIcon}>
                  <Ionicons name="arrow-up-circle" size={24} color="#2E7D32" />
                </View>
                <View style={styles.txDetails}>
                  <Text style={styles.txTitle}>{tx.product_name}</Text>
                  <Text style={styles.txDate}>
                    {new Date(tx.created_at).toLocaleDateString()}
                  </Text>
                </View>
                <Text style={styles.txAmount}>₹{tx.total_amount}</Text>
              </View>
            ))
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="receipt-outline" size={48} color="#CCC" />
              <Text style={styles.emptyText}>
                {language === 'hi' ? 'कोई लेनदेन नहीं' : 'No transactions yet'}
              </Text>
            </View>
          )}
        </Card>

        {/* Pending Requests */}
        <Text style={styles.sectionTitle}>
          {language === 'hi' ? 'लंबित अनुरोध' : 'Pending Requests'}
        </Text>
        <Card>
          {transactions?.requests?.filter((r: any) => r.status === 'pending')?.length > 0 ? (
            transactions.requests
              .filter((r: any) => r.status === 'pending')
              .slice(0, 3)
              .map((req: any, index: number) => (
                <View key={req.id || index} style={styles.txItem}>
                  <View style={[styles.txIcon, { backgroundColor: '#FFF3E0' }]}>
                    <Ionicons
                      name={req.request_type === 'sell' ? 'arrow-up' : 'arrow-down'}
                      size={20}
                      color="#F57C00"
                    />
                  </View>
                  <View style={styles.txDetails}>
                    <Text style={styles.txTitle}>{req.product_name}</Text>
                    <Text style={styles.txDate}>
                      {req.request_type === 'sell'
                        ? (language === 'hi' ? 'बेचना' : 'Sell')
                        : (language === 'hi' ? 'खरीदना' : 'Buy')}
                      {' - '}
                      {req.quantity} {req.unit || 'kg'}
                    </Text>
                  </View>
                  <View style={styles.statusBadge}>
                    <Text style={styles.statusText}>
                      {language === 'hi' ? 'लंबित' : 'Pending'}
                    </Text>
                  </View>
                </View>
              ))
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="hourglass-outline" size={48} color="#CCC" />
              <Text style={styles.emptyText}>
                {language === 'hi' ? 'कोई लंबित अनुरोध नहीं' : 'No pending requests'}
              </Text>
            </View>
          )}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  scrollContent: {
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  greeting: {
    fontSize: 16,
    color: '#666',
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  village: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  avatarContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
    marginTop: 8,
  },
  quickActions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  actionCard: {
    flex: 1,
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    gap: 8,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
  },
  txItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  txIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  txDetails: {
    flex: 1,
  },
  txTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  txDate: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  txAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2E7D32',
  },
  statusBadge: {
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#F57C00',
  },
  emptyState: {
    alignItems: 'center',
    padding: 24,
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
  },
});
