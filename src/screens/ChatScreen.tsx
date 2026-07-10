import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Clipboard,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Linking,
  useWindowDimensions,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import Markdown from 'react-native-markdown-display';
import { useAuth } from '../auth';
import {
  sendChat,
  submitLikeFeedback,
  submitCategoricalFeedback,
  fetchPrograms,
  fetchProgramModules,
  synthesizeSpeech,
  transcribeAudio,
  ChatMessage,
  ChatImage,
  CitationChunk,
  FeedbackType,
  Module,
  Program,
} from '../api';
import { ImageDisplay } from '../components/ImageDisplay';
import { Citations } from '../components/Citations';
import { PDFViewer } from '../components/PDFViewer';
import { VoiceInput } from '../components/VoiceInput';
import { AudioPlayer } from '../components/AudioPlayer';
import { APP_NAME } from '../../config';

const ACCENT = '#A63D33';
const TITLE_COLOR = '#92190c';

const markdownStyles: any = {
  body: { fontSize: 15, color: '#3A1410', lineHeight: 21 },
  heading1: { fontSize: 20, fontWeight: '700', color: '#3A1410', marginVertical: 6 },
  heading2: { fontSize: 17, fontWeight: '600', color: '#3A1410', marginVertical: 4 },
  heading3: { fontSize: 15, fontWeight: '600', color: '#3A1410', marginVertical: 4 },
  code_inline: { backgroundColor: '#F3C6C0', borderRadius: 4, paddingHorizontal: 4, fontFamily: 'monospace' },
  fence: { backgroundColor: '#F3C6C0', borderRadius: 8, padding: 10, marginVertical: 6 },
  blockquote: { borderLeftWidth: 3, borderLeftColor: '#A63D33', paddingLeft: 10, opacity: 0.8 },
  bullet_list: { marginVertical: 4 },
  ordered_list: { marginVertical: 4 },
  list_item: { marginVertical: 2 },
  link: { color: '#A63D33', textDecorationLine: 'underline' },
  strong: { fontWeight: '700' },
  em: { fontStyle: 'italic' },
};

const errorMarkdownStyles: any = {
  ...markdownStyles,
  body: { fontSize: 15, color: '#A1271A', lineHeight: 21 },
};

interface FeedbackState {
  liked: boolean | null;
  showOptions: boolean;
  feedbackId: string | null;
  selectedOptions: string[];
  buttonsRemoved: boolean;
  optionsRemoved: boolean;
}

const FEEDBACK_OPTIONS: { value: FeedbackType; label: string; group: string }[] = [
  { value: 'Too Short', label: '📏 Too Short', group: 'length' },
  { value: 'Too Long', label: '📏 Too Long', group: 'length' },
  { value: 'Fully Inaccurate', label: '❌ Fully Inaccurate', group: 'accuracy' },
  { value: 'Partially Inaccurate', label: '⚠️ Partially Inaccurate', group: 'accuracy' },
  { value: 'Not Clear', label: '🌐 Not Clear', group: 'independent' },
  { value: 'Not related to my work', label: '📝 Not related to my work', group: 'independent' },
  { value: 'Irrelevant', label: '🤔 Irrelevant', group: 'independent' },
  { value: 'Incorrect Program Documents Used', label: '📑 Incorrect Docs Used', group: 'independent' },
  { value: 'Bad Translation', label: '🗣️ Bad Translation', group: 'independent' },
];

type UIMessage = ChatMessage & {
  error?: boolean;
  request_id?: number;
  response_metadata?: { chunks: Record<string, CitationChunk> };
  images?: ChatImage[];
  original_language?: string;
};

// ── Typing animation ──────────────────────────────────────────────────────
function TypingDots() {
  const d1 = useRef(new Animated.Value(0.2)).current;
  const d2 = useRef(new Animated.Value(0.2)).current;
  const d3 = useRef(new Animated.Value(0.2)).current;
  useEffect(() => {
    const anim = (d: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(d, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(d, { toValue: 0.2, duration: 500, useNativeDriver: true }),
        ]),
      );
    const a1 = anim(d1, 0);
    const a2 = anim(d2, 200);
    const a3 = anim(d3, 400);
    a1.start(); a2.start(); a3.start();
    return () => { a1.stop(); a2.stop(); a3.stop(); };
  }, []);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 4 }}>
      {[d1, d2, d3].map((d, i) => (
        <Animated.View key={i} style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: ACCENT, opacity: d }} />
      ))}
    </View>
  );
}

