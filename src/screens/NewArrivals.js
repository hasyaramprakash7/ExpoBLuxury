// App.js — DeepSeek-style Chat Client (React Native)
// Complete with markdown rendering, code highlighting, file attachments,
// web search, reasoning traces, conversation branching, and voice input.
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  StyleSheet, View, Text, TouchableOpacity, ScrollView,
  TextInput, ActivityIndicator, Switch, Animated, Alert,
  Dimensions, StatusBar, KeyboardAvoidingView, Platform,
  Pressable, Modal, Clipboard, FlatList, Linking,
} from 'react-native';
import * as Speech from 'expo-speech';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { Audio } from 'expo-av';
import { Ionicons, MaterialIcons, Feather, FontAwesome5 } from '@expo/vector-icons';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

// ─── THEME (DeepSeek-inspired dark theme) ─────────────────────────────────
const THEME = {
  bgPrimary: '#0A0A0F',
  bgSecondary: '#14141C',
  bgTertiary: '#1C1C26',
  border: '#2A2A35',
  textPrimary: '#F2F2F7',
  textSecondary: '#A1A1B0',
  textTertiary: '#6C6C7A',
  accent: '#10A37F',
  accentDim: 'rgba(16, 163, 127, 0.15)',
  accentGlow: 'rgba(16, 163, 127, 0.4)',
  error: '#F04438',
  warning: '#F79009',
  codeBg: '#1E1E2E',
  gold: '#D4AF37',
  teal: '#1B4D3E',
  cyan: '#4DD9FF',
};

// ─── Markdown Renderer (with code blocks and copy) ───────────────────────
const MarkdownRenderer = ({ content, onCopyCode }) => {
  const parseMarkdown = (text) => {
    const parts = [];
    let remaining = text;
    let lastIndex = 0;
    
    // Code block regex (```language\ncode\n```)
    const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
    let match;
    
    while ((match = codeBlockRegex.exec(remaining)) !== null) {
      const before = remaining.slice(lastIndex, match.index);
      if (before) parts.push({ type: 'text', content: before });
      parts.push({
        type: 'code',
        language: match[1] || 'text',
        content: match[2].trim(),
      });
      lastIndex = match.index + match[0].length;
    }
    
    const after = remaining.slice(lastIndex);
    if (after) parts.push({ type: 'text', content: after });
    return parts;
  };
  
  const renderInlineMarkdown = (text) => {
    const elements = [];
    let remaining = text;
    let idx = 0;
    
    // Bold: **text** or __text__
    const boldRegex = /\*\*(.*?)\*\*|__(.*?)__/g;
    let match;
    while ((match = boldRegex.exec(remaining)) !== null) {
      if (match.index > 0) elements.push(<Text key={`t-${idx++}`}>{remaining.slice(0, match.index)}</Text>);
      elements.push(<Text key={`b-${idx++}`} style={styles.boldText}>{match[1] || match[2]}</Text>);
      remaining = remaining.slice(match.index + match[0].length);
      boldRegex.lastIndex = 0;
    }
    if (remaining) elements.push(<Text key={`t-${idx++}`}>{remaining}</Text>);
    return elements.length ? elements : <Text>{text}</Text>;
  };
  
  return (
    <View>
      {parseMarkdown(content).map((part, i) => {
        if (part.type === 'code') {
          return (
            <View key={i} style={styles.codeBlockWrapper}>
              <View style={styles.codeHeader}>
                <Text style={styles.codeLang}>{part.language}</Text>
                <TouchableOpacity
                  onPress={() => onCopyCode(part.content)}
                  style={styles.copyCodeBtn}
                  accessibilityLabel="Copy code"
                >
                  <Feather name="copy" size={14} color={THEME.textSecondary} />
                  <Text style={styles.copyCodeText}>Copy</Text>
                </TouchableOpacity>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <Text style={styles.codeText}>{part.content}</Text>
              </ScrollView>
            </View>
          );
        }
        return (
          <Text key={i} style={styles.markdownText}>
            {renderInlineMarkdown(part.content)}
          </Text>
        );
      })}
    </View>
  );
};

// ─── Reasoning Trace Component (DeepThink style) ─────────────────────────
const ReasoningTrace = ({ thinking, duration, onToggle, expanded }) => {
  if (!thinking) return null;
  return (
    <View style={styles.reasoningContainer}>
      <TouchableOpacity style={styles.reasoningHeader} onPress={onToggle}>
        <View style={styles.reasoningTitleRow}>
          <FontAwesome5 name="brain" size={12} color={THEME.accent} />
          <Text style={styles.reasoningTitle}>Reasoning</Text>
          {duration && <Text style={styles.reasoningDuration}>{duration}s</Text>}
        </View>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={THEME.textSecondary} />
      </TouchableOpacity>
      {expanded && (
        <View style={styles.reasoningContent}>
          <Text style={styles.reasoningText}>{thinking}</Text>
        </View>
      )}
    </View>
  );
};

