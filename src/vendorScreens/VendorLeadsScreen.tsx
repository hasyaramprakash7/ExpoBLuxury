// src/screens/vendorScreens/VendorLeadsScreen.tsx
import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  SafeAreaView,
  FlatList,
  RefreshControl,
  Modal,
  Alert,
  Linking,
  Dimensions,
  StatusBar,
  Platform,
} from "react-native";
import { useDispatch, useSelector } from "react-redux";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { RootState, AppDispatch } from "../../src/app/store";
import {
  fetchVendorLeads,
  updateLeadStatus,
  clearLeads,
  Lead,
  fetchLeadStats,
  addLead,
  refreshStats,
  unlockStats,
} from "../../src/features/leadSlice";
import { fetchVendorStats } from "../../src/features/vendor/vendorAuthSlice";
import socket from "../../src/userScreens/utils/socket";
import Toast from "react-native-toast-message";

const { width, height } = Dimensions.get("window");

// --- Responsive helpers ---
const scale = (size: number) => (width / 375) * size;
const verticalScale = (size: number) => (height / 812) * size;
const moderateScale = (size: number, factor = 0.5) => size + (scale(size) - size) * factor;

// --- Royal Color Palette ---
const Colors = {
  background: "#0A0A0A",
  card: "#141414",
  cardBorder: "#1F1F1F",
  royalGreen: "#1B8C40",
  royalGreenLight: "#2A9D4A",
  royalGreenDark: "#0F5A28",
  royalGreenGlow: "rgba(27, 140, 64, 0.15)",
  textPrimary: "#FFFFFF",
  textSecondary: "#B0B0B0",
  textMuted: "#6B7280",
  gold: "#FFD700",
  onlineGreen: "#34C759",
  offlineRed: "#FF4444",
  accentBlue: "#2563EB",
  accentPurple: "#7C3AED",
  whatsappGreen: "#25D366",
  borderGray: "#2A2A2A",
  shadowGreen: "rgba(27, 140, 64, 0.3)",
};

// --- Status Badge ---
const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const configs = {
    new: { color: Colors.accentBlue, label: 'New', icon: 'sparkles' },
    seen: { color: Colors.textMuted, label: 'Seen', icon: 'eye-outline' },
    replied: { color: Colors.accentPurple, label: 'Replied', icon: 'chatbubble-outline' },
    converted: { color: Colors.royalGreen, label: 'Converted', icon: 'checkmark-circle' },
  };

  const config = configs[status as keyof typeof configs] || { 
    color: Colors.textMuted, 
    label: status, 
    icon: 'help-outline' 
  };

  return (
    <View style={[badgeStyles.statusBadge, { backgroundColor: config.color + '20' }]}>
      <Ionicons name={config.icon as any} size={scale(10)} color={config.color} />
      <Text style={[badgeStyles.statusLabel, { color: config.color }]}>{config.label}</Text>
    </View>
  );
};

const badgeStyles = StyleSheet.create({
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: scale(6),
    paddingVertical: verticalScale(2),
    borderRadius: moderateScale(6),
    gap: scale(3),
  },
  statusLabel: {
    fontSize: moderateScale(9),
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});

// --- Type Badge ---
const TypeBadge: React.FC<{ type: string; count?: number }> = ({ type, count }) => {
  const configs = {
    view: { color: Colors.textMuted, icon: 'eye-outline', label: 'Views' },
    call: { color: Colors.accentBlue, icon: 'call-outline', label: 'Calls' },
    whatsapp: { color: Colors.whatsappGreen, icon: 'logo-whatsapp', label: 'WhatsApp' },
    email: { color: Colors.accentPurple, icon: 'mail-outline', label: 'Emails' },
    quote: { color: Colors.gold, icon: 'chatbubble-outline', label: 'Quotes' },
  };

  const config = configs[type as keyof typeof configs] || { 
    color: Colors.textMuted, 
    icon: 'chatbubble-outline', 
    label: 'Enquiry' 
  };

  return (
    <View style={typeStyles.typeBadge}>
      <Ionicons name={config.icon as any} size={scale(10)} color={config.color} />
      <Text style={[typeStyles.typeLabel, { color: config.color }]}>
        {config.label} {count && count > 1 ? `(${count})` : ''}
      </Text>
    </View>
  );
};

const typeStyles = StyleSheet.create({
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(3),
  },
  typeLabel: {
    fontSize: moderateScale(9),
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});

