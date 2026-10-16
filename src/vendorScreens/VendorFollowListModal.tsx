// src/vendorScreens/VendorFollowListModal.tsx
import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';

const Colors = {
  background: '#FFFFFF',
  card: '#F8FAFC',
  cardBorder: '#E2E8F0',
  textPrimary: '#0A0A0A',
  textSecondary: '#475569',
  textMuted: '#94A3B8',
  royalGreen: '#1B8C40',
  onlineGreen: '#34C759',
};

interface VendorFollowListModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  users: any[];
  loading: boolean;
  onOpenShop?: (vendor: any) => void;
}

export default function VendorFollowListModal({
  visible,
  onClose,
  title,
  users,
  loading,
  onOpenShop,
}: VendorFollowListModalProps) {
  const renderItem = ({ item }: { item: any }) => {
    const avatar =
      item?.avatar || item?.logo || item?.shopImage || item?.profilePic || '';
    const name = item?.shopName || item?.name || 'Vendor';
    const handle = item?.username ? `@${item.username}` : '';
    const isOnline = !!item?.isOnline;

    return (
      <TouchableOpacity
        style={styles.row}
        onPress={() => {
          if (onOpenShop) {
            onClose();
            onOpenShop(item);
          }
        }}
        activeOpacity={0.7}
      >
        <View style={styles.avatarWrap}>
          {avatar ? (
            <Image source={{ uri: avatar }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.avatarLetter}>
                {(name || 'V').charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          {isOnline ? <View style={styles.onlineDot} /> : null}
        </View>

        <View style={styles.infoWrap}>
          <Text style={styles.name} numberOfLines={1}>
            {name}
          </Text>
          {handle ? (
            <Text style={styles.handle} numberOfLines={1}>
              {handle}
            </Text>
          ) : null}
        </View>

        <Ionicons
          name="chevron-forward"
          size={20}
          color={Colors.textMuted}
        />
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle="pageSheet"
    >
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.headerBtn}>
            <Ionicons name="close" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{title}</Text>
          <View style={styles.headerBtn} />
        </View>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={Colors.royalGreen} />
          </View>
        ) : users.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Ionicons
              name="people-outline"
              size={60}
              color={Colors.textMuted}
            />
            <Text style={styles.emptyText}>No {title.toLowerCase()} yet</Text>
          </View>
        ) : (
          <FlatList
            data={users}
            keyExtractor={(item, i) => `${item?._id || i}`}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.cardBorder,
  },
  headerBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  listContent: { paddingVertical: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  avatarWrap: { position: 'relative', marginRight: 12 },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.card,
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.royalGreen,
  },
  avatarLetter: { color: '#FFFFFF', fontSize: 20, fontWeight: '800' },
  onlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: Colors.onlineGreen,
    borderWidth: 2,
    borderColor: Colors.background,
  },
  infoWrap: { flex: 1 },
  name: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  handle: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 24,
  },
  emptyText: {
    fontSize: 15,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
});