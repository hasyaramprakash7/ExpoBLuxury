// src/screens/EditProfileScreen.tsx
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
  KeyboardAvoidingView,
  StatusBar,
  Switch,
  Modal,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image as ExpoImage } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';

import { AppDispatch, RootState } from '../store';
import {
  updateProfileStats,
  fetchUserProfile,
  selectUserProfile,
} from '../features/adSlice';
import {
  updateUserProfile as updateAuthUser,
  fetchUserProfile as fetchAuthUserProfile,
} from '../features/user/authSlice';
import {
  updateVendorProfile as updateAuthVendor,
  fetchVendorProfile as fetchAuthVendorProfile,
  fetchVendorStats,
} from '../features/vendor/vendorAuthSlice';
import api from '../userScreens/utils/api';

const Royal = {
  pureBlack: '#000000',
  pureWhite: '#FFFFFF',
  offWhite: '#F4F4F6',
  softWhite: '#F2F2F7',
  textPrimary: '#0B0B0F',
  textSecondary: 'rgba(11,11,15,0.55)',
  textTertiary: 'rgba(11,11,15,0.40)',
  borderLight: 'rgba(0,0,0,0.08)',
  borderMedium: 'rgba(0,0,0,0.15)',
  shadow: 'rgba(0,0,0,0.10)',
  redAlert: '#FF3040',
  blueAccent: '#0095F6',
  greenAccent: '#00C853',
  vendorPurple: '#6C63FF',
};

// ✅ Prefer a remote URL over any local file:// path
const pickBestAvatar = (...candidates: any[]): string => {
  let fallback = '';
  for (const c of candidates) {
    if (typeof c !== 'string' || !c.trim()) continue;
    const s = c.trim();
    if (/^https?:\/\//i.test(s)) return s;
    if (!fallback) fallback = s;
  }
  return fallback;
};

const URL_PATTERN =
  /(https?:\/\/[^\s]+|www\.[^\s]+|[a-zA-Z0-9-]+\.(?:com|org|net|io|co|in|app|dev|me|tech|site|xyz|store|shop|link|ai|us|uk|info|biz|online|cloud|live)(?:\/[^\s]*)?)/gi;

const normalizeUrl = (raw: string): string => {
  if (!raw) return '';
  return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
};

const openExternalUrl = async (raw: string) => {
  const url = normalizeUrl(raw);
  if (!url) return;
  try {
    const ok = await Linking.canOpenURL(url);
    if (ok) await Linking.openURL(url);
    else Alert.alert('Invalid Link', `Cannot open:\n${url}`);
  } catch {
    Alert.alert('Error', 'Could not open this link.');
  }
};

const LinkifiedText: React.FC<{
  text: string;
  style?: any;
  linkStyle?: any;
  numberOfLines?: number;
}> = ({ text, style, linkStyle, numberOfLines }) => {
  if (!text || !text.trim()) return null;

  const segments: { value: string; isLink: boolean }[] = [];
  const regex = new RegExp(URL_PATTERN.source, 'gi');
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ value: text.slice(lastIndex, match.index), isLink: false });
    }
    segments.push({ value: match[0], isLink: true });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    segments.push({ value: text.slice(lastIndex), isLink: false });
  }

  return (
    <Text style={style} numberOfLines={numberOfLines}>
      {segments.map((seg, i) =>
        seg.isLink ? (
          <Text
            key={`l-${i}`}
            style={[style, linkStyle]}
            onPress={() => openExternalUrl(seg.value)}
            suppressHighlighting={false}
          >
            {seg.value}
          </Text>
        ) : (
          <Text key={`t-${i}`}>{seg.value}</Text>
        )
      )}
    </Text>
  );
};