// --- Grouped Lead Card (Group by User only) ---
const GroupedLeadCard: React.FC<{
  group: any;
  onUpdateStatus: (leadId: string, status: string) => void;
  onContact: (lead: Lead) => void;
}> = ({ group, onUpdateStatus, onContact }) => {
  const [expanded, setExpanded] = useState(false);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    
    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Get the latest lead for status
  const latestLead = group.leads.length > 0 ? group.leads[0] : null;
  const totalLeads = group.leads.length;
  
  // Count unseen (new) leads
  const unseenCount = group.leads.filter((l: Lead) => l.status === 'new').length;
  
  // Count by type
  const typeCounts = group.leads.reduce((acc: any, lead: Lead) => {
    acc[lead.type] = (acc[lead.type] || 0) + 1;
    return acc;
  }, {});

  // 🔥 Order: Views first, then Calls, then WhatsApp, then Emails, then Quotes
  const typeOrder = ['view', 'call', 'whatsapp', 'email', 'quote'];
  const uniqueTypes = Object.keys(typeCounts).sort((a, b) => {
    const indexA = typeOrder.indexOf(a);
    const indexB = typeOrder.indexOf(b);
    if (indexA === -1) return 1;
    if (indexB === -1) return -1;
    return indexA - indexB;
  });

  // 🔥 Handle contact click - mark all unseen leads as seen
  const handleContactPress = () => {
    // Find all new leads for this user
    const newLeads = group.leads.filter((l: Lead) => l.status === 'new');
    
    // Update each new lead to 'seen'
    newLeads.forEach((lead: Lead) => {
      onUpdateStatus(lead._id, 'seen');
    });
    
    // Then open contact modal
    onContact(latestLead);
  };

  return (
    <View style={cardStyles.card}>
      <TouchableOpacity 
        style={cardStyles.header} 
        onPress={() => setExpanded(!expanded)} 
        activeOpacity={0.7}
      >
        <View style={cardStyles.userSection}>
          <View style={cardStyles.avatar}>
            <Text style={cardStyles.avatarText}>
              {group.userName?.charAt(0)?.toUpperCase() || 'U'}
            </Text>
            {unseenCount > 0 && (
              <View style={cardStyles.unseenBadge}>
                <Text style={cardStyles.unseenText}>{unseenCount}</Text>
              </View>
            )}
          </View>
          <View style={cardStyles.userInfo}>
            <View style={cardStyles.nameRow}>
              <Text style={cardStyles.userName} numberOfLines={1}>
                {group.userName || 'Unknown User'}
              </Text>
              {group.userPhone && (
                <View style={cardStyles.phoneContainer}>
                  <Ionicons name="call-outline" size={scale(12)} color={Colors.textMuted} />
                  <Text style={cardStyles.phoneText}>{group.userPhone}</Text>
                </View>
              )}
            </View>
            <View style={cardStyles.userMetaRow}>
              <Text style={cardStyles.userMetaText}>
                {totalLeads} {totalLeads > 1 ? 'leads' : 'lead'}
              </Text>
              {group.latestTime && (
                <>
                  <Text style={cardStyles.dotSeparator}>•</Text>
                  <Text style={cardStyles.userMetaText}>{formatDate(group.latestTime)}</Text>
                </>
              )}
              {unseenCount > 0 && (
                <>
                  <Text style={cardStyles.dotSeparator}>•</Text>
                  <Text style={[cardStyles.userMetaText, { color: Colors.offlineRed }]}>
                    {unseenCount} unseen
                  </Text>
                </>
              )}
            </View>
            {/* Show type badges in order: Views, Calls, WhatsApp */}
            <View style={cardStyles.typeBadgesRow}>
              {uniqueTypes.map((type) => (
                <TypeBadge key={type} type={type} count={typeCounts[type]} />
              ))}
            </View>
          </View>
        </View>

        <View style={cardStyles.rightSection}>
          {latestLead && <StatusBadge status={latestLead.status} />}
          <Ionicons 
            name={expanded ? 'chevron-up' : 'chevron-down'} 
            size={scale(18)} 
            color={Colors.textMuted} 
          />
        </View>
      </TouchableOpacity>

      {expanded && (
        <View style={cardStyles.expanded}>
          {/* Show all leads grouped by type in order: Views, Calls, WhatsApp */}
          {uniqueTypes.map((type) => {
            const typeLeads = group.leads.filter((l: Lead) => l.type === type);
            const typeConfigs: Record<string, { color: string; icon: string; label: string }> = {
              view: { color: Colors.textMuted, icon: 'eye-outline', label: '👀 Views' },
              call: { color: Colors.accentBlue, icon: 'call-outline', label: '📞 Calls' },
              whatsapp: { color: Colors.whatsappGreen, icon: 'logo-whatsapp', label: '💬 WhatsApp' },
              email: { color: Colors.accentPurple, icon: 'mail-outline', label: '✉️ Emails' },
              quote: { color: Colors.gold, icon: 'chatbubble-outline', label: '📝 Quotes' },
            };
            const config = typeConfigs[type] || typeConfigs.call;
            
            return (
              <View key={type} style={cardStyles.typeSection}>
                <View style={cardStyles.typeHeader}>
                  <Ionicons name={config.icon as any} size={scale(14)} color={config.color} />
                  <Text style={[cardStyles.typeHeaderText, { color: config.color }]}>
                    {config.label} ({typeLeads.length})
                  </Text>
                </View>
                {typeLeads.map((lead: Lead, index: number) => (
                  <View key={lead._id} style={cardStyles.leadItem}>
                    <View style={cardStyles.leadLeft}>
                      <Text style={cardStyles.leadNumber}>#{index + 1}</Text>
                      <Text style={cardStyles.leadDate}>{formatDate(lead.createdAt)}</Text>
                      <Text style={cardStyles.leadMessage} numberOfLines={1}>
                        {lead.message}
                      </Text>
                    </View>
                    <StatusBadge status={lead.status} />
                  </View>
                ))}
              </View>
            );
          })}

          {/* Contact button - marks all unseen as seen before opening contact */}
          {group.hasNonView && (
            <View style={cardStyles.actions}>
              <TouchableOpacity
                style={[cardStyles.actionBtn, cardStyles.contactBtn]}
                onPress={handleContactPress}
              >
                <Ionicons name="chatbubble-outline" size={scale(14)} color={Colors.textPrimary} />
                <Text style={cardStyles.actionText}>Contact</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}
    </View>
  );
};

const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderRadius: moderateScale(12),
    marginBottom: verticalScale(10),
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: moderateScale(12),
  },
  userSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: scale(40),
    height: scale(40),
    borderRadius: moderateScale(20),
    backgroundColor: Colors.royalGreen,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: scale(10),
    position: 'relative',
  },
  avatarText: {
    color: Colors.textPrimary,
    fontSize: moderateScale(16),
    fontWeight: '700',
  },
  unseenBadge: {
    position: 'absolute',
    top: -scale(4),
    right: -scale(4),
    backgroundColor: Colors.offlineRed,
    borderRadius: moderateScale(10),
    minWidth: scale(18),
    height: scale(18),
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.background,
    paddingHorizontal: scale(3),
  },
  unseenText: {
    color: Colors.textPrimary,
    fontSize: moderateScale(9),
    fontWeight: '700',
  },
  userInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
  },
  userName: {
    color: Colors.textPrimary,
    fontSize: moderateScale(14),
    fontWeight: '600',
    flex: 1,
  },
  phoneContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: scale(6),
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: scale(6),
    paddingVertical: verticalScale(2),
    borderRadius: moderateScale(6),
  },
  phoneText: {
    color: Colors.textMuted,
    fontSize: moderateScale(10),
    marginLeft: scale(3),
  },
  userMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: verticalScale(2),
    flexWrap: 'wrap',
  },
  userMetaText: {
    color: Colors.textMuted,
    fontSize: moderateScale(11),
  },
  dotSeparator: {
    color: Colors.textMuted,
    fontSize: moderateScale(11),
    marginHorizontal: scale(4),
  },
  typeBadgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: verticalScale(2),
    gap: scale(4),
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(6),
  },
  expanded: {
    paddingHorizontal: moderateScale(12),
    paddingBottom: moderateScale(12),
    borderTopWidth: 1,
    borderTopColor: Colors.cardBorder,
    paddingTop: moderateScale(10),
  },
  typeSection: {
    marginBottom: verticalScale(6),
  },
  typeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: verticalScale(3),
    gap: scale(4),
  },
  typeHeaderText: {
    fontSize: moderateScale(11),
    fontWeight: '700',
  },
  leadItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: verticalScale(3),
    paddingHorizontal: scale(8),
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: moderateScale(4),
    marginBottom: verticalScale(2),
  },
  leadLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(6),
    flex: 1,
  },
  leadNumber: {
    color: Colors.textMuted,
    fontSize: moderateScale(10),
    fontWeight: '500',
  },
  leadDate: {
    color: Colors.textSecondary,
    fontSize: moderateScale(10),
  },
  leadMessage: {
    color: Colors.textSecondary,
    fontSize: moderateScale(10),
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
    gap: scale(8),
    marginTop: verticalScale(6),
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: verticalScale(6),
    paddingHorizontal: scale(12),
    borderRadius: moderateScale(8),
    flex: 1,
    gap: scale(6),
  },
  contactBtn: {
    backgroundColor: Colors.accentBlue,
  },
  actionText: {
    color: Colors.textPrimary,
    fontSize: moderateScale(12),
    fontWeight: '600',
  },
});