// ── Feedback buttons ───────────────────────────────────────────────────────
interface FeedbackButtonsProps {
  state: FeedbackState;
  onLike: (isLike: boolean) => void;
  onCategorical: (type: FeedbackType) => void;
}
function FeedbackButtons({ state, onLike, onCategorical }: FeedbackButtonsProps) {
  if (state.optionsRemoved && state.liked === true) {
    return <Text style={fbStyles.thanks}>Thank you for your feedback!</Text>;
  }
  if (state.optionsRemoved) return null;
  return (
    <View style={fbStyles.wrap}>
      {!state.buttonsRemoved && (
        <View style={fbStyles.row}>
          <TouchableOpacity
            style={[fbStyles.btn, state.liked === true && fbStyles.btnActive]}
            onPress={() => onLike(true)}
            disabled={state.liked !== null}
          >
            <Text style={fbStyles.btnText}>👍</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[fbStyles.btn, state.liked === false && fbStyles.btnActive]}
            onPress={() => onLike(false)}
            disabled={state.liked !== null}
          >
            <Text style={fbStyles.btnText}>👎</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}
const fbStyles = StyleSheet.create({
  wrap: { marginTop: 4, paddingHorizontal: 2 },
  row: { flexDirection: 'row', gap: 8 },
  btn: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16,
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#F3C6C0',
  },
  btnActive: { backgroundColor: '#F3C6C0', borderColor: '#A63D33' },
  btnText: { fontSize: 16 },
  thanks: { fontSize: 12, color: '#8a6a64', marginTop: 4, paddingHorizontal: 2 },
  options: { marginTop: 8 },
  optionsLabel: { fontSize: 12, fontWeight: '600', color: '#5C2018', marginBottom: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14,
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#E0A89F',
  },
  chipSelected: { backgroundColor: '#A63D33', borderColor: '#A63D33' },
  chipText: { fontSize: 11, color: '#5C2018' },
  chipTextSelected: { color: '#fff' },
});

const SUGGESTIONS = [
  'What are the danger signs in pregnancy?',
  'How do I manage a child with diarrhea?',
  'Summarize the referral process.',
];

// On tablets (width > 700) centre content in a max-width column so it doesn't
// stretch edge-to-edge across the whole screen.
function TabletFrame({ children }: { children: React.ReactNode }) {
  const { width } = useWindowDimensions();
  if (width <= 700) return <>{children}</>;
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <View style={{ flex: 1, width: '100%', maxWidth: 720 }}>
        {children}
      </View>
    </View>
  );
}

