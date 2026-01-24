import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useSettingsStore } from '../../src/store/settingsStore';
import { Card } from '../../src/components/Card';
import api from '../../src/utils/api';

interface Transaction {
  id: string;
  product_name: string;
  quantity: number;
  rate: number;
  total_amount: number;
  created_at: string;
  receipt_number?: string;
}

export default function TransactionsScreen() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const language = useSettingsStore((state) => state.language);

  const fetchTransactions = async () => {
    try {
      const res = await api.get('/my-transactions');
      setTransactions(res.data.purchases || []);
    } catch (error) {
      console.error('Failed to fetch transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchTransactions();
    setRefreshing(false);
  };

  const renderTransaction = ({ item }: { item: Transaction }) => (
    <Card style={styles.txCard}>
      <View style={styles.txHeader}>
        <View style={styles.txIcon}>
          <Ionicons name="receipt" size={24} color="#2E7D32" />
        </View>
        <View style={styles.txInfo}>
          <Text style={styles.txProduct}>{item.product_name}</Text>
          <Text style={styles.txDate}>
            {new Date(item.created_at).toLocaleDateString()}
          </Text>
        </View>
        <Text style={styles.txAmount}>₹{item.total_amount}</Text>
      </View>
      <View style={styles.txDetails}>
        <Text style={styles.txDetailText}>
          {language === 'hi' ? 'मात्रा' : 'Quantity'}: {item.quantity} kg
        </Text>
        <Text style={styles.txDetailText}>
          {language === 'hi' ? 'दर' : 'Rate'}: ₹{item.rate}/kg
        </Text>
      </View>
      {item.receipt_number && (
        <Text style={styles.receiptNumber}>
          {language === 'hi' ? 'रसीद' : 'Receipt'}: {item.receipt_number}
        </Text>
      )}
    </Card>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>
          {language === 'hi' ? 'मेरे लेनदेन' : 'My Transactions'}
        </Text>
        <Text style={styles.subtitle}>
          {language === 'hi'
            ? 'FPO के साथ आपके सभी लेनदेन'
            : 'All your transactions with FPO'}
        </Text>
      </View>

      <FlatList
        data={transactions}
        renderItem={renderTransaction}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyState}>
              <Ionicons name="receipt-outline" size={64} color="#CCC" />
              <Text style={styles.emptyText}>
                {language === 'hi' ? 'कोई लेनदेन नहीं' : 'No transactions yet'}
              </Text>
              <Text style={styles.emptySubtext}>
                {language === 'hi'
                  ? 'आपके लेनदेन यहाँ दिखाई देंगे'
                  : 'Your transactions will appear here'}
              </Text>
            </View>
          ) : null
        }
      />
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
  listContent: {
    padding: 16,
    paddingTop: 8,
  },
  txCard: {
    marginBottom: 12,
  },
  txHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  txIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  txInfo: {
    flex: 1,
  },
  txProduct: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  txDate: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  txAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2E7D32',
  },
  txDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  txDetailText: {
    fontSize: 14,
    color: '#666',
  },
  receiptNumber: {
    fontSize: 12,
    color: '#999',
    marginTop: 8,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#BBB',
    marginTop: 4,
  },
});
