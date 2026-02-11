// screens/ChatScreen.js
import React, { useState, useEffect, useRef } from "react";
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
  Animated,
  Modal,
  Image,
} from "react-native";
import {
  PinchGestureHandler,
  State,
  TouchableWithoutFeedback
} from 'react-native-gesture-handler';
import { useNavigation, useRoute } from '@react-navigation/native';
import SmsController from '../../Controller/SmsController';
import { useTheme } from '../context/ThemeContext';
import { useSettings } from '../context/SettingsContext';
// Re-import Animated to ensure we have the correct one for gestures if needed, 
// though we usually use react-native-reanimated for this.
// Assuming Animated from react-native is already imported, we might need Reanimated for smoother zoom.
import { useSharedValue, useAnimatedStyle, withSpring, FadeInUp, FadeInRight, FadeInLeft } from 'react-native-reanimated';
import Reanimated from 'react-native-reanimated';
import ScalePressable from '../components/animations/ScalePressable';
import { ArrowLeft, MoreVertical, Search, Edit2, Trash2, X, Check, Paperclip, Image as ImageIcon } from 'lucide-react-native';
import { launchImageLibrary } from 'react-native-image-picker';

// In-memory cache for chat messages
const chatCache = {};

export default function ChatScreen() {
  const { theme } = useTheme();
  const { settings } = useSettings();
  const navigation = useNavigation();
  const route = useRoute();
  const { contactId, name } = route.params || {};

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
  const buttonScale = useRef(new Animated.Value(1)).current;
  const messagesLoaded = useRef(false);

  // Zoom State
  const scale = useSharedValue(1);
  const onPinchEvent = Reanimated.useAnimatedGestureHandler({
    onActive: (event) => {
      if (settings.pinchToZoom) {
        scale.value = event.scale;
      }
    },
    onEnd: () => {
      scale.value = withSpring(1);
    }
  });

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }]
    };
  });

  // New UI States for Header
  const [isProfileMenuVisible, setIsProfileMenuVisible] = useState(false);
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [searchText, setSearchText] = useState('');

  const loadSmsMessages = React.useCallback(async (forceRefresh = false) => {
    if (!contactId) return;

    // Check cache first
    if (!forceRefresh && chatCache[contactId]) {
      setMessages(chatCache[contactId]);
      return;
    }

    try {
      const smsMessages = await SmsController.fetchSmsMessages();
      const formattedMessages = smsMessages
        .filter(sms => sms.address === contactId)
        .map((sms) => ({
          id: sms.id,
          sender: parseInt(sms.type) === 2 ? 'me' : sms.address,
          text: sms.body,
          time: new Date(parseInt(sms.date)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          date: parseInt(sms.date)
        }))
        .sort((a, b) => a.date - b.date);

      // Store in cache
      chatCache[contactId] = formattedMessages;
      setMessages(formattedMessages);
      messagesLoaded.current = true;
    } catch (error) {
      Alert.alert('Error', 'Failed to fetch SMS messages: ' + error.message);
    }
  }, [contactId]);

  useEffect(() => {
    if (!messagesLoaded.current) {
      loadSmsMessages();

      // Mark messages as read
      if (contactId) {
        SmsController.markAsRead(contactId).catch(error => {
          console.error('Error marking as read:', error);
        });
      }
    }
  }, [loadSmsMessages, contactId]);

  const animateButton = () => {
    Animated.sequence([
      Animated.timing(buttonScale, {
        toValue: 0.9,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(buttonScale, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handleSelectMessage = (messageId) => {
    setSelectedMessages(prev => {
      if (prev.includes(messageId)) {
        return prev.filter(id => id !== messageId);
      } else {
        return [...prev, messageId];
      }
    });
  };

  const handleLongPress = React.useCallback((message) => {
    // If we are already editing, don't allow selection? Or just switch modes.
    // For now, let's allow selection to override or coexist.
    // Use callback ref or access state directly if stable.
    if (!isSelectionMode) {
      if (editingMessage) {
        handleCancelEdit();
      }
      setSelectedMessages([message.id]);
    } else {
      handleSelectMessage(message.id);
    }
  }, [isSelectionMode, editingMessage, selectedMessages]);

  const handleMessagePress = React.useCallback((message) => {
    if (isSelectionMode) {
      handleSelectMessage(message.id);
    }
  }, [isSelectionMode]);

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

  const handleCancelEdit = () => {
    setEditingMessage(null);
    setInput("");
  };

  const handleUpdateMessage = () => {
    if (input.trim().length > 0 && editingMessage) {
      const updatedMessages = messages.map(msg =>
        msg.id === editingMessage.id ? { ...msg, text: input.trim(), isEdited: true } : msg
      );
      setMessages(updatedMessages);
      // Update cache
      chatCache[contactId] = updatedMessages;

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

  const sendMessage = React.useCallback(async () => {
    if (input.trim().length > 0 && !sending) {
      if (editingMessage) {
        handleUpdateMessage();
        return;
      }

      animateButton();
      setSending(true);
      try {
        await SmsController.sendSms(contactId, input.trim());
        setInput("");
        // Force refresh to get new message
        await loadSmsMessages(true);
      } catch (error) {
        Alert.alert('Error', 'Failed to send SMS: ' + error.message);
      } finally {
        setSending(false);
      }
    }
  }, [input, contactId, sending, loadSmsMessages, buttonScale, editingMessage]);

  const shouldShowDateSeparator = (currentMessage, previousMessage) => {
    if (!previousMessage) return true; // First message always shows date

    const currentDate = new Date(currentMessage.date);
    const previousDate = new Date(previousMessage.date);

    // If same day, don't show separator
    if (
      currentDate.getDate() === previousDate.getDate() &&
      currentDate.getMonth() === previousDate.getMonth() &&
      currentDate.getFullYear() === previousDate.getFullYear()
    ) {
      return false;
    }

    return true;
  };

  const renderDateSeparator = (dateTimestamp) => {
    const date = new Date(dateTimestamp);
    const today = new Date();
    const isToday =
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear();

    // Don't show separator for today's messages
    if (isToday) return null;

    return (
      <View style={{ alignItems: 'center', marginVertical: 12 }}>
        <View style={{ backgroundColor: theme.surface, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: theme.border }}>
          <Text style={{ color: theme.textSecondary, fontSize: 12, fontWeight: '500' }}>
            {date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
          </Text>
        </View>
      </View>
    );
  };

  const renderMessage = React.useCallback(({ item, index }) => {
    const previousMessage = messages[index + 1]; // Messages are sorted desc, so previous is +1
    // Actually, messages in FlatList usually sorted ascending for chat?
    // Let's check loadSmsMessages: .sort((a, b) => a.date - b.date);
    // So messages[0] is oldest.
    // Wait, typical chat flatlist with inverted={false} means index 0 is top (oldest).
    // Let's assume index 0 is oldest.
    // Then previous message is index - 1.

    // In loadSmsMessages: 100:         .sort((a, b) => a.date - b.date); 
    // This sorts ascending (oldest first).
    // So for item at index `i`, previous message is `i - 1`.

    const prevMsg = index > 0 ? messages[index - 1] : null;
    const showDate = shouldShowDateSeparator(item, prevMsg);

    return (
      <View>
        {showDate && renderDateSeparator(item.date)}
        <Reanimated.View
          entering={item.sender === "me" ? FadeInRight.springify() : FadeInLeft.springify()}
          style={{ marginBottom: 4 }}
        >
          <TouchableWithoutFeedback
            onLongPress={() => handleLongPress(item)}
            onPress={() => handleMessagePress(item)}
            delayLongPress={300}
          >
            <View
              style={[
                styles.messageContainer,
                item.sender === "me"
                  ? [styles.myMessage, { backgroundColor: theme.chatMyBubble }]
                  : [styles.otherMessage, { backgroundColor: theme.chatOtherBubble }],
                selectedMessages.includes(item.id) && { backgroundColor: theme.primary + '80', borderColor: theme.primary, borderWidth: 1 } // Highlight selected
              ]}>
              <Text style={[
                styles.messageText,
                item.sender === "me"
                  ? [styles.myMessageText, { color: theme.chatMyText }]
                  : [styles.otherMessageText, { color: theme.chatOtherText }]
              ]}>
                {item.text}
              </Text>
              {item.imageUri && (
                <Image
                  source={{ uri: item.imageUri }}
                  style={{ width: 200, height: 200, borderRadius: 8, marginTop: 4 }}
                  resizeMode="cover"
                />
              )}
              <View style={styles.messageFooter}>
                <Text style={[
                  styles.timeText,
                  item.sender === "me"
                    ? [styles.myTimeText, { color: 'rgba(255,255,255,0.7)' }]
                    : [styles.otherTimeText, { color: theme.textSecondary }]
                ]}>
                  {item.time}
                  {item.isEdited && <Text style={{ fontStyle: 'italic', fontSize: 10 }}> (edited)</Text>}
                </Text>
              </Text>
              {selectedMessages.includes(item.id) && <Check size={14} color={theme.text} style={{ marginLeft: 8 }} />}
            </View>

          </TouchableWithoutFeedback>
        </Reanimated.View>
      </View >
    );
  }, [theme, handleLongPress, handleMessagePress, selectedMessages, messages]);

  const scrollToBottom = () => {
    if (flatListRef.current && messages.length > 0) {
      flatListRef.current.scrollToEnd({ animated: true });
    }
  };

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

        <PinchGestureHandler onGestureEvent={onPinchEvent}>
          <Reanimated.View style={[{ flex: 1 }, animatedStyle]}>
            <FlatList
              ref={flatListRef}
              data={messages}
              keyExtractor={(item) => item.id}
              renderItem={renderMessage}
              extraData={selectedMessages}
              style={styles.messagesList}
              contentContainerStyle={styles.messagesContainer}
              showsVerticalScrollIndicator={false}
              onContentSizeChange={scrollToBottom}
              onLayout={scrollToBottom}
            />
          </Reanimated.View>
        </PinchGestureHandler>

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
                <TouchableOpacity style={styles.menuItem} onPress={() => setIsProfileMenuVisible(false)}>
                  <Text style={styles.menuText}>Settings</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.menuItem} onPress={() => setIsProfileMenuVisible(false)}>
                  <Text style={styles.menuText}>Delete Chat</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.menuItem} onPress={() => setIsProfileMenuVisible(false)}>
                  <Text style={styles.menuText}>Block Contact</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </Modal>

        {/* Image Preview Modal */}
        <Modal
          visible={isPreviewVisible}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setIsPreviewVisible(false)}
        >
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' }}>
            <Image
              source={{ uri: selectedImage?.uri }}
              style={{ width: '90%', height: '70%', borderRadius: 12 }}
              resizeMode="contain"
            />
            <View style={{ flexDirection: 'row', marginTop: 24, gap: 20 }}>
              <TouchableOpacity
                onPress={() => setIsPreviewVisible(false)}
                style={{ backgroundColor: '#FF4444', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 8 }}
              >
                <Text style={{ color: 'white', fontWeight: 'bold' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSendImage}
                style={{ backgroundColor: theme.primary, paddingVertical: 12, paddingHorizontal: 24, borderRadius: 8 }}
              >
                <Text style={{ color: 'white', fontWeight: 'bold' }}>Send Image</Text>
              </TouchableOpacity>
            </View>
          </View>
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
  timeText: {
    fontSize: 11,
    marginTop: 4,
  },
  myTimeText: {
    color: '#bfdbfe',
    textAlign: 'right',
  },
  otherTimeText: {
    color: '#adb5bd',
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
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  editingBanner: {
    position: 'absolute',
    top: -60,
    left: 0,
    right: 0,
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    zIndex: 10,
  },
  editingContent: {
    flex: 1,
  },
  editingTitle: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 2,
  },
  editingText: {
    fontSize: 14,
  },
  cancelButton: {
    padding: 8,
  },
  cancelButtonText: {
    fontSize: 18,
    fontWeight: '600',
  },
});