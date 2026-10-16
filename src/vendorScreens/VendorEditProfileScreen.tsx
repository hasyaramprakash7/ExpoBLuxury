// src/vendorScreens/VendorEditProfileScreen.tsx
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
  KeyboardAvoidingView,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import Ionicons from '@expo/vector-icons/Ionicons';
import { RootState, AppDispatch } from '../app/store';
import {
  updateVendorProfile,
  fetchVendorProfile,
} from '../features/vendor/vendorAuthSlice';

const Colors = {
  background: '#FFFFFF',
  card: '#F8FAFC',
  cardBorder: '#E2E8F0',
  textPrimary: '#0A0A0A',
  textSecondary: '#475569',
  textMuted: '#94A3B8',
  royalGreen: '#1B8C40',
  gold: '#D4AF37',
};

export default function VendorEditProfileScreen() {
  const dispatch = useDispatch<AppDispatch>();
  const navigation = useNavigation<any>();

  const { vendor } = useSelector((s: RootState) => (s as any).vendorAuth);

  const [saving, setSaving] = useState(false);
  const [shopImageFile, setShopImageFile] =
    useState<ImagePicker.ImagePickerAsset | null>(null);

  const [shopName, setShopName] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [businessType, setBusinessType] = useState('');
  const [description, setDescription] = useState('');
  const [website, setWebsite] = useState('');
  const [username, setUsername] = useState('');
  const [gstNo, setGstNo] = useState('');

  useEffect(() => {
    if (!vendor) return;
    setShopName(vendor.shopName || '');
    setName(vendor.name || '');
    setEmail(vendor.email || '');
    setPhone(vendor.phone || '');
    setBusinessType(vendor.businessType || '');
    setDescription(
      (vendor as any).description ||
        (vendor as any).bio ||
        (vendor as any).about ||
        ''
    );
    setWebsite((vendor as any).website || (vendor as any).link || '');
    setUsername((vendor as any).username || '');
    setGstNo(vendor.gstNo || '');
  }, [vendor]);

  const pickShopImage = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Gallery permission is required.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.9,
    });
    if (!result.canceled && result.assets?.[0]) {
      setShopImageFile(result.assets[0]);
    }
  }, []);

  const handleSave = useCallback(async () => {
    if (!shopName.trim()) {
      Alert.alert('Validation', 'Shop name is required.');
      return;
    }
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('shopName', shopName.trim());
      fd.append('name', name.trim());
      fd.append('email', email.trim());
      fd.append('phone', phone.trim());
      fd.append('businessType', businessType.trim());
      fd.append('description', description.trim());
      fd.append('website', website.trim());
      fd.append('username', username.trim());
      fd.append('gstNo', gstNo.trim());

      if (shopImageFile) {
        const uriParts = shopImageFile.uri.split('.');
        const ext = uriParts[uriParts.length - 1];
        fd.append('shopImage', {
          uri: shopImageFile.uri,
          name: `shop_image_${Date.now()}.${ext}`,
          type: `image/${ext}`,
        } as any);
      }

      await dispatch(updateVendorProfile(fd)).unwrap();
      Alert.alert('Success', 'Vendor profile updated.');
      dispatch(fetchVendorProfile());
      navigation.goBack();
    } catch (e: any) {
      Alert.alert(
        'Update Failed',
        typeof e === 'string' ? e : e?.message || 'Could not update profile.'
      );
    } finally {
      setSaving(false);
    }
  }, [
    dispatch,
    navigation,
    shopName,
    name,
    email,
    phone,
    businessType,
    description,
    website,
    username,
    gstNo,
    shopImageFile,
  ]);

  const previewUri =
    shopImageFile?.uri ||
    vendor?.shopImage ||
    (vendor as any)?.avatar ||
    (vendor as any)?.logo ||
    '';

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.topBar}>
          <TouchableOpacity
            style={styles.topBarBtn}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="close" size={26} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.topBarTitle}>Edit Vendor Profile</Text>
          <TouchableOpacity
            style={styles.topBarBtn}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color={Colors.royalGreen} />
            ) : (
              <Text style={styles.topBarSave}>Save</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.contentContainer}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.avatarSection}>
            <TouchableOpacity onPress={pickShopImage} activeOpacity={0.85}>
              {previewUri ? (
                <Image source={{ uri: previewUri }} style={styles.avatarImage} />
              ) : (
                <View style={[styles.avatarImage, styles.avatarFallback]}>
                  <Text style={styles.avatarFallbackLetter}>
                    {(shopName || 'V').charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
              <View style={styles.cameraBadge}>
                <Ionicons name="camera" size={16} color="#FFFFFF" />
              </View>
            </TouchableOpacity>
            <Text style={styles.changePhotoText}>Change shop photo</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Shop</Text>

            <Text style={styles.label}>Shop name</Text>
            <TextInput
              style={styles.input}
              value={shopName}
              onChangeText={setShopName}
              placeholder="Enter shop name"
              placeholderTextColor={Colors.textMuted}
            />

            <Text style={styles.label}>Owner name</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Enter owner name"
              placeholderTextColor={Colors.textMuted}
            />

            <Text style={styles.label}>Business type</Text>
            <TextInput
              style={styles.input}
              value={businessType}
              onChangeText={setBusinessType}
              placeholder="e.g. Retail, Grocery, Electronics"
              placeholderTextColor={Colors.textMuted}
            />

            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, styles.inputMultiline]}
              value={description}
              onChangeText={setDescription}
              placeholder="Tell customers about your shop"
              placeholderTextColor={Colors.textMuted}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />

            <Text style={styles.label}>Website / link</Text>
            <TextInput
              style={styles.input}
              value={website}
              onChangeText={setWebsite}
              placeholder="https://example.com"
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="none"
            />

            <Text style={styles.label}>Username (handle)</Text>
            <TextInput
              style={styles.input}
              value={username}
              onChangeText={setUsername}
              placeholder="yourshop"
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="none"
            />
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Contact</Text>

            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={Colors.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <Text style={styles.label}>Phone</Text>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              placeholder="9876543210"
              placeholderTextColor={Colors.textMuted}
              keyboardType="phone-pad"
            />

            <Text style={styles.label}>GST number</Text>
            <TextInput
              style={styles.input}
              value={gstNo}
              onChangeText={setGstNo}
              placeholder="Optional"
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="characters"
            />
          </View>

          <TouchableOpacity
            style={styles.saveButton}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.85}
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
                <Text style={styles.saveButtonText}>Save changes</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.cardBorder,
  },
  topBarBtn: { padding: 6, minWidth: 44, alignItems: 'center' },
  topBarTitle: { fontSize: 17, fontWeight: '700', color: Colors.textPrimary },
  topBarSave: {
    color: Colors.royalGreen,
    fontSize: 16,
    fontWeight: '700',
  },
  contentContainer: { padding: 16, paddingBottom: 40, gap: 16 },
  avatarSection: { alignItems: 'center', marginBottom: 8 },
  avatarImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.card,
  },
  avatarFallback: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.royalGreen,
  },
  avatarFallbackLetter: {
    color: '#FFFFFF',
    fontSize: 36,
    fontWeight: '800',
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.royalGreen,
    borderWidth: 3,
    borderColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  changePhotoText: {
    marginTop: 8,
    fontSize: 13,
    color: Colors.royalGreen,
    fontWeight: '600',
  },
  card: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.textMuted,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginTop: 6,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: Colors.textPrimary,
  },
  inputMultiline: {
    minHeight: 90,
    paddingTop: 12,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.royalGreen,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 8,
    shadowColor: Colors.royalGreen,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 5,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});