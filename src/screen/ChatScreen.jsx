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
  TouchableWithoutFeedback,
  ActivityIndicator,
  Share,
  Clipboard // If available, or use a package. Since react-native core clipboard is deprecated, we might need to check packages.
  // Wait, React Native Clipboard is deprecated in newer versions. 
  // Let's check imports. User provided package.json has "@react-native-community/cli", etc.
  // Actually, standard modern approach is Clipboard from '@react-native-clipboard/clipboard' if installed, or try React Native one if older.
  // Checking user package.json: no clipboard package. 
  // We'll rely on text input copy or assume standard Clipboard for now if it exists in RN < 0.60 or use a workaround.
  // Actually, `Clipboard` is removed from RN core.
  // We will assume `Clipboard` might not work directly. 
  // Instead, let's just implement Forward, Edit (copy to input), Reply, Delete, Star.
} from "react-native";
import { useNavigation, useRoute } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import SmsController from '../../Controller/SmsController';
import { useTheme } from "../context/ThemeContext";

// In-memory cache for chat messages
const chatCache = {};

export default function ChatScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { contactId, name } = route.params || {};
  const { theme } = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);

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

  // Pagination State
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);


  const loadSmsMessages = React.useCallback(async (refresh = false, nextPage = 1) => {
    if (!contactId) return;

    // Check cache first if not refreshing and page 1
    if (!refresh && nextPage === 1 && chatCache[contactId]) {
      setMessages(chatCache[contactId].messages);
      // We proceed to background refresh starred status or just rely on cache
    }

    if (nextPage > 1) {
      setLoadingMore(true);
    }

    try {
      const result = await SmsController.getChatMessages(contactId, nextPage);
      const starredIds = await SmsController.getStarredMessages();

      const processMessages = (msgs) => msgs.map(m => ({
        ...m,
        starred: starredIds.includes(m.id)
      }));

      const processedNew = processMessages(result.messages);

      if (nextPage === 1) {
        setMessages(processedNew);
      } else {
        setMessages(prev => {
          return [...processedNew, ...prev];
        });
      }

      setHasMore(result.hasMore);
      setPage(result.page);

      if (nextPage === 1) {
        chatCache[contactId] = { messages: processedNew };
        messagesLoaded.current = true;
      }

    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to fetch SMS messages: ' + error.message);
    } finally {
      setLoadingMore(false);
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
        await loadSmsMessages(true, 1);
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

  const handleAction = async (action) => {
    if (!selectedMessage) return;
    setMessageMenuVisible(false);

    switch (action) {
      case 'reply':
        setInput(`Replying to: "${selectedMessage.text.substring(0, 20)}..."\n`);
        break;
      case 'copy':
        setInput(selectedMessage.text);
        break;
      case 'forward':
        await SmsController.forwardMessage(selectedMessage.text);
        break;
      case 'edit':
        setInput(selectedMessage.text);
        break;
      case 'star':
        const isStarred = await SmsController.toggleStarMessage(selectedMessage.id);
        setMessages(prev => prev.map(m => m.id === selectedMessage.id ? { ...m, starred: isStarred } : m));
        // Update cache
        if (chatCache[contactId]) {
          chatCache[contactId].messages = chatCache[contactId].messages.map(m => m.id === selectedMessage.id ? { ...m, starred: isStarred } : m);
        }
        break;
      case 'delete':
        Alert.alert('Delete Message', 'Are you sure?', [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              try {
                await SmsController.deleteMessage(selectedMessage.id);
                setMessages(prev => prev.filter(m => m.id !== selectedMessage.id));
                // Update cache
                if (chatCache[contactId]) {
                  chatCache[contactId].messages = chatCache[contactId].messages.filter(m => m.id !== selectedMessage.id);
                }
              } catch (e) {
                Alert.alert('Error', 'Could not delete message');
              }
            }
          }
        ]);
        break;
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
              <Text style={styles.headerName}>{SmsController.getContactName(contactId) || name}</Text>
              <Text style={[styles.headerStatus, { color: isOnline ? theme.colors.success : theme.colors.textSecondary }]}>
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
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderMessage}
          style={styles.messagesList}
          contentContainerStyle={styles.messagesContainer}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={(w, h) => {
            // Only scroll to bottom on initial load or sending message, not when loading previous
            if (page === 1 && !loadingMore) {
              scrollToBottom();
            }
          }}
          onLayout={scrollToBottom}
          onScroll={({ nativeEvent }) => {
            if (nativeEvent.contentOffset.y <= 10 && hasMore && !loadingMore && messages.length > 0) {
              loadSmsMessages(true, page + 1);
            }
          }}
          scrollEventThrottle={16}
          ListHeaderComponent={loadingMore ? <ActivityIndicator size="small" color={theme.colors.primary} style={{ marginVertical: 10 }} /> : null}
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
              placeholderTextColor={theme.colors.placeholder}
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
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setIsProfileMenuVisible(false)}
          >
            <TouchableWithoutFeedback>
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
            </TouchableWithoutFeedback>
          </TouchableOpacity>
        </Modal>

        {/* Message Action Menu */}
        <Modal
          visible={messageMenuVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setMessageMenuVisible(false)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setMessageMenuVisible(false)}
          >
            <TouchableWithoutFeedback>
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
                <TouchableOpacity style={styles.actionItem} onPress={() => handleAction('reply')}>
                  <Icon name="reply" size={20} color="#ddd" />
                  <Text style={styles.actionText}>Reply</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionItem} onPress={() => handleAction('copy')}>
                  <Icon name="content-copy" size={20} color="#ddd" />
                  <Text style={styles.actionText}>Copy</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionItem} onPress={() => handleAction('forward')}>
                  <Icon name="share-variant" size={20} color="#ddd" />
                  <Text style={styles.actionText}>Forward</Text>
                </TouchableOpacity>
                {selectedMessage?.sender === 'me' && (
                  <TouchableOpacity style={styles.actionItem} onPress={() => handleAction('edit')}>
                    <Icon name="pencil" size={20} color="#ddd" />
                    <Text style={styles.actionText}>Edit</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={styles.actionItem} onPress={() => handleAction('star')}>
                  <Icon name={selectedMessage?.starred ? "star" : "star-outline"} size={20} color={selectedMessage?.starred ? "#fbc02d" : "#ddd"} />
                  <Text style={styles.actionText}>{selectedMessage?.starred ? "Unstar" : "Star"}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionItem} onPress={() => handleAction('delete')}>
                  <Icon name="delete" size={20} color="#f44336" />
                  <Text style={[styles.actionText, { color: '#f44336' }]}>Delete</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </TouchableOpacity>
        </Modal>

      </KeyboardAvoidingView>
    </View>
  );
}

