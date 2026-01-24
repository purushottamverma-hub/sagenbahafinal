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

interface Product {
  id: string;
  name: string;
  name_hi?: string;
  unit: string;
  category: string;
  description?: string;
}

export default function ProductsScreen() {
  const [products, setProducts] = useState<Product[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const language = useSettingsStore((state) => state.language);

  const fetchProducts = async () => {
    try {
      const res = await api.get('/products');
      setProducts(res.data);
    } catch (error) {
      console.error('Failed to fetch products:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchProducts();
    setRefreshing(false);
  };

  const renderProduct = ({ item }: { item: Product }) => (
    <Card style={styles.productCard}>
      <View style={styles.productIcon}>
        <Ionicons
          name={item.category === 'input' ? 'flask' : 'leaf'}
          size={28}
          color={item.category === 'input' ? '#1976D2' : '#2E7D32'}
        />
      </View>
      <View style={styles.productInfo}>
        <Text style={styles.productName}>
          {language === 'hi' && item.name_hi ? item.name_hi : item.name}
        </Text>
        <Text style={styles.productMeta}>
          {language === 'hi' ? 'इकाई' : 'Unit'}: {item.unit}
        </Text>
        <View style={styles.categoryBadge}>
          <Text style={styles.categoryText}>
            {item.category === 'input'
              ? (language === 'hi' ? 'इनपुट' : 'Input')
              : (language === 'hi' ? 'उपज' : 'Produce')}
          </Text>
        </View>
      </View>
    </Card>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>
          {language === 'hi' ? 'उपलब्ध उत्पाद' : 'Available Products'}
        </Text>
        <Text style={styles.subtitle}>
          {language === 'hi'
            ? 'FPO द्वारा उपलब्ध कराए गए उत्पाद'
            : 'Products available through FPO'}
        </Text>
      </View>

      <FlatList
        data={products}
        renderItem={renderProduct}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyState}>
              <Ionicons name="cube-outline" size={64} color="#CCC" />
              <Text style={styles.emptyText}>
                {language === 'hi' ? 'कोई उत्पाद नहीं' : 'No products available'}
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
  productCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  productIcon: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  productMeta: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 6,
  },
  categoryText: {
    fontSize: 12,
    color: '#2E7D32',
    fontWeight: '500',
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
});