export default function ChatScreen() {
  const { token, userId, username, backendUrl, subscriptionKey, signOut } = useAuth();
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [chatId, setChatId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [fullName, setFullName] = useState<string | null>(null);
  const [feedbackStates, setFeedbackStates] = useState<Record<number, FeedbackState>>({});
  const [feedbackNotification, setFeedbackNotification] = useState<{ visible: boolean; message: string }>({
    visible: false,
    message: '',
  });
  const [copiedMessageId, setCopiedMessageId] = useState<number | null>(null);
  const [dislikeModalMessageId, setDislikeModalMessageId] = useState<number | null>(null);
  const [useReference, setUseReference] = useState(false);
  const [selectedModuleId, setSelectedModuleId] = useState('All modules');
  const [selectedProgramId, setSelectedProgramId] = useState('All programs');
  const [modules, setModules] = useState<Module[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [expandedModules, setExpandedModules] = useState(false);
  const [expandedPrograms, setExpandedPrograms] = useState(false);
  const [audioPlayback, setAudioPlayback] = useState<{ messageId: number; data: ArrayBuffer } | null>(null);
  const [transcribing, setTranscribing] = useState(false);
  const [ttsLoadingMessageId, setTtsLoadingMessageId] = useState<number | null>(null);
  const [pdfPreview, setPdfPreview] = useState<{ visible: boolean; documentId: number | string; documentName: string; pageNumber: number }>({
    visible: false,
    documentId: '',
    documentName: '',
    pageNumber: 1,
  });
  const scrollRef = useRef<ScrollView>(null);
  const abortRef = useRef<AbortController | null>(null);
  const notificationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch full name from backend (like web app does)
  useEffect(() => {
    if (!token || !backendUrl) return;
    
    const fetchFullName = async () => {
      try {
        const response = await fetch(`${backendUrl}/users/me`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json',
          },
        });
        
        if (response.ok) {
          const data = await response.json();
          setFullName(data?.full_name ?? null);
        }
      } catch (error) {
        console.error('Failed to fetch full name:', error);
      }
    };

    fetchFullName();
  }, [token, backendUrl]);

  // Fetch modules and programs for settings
  useEffect(() => {
    if (!token || !backendUrl) return;
    
    const loadProgramsAndModules = async () => {
      try {
        const [programsResponse, modulesResponse] = await Promise.all([
          fetchPrograms(backendUrl, token, subscriptionKey || undefined),
          fetchProgramModules(backendUrl, token, subscriptionKey || undefined),
        ]);
        setPrograms(programsResponse.programs || []);
        setModules(modulesResponse.program_modules || []);
      } catch (error) {
        console.error('Failed to fetch programs/modules:', error);
      }
    };

    loadProgramsAndModules();
  }, [token, backendUrl, subscriptionKey]);

  // Cleanup notification timeout on unmount
  useEffect(() => {
    return () => {
      if (notificationTimeoutRef.current) {
        clearTimeout(notificationTimeoutRef.current);
      }
    };
  }, []);

  // Determine greeting name: prioritize fullName, then username (extract if email)
  const getGreetingName = () => {
    if (fullName) return fullName;
    if (username) {
      // If username is an email, extract the part before @
      if (username.includes('@')) {
        return username.split('@')[0];
      }
      return username;
    }
    return '';
  };

  const greetingName = getGreetingName();

  const handleResetSettings = () => {
    setUseReference(false);
    setSelectedModuleId('All modules');
    setSelectedProgramId('All programs');
  };

  const handleModuleChange = (moduleId: string) => {
    setSelectedModuleId(moduleId);
    if (moduleId !== 'All modules') {
      // If module changed, check if current program is still valid
      const stillValid = programs.find(
        (p) => p.program_id === selectedProgramId && p.program_module_id === moduleId
      );
      if (!stillValid) {
        setSelectedProgramId('All programs');
      }
    }
  };

  const handleProgramChange = (programId: string) => {
    setSelectedProgramId(programId);
    if (programId !== 'All programs') {
      // When program is selected, auto-update module
      const match = programs.find((p) => p.program_id === programId);
      if (match && match.program_module_id !== selectedModuleId) {
        setSelectedModuleId(match.program_module_id);
      }
    }
  };

  // Get filtered programs based on selected module
  const filteredPrograms = selectedModuleId === 'All modules'
    ? programs
    : programs.filter((p) => p.program_module_id === selectedModuleId);

  const initFeedback = (msgId: number): FeedbackState => ({
    liked: null, showOptions: false, feedbackId: null,
    selectedOptions: [], buttonsRemoved: false, optionsRemoved: false,
  });

  const handleLike = async (msgId: number, requestId: number, isLike: boolean) => {
    if (!token || !backendUrl) return;
    try {
      const res = await submitLikeFeedback(backendUrl, token, { request_id: requestId, is_like: isLike }, subscriptionKey || undefined);
      
      if (isLike) {
        // Like: Remove all buttons and show "Thank you" toast
        setFeedbackStates(prev => ({
          ...prev,
          [msgId]: {
            ...prev[msgId],
            liked: isLike,
            feedbackId: res.saved_feedback_id,
            buttonsRemoved: true,
            showOptions: false,
            optionsRemoved: true,
            selectedOptions: [],
          },
        }));
        // Show toast notification
        showFeedbackNotification('✅ Thank you for your feedback!');
      } else {
        // Dislike: Remove buttons and open modal for categorical options
        setFeedbackStates(prev => ({
          ...prev,
          [msgId]: {
            ...prev[msgId],
            liked: isLike,
            feedbackId: res.saved_feedback_id,
            buttonsRemoved: true,
            showOptions: false,
            optionsRemoved: false,
            selectedOptions: [],
          },
        }));
        // Open dislike modal
        setDislikeModalMessageId(msgId);
      }
    } catch { /* silent */ }
  };

  const showFeedbackNotification = (message: string) => {
    if (notificationTimeoutRef.current) {
      clearTimeout(notificationTimeoutRef.current);
    }
    setFeedbackNotification({ visible: true, message });
    notificationTimeoutRef.current = setTimeout(() => {
      setFeedbackNotification({ visible: false, message: '' });
    }, 2500);
  };

  const handleCopyMessage = async (messageId: number, messageText: string) => {
    try {
      Clipboard.setString(messageText);
      setCopiedMessageId(messageId);
      showFeedbackNotification('✅ Message copied!');
      
      // Reset copy button after 2 seconds
      setTimeout(() => {
        setCopiedMessageId(null);
      }, 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
      showFeedbackNotification('❌ Failed to copy message');
    }
  };

  const handleVoiceRecording = async (audioUri: string, duration: number) => {
    if (!token || !backendUrl) return;

    try {
      setTranscribing(true);
      const result = await transcribeAudio(
        backendUrl,
        token,
        audioUri,
        'am',
        subscriptionKey || undefined
      );
      
      if (result?.transcript) {
        setInput(result.transcript);
        showFeedbackNotification('✅ Transcribed!');
      }
    } catch (error: any) {
      console.error('Transcription error:', error);
      showFeedbackNotification('❌ Failed to transcribe');
    } finally {
      setTranscribing(false);
    }
  };

  const handlePlayAudio = async (messageId: number, languageCode: string) => {
    if (!token || !backendUrl) return;
    if (languageCode !== 'am' && languageCode !== 'om') {
      showFeedbackNotification('🔇 Audio only available in Amharic or Oromo');
      return;
    }

    try {
      setTtsLoadingMessageId(messageId);
      const audioArrayBuffer = await synthesizeSpeech(
        backendUrl,
        token,
        messageId,
        languageCode as 'am' | 'om',
        subscriptionKey || undefined
      );
      setAudioPlayback({ messageId, data: audioArrayBuffer });
    } catch (error) {
      console.error('TTS error:', error);
      showFeedbackNotification('❌ Failed to generate audio');
    } finally {
      setTtsLoadingMessageId(null);
    }
  };

  const handleCategorical = async (msgId: number, type: FeedbackType) => {
    const fb = feedbackStates[msgId];
    if (!fb?.feedbackId || !token || !backendUrl) return;
    
    // Toggle selection with mutual exclusion (like web app)
    const opt = FEEDBACK_OPTIONS.find(o => o.value === type)!;
    const prev = fb.selectedOptions;
    let next: string[];
    
    if (opt.group !== 'independent') {
      // Remove others in same group, toggle this one
      const sameGroup = FEEDBACK_OPTIONS.filter(o => o.group === opt.group).map(o => o.value);
      const others = prev.filter(v => !sameGroup.includes(v as FeedbackType));
      next = prev.includes(type) ? others : [...others, type];
    } else {
      // Allow multiple independent selections
      next = prev.includes(type) ? prev.filter(v => v !== type) : [...prev, type];
    }
    
    // Update state with new selections
    setFeedbackStates(p => ({ ...p, [msgId]: { ...p[msgId], selectedOptions: next } }));
    
    // Submit feedback
    try {
      await submitCategoricalFeedback(backendUrl, token, { feedback_id: fb.feedbackId!, feedback_type_name: type }, subscriptionKey || undefined);
      // Show notification - keep modal open for more selections
      showFeedbackNotification(`✅ Feedback recorded`);
    } catch { /* silent */ }
  };

  const handleDownloadPDF = async (documentId: number | string, documentName: string, pageNumber?: number) => {
    // Log all available data for debugging
    console.log('Citation clicked:', { documentId, documentName, pageNumber, type: typeof documentId });
    
    // Open PDF preview modal
    setPdfPreview({
      visible: true,
      documentId,
      documentName,
      pageNumber: pageNumber || 1,
    });
  };

  const hasChat = messages.length > 0;
  const scrollToEnd = () =>
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));

  const send = async (textOverride?: string) => {
    const content = (textOverride ?? input).trim();
    if (!content || loading || !token || !userId) return;

    const userMsg: UIMessage = { id: Date.now(), text: content, sender: 'user', timestamp: Date.now() };
    setMessages((m) => [...m, userMsg]);
    setInput('');
    setLoading(true);
    scrollToEnd();

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      // Convert settings like web app does
      const moduleId = selectedModuleId === 'All modules' ? null : parseInt(selectedModuleId);
      const programId = selectedProgramId === 'All programs' ? null : parseInt(selectedProgramId);

      const res = await sendChat({
        backendUrl,
        token,
        userId,
        message: content,
        chatId,
        documentModules: moduleId ? [moduleId.toString()] : null,
        documentPrograms: programId ? [programId.toString()] : null,
        signal: controller.signal,
        subscriptionKey: subscriptionKey || undefined,
      });
      setChatId(res.chat_id);
      const aiMsg: UIMessage = {
        id: res.response_id,
        text: res.response,
        sender: 'ai',
        timestamp: Date.now(),
        request_id: res.request_id,
        response_metadata: res.response_metadata,
        images: res.images,
        original_language: res.original_language,
      };
      setMessages((m) => [...m, aiMsg]);
      setFeedbackStates(prev => ({ ...prev, [res.response_id]: initFeedback(res.response_id) }));
    } catch (e: any) {
      if (e?.name === 'AbortError') return;
      setMessages((m) => [
        ...m,
        {
          id: Date.now() + 1,
          text: `⚠️ ${e?.message ?? 'Failed to send message.'}`,
          sender: 'ai',
          timestamp: Date.now(),
          error: true,
        },
      ]);
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setLoading(false);
      scrollToEnd();
    }
  };

  const newChat = () => {
    abortRef.current?.abort();
    setMessages([]);
    setChatId(null);
    setLoading(false);
    setMenuOpen(false);
  };

  return (
    <LinearGradient colors={['#FFF5F3', '#FCE4E0', '#F3C6C0']} style={styles.gradient}>
      <StatusBar style="dark" />
      <SafeAreaView style={styles.safe}>
        {/* Centre content on wide tablets */}
        <TabletFrame>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'android' ? 0 : 0}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.iconBtn} onPress={() => setMenuOpen(true)}>
              <Feather name="menu" size={22} color={ACCENT} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{APP_NAME}</Text>
            <TouchableOpacity style={styles.iconBtn} onPress={() => setSettingsOpen(true)}>
              <Feather name="settings" size={20} color={ACCENT} />
            </TouchableOpacity>
          </View>

          {/* Body */}
          {!hasChat ? (
            <ScrollView contentContainerStyle={styles.welcomeScroll} keyboardShouldPersistTaps="handled">
              <View style={styles.welcomeBlock}>
                <Text style={styles.titleText}>Hello{greetingName ? `, ${greetingName}` : ''}!</Text>
                <Text style={styles.subtitleText}>How can I help you today?</Text>
              </View>
              <View style={styles.avatarWrapper}>
                <View style={styles.avatarCircle}>
                  <Image source={require('../../assets/hawa.png')} style={styles.avatarImage} resizeMode="cover" />
                </View>
              </View>
              <View style={styles.suggestions}>
                {SUGGESTIONS.map((s) => (
                  <TouchableOpacity key={s} style={styles.suggestion} onPress={() => send(s)}>
                    <Feather name="message-circle" size={16} color={ACCENT} />
                    <Text style={styles.suggestionText}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          ) : (
            <ScrollView
              ref={scrollRef}
              style={styles.flex}
              contentContainerStyle={styles.chatContent}
              keyboardShouldPersistTaps="handled"
              onContentSizeChange={scrollToEnd}
            >
              {messages.map((m) => (
                <View
                  key={m.id}
                  style={[
                    styles.messageRow,
                    m.sender === 'user' ? styles.messageRowUser : styles.messageRowAI,
                  ]}
                >
                  <View
                    style={[
                      styles.bubble,
                      m.sender === 'user' ? styles.userBubble : styles.assistantBubble,
                      m.error && styles.errorBubble,
                    ]}
                  >
                    {m.sender === 'user' ? (
                      <Text style={[styles.bubbleText, styles.userBubbleText]}>{m.text}</Text>
                    ) : (
                      <Markdown style={m.error ? errorMarkdownStyles : markdownStyles}>
                        {m.text}
                      </Markdown>
                    )}
                    {/* Inline images */}
                    {m.images?.map((img) => (
                      <ImageDisplay
                        key={img.image_id}
                        image={img}
                        allImages={m.images}
                        isUserImage={m.sender === 'user'}
                      />
                    ))}
                    {/* Citations */}
                    {m.sender === 'ai' && !m.error && m.response_metadata?.chunks && (
                      <Citations
                        chunks={m.response_metadata.chunks}
                        onDocumentPress={handleDownloadPDF}
                      />
                    )}
                  </View>
                  {/* Actions: Copy & Feedback — only on non-error AI messages */}
                  {m.sender === 'ai' && !m.error && m.request_id != null && feedbackStates[m.id] && (
                    <View style={styles.actionRow}>
                      {/* Copy button */}
                      <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => handleCopyMessage(m.id, m.text)}
                      >
                        {copiedMessageId === m.id ? (
                          <Feather name="check" size={16} color="#22c55e" />
                        ) : (
                          <Feather name="copy" size={16} color={ACCENT} />
                        )}
                      </TouchableOpacity>

                      {/* Speaker button — only for Amharic / Oromo responses */}
                      {(m.original_language === 'am' || m.original_language === 'om') && (
                        <TouchableOpacity
                          style={styles.actionButton}
                          onPress={() => handlePlayAudio(m.id, m.original_language!)}
                          disabled={ttsLoadingMessageId === m.id}
                        >
                          {ttsLoadingMessageId === m.id
                            ? <ActivityIndicator size="small" color={ACCENT} />
                            : <Feather name="volume-2" size={16} color={ACCENT} />}
                        </TouchableOpacity>
                      )}
                      
                      {/* Feedback buttons */}
                      <FeedbackButtons
                        state={feedbackStates[m.id]}
                        onLike={(isLike) => handleLike(m.id, m.request_id!, isLike)}
                        onCategorical={(type) => handleCategorical(m.id, type)}
                      />
                    </View>
                  )}
                </View>
              ))}
              {loading && (
                <View style={[styles.bubble, styles.assistantBubble, styles.typingBubble]}>
                  <TypingDots />
                </View>
              )}
            </ScrollView>
          )}

          {/* Input bar */}
          <View style={styles.inputRow}>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.textInput}
                value={input}
                onChangeText={setInput}
                placeholder="Ask me anything..."
                placeholderTextColor="#BF7063"
                multiline
                onSubmitEditing={() => send()}
                returnKeyType="send"
                submitBehavior="blurAndSubmit"
              />
              <View style={styles.inputActions}>
                <VoiceInput
                  onRecordingComplete={handleVoiceRecording}
                  onBeforeRecord={() => setAudioPlayback(null)}
                  disabled={loading || transcribing}
                  transcribing={transcribing}
                />
                {loading ? (
                  <TouchableOpacity style={styles.sendBtn} onPress={() => abortRef.current?.abort()}>
                    <Feather name="square" size={18} color="#fff" />
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={[styles.sendBtn, !input.trim() && styles.sendBtnDisabled]}
                    onPress={() => send()}
                    disabled={!input.trim()}
                  >
                    <Feather name="send" size={18} color="#fff" />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
        </TabletFrame>
      </SafeAreaView>

      {/* Drawer */}
      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setMenuOpen(false)}>
          <Pressable style={styles.drawer} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.drawerTitle}>{APP_NAME}</Text>
            {!!greetingName && <Text style={styles.drawerUser}>Signed in as {greetingName}</Text>}
            {!greetingName && !!username && <Text style={styles.drawerUser}>Signed in as {username}</Text>}
            <TouchableOpacity style={styles.drawerItem} onPress={newChat}>
              <Feather name="edit" size={18} color={ACCENT} />
              <Text style={styles.drawerItemText}>New chat</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.drawerItem}
              onPress={async () => {
                setMenuOpen(false);
                await signOut();
              }}
            >
              <Feather name="log-out" size={18} color={ACCENT} />
              <Text style={styles.drawerItemText}>Sign out</Text>
            </TouchableOpacity>
            <View style={styles.drawerFooter}>
              <Text style={styles.drawerFooterText}>Server: {backendUrl}</Text>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Settings Modal */}
      <Modal visible={settingsOpen} transparent animationType="fade" onRequestClose={() => setSettingsOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setSettingsOpen(false)}>
          <Pressable style={styles.drawer} onPress={(e) => e.stopPropagation()}>
            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
              <Text style={styles.drawerTitle}>Settings</Text>
              
              {/* Server Section */}
              <View style={styles.settingsSection}>
                <Text style={styles.settingsSectionTitle}>Server</Text>
                <Text style={styles.settingsInfo}>{backendUrl}</Text>
              </View>

              {/* Document Settings Section */}
              <View style={styles.settingsSection}>
                <Text style={styles.settingsSectionTitle}>Document Search</Text>
                
                {/* Use Reference Toggle */}
                <View style={styles.settingToggleRow}>
                  <Text style={styles.settingToggleLabel}>Also use reference documents</Text>
                  <TouchableOpacity
                    style={[styles.toggle, useReference && styles.toggleActive]}
                    onPress={() => setUseReference(!useReference)}
                  >
                    <View style={[styles.toggleThumb, useReference && styles.toggleThumbActive]} />
                  </TouchableOpacity>
                </View>

                {/* Module Filter Dropdown */}
                <Text style={styles.settingLabel}>Module</Text>
                <TouchableOpacity
                  style={styles.dropdownHeader}
                  onPress={() => setExpandedModules(!expandedModules)}
                >
                  <Text style={styles.dropdownHeaderText}>
                    {selectedModuleId === 'All modules'
                      ? 'All modules'
                      : modules.find((m) => m.program_module_id === selectedModuleId)?.name || selectedModuleId}
                  </Text>
                  <Feather
                    name={expandedModules ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color={ACCENT}
                  />
                </TouchableOpacity>
                {expandedModules && (
                  <View style={styles.dropdownContainer}>
                    {['All modules', ...modules.map((m) => m.program_module_id)].map((moduleId) => {
                      const moduleName =
                        moduleId === 'All modules'
                          ? 'All modules'
                          : modules.find((m) => m.program_module_id === moduleId)?.name || moduleId;
                      const isSelected = selectedModuleId === moduleId;
                      
                      return (
                        <TouchableOpacity
                          key={moduleId}
                          style={[styles.dropdownItem, isSelected && styles.dropdownItemActive]}
                          onPress={() => {
                            handleModuleChange(moduleId);
                            setExpandedModules(false);
                          }}
                        >
                          <Text
                            style={[
                              styles.dropdownItemText,
                              isSelected && styles.dropdownItemTextActive,
                            ]}
                            numberOfLines={1}
                          >
                            {moduleName}
                          </Text>
                          {isSelected && (
                            <Feather name="check" size={18} color="#22c55e" style={{ marginLeft: 8 }} />
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}

                {/* Program Filter Dropdown */}
                <Text style={[styles.settingLabel, { marginTop: 20 }]}>Program</Text>
                <TouchableOpacity
                  style={styles.dropdownHeader}
                  onPress={() => setExpandedPrograms(!expandedPrograms)}
                >
                  <Text style={styles.dropdownHeaderText}>
                    {selectedProgramId === 'All programs'
                      ? 'All programs'
                      : programs.find((p) => p.program_id === selectedProgramId)?.name || selectedProgramId}
                  </Text>
                  <Feather
                    name={expandedPrograms ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color={ACCENT}
                  />
                </TouchableOpacity>
                {expandedPrograms && (
                  <View style={styles.dropdownContainer}>
                    <TouchableOpacity
                      style={[
                        styles.dropdownItem,
                        selectedProgramId === 'All programs' && styles.dropdownItemActive,
                      ]}
                      onPress={() => {
                        setSelectedProgramId('All programs');
                        setExpandedPrograms(false);
                      }}
                    >
                      <Text
                        style={[
                          styles.dropdownItemText,
                          selectedProgramId === 'All programs' && styles.dropdownItemTextActive,
                        ]}
                      >
                        All programs
                      </Text>
                      {selectedProgramId === 'All programs' && (
                        <Feather name="check" size={18} color="#22c55e" style={{ marginLeft: 8 }} />
                      )}
                    </TouchableOpacity>
                    {filteredPrograms.length === 0 ? (
                      <Text style={styles.noProgramsText}>No programs available</Text>
                    ) : (
                      filteredPrograms.map((program) => (
                        <TouchableOpacity
                          key={program.program_id}
                          style={[
                            styles.dropdownItem,
                            selectedProgramId === program.program_id && styles.dropdownItemActive,
                          ]}
                          onPress={() => {
                            handleProgramChange(program.program_id);
                            setExpandedPrograms(false);
                          }}
                        >
                          <Text
                            style={[
                              styles.dropdownItemText,
                              selectedProgramId === program.program_id &&
                                styles.dropdownItemTextActive,
                            ]}
                            numberOfLines={2}
                          >
                            {program.name}
                          </Text>
                          {selectedProgramId === program.program_id && (
                            <Feather name="check" size={18} color="#22c55e" style={{ marginLeft: 8 }} />
                          )}
                        </TouchableOpacity>
                      ))
                    )}
                  </View>
                )}

                {/* Reset Button */}
                <TouchableOpacity
                  style={styles.resetBtn}
                  onPress={handleResetSettings}
                >
                  <Text style={styles.resetBtnText}>Reset to defaults</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* PDF Viewer */}
      <PDFViewer
        visible={pdfPreview.visible}
        onClose={() => setPdfPreview({ ...pdfPreview, visible: false })}
        documentId={pdfPreview.documentId}
        documentName={pdfPreview.documentName}
        pageNumber={pdfPreview.pageNumber}
        backendUrl={backendUrl || ''}
        token={token || ''}
      />

      {/* Feedback Notification */}
      {feedbackNotification.visible && (
        <View style={styles.feedbackNotification}>
          <Text style={styles.feedbackNotificationText}>{feedbackNotification.message}</Text>
        </View>
      )}

      {/* Dislike Options Modal */}
      {dislikeModalMessageId !== null && feedbackStates[dislikeModalMessageId] && (
        <Modal visible={true} transparent animationType="fade" onRequestClose={() => setDislikeModalMessageId(null)}>
          <Pressable style={styles.backdrop} onPress={() => setDislikeModalMessageId(null)}>
            <Pressable style={styles.dislikeModal} onPress={(e) => e.stopPropagation()}>
              <Text style={styles.dislikeModalTitle}>What went wrong?</Text>
              <View style={styles.dislikeChips}>
                {FEEDBACK_OPTIONS.map((opt) => {
                  const selected = feedbackStates[dislikeModalMessageId]?.selectedOptions.includes(opt.value) || false;
                  return (
                    <TouchableOpacity
                      key={opt.value}
                      style={[styles.dislikeChip, selected && styles.dislikeChipSelected]}
                      onPress={() => handleCategorical(dislikeModalMessageId, opt.value)}
                    >
                      <Text style={[styles.dislikeChipText, selected && styles.dislikeChipSelectedText]}>
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <TouchableOpacity
                style={styles.dislikeCloseBtn}
                onPress={() => setDislikeModalMessageId(null)}
              >
                <Text style={styles.dislikeCloseBtnText}>Close</Text>
              </TouchableOpacity>
            </Pressable>
          </Pressable>
        </Modal>
      )}

      {/* Audio Player Modal */}
      {audioPlayback && (
        <Modal visible={true} transparent animationType="fade" onRequestClose={() => setAudioPlayback(null)}>
          <Pressable style={styles.backdrop} onPress={() => setAudioPlayback(null)}>
            <Pressable style={styles.audioModal} onPress={(e) => e.stopPropagation()}>
              <View style={styles.audioModalHeader}>
                <Text style={styles.audioModalTitle}>Playing audio</Text>
                <TouchableOpacity onPress={() => setAudioPlayback(null)}>
                  <Feather name="x" size={22} color="#5C2018" />
                </TouchableOpacity>
              </View>
              <AudioPlayer
                audioArrayBuffer={audioPlayback.data}
                onComplete={() => setAudioPlayback(null)}
              />
            </Pressable>
          </Pressable>
        </Modal>
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  flex: { flex: 1 },
  safe: { flex: 1, paddingHorizontal: 16 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 4,
  },
  headerTitle: { fontSize: 16, fontWeight: '600', color: TITLE_COLOR },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  welcomeScroll: { flexGrow: 1, justifyContent: 'center' },
  welcomeBlock: { alignItems: 'center', marginTop: 12, marginBottom: 20 },
  titleText: { fontSize: 28, fontWeight: '500', color: TITLE_COLOR, marginBottom: 6 },
  subtitleText: { fontSize: 20, color: TITLE_COLOR, opacity: 0.8 },
  avatarWrapper: { alignItems: 'center', marginBottom: 28 },
  avatarCircle: { width: 140, height: 140, borderRadius: 70, overflow: 'hidden', backgroundColor: '#F3C6C0' },
  avatarImage: { width: '100%', height: '100%' },
  suggestions: { gap: 10, paddingHorizontal: 8 },
  suggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    shadowColor: '#A63D33',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  suggestionText: { fontSize: 14, color: ACCENT, flexShrink: 1 },
  chatContent: { paddingVertical: 12, paddingHorizontal: 8, gap: 10 },
  messageRow: { width: '100%', flexDirection: 'column', marginHorizontal: 4 },
  messageRowUser: { alignItems: 'flex-end' },
  messageRowAI: { alignItems: 'flex-start' },
  bubble: { maxWidth: '85%', borderRadius: 18, paddingVertical: 12, paddingHorizontal: 16 },
  userBubble: { backgroundColor: ACCENT, borderBottomRightRadius: 4 },
  assistantBubble: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 4,
    shadowColor: '#A63D33',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  errorBubble: { backgroundColor: '#FFE3DE' },
  bubbleText: { fontSize: 15, color: '#3A1410', lineHeight: 21 },
  userBubbleText: { color: '#fff' },
  typingBubble: { paddingVertical: 12, paddingHorizontal: 16 },
  inputRow: { paddingVertical: 10, paddingHorizontal: 12 },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    minHeight: 52,
    maxHeight: 120,
    borderRadius: 26,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    paddingHorizontal: 16,
    paddingVertical: 6,
    shadowColor: '#A63D33',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  textInput: { flex: 1, fontSize: 15, color: '#5C2018', paddingVertical: 10, paddingRight: 8 },
  inputActions: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 6,
    gap: 4,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: '#D9B3AF', opacity: 0.5 },
  drawer: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 280,
    backgroundColor: '#FFF5F3',
    paddingTop: 64,
    paddingHorizontal: 20,
  },
  drawerTitle: { fontSize: 20, fontWeight: '600', color: TITLE_COLOR },
  drawerUser: { fontSize: 13, color: '#8a6a64', marginTop: 4, marginBottom: 20 },
  drawerItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  drawerItemText: { fontSize: 16, color: ACCENT, fontWeight: '500' },
  drawerFooter: { marginTop: 'auto', paddingBottom: 40 },
  drawerFooterText: { fontSize: 11, color: '#B07A70' },
  settingsSection: { marginTop: 20, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#E0A89F' },
  settingsSectionTitle: { fontSize: 13, fontWeight: '600', color: TITLE_COLOR, marginBottom: 8 },
  settingsInfo: { fontSize: 14, color: '#5C2018' },
  settingLabel: { fontSize: 13, fontWeight: '600', color: '#5C2018', marginBottom: 8 },
  settingToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingRight: 8,
  },
  settingToggleLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#5C2018',
    flex: 1,
    marginRight: 12,
  },
  toggle: {
    width: 50,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#E0A89F',
    justifyContent: 'center',
    alignItems: 'flex-start',
    paddingHorizontal: 2,
  },
  toggleActive: {
    backgroundColor: ACCENT,
    alignItems: 'flex-end',
  },
  toggleThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#fff',
  },
  toggleThumbActive: {
    backgroundColor: '#fff',
  },
  resetBtn: {
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: ACCENT,
    borderRadius: 8,
    alignItems: 'center',
  },
  resetBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },
  dropdownContainer: {
    borderWidth: 1,
    borderColor: '#E0A89F',
    borderRadius: 8,
    backgroundColor: '#FFF5F3',
    maxHeight: 300,
    marginBottom: 16,
    overflow: 'hidden',
  },
  dropdownHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#E0A89F',
    borderRadius: 8,
    backgroundColor: '#FFF5F3',
    marginBottom: 16,
  },
  dropdownHeaderText: {
    fontSize: 14,
    color: '#5C2018',
    fontWeight: '600',
    flex: 1,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E0A89F',
  },
  dropdownItemActive: {
    backgroundColor: '#FFE8E2',
  },
  dropdownItemText: {
    fontSize: 14,
    color: '#5C2018',
    fontWeight: '500',
    flex: 1,
  },
  dropdownItemTextActive: {
    fontWeight: '700',
    color: ACCENT,
  },
  moduleScroll: {
    marginBottom: 16,
  },
  moduleChip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: '#F3C6C0',
    marginRight: 8,
    borderWidth: 2,
    borderColor: '#F3C6C0',
  },
  moduleChipActive: {
    backgroundColor: ACCENT,
    borderColor: ACCENT,
  },
  moduleChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#5C2018',
  },
  moduleChipTextActive: {
    color: '#fff',
  },
  programsContainer: {
    borderWidth: 1,
    borderColor: '#E0A89F',
    borderRadius: 8,
    maxHeight: 300,
    marginBottom: 16,
  },
  programItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3C6C0',
  },
  programItemActive: {
    backgroundColor: '#FFF5F3',
  },
  programItemText: {
    flex: 1,
    fontSize: 13,
    color: '#5C2018',
    fontWeight: '500',
    marginRight: 8,
  },
  programItemTextActive: {
    fontWeight: '600',
    color: ACCENT,
  },
  noProgramsText: {
    fontSize: 13,
    color: '#8a6a64',
    paddingVertical: 16,
    paddingHorizontal: 12,
    textAlign: 'center',
  },
  feedbackNotification: {
    position: 'absolute',
    bottom: 40,
    left: 16,
    right: 16,
    backgroundColor: '#A63D33',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    shadowColor: '#A63D33',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
    zIndex: 1000,
  },
  feedbackNotificationText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
  },
  actionRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 2,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#F3C6C0',
  },
  actionButtonText: {
    fontSize: 11,
    color: '#5C2018',
    fontWeight: '500',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dislikeModal: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    maxHeight: '80%',
    width: '85%',
    alignItems: 'center',
  },
  dislikeModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#92190c',
    marginBottom: 16,
  },
  dislikeChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 20,
  },
  dislikeChip: {
    backgroundColor: '#F3C6C0',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 12,
    margin: 4,
    borderWidth: 2,
    borderColor: '#F3C6C0',
  },
  dislikeChipSelected: {
    backgroundColor: ACCENT,
    borderColor: ACCENT,
  },
  dislikeChipText: {
    fontSize: 13,
    color: '#5C2018',
    fontWeight: '600',
    textAlign: 'center',
  },
  dislikeChipSelectedText: {
    color: '#fff',
  },
  dislikeCloseBtn: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: ACCENT,
    borderRadius: 10,
    alignItems: 'center',
  },
  dislikeCloseBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  audioModal: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    width: '85%',
    alignItems: 'stretch',
  },
  audioModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  audioModalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#92190c',
  },
});
