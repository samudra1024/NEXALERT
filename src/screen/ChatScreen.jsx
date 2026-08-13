// screens/ChatScreen.js
import React, { useState, useEffect, useRef, useCallback, memo, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  Alert,
  StyleSheet,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  Modal,
  Image,
  ActivityIndicator,
  InteractionManager,
  Clipboard,
  Share,
} from "react-native";
import {
  TouchableWithoutFeedback
} from 'react-native-gesture-handler';
import { useNavigation, useRoute } from '@react-navigation/native';
import SmsController from '../../Controller/SmsController';
import { useTheme } from '../context/ThemeContext';
import ScalePressable from '../components/animations/ScalePressable';
import { ArrowLeft, MoreVertical, Search, Edit2, Trash2, X, Check, Paperclip, Copy, Share2 } from 'lucide-react-native';
import { launchImageLibrary } from 'react-native-image-picker';

// In-memory cache for chat messages
const chatCache = {};

const shouldShowDateSeparator = (currentMessage, previousMessage) => {
  if (!previousMessage) return true;

  const currentDate = new Date(currentMessage.date);
  const previousDate = new Date(previousMessage.date);

  return !(
    currentDate.getDate() === previousDate.getDate() &&
    currentDate.getMonth() === previousDate.getMonth() &&
    currentDate.getFullYear() === previousDate.getFullYear()
  );
};