const EditProfileScreen: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigation = useNavigation<any>();

  // ═════════════════════════════════════════════════════════
  // ROLE DETECTION
  // ═════════════════════════════════════════════════════════
  const activeRole = useSelector((s: RootState) => s.session.activeRole);
  const isVendorRole = activeRole === 'vendor';

  // User sources
  const authUser = useSelector((state: RootState) => state.auth.user);
  const userId = (authUser as any)?._id || (authUser as any)?.id || '';
  const userStats = useSelector(selectUserProfile);

  // Vendor sources
  const authVendor = useSelector((s: RootState) => (s as any).vendorAuth?.vendor);
  const vendorId =
    (authVendor as any)?._id ||
    (authVendor as any)?.id ||
    (authVendor as any)?.vendorId ||
    '';

  // ✅ Unified identity
  const identityId = isVendorRole ? vendorId : userId;
  const identityType: 'User' | 'Vendor' = isVendorRole ? 'Vendor' : 'User';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [showImagePicker, setShowImagePicker] = useState(false);

  const [name, setName] = useState('');
  const [shopName, setShopName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [website, setWebsite] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [isBusiness, setIsBusiness] = useState(false);
  const [category, setCategory] = useState('');
  const [avatar, setAvatar] = useState('');
  const [address, setAddress] = useState<string>('');

  const [original, setOriginal] = useState<any>({});

  // ═════════════════════════════════════════════════════════
  // INITIAL LOAD — role-aware
  // ═════════════════════════════════════════════════════════
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        if (isVendorRole) {
          await loadVendorForm();
        } else {
          await loadUserForm();
        }
      } catch (e) {
        console.warn('EditProfile init failed:', e);
        if (isVendorRole) fallbackFromVendor();
        else fallbackFromAuth();
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVendorRole, identityId]);

  // ── USER LOAD ──
  const loadUserForm = async () => {
    if (!userId) {
      fallbackFromAuth();
      return;
    }
    const result = await dispatch(fetchUserProfile(userId)).unwrap();
    const profile = (result as any)?.profile;
    if (!profile) {
      fallbackFromAuth();
      return;
    }
    const p = {
      name: profile.name || authUser?.name || '',
      shopName: '',
      username: profile.username || (authUser as any)?.username || '',
      bio: profile.bio || '',
      website: profile.website || '',
      phone: profile.phone || authUser?.phone || '',
      email: profile.email || authUser?.email || '',
      isPrivate: !!profile.isPrivate,
      isBusiness: !!profile.isBusiness,
      category: profile.category || '',
      avatar: pickBestAvatar(
        profile.avatar,
        profile.user?.avatar,
        (profile as any).userAvatar,
        authUser?.profilePic,
        (authUser as any)?.avatar
      ),
      address: '',
    };
    applyForm(p);
    setOriginal(p);
  };

  // ── VENDOR LOAD ──
  const loadVendorForm = async () => {
    // Prefer fetching vendor stats from adSlice (has avatar/bio/etc.)
    // AND fetch the fresh vendor document from /vendors/profile
    let vendorDoc: any = authVendor || null;
    try {
      const res = await api.get('/vendors/profile');
      const data = res?.data?.vendor || res?.data?.data || res?.data || null;
      if (data && typeof data === 'object') vendorDoc = data;
    } catch {
      // non-fatal — fall back to authVendor
    }

    // Also try to pull stats from adSlice for this vendor
    let stats: any = null;
    try {
      const result = await dispatch(fetchUserProfile(vendorId)).unwrap();
      stats = (result as any)?.profile || null;
    } catch {
      stats = null;
    }

    if (!vendorDoc && !stats) {
      fallbackFromVendor();
      return;
    }

    const p = {
      name:
        vendorDoc?.ownerName ||
        vendorDoc?.name ||
        stats?.name ||
        authVendor?.name ||
        '',
      shopName:
        vendorDoc?.shopName ||
        stats?.shopName ||
        authVendor?.shopName ||
        '',
      username:
        vendorDoc?.username ||
        stats?.username ||
        authVendor?.username ||
        '',
      bio:
        vendorDoc?.description ||
        vendorDoc?.bio ||
        vendorDoc?.about ||
        stats?.bio ||
        '',
      website:
        vendorDoc?.website ||
        vendorDoc?.link ||
        stats?.website ||
        '',
      phone:
        vendorDoc?.phone ||
        stats?.phone ||
        authVendor?.phone ||
        '',
      email:
        vendorDoc?.email ||
        stats?.email ||
        authVendor?.email ||
        '',
      isPrivate: !!stats?.isPrivate,
      isBusiness: true, // vendors are always business
      category:
        vendorDoc?.businessType ||
        vendorDoc?.category ||
        stats?.category ||
        stats?.businessType ||
        '',
      avatar: pickBestAvatar(
        vendorDoc?.avatar,
        vendorDoc?.logo,
        vendorDoc?.shopImage,
        vendorDoc?.profilePic,
        vendorDoc?.profileImage,
        stats?.avatar,
        stats?.logo,
        stats?.shopImage
      ),
      address: buildAddressString(vendorDoc?.address),
    };

    applyForm(p);
    setOriginal(p);
  };

  const fallbackFromAuth = () => {
    const p = {
      name: authUser?.name || '',
      shopName: '',
      username: (authUser as any)?.username || '',
      bio: '',
      website: '',
      phone: authUser?.phone || '',
      email: authUser?.email || '',
      isPrivate: false,
      isBusiness: false,
      category: '',
      avatar: pickBestAvatar(
        authUser?.profilePic,
        (authUser as any)?.avatar
      ),
      address: '',
    };
    applyForm(p);
    setOriginal(p);
  };

  const fallbackFromVendor = () => {
    const v: any = authVendor || {};
    const p = {
      name: v?.ownerName || v?.name || '',
      shopName: v?.shopName || '',
      username: v?.username || '',
      bio: v?.description || v?.bio || v?.about || '',
      website: v?.website || v?.link || '',
      phone: v?.phone || '',
      email: v?.email || '',
      isPrivate: false,
      isBusiness: true,
      category: v?.businessType || v?.category || '',
      avatar: pickBestAvatar(
        v?.avatar,
        v?.logo,
        v?.shopImage,
        v?.profilePic,
        v?.profileImage
      ),
      address: buildAddressString(v?.address),
    };
    applyForm(p);
    setOriginal(p);
  };

  const buildAddressString = (addr: any): string => {
    if (!addr) return '';
    if (typeof addr === 'string') return addr;
    return [
      addr.street,
      addr.locality,
      addr.city,
      addr.district,
      addr.state,
      addr.pincode,
      addr.country,
    ]
      .filter(Boolean)
      .join(', ');
  };

  const applyForm = (p: any) => {
    setName(p.name);
    setShopName(p.shopName);
    setUsername(p.username);
    setBio(p.bio);
    setWebsite(p.website);
    setPhone(p.phone);
    setEmail(p.email);
    setIsPrivate(p.isPrivate);
    setIsBusiness(p.isBusiness);
    setCategory(p.category);
    setAvatar(p.avatar);
    setAddress(p.address || '');
  };

  const hasChanges =
    name !== original.name ||
    shopName !== original.shopName ||
    username !== original.username ||
    bio !== original.bio ||
    website !== original.website ||
    phone !== original.phone ||
    email !== original.email ||
    isPrivate !== original.isPrivate ||
    isBusiness !== original.isBusiness ||
    category !== original.category ||
    avatar !== original.avatar ||
    address !== (original.address || '');

  // ═════════════════════════════════════════════════════════
  // PICK AVATAR
  // ═════════════════════════════════════════════════════════
  const pickAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Please allow access to your photos.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0]) {
      setShowImagePicker(false);
      await uploadAvatar(result.assets[0].uri);
    }
  };

  const takeAvatar = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Please allow access to your camera.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0]) {
      setShowImagePicker(false);
      await uploadAvatar(result.assets[0].uri);
    }
  };

  // ═════════════════════════════════════════════════════════
  // UPLOAD AVATAR — role-aware
  // ═════════════════════════════════════════════════════════
  const uploadAvatar = async (uri: string) => {
    setAvatarUploading(true);
    try {
      const filename = uri.split('/').pop() || 'avatar.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const ext = match ? match[1].toLowerCase() : 'jpg';
      const type =
        ext === 'png' ? 'image/png' :
        ext === 'gif' ? 'image/gif' :
        ext === 'webp' ? 'image/webp' :
        'image/jpeg';

      const formData = new FormData();
      // @ts-ignore
      formData.append('profilePic', { uri, name: filename, type });
      // Vendor also accepts 'logo' / 'shopImage' — send as avatar for consistency
      if (isVendorRole) {
        // @ts-ignore
        formData.append('avatar', { uri, name: filename, type });
      }

      // 1. Upload
      if (isVendorRole) {
        await dispatch(updateAuthVendor(formData as any)).unwrap();
      } else {
        await dispatch(updateAuthUser(formData as any)).unwrap();
      }

      // 2. Refetch to get the remote URL
      if (isVendorRole) {
        await dispatch(fetchAuthVendorProfile()).unwrap().catch(() => {});
      } else {
        await dispatch(fetchAuthUserProfile()).unwrap().catch(() => {});
      }
      const fresh = await dispatch(fetchUserProfile(identityId))
        .unwrap()
        .catch(() => null);

      const serverAvatar = pickBestAvatar(
        (fresh as any)?.profile?.avatar,
        (fresh as any)?.profile?.user?.avatar,
        (fresh as any)?.profile?.logo,
        (fresh as any)?.profile?.shopImage,
        isVendorRole
          ? (authVendor as any)?.avatar
          : (authUser as any)?.profilePic,
        uri // last-resort fallback only
      );

      setAvatar(serverAvatar);
      setOriginal((o: any) => ({ ...o, avatar: serverAvatar }));

      Alert.alert('Success', 'Profile photo updated!');
    } catch (e: any) {
      Alert.alert(
        'Error',
        e?.message || e?.response?.data?.message || 'Failed to upload avatar'
      );
    } finally {
      setAvatarUploading(false);
    }
  };

  // ═════════════════════════════════════════════════════════
  // SAVE PROFILE — role-aware
  // ═════════════════════════════════════════════════════════
  const handleSave = async () => {
    // Vendor requires shopName + name; user requires name
    if (isVendorRole) {
      if (!shopName.trim()) {
        Alert.alert('Error', 'Shop name is required');
        return;
      }
    } else {
      if (!name.trim()) {
        Alert.alert('Error', 'Name is required');
        return;
      }
    }

    setSaving(true);
    try {
      const formData = new FormData();

      if (isVendorRole) {
        formData.append('shopName', shopName.trim());
        formData.append('ownerName', name.trim());
        formData.append('name', name.trim());
      } else {
        formData.append('name', name.trim());
      }

      formData.append('username', username.trim().toLowerCase());
      formData.append('bio', bio.trim());
      formData.append('description', bio.trim());
      formData.append('website', website.trim());
      formData.append('phone', phone.trim());
      formData.append('email', email.trim());
      formData.append('isPrivate', String(isPrivate));
      formData.append('isBusiness', isVendorRole ? 'true' : String(isBusiness));
      formData.append('category', category.trim());
      formData.append('businessType', category.trim());
      if (address.trim()) {
        formData.append('address', JSON.stringify({ full: address.trim() }));
      }

      // Only attach a file if the user JUST picked a new local image
      const isLocalAvatar =
        avatar &&
        avatar !== original.avatar &&
        !/^https?:\/\//i.test(avatar);

      if (isLocalAvatar) {
        const filename = avatar.split('/').pop() || 'avatar.jpg';
        const match = /\.(\w+)$/.exec(filename);
        const ext = match ? match[1].toLowerCase() : 'jpg';
        const type =
          ext === 'png' ? 'image/png' :
          ext === 'gif' ? 'image/gif' :
          ext === 'webp' ? 'image/webp' :
          'image/jpeg';
        // @ts-ignore
        formData.append('profilePic', { uri: avatar, name: filename, type });
        if (isVendorRole) {
          // @ts-ignore
          formData.append('avatar', { uri: avatar, name: filename, type });
        }
      } else if (avatar && /^https?:\/\//i.test(avatar)) {
        formData.append('profilePic', avatar);
        if (isVendorRole) formData.append('avatar', avatar);
      }

      // 1. Update auth profile
      if (isVendorRole) {
        await dispatch(updateAuthVendor(formData as any)).unwrap();
      } else {
        await dispatch(updateAuthUser(formData as any)).unwrap();
      }

      // 2. Update stats — only send avatar if it's a remote URL
      const statsPayload: any = {
        name: isVendorRole ? shopName.trim() : name.trim(),
        shopName: isVendorRole ? shopName.trim() : undefined,
        username: username.trim().toLowerCase(),
        bio: bio.trim(),
        website: website.trim(),
        phone: phone.trim(),
        email: email.trim(),
        isPrivate: String(isPrivate),
        isBusiness: isVendorRole ? 'true' : String(isBusiness),
        category: category.trim(),
        businessType: category.trim(),
      };
      if (avatar && /^https?:\/\//i.test(avatar)) {
        statsPayload.avatar = avatar;
      }
      try {
        await dispatch(updateProfileStats(statsPayload)).unwrap();
      } catch {
        // non-fatal
      }

      // 3. Refetch both
      if (isVendorRole) {
        await dispatch(fetchAuthVendorProfile()).unwrap().catch(() => {});
        await dispatch(fetchVendorStats()).catch(() => {});
      } else {
        await dispatch(fetchAuthUserProfile()).unwrap().catch(() => {});
      }
      if (identityId) dispatch(fetchUserProfile(identityId));

      Alert.alert('Success', 'Profile updated successfully!', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => {
    if (!hasChanges) {
      navigation.goBack();
      return;
    }
    Alert.alert(
      'Discard changes?',
      'You have unsaved changes. Are you sure you want to discard them?',
      [
        { text: 'Keep editing', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () => {
            applyForm(original);
            navigation.goBack();
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <StatusBar barStyle="dark-content" backgroundColor={Royal.pureWhite} />
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.headerBtn}
          >
            <Ionicons name="close" size={26} color={Royal.pureBlack} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Profile</Text>
          <View style={styles.headerBtn} />
        </View>
        <View style={styles.loaderWrap}>
          <ActivityIndicator size="large" color={Royal.pureBlack} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={Royal.pureWhite} />

      <View style={styles.header}>
        <TouchableOpacity
          onPress={handleDiscard}
          style={styles.headerBtn}
          activeOpacity={0.7}
        >
          <Ionicons name="close" size={26} color={Royal.pureBlack} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {isVendorRole ? 'Edit Shop' : 'Edit Profile'}
        </Text>
        <TouchableOpacity
          onPress={handleSave}
          disabled={!hasChanges || saving}
          style={styles.headerBtn}
          activeOpacity={0.7}
        >
          {saving ? (
            <ActivityIndicator size="small" color={Royal.pureBlack} />
          ) : (
            <Text
              style={[
                styles.saveText,
                (!hasChanges || saving) && styles.saveTextDisabled,
              ]}
            >
              Save
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Role chip */}
          {isVendorRole ? (
            <View style={styles.roleChip}>
              <Ionicons name="storefront" size={12} color={Royal.pureWhite} />
              <Text style={styles.roleChipText}>SHOP ACCOUNT</Text>
            </View>
          ) : null}

          {/* Avatar */}
          <View style={styles.avatarSection}>
            <TouchableOpacity
              onPress={() => setShowImagePicker(true)}
              activeOpacity={0.8}
              disabled={avatarUploading}
            >
              <View style={styles.avatarWrap}>
                {avatar ? (
                  <ExpoImage
                    source={{ uri: avatar }}
                    style={styles.avatar}
                    contentFit="cover"
                    transition={150}
                  />
                ) : (
                  <View style={[styles.avatar, styles.avatarFallback]}>
                    <Text style={styles.avatarLetter}>
                      {((isVendorRole ? shopName : name) || 'U').charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
                {avatarUploading ? (
                  <View style={styles.avatarLoading}>
                    <ActivityIndicator size="small" color={Royal.pureWhite} />
                  </View>
                ) : null}
                <View style={styles.avatarEditBadge}>
                  <Ionicons name="camera" size={16} color={Royal.pureWhite} />
                </View>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setShowImagePicker(true)}
              activeOpacity={0.7}
            >
              <Text style={styles.changePhotoText}>
                {isVendorRole ? 'Change shop logo' : 'Change profile photo'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Shop Name (vendor only) */}
          {isVendorRole ? (
            <View style={styles.fieldWrap}>
              <Text style={styles.label}>Shop Name</Text>
              <TextInput
                style={styles.input}
                value={shopName}
                onChangeText={setShopName}
                placeholder="Your shop name"
                placeholderTextColor={Royal.textTertiary}
                maxLength={60}
                autoCapitalize="words"
              />
              <Text style={styles.helperText}>{shopName.length}/60</Text>
            </View>
          ) : null}

          {/* Owner Name / Name */}
          <View style={styles.fieldWrap}>
            <Text style={styles.label}>
              {isVendorRole ? 'Owner Name' : 'Name'}
            </Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder={isVendorRole ? 'Owner name' : 'Your name'}
              placeholderTextColor={Royal.textTertiary}
              maxLength={60}
              autoCapitalize="words"
            />
            <Text style={styles.helperText}>{name.length}/60</Text>
          </View>

          {/* Username */}
          <View style={styles.fieldWrap}>
            <Text style={styles.label}>Username</Text>
            <View style={styles.inputWithPrefix}>
              <Text style={styles.inputPrefix}>@</Text>
              <TextInput
                style={styles.inputInline}
                value={username}
                onChangeText={(t) =>
                  setUsername(t.replace(/[^a-z0-9._]/gi, '').toLowerCase())
                }
                placeholder="username"
                placeholderTextColor={Royal.textTertiary}
                maxLength={30}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
            <Text style={styles.helperText}>
              Letters, numbers, periods and underscores only.
            </Text>
          </View>

          {/* Bio */}
          <View style={styles.fieldWrap}>
            <Text style={styles.label}>
              {isVendorRole ? 'Shop Description' : 'Bio'}
            </Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={bio}
              onChangeText={setBio}
              placeholder={
                isVendorRole
                  ? 'Describe your shop, products, services... paste a link like google.com and it becomes tappable'
                  : 'Tell people about yourself... paste a link like google.com and it becomes tappable'
              }
              placeholderTextColor={Royal.textTertiary}
              maxLength={300}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Text style={styles.helperText}>
              {bio.length}/300 · links are auto-detected
            </Text>

            {bio.trim() ? (
              <View style={styles.previewCard}>
                <View style={styles.previewHeader}>
                  <Ionicons
                    name="eye-outline"
                    size={14}
                    color={Royal.textSecondary}
                  />
                  <Text style={styles.previewLabel}>Preview</Text>
                </View>
                <LinkifiedText
                  text={bio}
                  style={styles.previewText}
                  linkStyle={styles.previewLink}
                />
                <Text style={styles.previewHint}>
                  Tap a link above to test it in your browser.
                </Text>
              </View>
            ) : null}
          </View>

          {/* Website */}
          <View style={styles.fieldWrap}>
            <Text style={styles.label}>Website</Text>
            <TextInput
              style={styles.input}
              value={website}
              onChangeText={setWebsite}
              placeholder="https://example.com"
              placeholderTextColor={Royal.textTertiary}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              maxLength={200}
            />
            {website.trim() ? (
              <TouchableOpacity
                style={styles.websiteRow}
                onPress={() => openExternalUrl(website)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="link-outline"
                  size={14}
                  color={Royal.blueAccent}
                />
                <Text style={styles.websiteLink} numberOfLines={1}>
                  {website.replace(/^https?:\/\//i, '')}
                </Text>
                <Ionicons
                  name="open-outline"
                  size={14}
                  color={Royal.blueAccent}
                />
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Phone */}
          <View style={styles.fieldWrap}>
            <Text style={styles.label}>Phone</Text>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={(t) => setPhone(t.replace(/[^0-9+\-() ]/g, ''))}
              placeholder="+91 98765 43210"
              placeholderTextColor={Royal.textTertiary}
              keyboardType="phone-pad"
              maxLength={20}
            />
          </View>

          {/* Email */}
          <View style={styles.fieldWrap}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={Royal.textTertiary}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={100}
            />
          </View>

          {/* Address (vendor only) */}
          {isVendorRole ? (
            <View style={styles.fieldWrap}>
              <Text style={styles.label}>Shop Address</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={address}
                onChangeText={setAddress}
                placeholder="Street, city, state, pincode"
                placeholderTextColor={Royal.textTertiary}
                maxLength={250}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>
          ) : null}

          {/* Category (business / vendor) */}
          {(isBusiness || isVendorRole) ? (
            <View style={styles.fieldWrap}>
              <Text style={styles.label}>Business Category</Text>
              <TextInput
                style={styles.input}
                value={category}
                onChangeText={setCategory}
                placeholder="e.g. Fashion, Food, Electronics"
                placeholderTextColor={Royal.textTertiary}
                maxLength={50}
              />
            </View>
          ) : null}

          <View style={styles.switchBlock}>
            <View style={styles.switchRow}>
              <View style={styles.switchLabelWrap}>
                <Text style={styles.switchTitle}>Private account</Text>
                <Text style={styles.switchSubtitle}>
                  Only approved followers can see your posts
                </Text>
              </View>
              <Switch
                value={isPrivate}
                onValueChange={setIsPrivate}
                trackColor={{ false: Royal.borderLight, true: Royal.pureBlack }}
                thumbColor={Royal.pureWhite}
                ios_backgroundColor={Royal.borderLight}
              />
            </View>

            {/* Business toggle — vendor is always business */}
            {!isVendorRole ? (
              <>
                <View style={styles.divider} />
                <View style={styles.switchRow}>
                  <View style={styles.switchLabelWrap}>
                    <Text style={styles.switchTitle}>Business account</Text>
                    <Text style={styles.switchSubtitle}>
                      Show business info and analytics on your profile
                    </Text>
                  </View>
                  <Switch
                    value={isBusiness}
                    onValueChange={setIsBusiness}
                    trackColor={{ false: Royal.borderLight, true: Royal.pureBlack }}
                    thumbColor={Royal.pureWhite}
                    ios_backgroundColor={Royal.borderLight}
                  />
                </View>
              </>
            ) : null}
          </View>

          <TouchableOpacity
            style={styles.dangerRow}
            activeOpacity={0.7}
            onPress={() => {
              Alert.alert('Log Out', 'Are you sure you want to log out?', [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Log Out',
                  style: 'destructive',
                  onPress: () => {
                    navigation.goBack();
                  },
                },
              ]);
            }}
          >
            <Ionicons name="log-out-outline" size={22} color={Royal.redAlert} />
            <Text style={styles.dangerText}>Log Out</Text>
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        visible={showImagePicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowImagePicker(false)}
      >
        <TouchableOpacity
          style={styles.pickerOverlay}
          activeOpacity={1}
          onPress={() => setShowImagePicker(false)}
        >
          <View style={styles.pickerSheet}>
            <TouchableOpacity
              style={styles.pickerItem}
              onPress={takeAvatar}
              activeOpacity={0.7}
            >
              <Ionicons name="camera-outline" size={22} color={Royal.pureBlack} />
              <Text style={styles.pickerItemText}>Take Photo</Text>
            </TouchableOpacity>
            <View style={styles.pickerDivider} />
            <TouchableOpacity
              style={styles.pickerItem}
              onPress={pickAvatar}
              activeOpacity={0.7}
            >
              <Ionicons name="image-outline" size={22} color={Royal.pureBlack} />
              <Text style={styles.pickerItemText}>Choose from Library</Text>
            </TouchableOpacity>
            <View style={styles.pickerDivider} />
            <TouchableOpacity
              style={styles.pickerItem}
              onPress={() => setShowImagePicker(false)}
              activeOpacity={0.7}
            >
              <Ionicons name="close-outline" size={22} color={Royal.redAlert} />
              <Text style={[styles.pickerItemText, { color: Royal.redAlert }]}>
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Royal.pureWhite },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Royal.borderLight,
  },
  headerBtn: {
    width: 48,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    color: Royal.pureBlack,
    fontSize: 17,
    fontWeight: '700',
  },
  saveText: {
    color: Royal.blueAccent,
    fontSize: 15,
    fontWeight: '700',
  },
  saveTextDisabled: {
    color: Royal.textTertiary,
  },
  loaderWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  roleChip: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Royal.vendorPurple,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
    marginBottom: 16,
  },
  roleChipText: {
    color: Royal.pureWhite,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40 },

  avatarSection: {
    alignItems: 'center',
    marginBottom: 28,
  },
  avatarWrap: {
    width: 110,
    height: 110,
    borderRadius: 55,
    position: 'relative',
  },
  avatar: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: Royal.offWhite,
  },
  avatarFallback: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Royal.pureBlack,
  },
  avatarLetter: {
    color: Royal.pureWhite,
    fontSize: 42,
    fontWeight: '800',
  },
  avatarLoading: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 55,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Royal.blueAccent,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: Royal.pureWhite,
  },
  changePhotoText: {
    color: Royal.blueAccent,
    fontSize: 14,
    fontWeight: '700',
    marginTop: 12,
  },

  fieldWrap: { marginBottom: 20 },
  label: {
    color: Royal.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  input: {
    backgroundColor: Royal.offWhite,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: Royal.pureBlack,
    fontSize: 15,
    borderWidth: 1,
    borderColor: Royal.borderLight,
  },
  inputWithPrefix: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Royal.offWhite,
    borderRadius: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: Royal.borderLight,
  },
  inputPrefix: {
    color: Royal.textSecondary,
    fontSize: 15,
    fontWeight: '600',
    marginRight: 2,
  },
  inputInline: {
    flex: 1,
    color: Royal.pureBlack,
    fontSize: 15,
    paddingVertical: 12,
  },
  textArea: {
    minHeight: 100,
    paddingTop: 12,
  },
  helperText: {
    color: Royal.textTertiary,
    fontSize: 12,
    marginTop: 6,
    fontWeight: '500',
  },

  previewCard: {
    marginTop: 12,
    padding: 12,
    borderRadius: 10,
    backgroundColor: Royal.softWhite,
    borderWidth: 1,
    borderColor: Royal.borderLight,
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  previewLabel: {
    color: Royal.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  previewText: {
    color: Royal.textPrimary,
    fontSize: 14,
    lineHeight: 20,
  },
  previewLink: {
    color: Royal.blueAccent,
    textDecorationLine: 'underline',
    fontWeight: '600',
  },
  previewHint: {
    color: Royal.textTertiary,
    fontSize: 11,
    marginTop: 8,
    fontStyle: 'italic',
  },

  websiteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(0,149,246,0.08)',
    borderRadius: 8,
  },
  websiteLink: {
    flex: 1,
    color: Royal.blueAccent,
    fontSize: 14,
    fontWeight: '600',
  },

  switchBlock: {
    backgroundColor: Royal.offWhite,
    borderRadius: 12,
    paddingHorizontal: 14,
    marginTop: 4,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Royal.borderLight,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  switchLabelWrap: { flex: 1, marginRight: 12 },
  switchTitle: {
    color: Royal.pureBlack,
    fontSize: 15,
    fontWeight: '700',
  },
  switchSubtitle: {
    color: Royal.textSecondary,
    fontSize: 12,
    marginTop: 3,
    lineHeight: 16,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Royal.borderLight,
  },

  dangerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 16,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(255,48,64,0.06)',
    borderRadius: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,48,64,0.15)',
  },
  dangerText: {
    color: Royal.redAlert,
    fontSize: 15,
    fontWeight: '700',
  },

  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  pickerSheet: {
    backgroundColor: Royal.pureWhite,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: Platform.OS === 'ios' ? 30 : 12,
    paddingTop: 8,
  },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 22,
    paddingVertical: 16,
  },
  pickerItemText: {
    color: Royal.pureBlack,
    fontSize: 16,
    fontWeight: '600',
  },
  pickerDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Royal.borderLight,
    marginLeft: 22,
  },
});

export default EditProfileScreen;