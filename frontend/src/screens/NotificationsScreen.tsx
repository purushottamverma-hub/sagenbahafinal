import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useSettingsStore } from '../../src/store/settingsStore';
import { Card } from '../../src/components/Card';
import { Button } from '../../src/components/Button';
import api from '../../src/utils/api';

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: string;
  reference_type?: string;
  reference_id?: string;
  is_read: boolean;
  created_at: string;
}

export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const language = useSettingsStore((state) => state.language);

  const fetchNotifications = async () => {
    try {
      const res = await api.get('/notifications');
      setNotifications(res.data);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchNotifications();
  }, []);

  const markAsRead = async (id: string) => {
    try {
      await api.put(`/notifications/${id}/read`);
      setNotifications(prev => 
        prev.map(n => n.id === id ? { ...n, is_read: true } : n)
      );
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await api.put('/notifications/mark-all-read');
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      Alert.alert(
        language === 'hi' ? 'सफल' : 'Success',
        language === 'hi' ? 'सभी सूचनाएं पढ़ी गईं' : 'All notifications marked as read'
      );
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'request': return { name: 'document-text', color: '#1976D2' };
      case 'approval': return { name: 'checkmark-circle', color: '#4CAF50' };
      case 'rejection': return { name: 'close-circle', color: '#D32F2F' };
      case 'transfer': return { name: 'swap-horizontal', color: '#7B1FA2' };
      case 'procurement': return { name: 'basket', color: '#F57C00' };
      case 'shareholder': return { name: 'ribbon', color: '#2E7D32' };
      default: return { name: 'notifications', color: '#666' };
    }
  };

  const getTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return language === 'hi' ? `${days} दिन पहले` : `${days}d ago`;
    } else if (hours > 0) {
      return language === 'hi' ? `${hours} घंटे पहले` : `${hours}h ago`;
    } else if (minutes > 0) {
      return language === 'hi' ? `${minutes} मिनट पहले` : `${minutes}m ago`;
    } else {
      return language === 'hi' ? 'अभी' : 'Just now';
    }
  };

  const renderNotification = ({ item }: { item: NotificationItem }) => {
    const icon = getIcon(item.type);
    
    return (
      <TouchableOpacity onPress={() => !item.is_read && markAsRead(item.id)}>
        <Card style={[styles.notifCard, !item.is_read && styles.unreadCard]}>
          <View style={styles.notifRow}>
            <View style={[styles.iconContainer, { backgroundColor: icon.color + '20' }]}>
              <Ionicons name={icon.name as any} size={24} color={icon.color} />
            </View>
            <View style={styles.notifContent}>
              <View style={styles.notifHeader}>
                <Text style={[styles.notifTitle, !item.is_read && styles.unreadTitle]}>
                  {item.title}
                </Text>
                {!item.is_read && <View style={styles.unreadDot} />}
              </View>
              <Text style={styles.notifMessage} numberOfLines={2}>
                {item.message}
              </Text>
              <Text style={styles.notifTime}>
                {getTimeAgo(item.created_at)}
              </Text>
            </View>
          </View>
        </Card>
      </TouchableOpacity>
    );
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>
            {language === 'hi' ? 'सूचनाएं' : 'Notifications'}
          </Text>
          {unreadCount > 0 && (
            <Text style={styles.subtitle}>
              {unreadCount} {language === 'hi' ? 'अपठित' : 'unread'}
            </Text>
          )}
        </View>
        {unreadCount > 0 && (
          <TouchableOpacity style={styles.markAllBtn} onPress={markAllAsRead}>
            <Text style={styles.markAllText}>
              {language === 'hi' ? 'सभी पढ़ें' : 'Mark all read'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={notifications}
        renderItem={renderNotification}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#2E7D32']} />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="notifications-off-outline" size={64} color="#CCC" />
            <Text style={styles.emptyText}>
              {language === 'hi' ? 'कोई सूचना नहीं' : 'No notifications'}
            </Text>
            <Text style={styles.emptySubtext}>
              {language === 'hi' 
                ? 'जब कोई गतिविधि होगी तब सूचनाएं यहां दिखेंगी' 
                : 'Notifications will appear here when there is activity'}
            </Text>
          </View>
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
  subtitle: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  markAllBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#E8F5E9',
    borderRadius: 8,
  },
  markAllText: {
    color: '#2E7D32',
    fontWeight: '600',
    fontSize: 13,
  },
  listContent: {
    padding: 16,
  },
  notifCard: {
    marginBottom: 12,
  },
  unreadCard: {
    backgroundColor: '#FFF',
    borderLeftWidth: 4,
    borderLeftColor: '#2E7D32',
  },
  notifRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  notifContent: {
    flex: 1,
  },
  notifHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  notifTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: '#333',
  },
  unreadTitle: {
    fontWeight: '700',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2E7D32',
  },
  notifMessage: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
    lineHeight: 20,
  },
  notifTime: {
    fontSize: 12,
    color: '#999',
    marginTop: 6,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    color: '#999',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#BBB',
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
});