const MessageBubble = memo(function MessageBubble({
  item,
  previousItem,
  theme,
  isSelected,
  onLongPress,
  onPress,
}) {
  const showDate = shouldShowDateSeparator(item, previousItem);
  const date = new Date(item.date);
  const today = new Date();
  const isToday =
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear();

  return (
    <View>
      {showDate && !isToday && (
        <View style={{ alignItems: 'center', marginVertical: 12 }}>
          <View style={{ backgroundColor: theme.surface, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: theme.border }}>
            <Text style={{ color: theme.textSecondary, fontSize: 12, fontWeight: '500' }}>
              {date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
            </Text>
          </View>
        </View>
      )}
      <View style={{ marginBottom: 4 }}>
        <TouchableWithoutFeedback
          onLongPress={() => onLongPress(item)}
          onPress={() => onPress(item)}
          delayLongPress={300}
        >
          <View
            style={[
              styles.messageContainer,
              item.sender === "me"
                ? [styles.myMessage, { backgroundColor: theme.chatMyBubble }]
                : [styles.otherMessage, { backgroundColor: theme.chatOtherBubble }],
              isSelected && { backgroundColor: theme.primary + '80', borderColor: theme.primary, borderWidth: 1 }
            ]}>
            {item.imageUri ? (
              <Image
                source={{ uri: item.imageUri }}
                style={{ width: 200, height: 200, borderRadius: 8, marginBottom: 4 }}
                resizeMode="cover"
              />
            ) : null}
            <Text style={[
              styles.messageText,
              item.sender === "me"
                ? [styles.myMessageText, { color: theme.chatMyText }]
                : [styles.otherMessageText, { color: theme.chatOtherText }]
            ]}>
              {item.text}
            </Text>
            <View style={styles.messageFooter}>
              <Text style={[
                styles.timeText,
                item.sender === "me"
                  ? [styles.myTimeText, { color: 'rgba(255,255,255,0.7)' }]
                  : [styles.otherTimeText, { color: theme.textSecondary }]
              ]}>
                {item.time}
                {item.isEdited ? <Text style={{ fontStyle: 'italic', fontSize: 10 }}> (edited)</Text> : null}
              </Text>
            </View>
            {isSelected ? <Check size={14} color={theme.text} style={{ marginLeft: 8 }} /> : null}
          </View>
        </TouchableWithoutFeedback>
      </View>
    </View>
  );
});

export default function ChatScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation();
  const route = useRoute();
  const { contactId, name, initialBody } = route.params || {};

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [editingMessage, setEditingMessage] = useState(null);
  // Media Sharing State
  const [selectedImage, setSelectedImage] = useState(null);
  const [isPreviewVisible, setIsPreviewVisible] = useState(false);
  const [selectedMessages, setSelectedMessages] = useState([]);
  const isSelectionMode = selectedMessages.length > 0;
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const flatListRef = useRef(null);
  const messagesLoaded = useRef(false);
  const loadingMoreRef = useRef(false);
  const hasScrolledToBottom = useRef(false);
  const [isProfileMenuVisible, setIsProfileMenuVisible] = useState(false);
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [messageMenuVisible, setMessageMenuVisible] = useState(false);
  const [isOnline, setIsOnline] = useState(false);

  // Pagination State
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);


  const loadSmsMessages = useCallback(async (refresh = false, nextPage = 1) => {
    if (!contactId) return;
    if (loadingMoreRef.current && nextPage > 1) return;

    if (refresh) {
      delete chatCache[contactId];
      messagesLoaded.current = false;
    }

    if (!refresh && nextPage === 1 && chatCache[contactId]) {
      setMessages(chatCache[contactId].messages);
      setHasMore(chatCache[contactId].hasMore ?? true);
      setPage(chatCache[contactId].page ?? 1);
      messagesLoaded.current = true;
      return;
    }

    if (nextPage > 1) {
      loadingMoreRef.current = true;
      setLoadingMore(true);
    }

    try {
      const result = await SmsController.getChatMessages(contactId, nextPage);
      const processedNew = result.messages.map(m => ({
        ...m,
        id: m._id || m.id,
        text: m.body || m.text,
        sender: parseInt(m.type, 10) === 2 ? 'me' : 'other',
        time: new Date(m.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        starred: false,
      })).sort((a, b) => a.date - b.date);

      if (nextPage === 1) {
        setMessages(processedNew);
        chatCache[contactId] = {
          messages: processedNew,
          hasMore: result.hasMore,
          page: result.page,
        };
        messagesLoaded.current = true;
      } else {
        setMessages(prev => {
          const existingIds = new Set(prev.map(m => m.id));
          const olderMessages = processedNew.filter(m => !existingIds.has(m.id));
          const merged = olderMessages.length > 0 ? [...olderMessages, ...prev] : prev;
          chatCache[contactId] = {
            messages: merged,
            hasMore: result.hasMore,
            page: result.page,
          };
          return merged;
        });
      }

      setHasMore(result.hasMore);
      setPage(result.page);
    } catch (error) {
      console.error(error);
      if (nextPage === 1) {
        Alert.alert('Error', 'Failed to fetch SMS messages: ' + error.message);
      }
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [contactId]);

  useEffect(() => {
    messagesLoaded.current = false;
    hasScrolledToBottom.current = false;
    setMessages([]);
    setPage(1);
    setHasMore(true);
    setSelectedMessages([]);
    setInput(initialBody || '');

    SmsController.getDraft(contactId).then(draft => {
      if (draft && !initialBody) {
        setInput(draft);
      }
    });
  }, [contactId, initialBody]);

  useEffect(() => {
    if (messagesLoaded.current) return;

    const task = InteractionManager.runAfterInteractions(() => {
      loadSmsMessages();
      if (contactId) {
        SmsController.markAsRead(contactId).catch(error => {
          console.error('Error marking as read:', error);
        });
      }
    });

    return () => task.cancel();
  }, [loadSmsMessages, contactId]);

  const handleSelectMessage = useCallback((messageId) => {
    setSelectedMessages(prev => {
      if (prev.includes(messageId)) {
        return prev.filter(id => id !== messageId);
      }
      return [...prev, messageId];
    });
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditingMessage(null);
    setInput("");
  }, []);

  const handleLongPress = useCallback((message) => {
    if (!isSelectionMode) {
      if (editingMessage) {
        handleCancelEdit();
      }
      setSelectedMessages([message.id]);
    } else {
      handleSelectMessage(message.id);
    }
  }, [isSelectionMode, editingMessage, handleSelectMessage, handleCancelEdit]);

  const handleMessagePress = useCallback((message) => {
    if (isSelectionMode) {
      handleSelectMessage(message.id);
    }
  }, [isSelectionMode, handleSelectMessage]);

  const handleDeleteChat = () => {
    Alert.alert('Delete conversation?', 'All messages with this contact will be deleted.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await SmsController.deleteConversation(contactId);
          delete chatCache[contactId];
          navigation.goBack();
        },
      },
    ]);
  };

  const handleBlockContact = () => {
    Alert.alert('Block contact?', `Block messages from ${name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Block',
        style: 'destructive',
        onPress: async () => {
          await SmsController.blockNumber(contactId);
          navigation.goBack();
        },
      },
    ]);
  };

  const handleMarkUnread = async () => {
    await SmsController.markAsUnread(contactId);
    Alert.alert('Marked as unread');
    navigation.goBack();
  };

  const handleCopySelected = () => {
    const text = messages
      .filter(m => selectedMessages.includes(m.id))
      .map(m => m.text)
      .join('\n');
    Clipboard.setString(text);
    setSelectedMessages([]);
  };

  const handleForwardSelected = () => {
    const text = messages
      .filter(m => selectedMessages.includes(m.id))
      .map(m => m.text)
      .join('\n');
    Share.share({ message: text });
    setSelectedMessages([]);
  };

  const filteredMessages = useMemo(() => {
    if (!searchText.trim()) {
      return messages;
    }
    const lower = searchText.toLowerCase();
    return messages.filter(m => (m.text || '').toLowerCase().includes(lower));
  }, [messages, searchText]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (contactId) {
        SmsController.saveDraft(contactId, input);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [input, contactId]);

  const handleDeleteSelected = async () => {
    Alert.alert(
      "Delete Messages",
      `Are you sure you want to delete ${selectedMessages.length} message${selectedMessages.length > 1 ? 's' : ''}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await SmsController.deleteSms(selectedMessages);
              setSelectedMessages([]);
              await loadSmsMessages(true);
            } catch (error) {
              Alert.alert('Error', 'Failed to delete messages: ' + error.message);
            }
          }
        }
      ]
    );
  };

  const handleEditSelected = () => {
    if (selectedMessages.length === 1) {
      const msgId = selectedMessages[0];
      const msg = messages.find(m => m.id === msgId);
      if (msg) {
        setEditingMessage(msg);
        setInput(msg.text);
        setSelectedMessages([]);
      }
    }
  };

  const handleUpdateMessage = () => {
    if (input.trim().length > 0 && editingMessage) {
      const updatedMessages = messages.map(msg =>
        msg.id === editingMessage.id ? { ...msg, text: input.trim(), isEdited: true } : msg
      );
      setMessages(updatedMessages);
      chatCache[contactId] = {
        messages: updatedMessages,
        hasMore,
        page,
      };

      handleCancelEdit();
    }
  };

  const handleSelectImage = async () => {
    const options = {
      mediaType: 'photo',
      includeBase64: false,
    };

    try {
      const result = await launchImageLibrary(options);
      if (result.assets && result.assets[0]) {
        setSelectedImage(result.assets[0]);
        setIsPreviewVisible(true);
      }
    } catch (error) {
      console.log('ImagePicker Error: ', error);
    }
  };

  const handleSendImage = async () => {
    if (selectedImage) {
      // Create a mock message for the image
      const newMessage = {
        id: Date.now().toString(),
        address: contactId,
        body: "📷 Image", // Fallback text
        date: Date.now(),
        date_sent: Date.now(),
        read: 1,
        type: 2, // Outgoing
        status: -1,
        sender: 'me',
        text: "📷 Image",
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        imageUri: selectedImage.uri // Custom property
      };

      setMessages(prev => [newMessage, ...prev]);
      setIsPreviewVisible(false);
      setSelectedImage(null);
      // In a real app, you would upload this or send via MMS
    }
  };

  const sendMessage = useCallback(async () => {
    if (input.trim().length > 0 && !sending) {
      if (editingMessage) {
        handleUpdateMessage();
        return;
      }

      setSending(true);
      try {
        await SmsController.sendSms(contactId, input.trim());
        setInput("");
        delete chatCache[contactId];
        messagesLoaded.current = false;
        await loadSmsMessages(true, 1);
      } catch (error) {
        Alert.alert('Error', 'Failed to send SMS: ' + error.message);
      } finally {
        setSending(false);
      }
    }
  }, [input, contactId, sending, loadSmsMessages, editingMessage]);

  const selectedMessageSet = useMemo(
    () => new Set(selectedMessages),
    [selectedMessages],
  );

  const renderMessage = useCallback(({ item, index }) => (
    <MessageBubble
      item={item}
      previousItem={index > 0 ? messages[index - 1] : null}
      theme={theme}
      isSelected={selectedMessageSet.has(item.id)}
      onLongPress={handleLongPress}
      onPress={handleMessagePress}
    />
  ), [messages, theme, selectedMessageSet, handleLongPress, handleMessagePress]);

  const handleLoadOlder = useCallback(() => {
    if (hasMore && !loadingMoreRef.current) {
      loadSmsMessages(false, page + 1);
    }
  }, [hasMore, page, loadSmsMessages]);

  const msgKeyExtractor = useCallback((item) => item.id, []);

  const scrollToBottom = useCallback(() => {
    if (flatListRef.current && messages.length > 0) {
      flatListRef.current.scrollToEnd({ animated: false });
    }
  }, [messages.length]);

  const handleScroll = useCallback(({ nativeEvent }) => {
    if (nativeEvent.contentOffset.y <= 48) {
      handleLoadOlder();
    }
  }, [handleLoadOlder]);

  // Only scroll to bottom once after initial load
  useEffect(() => {
    if (messages.length > 0 && !hasScrolledToBottom.current) {
      setTimeout(() => {
        scrollToBottom();
        hasScrolledToBottom.current = true;
      }, 100);
    }
  }, [messages.length, scrollToBottom]);

  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', (e) => {
      setKeyboardHeight(e.endCoordinates.height);
      setTimeout(scrollToBottom, 100);
    });

    const keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardHeight(0);
    });

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: theme.surface }]}>
      <StatusBar barStyle={theme.statusBar} backgroundColor={theme.statusBg} />
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        enabled={Platform.OS === 'ios'}
      >

        {/* Enhanced Header */}
        <View style={[styles.header, { backgroundColor: isSelectionMode ? theme.surface : theme.background, borderBottomColor: theme.border }]}>
          {isSelectionMode ? (
            <>
              <TouchableOpacity onPress={() => setSelectedMessages([])} style={styles.backTouch}>
                <X size={24} color={theme.text} />
              </TouchableOpacity>
              <View style={styles.headerInfo}>
                <Text style={[styles.headerName, { color: theme.text }]}>{selectedMessages.length} Selected</Text>
              </View>
              <View style={styles.headerActions}>
                {selectedMessages.length >= 1 && (
                  <TouchableOpacity style={styles.iconButton} onPress={handleCopySelected}>
                    <Copy size={22} color={theme.text} />
                  </TouchableOpacity>
                )}
                {selectedMessages.length >= 1 && (
                  <TouchableOpacity style={styles.iconButton} onPress={handleForwardSelected}>
                    <Share2 size={22} color={theme.text} />
                  </TouchableOpacity>
                )}
                {selectedMessages.length === 1 && messages.find(m => m.id === selectedMessages[0])?.sender === 'me' && (
                  <TouchableOpacity style={styles.iconButton} onPress={handleEditSelected}>
                    <Edit2 size={22} color={theme.text} />
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={styles.iconButton} onPress={handleDeleteSelected}>
                  <Trash2 size={22} color={theme.error || 'red'} />
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <>
              <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backTouch}>
                <ArrowLeft size={24} color={theme.text} />
              </TouchableOpacity>

              {isSearchVisible ? (
                <TextInput
                  style={[styles.searchInput, { color: theme.text }]}
                  placeholder="Search in chat..."
                  placeholderTextColor={theme.textSecondary}
                  value={searchText}
                  onChangeText={setSearchText}
                  autoFocus
                  onBlur={() => !searchText && setIsSearchVisible(false)}
                />
              ) : (
                <View style={styles.headerInfo}>
                  <Text style={[styles.headerName, { color: theme.text }]}>{name}</Text>
                  <Text style={styles.headerStatus}>Online</Text>
                </View>
              )}

              <View style={styles.headerActions}>
                {!isSearchVisible && (
                  <TouchableOpacity style={[styles.searchIconButton, { backgroundColor: theme.surface, borderColor: theme.border }]} onPress={() => setIsSearchVisible(true)}>
                    <Search size={22} color={theme.text} />
                  </TouchableOpacity>
                )}

                <TouchableOpacity style={styles.profileButton} onPress={() => setIsProfileMenuVisible(true)}>
                  <MoreVertical size={22} color={theme.text} />
                </TouchableOpacity>
              </View>
            </>
          )}
          {/* End of Conditional Header Content */}
        </View>

        <FlatList
          ref={flatListRef}
          data={filteredMessages}
          keyExtractor={msgKeyExtractor}
          renderItem={renderMessage}
          extraData={selectedMessageSet}
          style={styles.messagesList}
          contentContainerStyle={styles.messagesContainer}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews={true}
          maxToRenderPerBatch={12}
          windowSize={9}
          initialNumToRender={15}
          updateCellsBatchingPeriod={100}
          onScroll={handleScroll}
          scrollEventThrottle={200}
          ListHeaderComponent={
            loadingMore ? (
              <ActivityIndicator size="small" color={theme.primary} style={{ marginVertical: 12 }} />
            ) : null
          }
        />

        <View style={[
          styles.inputContainer,
          { backgroundColor: theme.background, borderTopColor: theme.border },
          Platform.OS === 'android' && keyboardHeight > 0 && { paddingBottom: 8 }
        ]}>
          {editingMessage && (
            <View style={[styles.editingBanner, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
              <View style={styles.editingContent}>
                <Text style={[styles.editingTitle, { color: theme.primary }]}>Editing Message</Text>
                <Text style={[styles.editingText, { color: theme.textSecondary }]} numberOfLines={1}>
                  {editingMessage.text}
                </Text>
              </View>
              <TouchableOpacity onPress={handleCancelEdit} style={styles.cancelButton}>
                <Text style={[styles.cancelButtonText, { color: theme.text }]}>✕</Text>
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity
            style={styles.attachButton}
            onPress={handleSelectImage}
          >
            <Paperclip size={22} color={theme.textSecondary} />
          </TouchableOpacity>

          <View style={[styles.textInputContainer, { backgroundColor: theme.inputBg }]}>
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder="Message"
              placeholderTextColor={theme.textSecondary}
              style={[styles.textInput, { color: theme.text }]}
              multiline
              maxLength={1000}
              returnKeyType="send"
              onSubmitEditing={sendMessage}
              blurOnSubmit={false}
            />
          </View>

          <ScalePressable
            onPress={sendMessage}
            disabled={sending || !input.trim()}
          >
            <View
              style={[
                styles.sendButton,
                input.trim() && !sending ? [styles.sendButtonActive, { backgroundColor: theme.primary }] : [styles.sendButtonInactive, { backgroundColor: theme.mode === 'dark' ? '#3e4042' : '#dadce0' }],
              ]}
            >
              <Text style={[styles.sendButtonText, input.trim() && !sending ? styles.sendButtonTextActive : styles.sendButtonTextInactive]}>
                {sending ? '⏳' : (editingMessage ? '✓' : '➤')}
              </Text>
            </View>
          </ScalePressable>
        </View>

        {/* Profile Overflow Menu */}
        <Modal
          visible={isProfileMenuVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setIsProfileMenuVisible(false)}
        >
          <TouchableWithoutFeedback onPress={() => setIsProfileMenuVisible(false)}>
            <View style={styles.modalOverlay}>
              <View style={styles.menuContainer}>
                <TouchableOpacity style={styles.menuItem} onPress={() => {
                  setIsProfileMenuVisible(false);
                  handleMarkUnread();
                }}>
                  <Text style={styles.menuText}>Mark as Unread</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.menuItem} onPress={() => {
                  setIsProfileMenuVisible(false);
                  navigation.navigate('Blocked');
                }}>
                  <Text style={styles.menuText}>Blocked Contacts</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.menuItem} onPress={() => {
                  setIsProfileMenuVisible(false);
                  handleBlockContact();
                }}>
                  <Text style={[styles.menuText, { color: '#ef4444' }]}>Block Contact</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.menuItem} onPress={() => {
                  setIsProfileMenuVisible(false);
                  handleDeleteChat();
                }}>
                  <Text style={[styles.menuText, { color: '#ef4444' }]}>Delete Chat</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </Modal>

      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  keyboardContainer: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff', // Changed to white for modern look
    paddingHorizontal: 16,
    paddingVertical: 12,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  backTouch: {
    padding: 8,
    marginRight: 8,
  },
  backButton: {
    fontSize: 24,
    color: '#333',
    fontWeight: '300',
  },
  headerInfo: {
    flex: 1,
  },
  headerName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  headerStatus: {
    fontSize: 12,
    color: '#28a745', // Green for online
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    paddingVertical: 4,
  },
  iconButton: {
    padding: 8,
    marginLeft: 8,
  },
  profileButton: {
    padding: 8,
    marginLeft: 4,
  },
  iconText: {
    fontSize: 22, // Bigger icons
    color: '#555',
  },
  searchIconButton: {
    marginLeft: 8,
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#f0f2f5',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e1e4e8',
  },
  searchIconText: {
    fontSize: 18,
    color: '#555',
  },

  messagesList: {
    flex: 1,
  },
  messagesContainer: {
    paddingVertical: 16,
    paddingHorizontal: 12,
    paddingBottom: 20,
    flexGrow: 1,
  },
  messageContainer: {
    maxWidth: '80%',
    marginVertical: 4,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 18,
  },
  myMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#2563eb',
    borderBottomRightRadius: 4,
  },
  otherMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#ffffff',
    borderBottomLeftRadius: 4,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 20,
  },
  myMessageText: {
    color: '#ffffff',
  },
  otherMessageText: {
    color: '#212529',
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  messageFooter: {
    marginTop: 4,
  },
  timeText: {
    fontSize: 11,
  },
  myTimeText: {
    color: '#bfdbfe',
  },
  otherTimeText: {
    color: '#adb5bd',
  },
  statusIconContainer: {
    marginLeft: 4,
  },
  statusIcon: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  checkSeen: {
    color: '#4fc3f7',
  },
  checkSent: {
    color: '#bfdbfe',
  },
  doubleCheck: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkOverlap: {
    marginLeft: -8,
  },
  clockIcon: {
    fontSize: 12,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    paddingBottom: Platform.OS === 'ios' ? 8 : 12,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    minHeight: 64,
  },
  textInput: {
    flex: 1,
    backgroundColor: 'transparent',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#202124',
    maxHeight: 120,
    minHeight: 48,
    textAlignVertical: 'center',
    lineHeight: 20,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
  },
  sendButtonActive: {
    backgroundColor: '#1a73e8',
    elevation: 6,
    shadowOpacity: 0.25,
  },
  sendButtonInactive: {
    backgroundColor: '#dadce0',
    elevation: 1,
    shadowOpacity: 0.1,
  },
  sendButtonText: {
    fontSize: 18,
    fontWeight: '500',
  },
  sendButtonTextActive: {
    color: '#ffffff',
  },
  sendButtonTextInactive: {
    color: '#9aa0a6',
  },
  attachButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 4,
  },
  attachButtonText: {
    fontSize: 24,
    color: '#5f6368',
    fontWeight: '300',
  },
  textInputContainer: {
    flex: 1,
    backgroundColor: '#f1f3f4',
    borderRadius: 24,
    marginRight: 8,
    paddingHorizontal: 4,
  },

  // Modal / Menu
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  menuContainer: {
    position: 'absolute',
    top: 60,
    right: 20,
    backgroundColor: 'white',
    borderRadius: 12,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    padding: 8,
    minWidth: 160,
  },
  menuItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  menuText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
});