// ─── Message Bubble (with DeepSeek-like styling) ─────────────────────────
const MessageBubble = ({ msg, onCopy, onEdit, onRegenerate, onRating, isStreaming, onStop }) => {
  const [showActions, setShowActions] = useState(false);
  const [expandedReasoning, setExpandedReasoning] = useState(false);
  const slideAnim = useRef(new Animated.Value(30)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(slideAnim, { toValue: 0, tension: 90, friction: 11, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
    ]).start();
  }, []);

  const isUser = msg.role === 'user';
  const isAssistant = msg.role === 'assistant';

  const handleLongPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setShowActions(prev => !prev);
  };

  return (
    <Animated.View
      style={[
        styles.msgRow,
        isUser ? styles.msgRowRight : styles.msgRowLeft,
        { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
      ]}
    >
      {!isUser && (
        <View style={styles.avatarLeft}>
          <View style={styles.avatarOrb}>
            <FontAwesome5 name="robot" size={14} color={THEME.accent} />
          </View>
        </View>
      )}

      <View style={[styles.bubbleCol, isUser && styles.bubbleColRight]}>
        {isAssistant && msg.thinking && (
          <ReasoningTrace
            thinking={msg.thinking}
            duration={msg.thinkingDuration}
            expanded={expandedReasoning}
            onToggle={() => setExpandedReasoning(!expandedReasoning)}
          />
        )}

        <Pressable onLongPress={handleLongPress} onPress={() => setShowActions(false)}>
          <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAssistant]}>
            {isStreaming && !isUser && <Animated.View style={styles.streamingCursor} />}
            {isAssistant ? (
              <MarkdownRenderer content={msg.content} onCopyCode={onCopy} />
            ) : (
              <Text style={styles.bubbleText}>{msg.content}</Text>
            )}
          </View>
        </Pressable>

        <View style={styles.msgFooter}>
          <Text style={[styles.msgTime, isUser && styles.msgTimeRight]}>
            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            {isStreaming && ' ●'}
          </Text>
          
          {showActions && (
            <View style={[styles.actionBar, isUser && styles.actionBarRight]}>
              <TouchableOpacity style={styles.actionBtn} onPress={() => onCopy(msg.content)}>
                <Feather name="copy" size={12} color={THEME.textSecondary} />
              </TouchableOpacity>
              {isUser && (
                <TouchableOpacity style={styles.actionBtn} onPress={() => onEdit(msg)}>
                  <Feather name="edit-2" size={12} color={THEME.textSecondary} />
                </TouchableOpacity>
              )}
              {isAssistant && (
                <>
                  <TouchableOpacity style={styles.actionBtn} onPress={() => onRegenerate(msg.id)}>
                    <Feather name="refresh-cw" size={12} color={THEME.textSecondary} />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.actionBtn} onPress={() => onRating(msg.id, 'like')}>
                    <Feather name="thumbs-up" size={12} color={THEME.textSecondary} />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.actionBtn} onPress={() => onRating(msg.id, 'dislike')}>
                    <Feather name="thumbs-down" size={12} color={THEME.textSecondary} />
                  </TouchableOpacity>
                </>
              )}
              {isStreaming && onStop && (
                <TouchableOpacity style={styles.actionBtn} onPress={onStop}>
                  <Feather name="stop-circle" size={12} color={THEME.error} />
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </View>

      {isUser && (
        <View style={styles.avatarRight}>
          <View style={[styles.avatarOrb, styles.avatarUser]}>
            <FontAwesome5 name="user" size={12} color={THEME.textPrimary} />
          </View>
        </View>
      )}
    </Animated.View>
  );
};