const getStyles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  keyboardContainer: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.headerBackground,
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
    color: theme.colors.iconColor,
    fontWeight: '300',
  },
  headerInfo: {
    flex: 1,
  },
  headerName: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text,
  },
  headerStatus: {
    fontSize: 12,
    color: theme.colors.success,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: theme.colors.text,
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
    fontSize: 22,
    color: theme.colors.iconColor,
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
    backgroundColor: theme.colors.myMessage,
    borderBottomRightRadius: 4,
  },
  otherMessage: {
    alignSelf: 'flex-start',
    backgroundColor: theme.colors.otherMessage,
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
    color: theme.colors.myMessageText,
  },
  otherMessageText: {
    color: theme.colors.otherMessageText,
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
    color: 'rgba(255,255,255,0.7)',
  },
  otherTimeText: {
    color: theme.colors.textSecondary,
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
    color: 'rgba(255,255,255,0.7)',
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
    backgroundColor: theme.colors.headerBackground,
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
    color: theme.colors.inputText,
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
    backgroundColor: theme.colors.primary,
    elevation: 6,
    shadowOpacity: 0.25,
  },
  sendButtonInactive: {
    backgroundColor: theme.colors.secondary,
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
    color: theme.colors.textSecondary,
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
    color: theme.colors.textSecondary,
    fontWeight: '300',
  },
  textInputContainer: {
    flex: 1,
    backgroundColor: theme.colors.inputBackground,
    borderRadius: 24,
    marginRight: 8,
    paddingHorizontal: 4,
  },

  // Modal / Menu
  modalOverlay: {
    flex: 1,
    backgroundColor: theme.colors.modalOverlay,
  },
  menuContainer: {
    position: 'absolute',
    top: 60,
    right: 20,
    backgroundColor: theme.colors.menuBackground,
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
    color: theme.colors.text,
    fontWeight: '500',
  },

  // Message Action Menu
  messageActionMenu: {
    position: 'absolute',
    bottom: 100,
    left: 20,
    right: 20,
    backgroundColor: '#2a2a2a', // Keep dark for actions
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
    backgroundColor: theme.colors.card,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  reactionBadgeEmoji: {
    fontSize: 16,
  },
});