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
  TouchableWithoutFeedback
} from "react-native";
import { useNavigation, useRoute } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import SmsController from '../../Controller/SmsController';

// In-memory cache for chat messages
const chatCache = {};

export default function ChatScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { contactId, name } = route.params || {};

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const flatListRef = useRef(null);
  const buttonScale = useRef(new Animated.Value(1)).current;
  const messagesLoaded = useRef(false);

  // New UI States for Header
  const [isProfileMenuVisible, setIsProfileMenuVisible] = useState(false);
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [messageMenuVisible, setMessageMenuVisible] = useState(false);
  const [isOnline, setIsOnline] = useState(false);

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
          date: parseInt(sms.date),
          status: parseInt(sms.type) === 2 ? (parseInt(sms.read) === 1 ? 'seen' : parseInt(sms.status) === 0 ? 'sent' : 'pending') : null,
          reaction: null
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

  const sendMessage = React.useCallback(async () => {
    if (input.trim().length > 0 && !sending) {
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
  }, [input, contactId, sending, loadSmsMessages, buttonScale]);

  const addReaction = (emoji) => {
    if (selectedMessage) {
      setMessages(prevMessages => 
        prevMessages.map(msg => 
          msg.id === selectedMessage.id ? { ...msg, reaction: emoji } : msg
        )
      );
      setMessageMenuVisible(false);
    }
  };

  const renderMessage = React.useCallback(({ item }) => (
    <TouchableOpacity
      onLongPress={() => {
        setSelectedMessage(item);
        setMessageMenuVisible(true);
      }}
      activeOpacity={0.7}
    >
      <View style={[
        styles.messageContainer,
        item.sender === "me" ? styles.myMessage : styles.otherMessage
      ]}>
        <Text style={[
          styles.messageText,
          item.sender === "me" ? styles.myMessageText : styles.otherMessageText
        ]}>
          {item.text}
        </Text>
        <View style={styles.timeContainer}>
          <Text style={[
            styles.timeText,
            item.sender === "me" ? styles.myTimeText : styles.otherTimeText
          ]}>
            {item.time}
          </Text>
          {item.sender === "me" && (
            <View style={styles.statusIconContainer}>
              {item.status === 'seen' ? (
                <View style={styles.doubleCheck}>
                  <Text style={[styles.statusIcon, styles.checkSeen]}>✓</Text>
                  <Text style={[styles.statusIcon, styles.checkSeen, styles.checkOverlap]}>✓</Text>
                </View>
              ) : item.status === 'sent' ? (
                <View style={styles.doubleCheck}>
                  <Text style={[styles.statusIcon, styles.checkSent]}>✓</Text>
                  <Text style={[styles.statusIcon, styles.checkSent, styles.checkOverlap]}>✓</Text>
                </View>
              ) : (
                <Text style={styles.clockIcon}>🕐</Text>
              )}
            </View>
          )}
        </View>
        {item.reaction && (
          <View style={styles.reactionBadge}>
            <Text style={styles.reactionBadgeEmoji}>{item.reaction}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  ), []);

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
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        enabled={Platform.OS === 'ios'}
      >

        {/* Enhanced Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backTouch}>
            <Text style={styles.backButton}>←</Text>
          </TouchableOpacity>

          {isSearchVisible ? (
            <TextInput
              style={styles.searchInput}
              placeholder="Search in chat..."
              value={searchText}
              onChangeText={setSearchText}
              autoFocus
              onBlur={() => !searchText && setIsSearchVisible(false)}
            />
          ) : (
            <View style={styles.headerInfo}>
              <Text style={styles.headerName}>{name}</Text>
              <Text style={[styles.headerStatus, { color: isOnline ? '#28a745' : '#999' }]}>
                {isOnline ? 'Online' : 'Offline'}
              </Text>
            </View>
          )}

          <View style={styles.headerActions}>
            {!isSearchVisible && (
              <TouchableOpacity style={styles.iconButton} onPress={() => setIsSearchVisible(true)}>
                <Text style={styles.iconText}>🔍</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.profileButton} onPress={() => setIsProfileMenuVisible(true)}>
              <Text style={styles.iconText}>⋮</Text>
            </TouchableOpacity>
          </View>
        </View>

        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          style={styles.messagesList}
          contentContainerStyle={styles.messagesContainer}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={scrollToBottom}
          onLayout={scrollToBottom}
        />

        <View style={[styles.inputContainer, Platform.OS === 'android' && keyboardHeight > 0 && { paddingBottom: 8 }]}>
          <TouchableOpacity style={styles.attachButton}>
            <Text style={styles.attachButtonText}>+</Text>
          </TouchableOpacity>

          <View style={styles.textInputContainer}>
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder="Message"
              placeholderTextColor="#5f6368"
              style={styles.textInput}
              multiline
              maxLength={1000}
              returnKeyType="send"
              onSubmitEditing={sendMessage}
              blurOnSubmit={false}
            />
          </View>

          <TouchableOpacity
            onPress={sendMessage}
            disabled={sending || !input.trim()}
            activeOpacity={0.8}
          >
            <Animated.View
              style={[
                styles.sendButton,
                input.trim() && !sending ? styles.sendButtonActive : styles.sendButtonInactive,
                { transform: [{ scale: buttonScale }] }
              ]}
            >
              <Text style={[styles.sendButtonText, input.trim() && !sending ? styles.sendButtonTextActive : styles.sendButtonTextInactive]}>
                {sending ? '⏳' : '➤'}
              </Text>
            </Animated.View>
          </TouchableOpacity>
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

        {/* Message Action Menu */}
        <Modal
          visible={messageMenuVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setMessageMenuVisible(false)}
        >
          <TouchableWithoutFeedback onPress={() => setMessageMenuVisible(false)}>
            <View style={styles.modalOverlay}>
              <View style={styles.messageActionMenu}>
                {/* Reactions */}
                <View style={styles.reactionsRow}>
                  <TouchableOpacity style={styles.reactionButton} onPress={() => addReaction('👍')}>
                    <Text style={styles.reactionEmoji}>👍</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.reactionButton} onPress={() => addReaction('❤️')}>
                    <Text style={styles.reactionEmoji}>❤️</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.reactionButton} onPress={() => addReaction('😂')}>
                    <Text style={styles.reactionEmoji}>😂</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.reactionButton} onPress={() => addReaction('😮')}>
                    <Text style={styles.reactionEmoji}>😮</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.reactionButton} onPress={() => addReaction('😢')}>
                    <Text style={styles.reactionEmoji}>😢</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.reactionButton} onPress={() => addReaction('🙏')}>
                    <Text style={styles.reactionEmoji}>🙏</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.reactionButton}>
                    <Icon name="plus" size={20} color="#999" />
                  </TouchableOpacity>
                </View>

                {/* Actions */}
                <TouchableOpacity style={styles.actionItem} onPress={() => setMessageMenuVisible(false)}>
                  <Icon name="reply" size={20} color="#ddd" />
                  <Text style={styles.actionText}>Reply</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionItem} onPress={() => setMessageMenuVisible(false)}>
                  <Icon name="content-copy" size={20} color="#ddd" />
                  <Text style={styles.actionText}>Copy</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionItem} onPress={() => setMessageMenuVisible(false)}>
                  <Icon name="share" size={20} color="#ddd" />
                  <Text style={styles.actionText}>Forward</Text>
                </TouchableOpacity>
                {selectedMessage?.sender === 'me' && (
                  <TouchableOpacity style={styles.actionItem} onPress={() => setMessageMenuVisible(false)}>
                    <Icon name="pencil" size={20} color="#ddd" />
                    <Text style={styles.actionText}>Edit</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={styles.actionItem} onPress={() => setMessageMenuVisible(false)}>
                  <Icon name="star-outline" size={20} color="#ddd" />
                  <Text style={styles.actionText}>Star</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionItem} onPress={() => setMessageMenuVisible(false)}>
                  <Icon name="delete" size={20} color="#f44336" />
                  <Text style={[styles.actionText, { color: '#f44336' }]}>Delete</Text>
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

  // Message Action Menu
  messageActionMenu: {
    position: 'absolute',
    bottom: 100,
    left: 20,
    right: 20,
    backgroundColor: '#2a2a2a',
    borderRadius: 16,
    padding: 12,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  reactionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#444',
    marginBottom: 8,
  },
  reactionButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
  },
  reactionEmoji: {
    fontSize: 24,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
  },
  actionText: {
    fontSize: 16,
    color: '#ddd',
    marginLeft: 16,
  },
  reactionBadge: {
    position: 'absolute',
    bottom: -8,
    right: 8,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  reactionBadgeEmoji: {
    fontSize: 16,
  },
});