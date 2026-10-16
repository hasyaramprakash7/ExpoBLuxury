// src/screens/VideoSettingsScreen.tsx
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';

import {
  loadSettings,
  savePreloadEnabled,
  saveReducedData,
  saveWifiOnlyPreload,
  saveQuality,
  clearPreloadCache,
  getCacheStats,
  VideoQuality,
} from '../utils/preloadManager';

const Royal = {
  pureBlack: '#000000',
  pureWhite: '#FFFFFF',
  offWhite: '#F4F4F6',
  textSecondary: 'rgba(11,11,15,0.55)',
  borderLight: 'rgba(0,0,0,0.08)',
  blueAccent: '#0095F6',
  greenAccent: '#00C853',
};

const VideoSettingsScreen: React.FC = () => {
  const navigation = useNavigation<any>();

  const [preloadEnabled, setPreloadEnabled] = useState(true);
  const [reducedData, setReducedData] = useState(false);
  const [wifiOnly, setWifiOnly] = useState(true);
  const [quality, setQuality] = useState<VideoQuality>('auto');
  const [cacheSize, setCacheSize] = useState(0);

  useEffect(() => {
    (async () => {
      await loadSettings();
      const stats = getCacheStats();
      setCacheSize(stats.size);
    })();
  }, []);

  const handleTogglePreload = async (value: boolean) => {
    setPreloadEnabled(value);
    await savePreloadEnabled(value);
  };

  const handleToggleReducedData = async (value: boolean) => {
    setReducedData(value);
    await saveReducedData(value);
  };

  const handleToggleWifiOnly = async (value: boolean) => {
    setWifiOnly(value);
    await saveWifiOnlyPreload(value);
  };

  const handleQualityChange = async (q: VideoQuality) => {
    setQuality(q);
    await saveQuality(q);
  };

  const handleClearCache = () => {
    clearPreloadCache();
    setCacheSize(0);
  };

  const Row = ({
    icon,
    title,
    subtitle,
    right,
    onPress,
  }: {
    icon: string;
    title: string;
    subtitle?: string;
    right?: React.ReactNode;
    onPress?: () => void;
  }) => (
    <TouchableOpacity
      style={styles.row}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      disabled={!onPress}
    >
      <View style={styles.rowIconWrap}>
        <Ionicons name={icon as any} size={20} color={Royal.pureBlack} />
      </View>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{title}</Text>
        {subtitle ? <Text style={styles.rowSubtitle}>{subtitle}</Text> : null}
      </View>
      {right}
    </TouchableOpacity>
  );

  const QualityOption = ({
    value,
    label,
    subtitle,
  }: {
    value: VideoQuality;
    label: string;
    subtitle: string;
  }) => {
    const selected = quality === value;
    return (
      <TouchableOpacity
        style={[styles.qualityCard, selected && styles.qualityCardActive]}
        onPress={() => handleQualityChange(value)}
        activeOpacity={0.7}
      >
        <View style={{ flex: 1 }}>
          <Text
            style={[
              styles.qualityLabel,
              selected && styles.qualityLabelActive,
            ]}
          >
            {label}
          </Text>
          <Text style={styles.qualitySubtitle}>{subtitle}</Text>
        </View>
        {selected ? (
          <Ionicons name="checkmark-circle" size={24} color={Royal.blueAccent} />
        ) : (
          <View style={styles.radioEmpty} />
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={Royal.pureWhite} />

      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={26} color={Royal.pureBlack} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Video & Data</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionTitle}>STREAMING QUALITY</Text>
        <View style={styles.qualityContainer}>
          <QualityOption
            value="auto"
            label="Auto"
            subtitle="Adjust quality based on network speed (recommended)"
          />
          <QualityOption
            value="hd"
            label="HD (720p)"
            subtitle="Highest quality, uses more data"
          />
          <QualityOption
            value="sd"
            label="SD (480p)"
            subtitle="Balanced quality, saves data"
          />
          <QualityOption
            value="low"
            label="Low (360p)"
            subtitle="Lowest quality, minimum data usage"
          />
        </View>

        <Text style={styles.sectionTitle}>DATA SAVER</Text>
        <View style={styles.card}>
          <Row
            icon="wifi-outline"
            title="Preload videos"
            subtitle="Load next videos ahead for instant playback"
            right={
              <Switch
                value={preloadEnabled}
                onValueChange={handleTogglePreload}
                trackColor={{ true: Royal.greenAccent, false: '#ccc' }}
              />
            }
          />
          <View style={styles.divider} />
          <Row
            icon="cellular-outline"
            title="Preload on Wi-Fi only"
            subtitle="Save mobile data"
            right={
              <Switch
                value={wifiOnly}
                onValueChange={handleToggleWifiOnly}
                trackColor={{ true: Royal.greenAccent, false: '#ccc' }}
              />
            }
          />
          <View style={styles.divider} />
          <Row
            icon="leaf-outline"
            title="Reduce data usage"
            subtitle="Lower video quality on mobile networks"
            right={
              <Switch
                value={reducedData}
                onValueChange={handleToggleReducedData}
                trackColor={{ true: Royal.greenAccent, false: '#ccc' }}
              />
            }
          />
        </View>

        <Text style={styles.sectionTitle}>CACHE</Text>
        <View style={styles.card}>
          <Row
            icon="trash-outline"
            title="Clear video cache"
            subtitle={`${cacheSize} video${cacheSize === 1 ? '' : 's'} cached`}
            right={
              <Ionicons
                name="chevron-forward"
                size={20}
                color={Royal.textSecondary}
              />
            }
            onPress={handleClearCache}
          />
        </View>

        <View style={styles.infoCard}>
          <Ionicons
            name="information-circle"
            size={20}
            color={Royal.blueAccent}
          />
          <Text style={styles.infoText}>
            Auto quality adjusts based on your network. When reduced data is on,
            videos play at lower quality to save mobile data.
          </Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Royal.pureWhite },
  container: { flex: 1, backgroundColor: Royal.pureWhite },
  content: { paddingHorizontal: 16, paddingTop: 16 },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Royal.borderLight,
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  topBarTitle: { fontSize: 17, fontWeight: '700', color: Royal.pureBlack },

  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: Royal.textSecondary,
    letterSpacing: 0.6,
    marginTop: 20,
    marginBottom: 8,
    paddingHorizontal: 4,
  },

  card: {
    backgroundColor: Royal.offWhite,
    borderRadius: 12,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 12,
  },
  rowIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Royal.pureWhite,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rowText: { flex: 1 },
  rowTitle: { fontSize: 15, fontWeight: '600', color: Royal.pureBlack },
  rowSubtitle: { fontSize: 12, color: Royal.textSecondary, marginTop: 2 },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Royal.borderLight,
    marginLeft: 58,
  },

  qualityContainer: { gap: 8 },
  qualityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: Royal.offWhite,
    gap: 12,
  },
  qualityCardActive: {
    backgroundColor: 'rgba(0,149,246,0.08)',
    borderWidth: 1,
    borderColor: Royal.blueAccent,
  },
  qualityLabel: { fontSize: 15, fontWeight: '600', color: Royal.pureBlack },
  qualityLabelActive: { color: Royal.blueAccent },
  qualitySubtitle: { fontSize: 12, color: Royal.textSecondary, marginTop: 2 },
  radioEmpty: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: Royal.borderLight,
  },

  infoCard: {
    flexDirection: 'row',
    gap: 10,
    padding: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(0,149,246,0.06)',
    marginTop: 24,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: Royal.textSecondary,
    lineHeight: 18,
  },
});

export default VideoSettingsScreen;