// src/screens/LocalAIAgentScreen.tsx
import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  TextInput,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
  Alert,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import {
  AVAILABLE_MODELS,
  downloadModel,
  getDownloadedModels,
  loadModel,
  chatWithModel,
  unloadModel,
  deleteModel,
} from '../features/localAIService';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

type ScreenMode = 'models' | 'chat';
type DownloadedModel = { id: string; name: string; path: string };

const LocalAIAgentScreen = () => {
  const [mode, setMode] = useState<ScreenMode>('models');
  const [downloaded, setDownloaded] = useState<DownloadedModel[]>([]);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadPct, setDownloadPct] = useState(0);
  const [loadedModel, setLoadedModel] = useState<string | null>(null);
  const [loadingModel, setLoadingModel] = useState(false);

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [generating, setGenerating] = useState(false);
  const [streamingText, setStreamingText] = useState('');

  const flatListRef = useRef<FlatList<Message>>(null);

  const log = useCallback((tag: string, msg: string, data?: any) => {
    if (data !== undefined) {
      console.log(`[LocalAI:${tag}] ${msg}`, data);
    } else {
      console.log(`[LocalAI:${tag}] ${msg}`);
    }
  }, []);

  const refreshDownloaded = useCallback(async () => {
    log('refresh', 'Loading downloaded models...');
    const list = await getDownloadedModels();
    log('refresh', `Found ${list.length} model(s)`, list.map((m) => m.name));
    setDownloaded(list);
  }, [log]);

  useEffect(() => {
    refreshDownloaded();
    return () => {
      unloadModel();
    };
  }, [refreshDownloaded]);

  const handleDownload = useCallback(
    async (model: typeof AVAILABLE_MODELS[0]) => {
      log('download', `Starting download: ${model.name}`);
      setDownloadingId(model.id);
      setDownloadPct(0);
      try {
        const fileName = model.url.split('/').pop() || `${model.id}.gguf`;
        await downloadModel(model.url, fileName, (pct) => {
          setDownloadPct(pct);
        });
        log('download', `✅ Downloaded ${model.name}`);
        await refreshDownloaded();
      } catch (e: any) {
        log('download', `❌ Failed: ${e?.message}`);
        Alert.alert('Download failed', e?.message || 'Check your internet.');
      } finally {
        setDownloadingId(null);
        setDownloadPct(0);
      }
    },
    [refreshDownloaded, log]
  );

  const handleLoadModel = useCallback(
    async (model: DownloadedModel) => {
      log('load', `Loading: ${model.name}`);
      setLoadingModel(true);
      try {
        const ok = await loadModel(model.path);
        if (ok) {
          log('load', `✅ ${model.name} loaded`);
          setLoadedModel(model.name);
          setMode('chat');
          setMessages([
            {
              id: 'welcome',
              role: 'assistant',
              content: `Hi! I'm ${model.name}, running locally on your device. Ask me anything.`,
            },
          ]);
        } else {
          log('load', `❌ ${model.name} failed`);
          Alert.alert('Load failed', 'Could not load this model.');
        }
      } catch (e: any) {
        log('load', `❌ Error: ${e?.message}`);
        Alert.alert('Error', e?.message || 'Failed to load model.');
      } finally {
        setLoadingModel(false);
      }
    },
    [log]
  );

  const handleSend = useCallback(async () => {
    if (!input.trim() || generating) return;
    log('chat', `User: ${input.trim().slice(0, 60)}`);

    const userMsg: Message = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: input.trim(),
    };
    const history = [...messages, userMsg];
    setMessages(history);
    setInput('');
    setGenerating(true);
    setStreamingText('');

    try {
      const chatHistory = history.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

      const response = await chatWithModel(chatHistory, (token) => {
        setStreamingText((prev) => prev + token);
      });

      log('chat', `AI: ${response.slice(0, 80)}`);
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: 'assistant',
          content: response,
        },
      ]);
      setStreamingText('');
    } catch (e: any) {
      log('chat', `❌ Error: ${e?.message}`);
      Alert.alert('Error', e?.message || 'Generation failed.');
    } finally {
      setGenerating(false);
    }
  }, [input, generating, messages, log]);

  const handleDeleteModel = useCallback(
    (model: DownloadedModel) => {
      log('delete', `Delete request: ${model.name}`);
      Alert.alert('Delete', `Remove "${model.name}"?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteModel(model.path);
            log('delete', `✅ Deleted ${model.name}`);
            await refreshDownloaded();
          },
        },
      ]);
    },
    [refreshDownloaded, log]
  );

  if (mode === 'models') {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

        <View style={styles.header}>
          <Text style={styles.headerTitle}>Local AI</Text>
          <Text style={styles.headerSub}>
            Download a model to run AI on your phone — no internet needed
          </Text>
        </View>

        {downloaded.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>ON DEVICE</Text>
            {downloaded.map((m) => (
              <View key={m.id} style={styles.modelCard}>
                <View style={styles.modelIcon}>
                  <Ionicons name="checkmark-circle" size={24} color="#4ade80" />
                </View>
                <View style={styles.modelInfo}>
                  <Text style={styles.modelName}>{m.name}</Text>
                  <Text style={styles.modelSub}>Ready to use</Text>
                </View>
                <TouchableOpacity
                  style={styles.loadBtn}
                  onPress={() => handleLoadModel(m)}
                  disabled={loadingModel}
                >
                  {loadingModel ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.loadBtnText}>LOAD</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.deleteBtn}
                  onPress={() => handleDeleteModel(m)}
                >
                  <Ionicons name="trash-outline" size={20} color="#FF3B30" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>AVAILABLE MODELS</Text>
          <ScrollView showsVerticalScrollIndicator={false}>
            {AVAILABLE_MODELS.map((model) => {
              const isDownloading = downloadingId === model.id;
              const isDownloaded = downloaded.some((d) =>
                d.path.includes(model.id)
              );

              return (
                <View key={model.id} style={styles.modelCard}>
                  <View style={styles.modelIcon}>
                    <Ionicons name="cube-outline" size={24} color="#0A3D2B" />
                  </View>
                  <View style={styles.modelInfo}>
                    <Text style={styles.modelName}>{model.name}</Text>
                    <Text style={styles.modelSub}>{model.size}</Text>
                  </View>

                  {isDownloaded ? (
                    <View style={styles.doneBadge}>
                      <Ionicons name="checkmark" size={16} color="#4ade80" />
                      <Text style={styles.doneText}>Done</Text>
                    </View>
                  ) : isDownloading ? (
                    <View style={styles.progressWrap}>
                      <ActivityIndicator size="small" color="#0A3D2B" />
                      <Text style={styles.progressText}>
                        {Math.round(downloadPct * 100)}%
                      </Text>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={styles.downloadBtn}
                      onPress={() => handleDownload(model)}
                    >
                      <Ionicons
                        name="download-outline"
                        size={20}
                        color="#FFFFFF"
                      />
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </ScrollView>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      <View style={styles.chatHeader}>
        <TouchableOpacity onPress={() => setMode('models')} hitSlop={8}>
          <Ionicons name="arrow-back" size={24} color="#1C1C1E" />
        </TouchableOpacity>
        <View style={styles.chatHeaderInfo}>
          <Text style={styles.chatHeaderTitle}>{loadedModel}</Text>
          <Text style={styles.chatHeaderSub}>🔒 Running locally — offline</Text>
        </View>
        <View style={styles.offlineBadge}>
          <Ionicons name="wifi-outline" size={14} color="#4ade80" />
          <Text style={styles.offlineText}>Offline</Text>
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.chatBody}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.chatList}
          onContentSizeChange={() =>
            flatListRef.current?.scrollToEnd({ animated: true })
          }
          renderItem={({ item }) => (
            <View
              style={[
                styles.bubble,
                item.role === 'user' ? styles.bubbleUser : styles.bubbleAI,
              ]}
            >
              <Text
                style={[
                  styles.bubbleText,
                  item.role === 'user' && styles.bubbleTextUser,
                ]}
              >
                {item.content}
              </Text>
            </View>
          )}
          ListFooterComponent={
            generating && streamingText ? (
              <View style={[styles.bubble, styles.bubbleAI]}>
                <Text style={styles.bubbleText}>{streamingText}▌</Text>
              </View>
            ) : generating ? (
              <View style={[styles.bubble, styles.bubbleAI]}>
                <ActivityIndicator size="small" color="#0A3D2B" />
              </View>
            ) : null
          }
        />

        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            placeholder="Ask your local AI..."
            placeholderTextColor="#999"
            value={input}
            onChangeText={setInput}
            multiline
            editable={!generating}
          />
          <TouchableOpacity
            style={[
              styles.sendBtn,
              (!input.trim() || generating) && styles.sendBtnDisabled,
            ]}
            onPress={handleSend}
            disabled={!input.trim() || generating}
          >
            <Ionicons name="arrow-up" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },

  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1C1C1E',
  },
  headerSub: {
    fontSize: 13,
    color: '#8E8E93',
    marginTop: 4,
  },

  section: {
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: '#8E8E93',
    marginBottom: 10,
  },

  modelCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F8F8',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  modelIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#E8F5E9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modelInfo: {
    flex: 1,
    marginLeft: 12,
  },
  modelName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  modelSub: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 2,
  },

  downloadBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#0A3D2B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadBtn: {
    backgroundColor: '#0A3D2B',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    minWidth: 70,
    alignItems: 'center',
  },
  loadBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
  },
  deleteBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  doneBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  doneText: {
    color: '#4ade80',
    fontSize: 12,
    fontWeight: '700',
  },
  progressWrap: {
    alignItems: 'center',
    minWidth: 50,
  },
  progressText: {
    fontSize: 10,
    color: '#0A3D2B',
    fontWeight: '700',
    marginTop: 2,
  },

  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
    gap: 12,
  },
  chatHeaderInfo: {
    flex: 1,
  },
  chatHeaderTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  chatHeaderSub: {
    fontSize: 11,
    color: '#4ade80',
    marginTop: 2,
  },
  offlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  offlineText: {
    fontSize: 10,
    color: '#4ade80',
    fontWeight: '700',
  },

  chatBody: {
    flex: 1,
  },
  chatList: {
    padding: 16,
    paddingBottom: 8,
  },
  bubble: {
    maxWidth: '82%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
    marginBottom: 8,
  },
  bubbleUser: {
    backgroundColor: '#0A3D2B',
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  bubbleAI: {
    backgroundColor: '#F0F0F0',
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
  },
  bubbleText: {
    fontSize: 15,
    color: '#1C1C1E',
    lineHeight: 21,
  },
  bubbleTextUser: {
    color: '#FFFFFF',
  },

  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E5EA',
    backgroundColor: '#FFFFFF',
  },
  input: {
    flex: 1,
    backgroundColor: '#F0F0F0',
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: '#1C1C1E',
    maxHeight: 120,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#0A3D2B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    opacity: 0.4,
  },
});

export default LocalAIAgentScreen;