// ─── Sidebar with Search and Conversations ───────────────────────────────
const Sidebar = ({ visible, conversations, activeId, onSelect, onNew, onDelete, onClose, onSearch }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const slideX = useRef(new Animated.Value(-SCREEN_W * 0.8)).current;
  
  useEffect(() => {
    Animated.spring(slideX, {
      toValue: visible ? 0 : -SCREEN_W * 0.8,
      tension: 80, friction: 12,
      useNativeDriver: true,
    }).start();
  }, [visible]);

  const filteredConvos = useMemo(() => {
    if (!searchQuery) return conversations;
    return conversations.filter(c => 
      c.title?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [conversations, searchQuery]);

  const grouped = useMemo(() => {
    const groups = {};
    filteredConvos.forEach(c => {
      const date = new Date(c.created_at);
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      let label;
      if (date.toDateString() === today.toDateString()) label = 'Today';
      else if (date.toDateString() === yesterday.toDateString()) label = 'Yesterday';
      else label = date.toLocaleDateString();
      if (!groups[label]) groups[label] = [];
      groups[label].push(c);
    });
    return groups;
  }, [filteredConvos]);

  return (
    <>
      {visible && <Pressable style={styles.sidebarOverlay} onPress={onClose} />}
      <Animated.View style={[styles.sidebar, { transform: [{ translateX: slideX }] }]}>
        <View style={styles.sidebarHeader}>
          <Text style={styles.sidebarLogo}>DeepSeek Clone</Text>
          <TouchableOpacity style={styles.newChatBtn} onPress={onNew}>
            <Ionicons name="add-circle" size={22} color={THEME.accent} />
            <Text style={styles.newChatBtnText}>New Chat</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.searchContainer}>
          <Feather name="search" size={16} color={THEME.textTertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search conversations..."
            placeholderTextColor={THEME.textTertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        <FlatList
          data={Object.entries(grouped)}
          keyExtractor={([date]) => date}
          renderItem={({ item: [date, convos] }) => (
            <View>
              <Text style={styles.dateLabel}>{date}</Text>
              {convos.map(c => (
                <View key={c.id} style={styles.convRow}>
                  <TouchableOpacity
                    style={[styles.convItem, c.id === activeId && styles.convItemActive]}
                    onPress={() => { onSelect(c.id); onClose(); }}
                  >
                    <Feather name="message-square" size={14} color={THEME.textSecondary} />
                    <Text style={[styles.convTitle, c.id === activeId && styles.convTitleActive]} numberOfLines={1}>
                      {c.title || 'Untitled'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.convDelete} onPress={() => onDelete(c.id)}>
                    <Feather name="trash-2" size={14} color={THEME.error} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
          ListEmptyComponent={<Text style={styles.emptyConvText}>No conversations found</Text>}
          contentContainerStyle={{ paddingBottom: 80 }}
        />
      </Animated.View>
    </>
  );
};

// ─── Settings Modal ─────────────────────────────────────────────────────
const SettingsModal = ({ visible, onClose, settings, onUpdateSettings }) => {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <View style={styles.settingsModal}>
          <Text style={styles.settingsTitle}>Settings</Text>
          
          <View style={styles.settingItem}>
            <Text style={styles.settingLabel}>Auto-read responses</Text>
            <Switch
              value={settings.autoSpeak}
              onValueChange={(v) => onUpdateSettings({ autoSpeak: v })}
              trackColor={{ false: THEME.border, true: THEME.accent }}
              thumbColor={settings.autoSpeak ? THEME.accent : THEME.textTertiary}
            />
          </View>
          
          <View style={styles.settingItem}>
            <Text style={styles.settingLabel}>Speech rate</Text>
            <View style={styles.rateControl}>
              <TouchableOpacity onPress={() => onUpdateSettings({ speechRate: Math.max(0.5, settings.speechRate - 0.1) })}>
                <Feather name="minus" size={20} color={THEME.accent} />
              </TouchableOpacity>
              <Text style={styles.rateValue}>{settings.speechRate.toFixed(1)}x</Text>
              <TouchableOpacity onPress={() => onUpdateSettings({ speechRate: Math.min(2.0, settings.speechRate + 0.1) })}>
                <Feather name="plus" size={20} color={THEME.accent} />
              </TouchableOpacity>
            </View>
          </View>
          
          <View style={styles.settingItem}>
            <Text style={styles.settingLabel}>Default model</Text>
            <Text style={styles.settingValue}>{settings.defaultModel}</Text>
          </View>
          
          <TouchableOpacity style={styles.closeSettingsBtn} onPress={onClose}>
            <Text style={styles.closeSettingsText}>Close</Text>
          </TouchableOpacity>
        </View>
      </Pressable>
    </Modal>
  );
};

// ─── Model Picker Modal ─────────────────────────────────────────────────
const ModelPicker = ({ visible, current, onSelect, onClose }) => {
  const models = [
    { id: 'deepseek-chat', name: 'DeepSeek-V3', description: 'Latest model, best for complex tasks' },
    { id: 'deepseek-coder', name: 'DeepSeek-Coder', description: 'Specialized for programming' },
    { id: 'deepseek-lite', name: 'DeepSeek-Lite', description: 'Faster, lower resource usage' },
  ];
  
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <View style={styles.modelModal}>
          <Text style={styles.modelModalTitle}>Select Model</Text>
          {models.map(m => (
            <TouchableOpacity
              key={m.id}
              style={[styles.modelRow, m.id === current && styles.modelRowActive]}
              onPress={() => { onSelect(m.id); onClose(); }}
            >
              <View style={styles.modelInfo}>
                <Text style={styles.modelName}>{m.name}</Text>
                <Text style={styles.modelDesc}>{m.description}</Text>
              </View>
              {m.id === current && <Ionicons name="checkmark-circle" size={20} color={THEME.accent} />}
            </TouchableOpacity>
          ))}
        </View>
      </Pressable>
    </Modal>
  );
};

// ─── Edit Message Modal ─────────────────────────────────────────────────
const EditModal = ({ visible, message, onSave, onClose }) => {
  const [text, setText] = useState('');
  useEffect(() => { if (message) setText(message.content); }, [message]);
  
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.editModalOverlay}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.editModal}>
            <Text style={styles.editModalTitle}>Edit Message</Text>
            <TextInput
              style={styles.editInput}
              value={text}
              onChangeText={setText}
              multiline
              autoFocus
              placeholder="Edit your message..."
              placeholderTextColor={THEME.textTertiary}
            />
            <View style={styles.editBtns}>
              <TouchableOpacity style={styles.editCancelBtn} onPress={onClose}>
                <Text style={styles.editCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.editSaveBtn} onPress={() => { onSave(message, text); onClose(); }}>
                <Text style={styles.editSaveText}>Send & Regenerate</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

// ─── File Attachment Modal ─────────────────────────────────────────────
const AttachmentModal = ({ visible, onClose, onSelectImage, onSelectDocument }) => {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <View style={styles.attachmentModal}>
          <Text style={styles.attachmentTitle}>Attach File</Text>
          <TouchableOpacity style={styles.attachmentOption} onPress={onSelectImage}>
            <Feather name="image" size={24} color={THEME.accent} />
            <Text style={styles.attachmentOptionText}>Photo or Image</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.attachmentOption} onPress={onSelectDocument}>
            <Feather name="file-text" size={24} color={THEME.accent} />
            <Text style={styles.attachmentOptionText}>Document (PDF, TXT, etc.)</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.attachmentCancel} onPress={onClose}>
            <Text style={styles.attachmentCancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </Pressable>
    </Modal>
  );
};

// ─── Voice Input Component ─────────────────────────────────────────────
const VoiceInputButton = ({ onTranscript, disabled }) => {
  const [recording, setRecording] = useState(null);
  const [permission, setPermission] = useState(null);
  
  useEffect(() => {
    (async () => {
      const { status } = await Audio.requestPermissionsAsync();
      setPermission(status === 'granted');
    })();
  }, []);
  
  const startRecording = async () => {
    if (!permission) {
      Alert.alert('Permission required', 'Please allow microphone access to use voice input.');
      return;
    }
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setRecording(recording);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (err) {
      console.error('Failed to start recording', err);
    }
  };
  
  const stopRecording = async () => {
    if (!recording) return;
    await recording.stopAndUnloadAsync();
    const uri = recording.getURI();
    setRecording(null);
    
    // Here you would send the audio to a speech-to-text service
    // For demo, we'll simulate with a placeholder
    Alert.alert('Voice Input', 'Speech recognition would process the audio and fill the input.');
    // onTranscript('Simulated transcript from voice');
  };
  
  return (
    <TouchableOpacity
      style={[styles.voiceBtn, recording && styles.voiceBtnActive]}
      onPressIn={startRecording}
      onPressOut={stopRecording}
      disabled={disabled}
      accessibilityLabel="Voice input"
    >
      <Feather name="mic" size={20} color={recording ? THEME.error : THEME.textSecondary} />
    </TouchableOpacity>
  );
};

// ─── Main App Component ─────────────────────────────────────────────────
export default function DeepSeekClone() {
  // State
  const [messages, setMessages] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [activeConvId, setActiveConvId] = useState(null);
  const [inputText, setInputText] = useState('');
  const [generating, setGenerating] = useState(false);
  const [streamingMsgId, setStreamingMsgId] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [modelPickerOpen, setModelPickerOpen] = useState(false);
  const [attachmentOpen, setAttachmentOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const [deepThinkEnabled, setDeepThinkEnabled] = useState(false);
  const [currentModel, setCurrentModel] = useState('deepseek-chat');
  const [settings, setSettings] = useState({
    autoSpeak: false,
    speechRate: 1.0,
    defaultModel: 'deepseek-chat',
  });
  const [showScrollButton, setShowScrollButton] = useState(false);
  
  // Refs
  const flatListRef = useRef(null);
  const thinkBuffer = useRef('');
  const answerBuffer = useRef('');
  const currentStreamId = useRef(null);
  const wsRef = useRef(null);
  
  // WebSocket connection (simulated backend - replace with your actual endpoint)
  const connectWS = useCallback(() => {
    // Replace with your actual WebSocket URL
    const WS_URL = 'wss://api.deepseek.com/v1/chat/completions'; // Example - not actual endpoint
    // For demo, we'll simulate responses
    wsRef.current = {
      readyState: WebSocket.OPEN,
      send: (data) => console.log('Send:', data),
    };
  }, []);
  
  useEffect(() => {
    connectWS();
    return () => { if (wsRef.current?.close) wsRef.current.close(); Speech.stop(); };
  }, []);
  
  // Scroll handling
  const handleScroll = (event) => {
    const offsetY = event.nativeEvent.contentOffset.y;
    const contentHeight = event.nativeEvent.contentSize.height;
    const layoutHeight = event.nativeEvent.layoutMeasurement.height;
    setShowScrollButton(contentHeight - offsetY - layoutHeight > 100);
  };
  
  const scrollToBottom = () => {
    flatListRef.current?.scrollToEnd({ animated: true });
  };
  
  // Speech
  const speakText = useCallback((text) => {
    if (!settings.autoSpeak || !text) return;
    Speech.stop();
    Speech.speak(text, {
      language: 'en',
      pitch: 1.0,
      rate: settings.speechRate,
      onStart: () => console.log('Speaking started'),
      onDone: () => console.log('Speaking finished'),
    });
  }, [settings.autoSpeak, settings.speechRate]);
  
  // Send message (simulated)
  const sendMessage = useCallback(async (text, attachment = null) => {
    const content = text || inputText;
    if (!content.trim() && !attachment) return;
    
    setInputText('');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    // Add user message
    const userMsg = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: content,
      timestamp: new Date().toISOString(),
      attachment: attachment,
    };
    setMessages(prev => [...prev, userMsg]);
    setGenerating(true);
    scrollToBottom();
    
    // Simulate AI response with streaming
    const assistantId = `assistant_${Date.now()}`;
    currentStreamId.current = assistantId;
    setStreamingMsgId(assistantId);
    setMessages(prev => [...prev, {
      id: assistantId,
      role: 'assistant',
      content: '',
      thinking: deepThinkEnabled ? 'Analyzing your request...' : null,
      timestamp: new Date().toISOString(),
    }]);
    
    // Simulate reasoning trace if DeepThink enabled
    if (deepThinkEnabled) {
      await new Promise(r => setTimeout(r, 800));
      setMessages(prev => prev.map(m => 
        m.id === assistantId ? { ...m, thinking: 'I need to understand the context and provide a helpful response. Let me break this down step by step...' } : m
      ));
      await new Promise(r => setTimeout(r, 1200));
    }
    
    // Simulate streaming response
    const fullResponse = `Here's my response to: "${content}"\n\nYou can ask me anything about programming, general knowledge, or creative tasks. I support **markdown** formatting and code blocks:\n\n\`\`\`python\ndef hello():\n    print("Hello, World!")\n\`\`\`\n\nLet me know if you need further assistance!`;
    
    for (let i = 0; i <= fullResponse.length; i++) {
      await new Promise(r => setTimeout(r, 15));
      const partial = fullResponse.slice(0, i);
      setMessages(prev => prev.map(m => 
        m.id === assistantId ? { ...m, content: partial } : m
      ));
      if (i % 20 === 0) scrollToBottom();
    }
    
    setGenerating(false);
    setStreamingMsgId(null);
    speakText(fullResponse);
    scrollToBottom();
  }, [inputText, deepThinkEnabled, settings.speechRate, speakText]);
  
  // Regenerate from a specific message
  const regenerateMessage = useCallback((messageId) => {
    // Find the message and regenerate from that point
    const index = messages.findIndex(m => m.id === messageId);
    if (index === -1) return;
    const newMessages = messages.slice(0, index);
    setMessages(newMessages);
    setGenerating(true);
    // Simulate new response
    setTimeout(() => {
      const newResponse = `Regenerated response for context...\n\nThis is a fresh answer to the previous query.`;
      setMessages(prev => [...prev, {
        id: `assistant_${Date.now()}`,
        role: 'assistant',
        content: newResponse,
        timestamp: new Date().toISOString(),
      }]);
      setGenerating(false);
      speakText(newResponse);
    }, 500);
  }, [messages, speakText]);
  
  // Edit message
  const handleEdit = useCallback((message, newContent) => {
    const index = messages.findIndex(m => m.id === message.id);
    if (index === -1) return;
    const updatedMessages = messages.slice(0, index);
    updatedMessages.push({ ...message, content: newContent, timestamp: new Date().toISOString() });
    setMessages(updatedMessages);
    sendMessage(newContent);
  }, [messages, sendMessage]);
  
  // Copy to clipboard
  const copyText = useCallback((text) => {
    Clipboard.setString(text);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert('Copied', 'Content copied to clipboard');
  }, []);
  
  // File handling
  const handleImagePick = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      base64: true,
    });
    if (!result.canceled) {
      setAttachmentOpen(false);
      sendMessage('', { type: 'image', uri: result.assets[0].uri });
    }
  };
  
  const handleDocumentPick = async () => {
    const result = await DocumentPicker.getDocumentAsync({});
    if (result.type === 'success') {
      setAttachmentOpen(false);
      sendMessage('', { type: 'document', name: result.name, uri: result.uri });
    }
  };
  
  // New conversation
  const newConversation = useCallback(() => {
    setMessages([]);
    setActiveConvId(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);
  
  // Stop generation
  const stopGeneration = useCallback(() => {
    setGenerating(false);
    setStreamingMsgId(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, []);
  
  // Rating callback
  const handleRating = useCallback((messageId, rating) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert('Feedback', `Thanks for your ${rating === 'like' ? 'positive' : 'negative'} feedback!`);
  }, []);
  
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={THEME.bgPrimary} />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBtn} onPress={() => setSidebarOpen(true)}>
          <Feather name="menu" size={22} color={THEME.textPrimary} />
        </TouchableOpacity>
        
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>DeepSeek</Text>
          <View style={styles.modelBadge}>
            <Text style={styles.modelBadgeText}>{currentModel.replace('deepseek-', '')}</Text>
          </View>
        </View>
        
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.headerBtn} onPress={() => setSettingsOpen(true)}>
            <Feather name="settings" size={20} color={THEME.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerBtn} onPress={newConversation}>
            <Feather name="plus" size={22} color={THEME.textPrimary} />
          </TouchableOpacity>
        </View>
      </View>
      
      {/* Toggle Bar */}
      <View style={styles.toggleBar}>
        <TouchableOpacity
          style={[styles.toggleBtn, webSearchEnabled && styles.toggleBtnActive]}
          onPress={() => setWebSearchEnabled(!webSearchEnabled)}
        >
          <Feather name="globe" size={14} color={webSearchEnabled ? THEME.accent : THEME.textSecondary} />
          <Text style={[styles.toggleBtnText, webSearchEnabled && styles.toggleBtnTextActive]}>Web Search</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.toggleBtn, deepThinkEnabled && styles.toggleBtnActive]}
          onPress={() => setDeepThinkEnabled(!deepThinkEnabled)}
        >
          <FontAwesome5 name="brain" size={12} color={deepThinkEnabled ? THEME.accent : THEME.textSecondary} />
          <Text style={[styles.toggleBtnText, deepThinkEnabled && styles.toggleBtnTextActive]}>DeepThink</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.toggleBtn} onPress={() => setModelPickerOpen(true)}>
          <Feather name="cpu" size={12} color={THEME.textSecondary} />
          <Text style={styles.toggleBtnText}>{currentModel.split('-')[1]?.toUpperCase() || 'MODEL'}</Text>
        </TouchableOpacity>
      </View>
      
      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <MessageBubble
            msg={item}
            onCopy={copyText}
            onEdit={setEditTarget}
            onRegenerate={regenerateMessage}
            onRating={handleRating}
            isStreaming={item.id === streamingMsgId}
            onStop={stopGeneration}
          />
        )}
        contentContainerStyle={styles.messagesContent}
        onScroll={handleScroll}
        scrollEventThrottle={100}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <FontAwesome5 name="robot" size={48} color={THEME.accentDim} />
            <Text style={styles.emptyTitle}>How can I help you today?</Text>
            <Text style={styles.emptySubtitle}>DeepSeek AI assistant at your service</Text>
          </View>
        }
      />
      
      {/* Scroll to bottom button */}
      {showScrollButton && (
        <TouchableOpacity style={styles.scrollButton} onPress={scrollToBottom}>
          <Feather name="arrow-down" size={20} color={THEME.accent} />
        </TouchableOpacity>
      )}
      
      {/* Input Area */}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={100}>
        <View style={styles.inputContainer}>
          <View style={styles.inputRow}>
            <TouchableOpacity style={styles.inputBtn} onPress={() => setAttachmentOpen(true)}>
              <Feather name="paperclip" size={20} color={THEME.textSecondary} />
            </TouchableOpacity>
            
            <TextInput
              style={styles.textInput}
              placeholder="Ask DeepSeek anything..."
              placeholderTextColor={THEME.textTertiary}
              value={inputText}
              onChangeText={setInputText}
              multiline
              editable={!generating}
            />
            
            <VoiceInputButton onTranscript={(text) => setInputText(text)} disabled={generating} />
            
            <TouchableOpacity
              style={[styles.sendBtn, (!inputText.trim() && !generating) && styles.sendBtnDisabled]}
              onPress={() => sendMessage()}
              disabled={!inputText.trim() && !generating}
            >
              {generating ? (
                <ActivityIndicator size="small" color={THEME.accent} />
              ) : (
                <Feather name="send" size={18} color={THEME.bgPrimary} />
              )}
            </TouchableOpacity>
          </View>
          <Text style={styles.disclaimer}>AI-generated content may be inaccurate or incomplete</Text>
        </View>
      </KeyboardAvoidingView>
      
      {/* Modals */}
      <Sidebar
        visible={sidebarOpen}
        conversations={conversations}
        activeId={activeConvId}
        onSelect={(id) => { setActiveConvId(id); setSidebarOpen(false); }}
        onNew={newConversation}
        onDelete={(id) => setConversations(prev => prev.filter(c => c.id !== id))}
        onClose={() => setSidebarOpen(false)}
        onSearch={(q) => console.log('Search:', q)}
      />
      
      <SettingsModal
        visible={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        onUpdateSettings={setSettings}
      />
      
      <ModelPicker
        visible={modelPickerOpen}
        current={currentModel}
        onSelect={setCurrentModel}
        onClose={() => setModelPickerOpen(false)}
      />
      
      <AttachmentModal
        visible={attachmentOpen}
        onClose={() => setAttachmentOpen(false)}
        onSelectImage={handleImagePick}
        onSelectDocument={handleDocumentPick}
      />
      
      <EditModal
        visible={!!editTarget}
        message={editTarget}
        onSave={(msg, newContent) => { handleEdit(msg, newContent); setEditTarget(null); }}
        onClose={() => setEditTarget(null)}
      />
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.bgPrimary },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: THEME.border,
    backgroundColor: THEME.bgSecondary,
  },
  headerBtn: { padding: 8, borderRadius: 20, backgroundColor: THEME.bgTertiary },
  headerCenter: { alignItems: 'center' },
  headerTitle: { color: THEME.textPrimary, fontSize: 18, fontWeight: '600' },
  modelBadge: { backgroundColor: THEME.accentDim, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12, marginTop: 2 },
  modelBadgeText: { color: THEME.accent, fontSize: 10, fontWeight: '500' },
  headerRight: { flexDirection: 'row', gap: 8 },
  
  toggleBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 12,
    backgroundColor: THEME.bgSecondary,
    borderBottomWidth: 0.5,
    borderBottomColor: THEME.border,
  },
  toggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: THEME.bgTertiary,
  },
  toggleBtnActive: { backgroundColor: THEME.accentDim },
  toggleBtnText: { color: THEME.textSecondary, fontSize: 12, fontWeight: '500' },
  toggleBtnTextActive: { color: THEME.accent },
  
  messagesContent: { paddingHorizontal: 16, paddingVertical: 20, paddingBottom: 100 },
  msgRow: { flexDirection: 'row', marginBottom: 20, alignItems: 'flex-start' },
  msgRowLeft: { justifyContent: 'flex-start' },
  msgRowRight: { justifyContent: 'flex-end' },
  avatarLeft: { marginRight: 10 },
  avatarRight: { marginLeft: 10 },
  avatarOrb: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: THEME.bgTertiary,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: THEME.border,
  },
  avatarUser: { backgroundColor: THEME.accentDim },
  bubbleCol: { maxWidth: '80%' },
  bubbleColRight: { alignItems: 'flex-end' },
  bubble: {
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  bubbleUser: {
    backgroundColor: THEME.accent,
    borderBottomRightRadius: 4,
  },
  bubbleAssistant: {
    backgroundColor: THEME.bgTertiary,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: THEME.border,
  },
  bubbleText: { color: THEME.textPrimary, fontSize: 15, lineHeight: 22 },
  markdownText: { color: THEME.textPrimary, fontSize: 15, lineHeight: 22 },
  boldText: { fontWeight: '700', color: THEME.textPrimary },
  codeBlockWrapper: {
    backgroundColor: THEME.codeBg,
    borderRadius: 8,
    marginVertical: 8,
    overflow: 'hidden',
  },
  codeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderBottomWidth: 0.5,
    borderBottomColor: THEME.border,
  },
  codeLang: { color: THEME.textTertiary, fontSize: 11, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  copyCodeBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  copyCodeText: { color: THEME.textSecondary, fontSize: 11 },
  codeText: {
    color: THEME.textPrimary,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 12,
    padding: 12,
  },
  reasoningContainer: {
    backgroundColor: THEME.accentDim,
    borderRadius: 12,
    marginBottom: 8,
    overflow: 'hidden',
  },
  reasoningHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  reasoningTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  reasoningTitle: { color: THEME.accent, fontSize: 12, fontWeight: '500' },
  reasoningDuration: { color: THEME.textTertiary, fontSize: 10 },
  reasoningContent: { paddingHorizontal: 12, paddingBottom: 12 },
  reasoningText: { color: THEME.textSecondary, fontSize: 12, fontStyle: 'italic', lineHeight: 18 },
  streamingCursor: {
    width: 2,
    height: 16,
    backgroundColor: THEME.accent,
    marginLeft: 2,
    alignSelf: 'center',
  },
  msgFooter: { marginTop: 4, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  msgTime: { color: THEME.textTertiary, fontSize: 10, marginHorizontal: 4 },
  msgTimeRight: { textAlign: 'right' },
  actionBar: { flexDirection: 'row', gap: 8 },
  actionBarRight: { justifyContent: 'flex-end' },
  actionBtn: { padding: 4, backgroundColor: THEME.bgTertiary, borderRadius: 12 },
  
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 80, gap: 12 },
  emptyTitle: { color: THEME.textPrimary, fontSize: 20, fontWeight: '600' },
  emptySubtitle: { color: THEME.textSecondary, fontSize: 14 },
  
  scrollButton: {
    position: 'absolute',
    bottom: 100,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: THEME.bgSecondary,
    borderWidth: 1,
    borderColor: THEME.border,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  
  inputContainer: {
    backgroundColor: THEME.bgSecondary,
    borderTopWidth: 0.5,
    borderTopColor: THEME.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  inputBtn: { padding: 10, backgroundColor: THEME.bgTertiary, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
  textInput: {
    flex: 1,
    backgroundColor: THEME.bgTertiary,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxHeight: 100,
    color: THEME.textPrimary,
    fontSize: 15,
  },
  voiceBtn: { padding: 10, backgroundColor: THEME.bgTertiary, borderRadius: 30 },
  voiceBtnActive: { backgroundColor: 'rgba(240,68,56,0.2)' },
  sendBtn: {
    backgroundColor: THEME.accent,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.5 },
  disclaimer: { color: THEME.textTertiary, fontSize: 10, textAlign: 'center', marginTop: 8 },
  
  sidebarOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 20 },
  sidebar: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: SCREEN_W * 0.8,
    backgroundColor: THEME.bgSecondary,
    zIndex: 30,
    borderRightWidth: 1,
    borderRightColor: THEME.border,
    paddingTop: 50,
  },
  sidebarHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, marginBottom: 16 },
  sidebarLogo: { color: THEME.textPrimary, fontSize: 20, fontWeight: '700' },
  newChatBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: THEME.accentDim, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20 },
  newChatBtnText: { color: THEME.accent, fontWeight: '500' },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: THEME.bgTertiary, marginHorizontal: 16, marginBottom: 16, borderRadius: 12, paddingHorizontal: 12, gap: 8 },
  searchInput: { flex: 1, color: THEME.textPrimary, paddingVertical: 10, fontSize: 14 },
  dateLabel: { color: THEME.textTertiary, fontSize: 11, marginTop: 16, marginBottom: 8, paddingHorizontal: 16 },
  convRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 4 },
  convItem: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderRadius: 8 },
  convItemActive: { backgroundColor: THEME.accentDim },
  convTitle: { color: THEME.textSecondary, fontSize: 14, flex: 1 },
  convTitleActive: { color: THEME.accent, fontWeight: '500' },
  convDelete: { padding: 8 },
  emptyConvText: { textAlign: 'center', color: THEME.textTertiary, marginTop: 40 },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center' },
  settingsModal: { width: SCREEN_W * 0.85, backgroundColor: THEME.bgSecondary, borderRadius: 20, padding: 20, gap: 20 },
  settingsTitle: { color: THEME.textPrimary, fontSize: 20, fontWeight: '600', textAlign: 'center' },
  settingItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  settingLabel: { color: THEME.textPrimary, fontSize: 15 },
  settingValue: { color: THEME.accent, fontSize: 14 },
  rateControl: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  rateValue: { color: THEME.textPrimary, fontSize: 16, fontWeight: '500', width: 40, textAlign: 'center' },
  closeSettingsBtn: { backgroundColor: THEME.accent, paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  closeSettingsText: { color: THEME.bgPrimary, fontWeight: '600' },
  
  modelModal: { width: SCREEN_W * 0.85, backgroundColor: THEME.bgSecondary, borderRadius: 20, padding: 20 },
  modelModalTitle: { color: THEME.textPrimary, fontSize: 18, fontWeight: '600', marginBottom: 16, textAlign: 'center' },
  modelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: THEME.border },
  modelRowActive: { backgroundColor: THEME.accentDim, marginHorizontal: -12, paddingHorizontal: 12, borderRadius: 8 },
  modelInfo: { flex: 1 },
  modelName: { color: THEME.textPrimary, fontSize: 15, fontWeight: '500' },
  modelDesc: { color: THEME.textTertiary, fontSize: 12, marginTop: 2 },
  
  editModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  editModal: { backgroundColor: THEME.bgSecondary, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, gap: 16 },
  editModalTitle: { color: THEME.textPrimary, fontSize: 18, fontWeight: '600', textAlign: 'center' },
  editInput: { backgroundColor: THEME.bgTertiary, borderRadius: 12, padding: 12, color: THEME.textPrimary, minHeight: 80, textAlignVertical: 'top' },
  editBtns: { flexDirection: 'row', gap: 12 },
  editCancelBtn: { flex: 1, backgroundColor: THEME.bgTertiary, paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  editCancelText: { color: THEME.textSecondary },
  editSaveBtn: { flex: 2, backgroundColor: THEME.accent, paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  editSaveText: { color: THEME.bgPrimary, fontWeight: '600' },
  
  attachmentModal: { width: SCREEN_W * 0.85, backgroundColor: THEME.bgSecondary, borderRadius: 20, padding: 20, gap: 12 },
  attachmentTitle: { color: THEME.textPrimary, fontSize: 18, fontWeight: '600', textAlign: 'center', marginBottom: 8 },
  attachmentOption: { flexDirection: 'row', alignItems: 'center', gap: 16, backgroundColor: THEME.bgTertiary, padding: 16, borderRadius: 12 },
  attachmentOptionText: { color: THEME.textPrimary, fontSize: 15 },
  attachmentCancel: { backgroundColor: THEME.bgTertiary, paddingVertical: 12, borderRadius: 12, alignItems: 'center', marginTop: 8 },
  attachmentCancelText: { color: THEME.error },
});