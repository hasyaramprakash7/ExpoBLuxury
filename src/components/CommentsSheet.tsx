// components/CommentsSheet.tsx
import React, { useEffect, useState, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
  Alert,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { AdComment } from '../features/adSlice';

interface Props {
  visible: boolean;
  onClose: () => void;
  ad: any;
  currentUserId?: string;
  onSubmit: (text: string, parentId?: string) => void;
  onDelete: (commentId: string) => void;
  onToggleLike: (commentId: string) => void;
}

const EMPTY_COMMENTS: AdComment[] = [];

const formatCount = (n?: number) => {
  const v = n || 0;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return String(v);
};

const timeAgo = (iso: string) => {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
  return `${Math.floor(diff / 604800)}w`;
};

const CommentsSheet: React.FC<Props> = ({
  visible,
  onClose,
  ad,
  currentUserId,
  onSubmit,
  onDelete,
  onToggleLike,
}) => {
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState<AdComment | null>(null);
  const inputRef = useRef<TextInput>(null);

  const adId = ad?._id as string | undefined;

  const commentsMap = useSelector(
    (state: RootState) => state.ads.commentsByAd
  );
  const loading = useSelector(
    (state: RootState) => state.ads.commentsLoading
  );

  const comments = useMemo(() => {
    if (!adId) return EMPTY_COMMENTS;
    const list = commentsMap?.[adId];
    return Array.isArray(list) ? list : EMPTY_COMMENTS;
  }, [commentsMap, adId]);

  useEffect(() => {
    if (!visible) {
      setText('');
      setReplyTo(null);
    }
  }, [visible]);

  const handleSend = () => {
    const t = text.trim();
    if (!t) return;
    onSubmit(t, replyTo?._id);
    setText('');
    setReplyTo(null);
  };

  // Back button — cancel reply first, else close sheet
  const handleBack = () => {
    if (replyTo) {
      setReplyTo(null);
      return;
    }
    onClose();
  };

  // Bell — placeholder for future notifications hook
  const handleBell = () => {
    Alert.alert(
      'Notifications',
      'You will be notified about new comments on this ad.'
    );
  };

  const handleLongPress = (c: AdComment) => {
    const isMine =
      String(c.userId?._id || c.userId) === String(currentUserId);
    const options = isMine
      ? [
          { text: 'Cancel', style: 'cancel' as const },
          {
            text: 'Delete',
            style: 'destructive' as const,
            onPress: () => onDelete(c._id),
          },
        ]
      : [{ text: 'Cancel', style: 'cancel' as const }];
    Alert.alert('Comment', 'Choose an action', options as any);
  };

  const topLevel = useMemo(
    () => comments.filter((c) => !c.parentId),
    [comments]
  );

  const repliesByParent = useMemo(() => {
    const map: Record<string, AdComment[]> = {};
    comments
      .filter((c) => c.parentId)
      .forEach((c) => {
        const key = String(c.parentId);
        if (!map[key]) map[key] = [];
        map[key].push(c);
      });
    return map;
  }, [comments]);

  const renderComment = (item: AdComment, isReply = false) => {
    const liked = !!item.likedByMe;
    const isMine =
      String(item.userId?._id || item.userId) === String(currentUserId);

    return (
      <TouchableOpacity
        key={item._id}
        style={[styles.commentRow, isReply && styles.replyRow]}
        activeOpacity={0.9}
        onLongPress={() => handleLongPress(item)}
      >
        <View style={styles.avatar}>
          {item.userAvatar ? (
            <Image
              source={{ uri: item.userAvatar }}
              style={styles.avatarImg}
            />
          ) : (
            <Ionicons name="person" size={16} color="#FFFFFF" />
          )}
        </View>

        <View style={styles.commentBody}>
          <Text style={styles.commentText}>
            <Text style={styles.commentUser}>
              {item.userName || 'User'}{' '}
            </Text>
            {item.text}
          </Text>

          <View style={styles.commentMeta}>
            <Text style={styles.metaText}>
              {timeAgo(item.createdAt)}
            </Text>

            <TouchableOpacity
              onPress={() => {
                setReplyTo(item);
                inputRef.current?.focus();
              }}
            >
              <Text style={styles.metaText}>Reply</Text>
            </TouchableOpacity>

            {isMine ? (
              <TouchableOpacity onPress={() => onDelete(item._id)}>
                <Text style={styles.metaText}>Delete</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        <TouchableOpacity
          style={styles.likeBtn}
          onPress={() => onToggleLike(item._id)}
        >
          <Ionicons
            name={liked ? 'heart' : 'heart-outline'}
            size={16}
            color={liked ? '#FF3040' : '#888'}
          />
          {item.likesCount > 0 ? (
            <Text style={styles.likeCount}>
              {formatCount(item.likesCount)}
            </Text>
          ) : null}
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleBack}
    >
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} onPress={onClose} />

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.sheet}
        >
          <View style={styles.handle} />

          {/* ── Header with back + title + bell ── */}
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.headerIconBtn}
              onPress={handleBack}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
            </TouchableOpacity>

            <Text style={styles.headerTitle} numberOfLines={1}>
              Comments {ad?.commentsCount ? `(${ad.commentsCount})` : ''}
            </Text>

            <TouchableOpacity
              style={styles.headerIconBtn}
              onPress={handleBell}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="notifications-outline" size={22} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {loading && comments.length === 0 ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator color="#FFFFFF" />
            </View>
          ) : (
            <FlatList
              data={topLevel}
              keyExtractor={(c) => c._id}
              contentContainerStyle={styles.listContent}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <>
                  {renderComment(item)}
                  {(repliesByParent[item._id] || []).map((r) =>
                    renderComment(r, true)
                  )}
                </>
              )}
              ListEmptyComponent={
                <View style={styles.emptyWrap}>
                  <Ionicons
                    name="chatbubble-outline"
                    size={40}
                    color="#666"
                  />
                  <Text style={styles.emptyText}>
                    No comments yet — be the first.
                  </Text>
                </View>
              }
            />
          )}

          {replyTo ? (
            <View style={styles.replyBanner}>
              <Text style={styles.replyText} numberOfLines={1}>
                Replying to {replyTo.userName}
              </Text>
              <TouchableOpacity onPress={() => setReplyTo(null)}>
                <Ionicons name="close" size={16} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          ) : null}

          <View style={styles.inputRow}>
            <View style={styles.inputAvatar}>
              <Ionicons name="person" size={16} color="#FFFFFF" />
            </View>

            <TextInput
              ref={inputRef}
              style={styles.input}
              placeholder="Add a comment..."
              placeholderTextColor="#888"
              value={text}
              onChangeText={setText}
              multiline
              maxLength={1000}
            />

            <TouchableOpacity
              onPress={handleSend}
              disabled={!text.trim()}
              style={[
                styles.sendBtn,
                !text.trim() && styles.sendBtnDisabled,
              ]}
            >
              <Ionicons
                name="send"
                size={18}
                color={text.trim() ? '#0095F6' : '#555'}
              />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    backgroundColor: '#121212',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    maxHeight: '80%',
    minHeight: '55%',
    paddingBottom: Platform.OS === 'ios' ? 24 : 8,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#444',
    marginTop: 8,
    marginBottom: 6,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#2A2A2A',
  },
  headerIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
    marginHorizontal: 8,
  },
  loadingWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: { paddingVertical: 8, paddingHorizontal: 8 },
  commentRow: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingVertical: 10,
  },
  replyRow: { paddingLeft: 46 },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    overflow: 'hidden',
  },
  avatarImg: { width: '100%', height: '100%' },
  commentBody: { flex: 1 },
  commentText: { color: '#FFFFFF', fontSize: 14, lineHeight: 20 },
  commentUser: { fontWeight: '700' },
  commentMeta: { flexDirection: 'row', gap: 14, marginTop: 4 },
  metaText: { color: '#888', fontSize: 12, fontWeight: '600' },
  likeBtn: { alignItems: 'center', paddingLeft: 10 },
  likeCount: { color: '#888', fontSize: 10, marginTop: 2 },
  emptyWrap: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: { color: '#888', fontSize: 13, marginTop: 12 },
  replyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#1A1A1A',
  },
  replyText: { color: '#CCC', fontSize: 12, flex: 1, marginRight: 8 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#2A2A2A',
    backgroundColor: '#121212',
  },
  inputAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  input: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 14,
    backgroundColor: '#1E1E1E',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 20 : 28,
    maxHeight: 100,
  },
  sendBtn: { padding: 8 },
  sendBtnDisabled: { opacity: 0.6 },
});

export default CommentsSheet;