// --- Combined Filter Chips - TWO LINES with content height ---
const FilterChips: React.FC<{
  items: Array<{ key: string | null; label: string; icon: string; color?: string; type: 'status' | 'type' }>;
  selectedStatus: string | null;
  selectedType: string | null;
  onSelectStatus: (key: string | null) => void;
  onSelectType: (key: string | null) => void;
  statusCounts: Record<string, number>;
  typeCounts: Record<string, number>;
}> = ({ 
  items, 
  selectedStatus, 
  selectedType, 
  onSelectStatus, 
  onSelectType, 
  statusCounts, 
  typeCounts 
}) => {
  // Split items into two rows: Status chips first row, Type chips second row
  const statusItems = items.filter(item => item.type === 'status');
  const typeItems = items.filter(item => item.type === 'type');

  const renderChipRow = (rowItems: typeof items, rowType: 'status' | 'type') => {
    return (
      <View style={filterStyles.chipRow}>
        {rowItems.map((item) => {
          const isStatus = item.type === 'status';
          const isSelected = isStatus ? selectedStatus === item.key : selectedType === item.key;
          const count = isStatus 
            ? statusCounts[item.key || 'all'] || 0 
            : typeCounts[item.key || 'all'] || 0;
          
          return (
            <TouchableOpacity
              key={`${item.type}-${item.key || 'all'}`}
              style={[
                filterStyles.chip,
                isSelected && filterStyles.chipActive,
              ]}
              onPress={() => {
                if (isStatus) {
                  if (selectedStatus === item.key) {
                    onSelectStatus(null);
                  } else {
                    onSelectStatus(item.key);
                    onSelectType(null);
                  }
                } else {
                  if (selectedType === item.key) {
                    onSelectType(null);
                  } else {
                    onSelectType(item.key);
                    onSelectStatus(null);
                  }
                }
              }}
            >
              <Ionicons
                name={item.icon as any}
                size={scale(12)}
                color={isSelected ? Colors.textPrimary : (item.color || Colors.textMuted)}
              />
              <Text
                style={[
                  filterStyles.chipText,
                  isSelected && filterStyles.chipTextActive,
                ]}
              >
                {item.label}
              </Text>
              {count > 0 && (
                <View style={filterStyles.countBadge}>
                  <Text style={filterStyles.countText}>{count}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  return (
    <View style={filterStyles.container}>
      {renderChipRow(statusItems, 'status')}
      {renderChipRow(typeItems, 'type')}
    </View>
  );
};

const filterStyles = StyleSheet.create({
  container: {
    marginBottom: verticalScale(8),
    gap: verticalScale(4),
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: scale(4),
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    paddingHorizontal: scale(10),
    paddingVertical: verticalScale(4),
    borderRadius: moderateScale(14),
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    gap: scale(4),
    height: verticalScale(30),
    alignSelf: 'flex-start',
  },
  chipActive: {
    backgroundColor: Colors.royalGreen,
    borderColor: Colors.royalGreen,
    shadowColor: Colors.royalGreen,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  chipText: {
    color: Colors.textMuted,
    fontSize: moderateScale(11),
    fontWeight: '600',
  },
  chipTextActive: {
    color: Colors.textPrimary,
  },
  countBadge: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: scale(4),
    borderRadius: moderateScale(6),
    minWidth: scale(14),
    alignItems: 'center',
  },
  countText: {
    color: Colors.textSecondary,
    fontSize: moderateScale(9),
    fontWeight: '600',
  },
});

// --- Contact Modal ---
const ContactModal: React.FC<{
  visible: boolean;
  lead: Lead | null;
  onClose: () => void;
  onCall: (phone: string) => void;
  onWhatsApp: (phone: string, message: string) => void;
  onEmail: (email: string) => void;
}> = ({ visible, lead, onClose, onCall, onWhatsApp, onEmail }) => {
  if (!lead) return null;

  // 🔥 Updated WhatsApp message with shop details
  const getWhatsAppMessage = () => {
    const shopName = lead.vendor?.shopName || 'our shop';
    return `Welcome to BLuxury! 👋\n\nI'm interested in your shop "${shopName}".\n\nCan you please share more details about your products and services?`;
  };

  const message = getWhatsAppMessage();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={modalStyles.overlay}>
        <View style={modalStyles.content}>
          <View style={modalStyles.header}>
            <Text style={modalStyles.title}>Contact {lead.user?.name}</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={scale(22)} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>

          <View style={modalStyles.options}>
            {lead.user?.phone && (
              <>
                <TouchableOpacity style={modalStyles.option} onPress={() => onCall(lead.user!.phone)}>
                  <View style={[modalStyles.iconWrap, { backgroundColor: Colors.accentBlue + '20' }]}>
                    <Ionicons name="call-outline" size={scale(22)} color={Colors.accentBlue} />
                  </View>
                  <View style={modalStyles.optionInfo}>
                    <Text style={modalStyles.optionTitle}>Call</Text>
                    <Text style={modalStyles.optionSub}>{lead.user.phone}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={scale(18)} color={Colors.textMuted} />
                </TouchableOpacity>

                <TouchableOpacity style={modalStyles.option} onPress={() => onWhatsApp(lead.user!.phone, message)}>
                  <View style={[modalStyles.iconWrap, { backgroundColor: Colors.whatsappGreen + '20' }]}>
                    <Ionicons name="logo-whatsapp" size={scale(22)} color={Colors.whatsappGreen} />
                  </View>
                  <View style={modalStyles.optionInfo}>
                    <Text style={modalStyles.optionTitle}>WhatsApp</Text>
                    <Text style={modalStyles.optionSub}>Send quick message</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={scale(18)} color={Colors.textMuted} />
                </TouchableOpacity>
              </>
            )}

            {lead.user?.email && (
              <TouchableOpacity style={modalStyles.option} onPress={() => onEmail(lead.user!.email)}>
                <View style={[modalStyles.iconWrap, { backgroundColor: Colors.accentPurple + '20' }]}>
                  <Ionicons name="mail-outline" size={scale(22)} color={Colors.accentPurple} />
                </View>
                <View style={modalStyles.optionInfo}>
                  <Text style={modalStyles.optionTitle}>Email</Text>
                  <Text style={modalStyles.optionSub}>{lead.user.email}</Text>
                </View>
                <Ionicons name="chevron-forward" size={scale(18)} color={Colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity style={modalStyles.closeBtn} onPress={onClose}>
            <Text style={modalStyles.closeText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  content: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: moderateScale(20),
    borderTopRightRadius: moderateScale(20),
    padding: moderateScale(20),
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: verticalScale(16),
  },
  title: {
    fontSize: moderateScale(18),
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  options: {
    gap: verticalScale(8),
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    padding: moderateScale(12),
    borderRadius: moderateScale(10),
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  iconWrap: {
    width: scale(40),
    height: scale(40),
    borderRadius: moderateScale(10),
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: scale(12),
  },
  optionInfo: {
    flex: 1,
  },
  optionTitle: {
    color: Colors.textPrimary,
    fontSize: moderateScale(14),
    fontWeight: '600',
  },
  optionSub: {
    color: Colors.textMuted,
    fontSize: moderateScale(12),
    marginTop: verticalScale(1),
  },
  closeBtn: {
    marginTop: verticalScale(16),
    paddingVertical: verticalScale(10),
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: Colors.cardBorder,
  },
  closeText: {
    color: Colors.textMuted,
    fontSize: moderateScale(14),
    fontWeight: '600',
  },
});

// --- Stats Row (Single horizontal line with fixed height) ---
const StatsRow: React.FC<{ stats: any }> = ({ stats }) => {
  const statsData = stats?.data || stats || {};
  const byStatus = statsData.byStatus || {};
  
  return (
    <View style={statsStyles.container}>
      <View style={statsStyles.item}>
        <Text style={statsStyles.number}>{statsData.total || 0}</Text>
        <Text style={statsStyles.label}>Total</Text>
      </View>
      <View style={statsStyles.divider} />
      <View style={statsStyles.item}>
        <Text style={[statsStyles.number, { color: Colors.accentBlue }]}>
          {byStatus.new || 0}
        </Text>
        <Text style={statsStyles.label}>New</Text>
      </View>
      <View style={statsStyles.divider} />
      <View style={statsStyles.item}>
        <Text style={[statsStyles.number, { color: Colors.accentPurple }]}>
          {byStatus.replied || 0}
        </Text>
        <Text style={statsStyles.label}>Replied</Text>
      </View>
      <View style={statsStyles.divider} />
      <View style={statsStyles.item}>
        <Text style={[statsStyles.number, { color: Colors.royalGreen }]}>
          {byStatus.converted || 0}
        </Text>
        <Text style={statsStyles.label}>Converted</Text>
      </View>
    </View>
  );
};

const statsStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: Colors.card,
    borderRadius: moderateScale(10),
    paddingVertical: verticalScale(6),
    marginBottom: verticalScale(8),
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    height: verticalScale(50),
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  number: {
    fontSize: moderateScale(15),
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  label: {
    fontSize: moderateScale(9),
    color: Colors.textMuted,
    marginTop: verticalScale(1),
    fontWeight: '500',
  },
  divider: {
    width: 1,
    backgroundColor: Colors.cardBorder,
    alignSelf: 'stretch',
  },
});

// --- Main Component ---
const VendorLeadsScreen = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigation = useNavigation();
  const { leads, loading, stats } = useSelector((state: RootState) => state.leads);
  const { vendor } = useSelector((state: RootState) => state.vendorAuth);

  const [refreshing, setRefreshing] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [showContact, setShowContact] = useState(false);
  
  const processedLeadIds = useRef<Set<string>>(new Set());
  const viewProcessedIds = useRef<Set<string>>(new Set());
  const isMounted = useRef<boolean>(true);
  const isInitialLoad = useRef<boolean>(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      processedLeadIds.current.clear();
      viewProcessedIds.current.clear();
    };
  }, []);

  useEffect(() => {
    console.log(`📊 [Redux] Leads updated: ${leads.length} items`);
    console.log(`📊 [Redux] Leads stats:`, stats);
  }, [leads, stats]);

  const forceRefresh = useCallback(async () => {
    console.log('🔄 [Force Refresh] Clearing cache and fetching fresh leads...');
    setRefreshing(true);
    dispatch(clearLeads());
    processedLeadIds.current.clear();
    viewProcessedIds.current.clear();
    dispatch(unlockStats());
    await Promise.all([
      dispatch(fetchVendorLeads({})),
      dispatch(fetchVendorStats()),
    ]);
    console.log('✅ [Force Refresh] Complete');
    setRefreshing(false);
  }, [dispatch]);

  // Real-time socket listener
  useEffect(() => {
    const handleNewLead = (newLead: any) => {
      if (!isMounted.current) return;
      
      console.log('🔔 [Socket] New lead received:', newLead);
      
      const leadId = newLead._id || `lead_${Date.now()}`;
      if (processedLeadIds.current.has(leadId)) {
        console.log('⏭️ [Socket] Lead already processed, skipping');
        return;
      }
      
      processedLeadIds.current.add(leadId);
      
      const lead: Lead = {
        _id: leadId,
        vendor: newLead.vendor || newLead.vendorId || '',
        user: newLead.user || { 
          _id: newLead.userId || 'unknown', 
          name: newLead.userName || 'Someone',
          phone: newLead.userPhone || '',
          email: newLead.userEmail || '',
        },
        message: newLead.message || 'New enquiry',
        type: newLead.type || 'view',
        status: newLead.status || 'new',
        viewedAt: newLead.viewedAt || null,
        createdAt: newLead.createdAt || new Date().toISOString(),
        updatedAt: newLead.updatedAt || new Date().toISOString(),
      };
      
      dispatch(addLead(lead));
      dispatch(fetchVendorStats());
      
      const typeLabels: Record<string, string> = {
        view: '👀 New View',
        call: '📞 New Call',
        whatsapp: '💬 New WhatsApp',
        email: '✉️ New Email',
        quote: '📝 New Quote',
      };
      
      Toast.show({
        type: 'info',
        text1: typeLabels[lead.type] || 'New Lead',
        text2: `${lead.user?.name || 'Someone'} ${lead.type === 'view' ? 'viewed your shop' : 'sent an enquiry'}`,
        visibilityTime: 3000,
        position: 'top',
        topOffset: 60,
      });
    };

    socket.on('newLead', handleNewLead);

    socket.on('newView', (newView: any) => {
      if (!isMounted.current) return;
      
      console.log('👀 [Socket] New view received:', newView);
      
      const viewId = newView._id || `view_${Date.now()}`;
      if (viewProcessedIds.current.has(viewId)) {
        console.log('⏭️ [Socket] View already processed, skipping');
        return;
      }
      
      viewProcessedIds.current.add(viewId);
      
      const viewLead: Lead = {
        _id: viewId,
        vendor: newView.vendorId || newView.vendor || '',
        type: 'view',
        status: newView.status || 'new',
        message: newView.message || `${newView.userName || 'Someone'} viewed your shop`,
        createdAt: newView.createdAt || new Date().toISOString(),
        updatedAt: newView.updatedAt || new Date().toISOString(),
        user: newView.user || { 
          _id: newView.userId || 'unknown', 
          name: newView.userName || 'Someone',
          phone: newView.userPhone || '',
          email: newView.userEmail || '',
        },
      };
      
      const exists = leads.some(l => l._id === viewLead._id);
      if (!exists) {
        dispatch(addLead(viewLead));
        dispatch(fetchVendorStats());
        
        Toast.show({
          type: 'info',
          text1: '👀 New View',
          text2: `${viewLead.user?.name || 'Someone'} viewed your shop`,
          visibilityTime: 3000,
          position: 'top',
          topOffset: 60,
        });
      }
    });

    return () => {
      socket.off('newLead', handleNewLead);
      socket.off('newView');
      processedLeadIds.current.clear();
      viewProcessedIds.current.clear();
    };
  }, [dispatch, leads]);

  // Fetch on mount and on focus
  useFocusEffect(
    useCallback(() => {
      if (vendor?._id && isMounted.current) {
        console.log('🔄 [Focus] Screen focused, fetching leads...');
        processedLeadIds.current.clear();
        viewProcessedIds.current.clear();
        dispatch(unlockStats());
        dispatch(fetchVendorLeads({}));
        dispatch(fetchVendorStats());
      }
      return () => {};
    }, [vendor?._id, dispatch])
  );

  // Initial fetch
  useEffect(() => {
    if (vendor?._id && isMounted.current && isInitialLoad.current) {
      isInitialLoad.current = false;
      console.log('🔄 [Mount] Initial fetch of leads...');
      dispatch(unlockStats());
      dispatch(fetchVendorLeads({}));
      dispatch(fetchVendorStats());
    }
    return () => {
      if (isMounted.current) {
        processedLeadIds.current.clear();
        viewProcessedIds.current.clear();
      }
    };
  }, [vendor?._id, dispatch]);

  const onRefresh = useCallback(async () => {
    console.log('🔄 [Refresh] Manual refresh triggered');
    setRefreshing(true);
    dispatch(clearLeads());
    processedLeadIds.current.clear();
    viewProcessedIds.current.clear();
    dispatch(unlockStats());
    await Promise.all([
      dispatch(fetchVendorLeads({})),
      dispatch(fetchVendorStats()),
    ]);
    console.log('✅ [Refresh] Refresh completed');
    setRefreshing(false);
  }, [dispatch]);

  const handleUpdateStatus = useCallback(async (leadId: string, status: string) => {
    console.log(`🔄 [Status] Updating lead ${leadId} to "${status}"`);
    try {
      await dispatch(updateLeadStatus({ leadId, status })).unwrap();
      dispatch(unlockStats());
      await dispatch(fetchVendorLeads({}));
      console.log(`✅ [Status] Lead ${leadId} updated successfully`);
    } catch (error: any) {
      console.error(`❌ [Status] Failed to update lead ${leadId}:`, error);
    }
  }, [dispatch]);

  const handleContact = useCallback((lead: Lead) => {
    console.log(`📞 [Contact] Opening contact for lead ${lead._id}`);
    setSelectedLead(lead);
    setShowContact(true);
  }, []);

  const handleCall = useCallback((phone: string) => {
    console.log(`📞 [Call] Dialing ${phone}`);
    Linking.openURL(`tel:${phone}`).catch(() => Alert.alert('Error', 'Unable to make call'));
    setShowContact(false);
  }, []);

  const handleWhatsApp = useCallback((phone: string, message: string) => {
    console.log(`💬 [WhatsApp] Opening WhatsApp for ${phone}`);
    Linking.openURL(`whatsapp://send?phone=${phone}&text=${encodeURIComponent(message)}`)
      .catch(() => Alert.alert('Error', 'WhatsApp not installed'));
    setShowContact(false);
  }, []);

  const handleEmail = useCallback((email: string) => {
    console.log(`✉️ [Email] Opening email for ${email}`);
    Linking.openURL(`mailto:${email}`).catch(() => Alert.alert('Error', 'Unable to open email'));
    setShowContact(false);
  }, []);

  // 🔥 Group leads by user ONLY (not by type) - Sorted by latest activity
  const groupedLeads = useMemo(() => {
    console.log('🔄 [Group] Grouping leads by user...');
    const groups = new Map();

    leads.forEach((lead) => {
      const userId = lead.user?._id || 'unknown';
      
      if (groups.has(userId)) {
        const group = groups.get(userId)!;
        group.count += 1;
        group.leads.push(lead);
        if (lead.type !== 'view') {
          group.hasNonView = true;
        }
        const leadDate = new Date(lead.createdAt);
        const currentLatest = new Date(group.latestTime || 0);
        if (leadDate > currentLatest) {
          group.latestTime = lead.createdAt;
          group.lastLead = lead;
        }
      } else {
        groups.set(userId, {
          userId: userId,
          userName: lead.user?.name || 'Unknown User',
          userPhone: lead.user?.phone || '',
          userEmail: lead.user?.email || '',
          count: 1,
          leads: [lead],
          lastLead: lead,
          latestTime: lead.createdAt,
          hasNonView: lead.type !== 'view',
        });
      }
    });

    const result = Array.from(groups.values()).sort((a, b) => {
      const dateA = new Date(a.latestTime || 0);
      const dateB = new Date(b.latestTime || 0);
      return dateB.getTime() - dateA.getTime();
    });
    
    console.log(`📊 [Group] Grouped ${leads.length} leads into ${result.length} user groups`);
    return result;
  }, [leads]);

  const filteredGroups = useMemo(() => {
    let filtered = groupedLeads;
    if (selectedStatus) {
      filtered = filtered.filter((g) => 
        g.leads.some((l: Lead) => l.status === selectedStatus)
      );
    }
    if (selectedType) {
      filtered = filtered.filter((g) => 
        g.leads.some((l: Lead) => l.type === selectedType)
      );
    }
    return filtered;
  }, [groupedLeads, selectedStatus, selectedType]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: leads.length };
    leads.forEach((l) => { counts[l.status] = (counts[l.status] || 0) + 1; });
    return counts;
  }, [leads]);

  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = { all: leads.length };
    leads.forEach((l) => { counts[l.type] = (counts[l.type] || 0) + 1; });
    return counts;
  }, [leads]);

  // Combined filter items - Status first, then Types (Views, Calls, WhatsApp)
  const filterItems = [
    { key: null, label: 'All', icon: 'grid-outline', type: 'status' as const },
    { key: 'new', label: 'New', icon: 'sparkles', type: 'status' as const },
    { key: 'seen', label: 'Seen', icon: 'eye-outline', type: 'status' as const },
    { key: 'replied', label: 'Replied', icon: 'chatbubble-outline', type: 'status' as const },
    { key: 'converted', label: 'Converted', icon: 'checkmark-circle', type: 'status' as const },
    { key: 'view', label: 'Views', icon: 'eye-outline', color: Colors.textMuted, type: 'type' as const },
    { key: 'call', label: 'Calls', icon: 'call-outline', color: Colors.accentBlue, type: 'type' as const },
    { key: 'whatsapp', label: 'WhatsApp', icon: 'logo-whatsapp', color: Colors.whatsappGreen, type: 'type' as const },
    { key: 'email', label: 'Emails', icon: 'mail-outline', color: Colors.accentPurple, type: 'type' as const },
    { key: 'quote', label: 'Quotes', icon: 'chatbubble-outline', color: Colors.gold, type: 'type' as const },
  ];

  if (!vendor?._id) {
    return (
      <View style={styles.center}>
        <Ionicons name="lock-closed-outline" size={scale(50)} color={Colors.textMuted} />
        <Text style={styles.centerText}>Please login as a vendor</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />
      
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={scale(24)} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Leads</Text>
          <TouchableOpacity style={styles.refreshBtn} onPress={forceRefresh}>
            <Ionicons name="refresh-outline" size={scale(22)} color={Colors.textPrimary} />
          </TouchableOpacity>
        </View>

        {/* Stats - Single horizontal line */}
        {stats && <StatsRow stats={stats} />}

        {/* Combined Filters */}
        <FilterChips
          items={filterItems}
          selectedStatus={selectedStatus}
          selectedType={selectedType}
          onSelectStatus={setSelectedStatus}
          onSelectType={setSelectedType}
          statusCounts={statusCounts}
          typeCounts={typeCounts}
        />

        {/* List */}
        {loading && !refreshing ? (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color={Colors.royalGreen} />
            <Text style={styles.loadingText}>Loading leads...</Text>
          </View>
        ) : filteredGroups.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="chatbubbles-outline" size={scale(60)} color={Colors.textMuted} />
            <Text style={styles.emptyTitle}>No Leads Yet</Text>
            <Text style={styles.emptySub}>
              {selectedStatus || selectedType 
                ? 'No leads match your filters' 
                : 'Customer enquiries will appear here'}
            </Text>
            {(selectedStatus || selectedType) && (
              <TouchableOpacity 
                style={styles.clearBtn}
                onPress={() => { setSelectedStatus(null); setSelectedType(null); }}
              >
                <Text style={styles.clearBtnText}>Clear Filters</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <FlatList
            data={filteredGroups}
            keyExtractor={(item) => item.userId}
            renderItem={({ item }) => (
              <GroupedLeadCard
                group={item}
                onUpdateStatus={handleUpdateStatus}
                onContact={handleContact}
              />
            )}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={Colors.royalGreen}
                colors={[Colors.royalGreen]}
              />
            }
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>

      <ContactModal
        visible={showContact}
        lead={selectedLead}
        onClose={() => setShowContact(false)}
        onCall={handleCall}
        onWhatsApp={handleWhatsApp}
        onEmail={handleEmail}
      />
      
      <Toast />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  container: {
    flex: 1,
    paddingHorizontal: moderateScale(14),
    paddingTop: verticalScale(8),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: verticalScale(8),
    marginBottom: verticalScale(4),
  },
  backBtn: {
    padding: scale(4),
  },
  headerTitle: {
    fontSize: moderateScale(20),
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: 0.5,
  },
  refreshBtn: {
    padding: scale(4),
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
    padding: scale(20),
  },
  centerText: {
    color: Colors.textMuted,
    fontSize: moderateScale(16),
    marginTop: verticalScale(12),
    textAlign: 'center',
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: Colors.textMuted,
    marginTop: verticalScale(8),
    fontSize: moderateScale(14),
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: scale(20),
    marginTop: verticalScale(40),
  },
  emptyTitle: {
    fontSize: moderateScale(18),
    fontWeight: '700',
    color: Colors.textPrimary,
    marginTop: verticalScale(12),
  },
  emptySub: {
    fontSize: moderateScale(14),
    color: Colors.textMuted,
    marginTop: verticalScale(4),
    textAlign: 'center',
  },
  clearBtn: {
    marginTop: verticalScale(16),
    paddingVertical: verticalScale(8),
    paddingHorizontal: scale(20),
    backgroundColor: 'rgba(37, 99, 235, 0.15)',
    borderRadius: moderateScale(8),
  },
  clearBtnText: {
    color: Colors.accentBlue,
    fontSize: moderateScale(14),
    fontWeight: '600',
  },
  listContent: {
    paddingBottom: verticalScale(20),
  },
});

export default VendorLeadsScreen;