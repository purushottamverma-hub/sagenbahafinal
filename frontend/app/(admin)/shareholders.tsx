import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  Modal,
  Alert,
  Image,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useSettingsStore } from '../../src/store/settingsStore';
import { Card } from '../../src/components/Card';
import { Button } from '../../src/components/Button';
import { Input } from '../../src/components/Input';
import api from '../../src/utils/api';

interface ShareholderRequest {
  id: string;
  user_id: string;
  user_name: string;
  certificate_data?: string;
  certificate_filename?: string;
  status: string;
  admin_remark?: string;
  approved_by?: string;
  created_at: string;
  updated_at: string;
}

export default function ShareholdersScreen() {
  const [requests, setRequests] = useState<ShareholderRequest[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<ShareholderRequest | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [remark, setRemark] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const language = useSettingsStore((state) => state.language);

  const fetchRequests = async () => {
    try {
      const params = filterStatus !== 'all' ? { status: filterStatus } : {};
      const response = await api.get('/shareholder-upgrade/requests', { params });
      setRequests(response.data);
    } catch (error) {
      console.error('Failed to fetch shareholder requests:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [filterStatus]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchRequests();
  }, [filterStatus]);

  const handleApprove = async () => {
    if (!selectedRequest) return;
    
    setActionLoading(true);
    try {
      await api.put(`/shareholder-upgrade/${selectedRequest.id}/approve`, null, {
        params: { remark: remark || 'Approved' }
      });
      
      Alert.alert(
        language === 'hi' ? 'सफल' : 'Success',
        language === 'hi' ? 'शेयरधारक अनुरोध स्वीकृत' : 'Shareholder request approved'
      );
      
      setShowModal(false);
      setSelectedRequest(null);
      setRemark('');
      fetchRequests();
    } catch (error: any) {
      Alert.alert(
        language === 'hi' ? 'त्रुटि' : 'Error',
        error.response?.data?.detail || 'Failed to approve request'
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!selectedRequest) return;
    
    if (!remark.trim()) {
      Alert.alert(
        language === 'hi' ? 'त्रुटि' : 'Error',
        language === 'hi' ? 'अस्वीकृति का कारण दर्ज करें' : 'Please enter rejection reason'
      );
      return;
    }
    
    setActionLoading(true);
    try {
      await api.put(`/shareholder-upgrade/${selectedRequest.id}/reject`, null, {
        params: { remark }
      });
      
      Alert.alert(
        language === 'hi' ? 'सफल' : 'Success',
        language === 'hi' ? 'शेयरधारक अनुरोध अस्वीकृत' : 'Shareholder request rejected'
      );
      
      setShowModal(false);
      setSelectedRequest(null);
      setRemark('');
      fetchRequests();
    } catch (error: any) {
      Alert.alert(
        language === 'hi' ? 'त्रुटि' : 'Error',
        error.response?.data?.detail || 'Failed to reject request'
      );
    } finally {
      setActionLoading(false);
    }
  };

  const openRequestDetail = (request: ShareholderRequest) => {
    setSelectedRequest(request);
    setRemark('');
    setShowModal(true);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return '#F57C00';
      case 'approved': return '#2E7D32';
      case 'rejected': return '#D32F2F';
      default: return '#666';
    }
  };

  const getStatusText = (status: string) => {
    if (language === 'hi') {
      switch (status) {
        case 'pending': return 'लंबित';
        case 'approved': return 'स्वीकृत';
        case 'rejected': return 'अस्वीकृत';
        default: return status;
      }
    }
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  const renderRequest = ({ item }: { item: ShareholderRequest }) => (
    <Card style={styles.requestCard} onPress={() => openRequestDetail(item)}>
      <View style={styles.requestHeader}>
        <View style={styles.userInfo}>
          <View style={styles.userIcon}>
            <Ionicons name="person" size={24} color="#2E7D32" />
          </View>
          <View>
            <Text style={styles.userName}>{item.user_name}</Text>
            <Text style={styles.requestDate}>
              {new Date(item.created_at).toLocaleDateString('en-IN')}
            </Text>
          </View>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
          <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
            {getStatusText(item.status)}
          </Text>
        </View>
      </View>
      
      {item.certificate_data && (
        <View style={styles.certificatePreview}>
          <Ionicons name="document-attach" size={18} color="#1976D2" />
          <Text style={styles.certificateText}>
            {language === 'hi' ? 'प्रमाणपत्र संलग्न' : 'Certificate attached'}
          </Text>
        </View>
      )}
      
      {item.admin_remark && (
        <View style={styles.remarkBox}>
          <Text style={styles.remarkLabel}>
            {language === 'hi' ? 'टिप्पणी:' : 'Remark:'}
          </Text>
          <Text style={styles.remarkText}>{item.admin_remark}</Text>
        </View>
      )}
      
      {item.status === 'pending' && (
        <View style={styles.actionHint}>
          <Ionicons name="chevron-forward" size={20} color="#999" />
          <Text style={styles.actionHintText}>
            {language === 'hi' ? 'समीक्षा करने के लिए टैप करें' : 'Tap to review'}
          </Text>
        </View>
      )}
    </Card>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>
            {language === 'hi' ? 'शेयरधारक अनुरोध' : 'Shareholder Requests'}
          </Text>
          <Text style={styles.subtitle}>
            {language === 'hi' ? 'किसान शेयरधारक अपग्रेड' : 'Farmer Shareholder Upgrades'}
          </Text>
        </View>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        {(['pending', 'approved', 'rejected', 'all'] as const).map((status) => (
          <TouchableOpacity
            key={status}
            style={[
              styles.filterTab,
              filterStatus === status && styles.filterTabActive
            ]}
            onPress={() => setFilterStatus(status)}
          >
            <Text style={[
              styles.filterTabText,
              filterStatus === status && styles.filterTabTextActive
            ]}>
              {status === 'all' 
                ? (language === 'hi' ? 'सभी' : 'All')
                : getStatusText(status)
              }
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={requests}
        renderItem={renderRequest}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#2E7D32']} />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={64} color="#CCC" />
            <Text style={styles.emptyText}>
              {language === 'hi' ? 'कोई अनुरोध नहीं' : 'No requests found'}
            </Text>
          </View>
        }
      />

      {/* Request Detail Modal */}
      <Modal visible={showModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {language === 'hi' ? 'अनुरोध विवरण' : 'Request Details'}
              </Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            {selectedRequest && (
              <ScrollView style={styles.modalBody}>
                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>
                    {language === 'hi' ? 'किसान का नाम' : 'Farmer Name'}
                  </Text>
                  <Text style={styles.detailValue}>{selectedRequest.user_name}</Text>
                </View>

                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>
                    {language === 'hi' ? 'अनुरोध तिथि' : 'Request Date'}
                  </Text>
                  <Text style={styles.detailValue}>
                    {new Date(selectedRequest.created_at).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric'
                    })}
                  </Text>
                </View>

                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>
                    {language === 'hi' ? 'स्थिति' : 'Status'}
                  </Text>
                  <View style={[styles.statusBadgeLarge, { backgroundColor: getStatusColor(selectedRequest.status) + '20' }]}>
                    <Text style={[styles.statusTextLarge, { color: getStatusColor(selectedRequest.status) }]}>
                      {getStatusText(selectedRequest.status)}
                    </Text>
                  </View>
                </View>

                {/* Certificate Image */}
                {selectedRequest.certificate_data && (
                  <View style={styles.certificateSection}>
                    <Text style={styles.detailLabel}>
                      {language === 'hi' ? 'शेयर प्रमाणपत्र' : 'Share Certificate'}
                    </Text>
                    <TouchableOpacity 
                      style={styles.certificateImageContainer}
                      onPress={() => setShowImageModal(true)}
                    >
                      <Image
                        source={{ uri: `data:image/jpeg;base64,${selectedRequest.certificate_data}` }}
                        style={styles.certificateImage}
                        resizeMode="cover"
                      />
                      <View style={styles.viewImageOverlay}>
                        <Ionicons name="expand" size={24} color="#FFF" />
                        <Text style={styles.viewImageText}>
                          {language === 'hi' ? 'बड़ा करें' : 'View Full'}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Actions for pending requests */}
                {selectedRequest.status === 'pending' && (
                  <View style={styles.actionSection}>
                    <Input
                      label={language === 'hi' ? 'टिप्पणी (अस्वीकृति के लिए आवश्यक)' : 'Remark (required for rejection)'}
                      placeholder={language === 'hi' ? 'टिप्पणी दर्ज करें...' : 'Enter remark...'}
                      value={remark}
                      onChangeText={setRemark}
                      multiline
                      numberOfLines={3}
                    />

                    <View style={styles.actionButtons}>
                      <Button
                        title={language === 'hi' ? 'अस्वीकृत करें' : 'Reject'}
                        onPress={handleReject}
                        loading={actionLoading}
                        variant="outline"
                        style={styles.rejectBtn}
                      />
                      <Button
                        title={language === 'hi' ? 'स्वीकृत करें' : 'Approve'}
                        onPress={handleApprove}
                        loading={actionLoading}
                        style={styles.approveBtn}
                      />
                    </View>
                  </View>
                )}

                {/* Show remark for processed requests */}
                {selectedRequest.status !== 'pending' && selectedRequest.admin_remark && (
                  <View style={styles.detailSection}>
                    <Text style={styles.detailLabel}>
                      {language === 'hi' ? 'व्यवस्थापक टिप्पणी' : 'Admin Remark'}
                    </Text>
                    <Text style={styles.detailValue}>{selectedRequest.admin_remark}</Text>
                  </View>
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Full Image Modal */}
      <Modal visible={showImageModal} animationType="fade" transparent>
        <View style={styles.imageModalOverlay}>
          <TouchableOpacity 
            style={styles.imageModalClose}
            onPress={() => setShowImageModal(false)}
          >
            <Ionicons name="close-circle" size={36} color="#FFF" />
          </TouchableOpacity>
          {selectedRequest?.certificate_data && (
            <Image
              source={{ uri: `data:image/jpeg;base64,${selectedRequest.certificate_data}` }}
              style={styles.fullImage}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  header: { padding: 16, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E0E0E0' },
  title: { fontSize: 24, fontWeight: 'bold', color: '#333' },
  subtitle: { fontSize: 13, color: '#666', marginTop: 2 },
  filterContainer: { flexDirection: 'row', padding: 12, backgroundColor: '#FFF', gap: 8 },
  filterTab: { flex: 1, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 20, backgroundColor: '#F0F0F0', alignItems: 'center' },
  filterTabActive: { backgroundColor: '#2E7D32' },
  filterTabText: { fontSize: 12, fontWeight: '600', color: '#666' },
  filterTabTextActive: { color: '#FFF' },
  listContent: { padding: 16 },
  requestCard: { marginBottom: 12 },
  requestHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  userInfo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  userIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#E8F5E9', justifyContent: 'center', alignItems: 'center' },
  userName: { fontSize: 16, fontWeight: '600', color: '#333' },
  requestDate: { fontSize: 12, color: '#666', marginTop: 2 },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  statusText: { fontSize: 12, fontWeight: '600' },
  certificatePreview: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#E0E0E0' },
  certificateText: { fontSize: 13, color: '#1976D2' },
  remarkBox: { marginTop: 12, padding: 10, backgroundColor: '#F5F5F5', borderRadius: 8 },
  remarkLabel: { fontSize: 11, color: '#666', marginBottom: 2 },
  remarkText: { fontSize: 13, color: '#333' },
  actionHint: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 12, gap: 4 },
  actionHintText: { fontSize: 12, color: '#999' },
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { fontSize: 16, color: '#999', marginTop: 16 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#FFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#E0E0E0' },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  modalBody: { padding: 16 },
  detailSection: { marginBottom: 16 },
  detailLabel: { fontSize: 12, color: '#666', marginBottom: 4 },
  detailValue: { fontSize: 16, color: '#333', fontWeight: '500' },
  statusBadgeLarge: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 16, alignSelf: 'flex-start' },
  statusTextLarge: { fontSize: 14, fontWeight: '600' },
  certificateSection: { marginBottom: 16 },
  certificateImageContainer: { position: 'relative', borderRadius: 12, overflow: 'hidden', marginTop: 8 },
  certificateImage: { width: '100%', height: 200, backgroundColor: '#F0F0F0' },
  viewImageOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.6)', padding: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  viewImageText: { color: '#FFF', fontSize: 14, fontWeight: '500' },
  actionSection: { marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#E0E0E0' },
  actionButtons: { flexDirection: 'row', gap: 12, marginTop: 16, marginBottom: 24 },
  rejectBtn: { flex: 1, borderColor: '#D32F2F' },
  approveBtn: { flex: 1, backgroundColor: '#2E7D32' },
  imageModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' },
  imageModalClose: { position: 'absolute', top: 50, right: 20, zIndex: 1 },
  fullImage: { width: '90%', height: '80%' },
});
