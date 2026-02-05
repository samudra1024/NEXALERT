// screens/ChatsList.js
import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Alert,
  StyleSheet,
  StatusBar,
  PermissionsAndroid,
  Platform,
  ScrollView,
  Modal,
  TouchableWithoutFeedback,
  TextInput
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import SmsController from '../../Controller/SmsController';
import DefaultSmsPrompt from './DefaultSmsPrompt';
import { useTheme } from '../context/ThemeContext';
import { Switch } from 'react-native';

const getAvatarColor = (address) => {
  const colors = ['#2563eb', '#fd79a8', '#fdcb6e', '#e17055', '#1d4ed8', '#00b894'];
  const index = address.charCodeAt(0) % colors.length;
  return colors[index];
};

const CATEGORIES = ['All', 'Family', 'Official', 'Important'];

export default function ChatsList() {
  const { theme, toggleTheme } = useTheme();
  const navigation = useNavigation();
  const [contacts, setContacts] = useState([]);
  const [readContacts, setReadContacts] = useState(new Set());
  const [showDefaultPrompt, setShowDefaultPrompt] = useState(false);
  const [smsLoaded, setSmsLoaded] = useState(false);

  // UI States
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [isProfileMenuVisible, setIsProfileMenuVisible] = useState(false);
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [searchText, setSearchText] = useState('');
  // Mock Category Map (In a real app, this would be persisted)
  const [categoryMap, setCategoryMap] = useState({});

  const requestSmsPermissions = async () => {
    try {
      const hasPermissions = await SmsController.requestAllSmsPermissions();
      if (!hasPermissions) {
        Alert.alert('Permissions Required', 'SMS permissions are required for full functionality.');
        return false;
      }
      return true;
    } catch (err) {
      console.warn('Permission error:', err);
      return false;
    }
  };

  const loadSmsMessages = async (forceRefresh = false) => {
    try {
      if (smsLoaded && !forceRefresh) {
        return;
      }

      const hasPermissions = await requestSmsPermissions();
      if (!hasPermissions) {
        setSmsLoaded(true);
        return;
      }

      const messages = await SmsController.fetchSmsMessages();
      console.log('Total SMS messages fetched:', messages.length);

      const currentUnreadContacts = new Set();
      messages.forEach(msg => {
        if (parseInt(msg.type) === 1 && parseInt(msg.read) === 0) {
          currentUnreadContacts.add(msg.address);
        }
      });

      setReadContacts(prev => {
        const newSet = new Set(prev);
        currentUnreadContacts.forEach(address => {
          if (newSet.has(address)) {
            console.log('Removing from read contacts due to new unread:', address);
            newSet.delete(address);
          }
        });
        return newSet;
      });

      const contactsMap = {};

      messages.forEach(msg => {
        const address = msg.address;
        if (!contactsMap[address]) {
          contactsMap[address] = {
            id: address,
            name: address,
            messages: [],
            avatar: address.charAt(0).toUpperCase(),
            avatarColor: getAvatarColor(address)
          };
        }
        contactsMap[address].messages.push(msg);
      });

      const contactsList = Object.values(contactsMap).map(contact => {
        const sortedMessages = contact.messages.sort((a, b) => b.date - a.date);
        const latestMessage = sortedMessages[0];
        const unreadMessages = contact.messages.filter(msg => parseInt(msg.type) === 1 && parseInt(msg.read) === 0);

        const finalUnreadCount = readContacts.has(contact.id) ? 0 : unreadMessages.length;

        return {
          ...contact,
          lastMessage: latestMessage.body,
          time: new Date(latestMessage.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          unread: finalUnreadCount,
          date: latestMessage.date,
          messageCount: contact.messages.length
        };
      }).sort((a, b) => b.date - a.date);

      setContacts(contactsList);
      setSmsLoaded(true);
    } catch (error) {
      console.error('SMS fetch error:', error);
      Alert.alert('Error', 'Failed to fetch SMS messages: ' + error.message);
      setSmsLoaded(true);
    }
  };

  useEffect(() => {
    checkDefaultSmsApp();
    loadSmsMessages();
  }, []);

  const refreshSmsData = async () => {
    setSmsLoaded(false);
    await loadSmsMessages(true);
  };

  const checkDefaultSmsApp = async () => {
    try {
      const shouldShow = await SmsController.shouldShowDefaultPrompt();
      if (shouldShow) {
        setShowDefaultPrompt(true);
      }
    } catch (error) {
      console.error('Error checking default SMS app:', error);
    }
  };

  const markAsRead = async (contactId) => {
    try {
      console.log('Marking as read:', contactId);

      // Add to local read set immediately
      setReadContacts(prev => {
        const newSet = new Set(prev);
        newSet.add(contactId);
        console.log('Updated read contacts:', Array.from(newSet));
        return newSet;
      });

      // Try to mark as read in database (but don't depend on it)
      try {
        const result = await SmsController.markAsRead(contactId);
        console.log('Database mark as read result:', result);
      } catch (dbError) {
        console.warn('Database mark as read failed:', dbError);
      }

    } catch (error) {
      console.error('Error in markAsRead:', error);
    }
  };

  // Filter Logic
  const filteredContacts = useMemo(() => {
    let result = contacts;

    // Category Filter
    if (selectedCategory !== 'All') {
      result = result.filter(c => categoryMap[c.id] === selectedCategory);
    }

    // Search Filter
    if (searchText) {
      const lower = searchText.toLowerCase();
      result = result.filter(c =>
        (c.name && c.name.toLowerCase().includes(lower)) ||
        (c.lastMessage && c.lastMessage.toLowerCase().includes(lower))
      );
    }

    return result;
  }, [contacts, selectedCategory, categoryMap, searchText]);

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={[styles.chatItem, { backgroundColor: theme.background }]}
      onPress={() => {
        markAsRead(item.id);
        navigation.navigate("Chat", { contactId: item.id, name: item.name });
      }}
    >
      <View style={[styles.avatar, { backgroundColor: item.avatarColor }]}>
        <Text style={styles.avatarText}>{item.avatar}</Text>
      </View>

      <View style={styles.chatContent}>
        <Text style={[styles.contactName, { color: theme.text }]}>{item.name}</Text>
        <Text style={[styles.lastMessage, { color: theme.textSecondary }]} numberOfLines={1}>
          {item.lastMessage}
        </Text>
      </View>

      <View style={styles.timeContainer}>
        <Text style={[styles.timeText, { color: theme.textSecondary }]}>{item.time}</Text>
        {item.unread > 0 && (
          <View style={[styles.unreadBadge, { backgroundColor: theme.primary }]}>
            <Text style={[styles.unreadText, { color: theme.onPrimary }]}>{item.unread}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={theme.statusBar} backgroundColor={theme.statusBg} />

      {/* Enhanced Header */}
      <View style={[styles.header, { backgroundColor: theme.background, borderBottomColor: theme.border }]}>
        {isSearchVisible ? (
          <TextInput
            style={[styles.searchInput, { color: theme.text }]}
            placeholder="Search messages..."
            placeholderTextColor={theme.textSecondary}
            value={searchText}
            onChangeText={setSearchText}
            autoFocus
            onBlur={() => !searchText && setIsSearchVisible(false)}
          />
        ) : (
          <Text style={[styles.headerTitle, { color: theme.text }]}>Messages</Text>
        )}

        <View style={styles.headerActions}>
          {!isSearchVisible && (
            <TouchableOpacity style={[styles.searchIconButton, { backgroundColor: theme.surface, borderColor: theme.border }]} onPress={() => setIsSearchVisible(true)}>
              <Text style={[styles.searchIconText, { color: theme.text }]}>🔍</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.iconButton, { marginLeft: 12 }]} // Added margin to separate from search
            onPress={refreshSmsData}
          >
            <Text style={[styles.iconText, { color: theme.text }]}>↻</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.profileButton} onPress={() => setIsProfileMenuVisible(true)}>
            <View style={[styles.profileAvatar, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Text style={styles.profileAvatarText}>👤</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {/* Category Bar */}
      <View style={[styles.categoryBarContainer, { borderBottomColor: theme.border }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryScrollView}>
          {CATEGORIES.map(cat => (
            <TouchableOpacity
              key={cat}
              style={[
                styles.categoryPill,
                { backgroundColor: selectedCategory === cat ? theme.primary : theme.surface },
                selectedCategory === cat && styles.categoryPillActive
              ]}
              onPress={() => setSelectedCategory(cat)}
            >
              <Text style={[
                styles.categoryText,
                { color: selectedCategory === cat ? theme.onPrimary : theme.textSecondary }
              ]}>{cat}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={[styles.addCategoryButton, { backgroundColor: theme.surface }]}>
            <Text style={[styles.addCategoryText, { color: theme.textSecondary }]}>+</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      <FlatList
        data={filteredContacts}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        showsVerticalScrollIndicator={true}
        style={styles.flatList}
        contentContainerStyle={{ paddingBottom: 100 }}
      />

      {/* Profile Overflow Menu */}
      <Modal
        visible={isProfileMenuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsProfileMenuVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setIsProfileMenuVisible(false)}>
          <View style={styles.modalOverlay}>
            <View style={[styles.menuContainer, { backgroundColor: theme.background, shadowColor: theme.mode === 'dark' ? '#fff' : '#000' }]}>

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  setIsProfileMenuVisible(false);
                  navigation.navigate('YourProfile');
                }}
              >
                <View style={[styles.menuIconBox, { backgroundColor: theme.surface }]}>
                  <Text style={styles.menuIcon}>👤</Text>
                </View>
                <Text style={[styles.menuText, { color: theme.text }]}>Your Profile</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  setIsProfileMenuVisible(false);
                  navigation.navigate('Archived');
                }}
              >
                <View style={[styles.menuIconBox, { backgroundColor: theme.surface }]}>
                  <Text style={styles.menuIcon}>🗄️</Text>
                </View>
                <Text style={[styles.menuText, { color: theme.text }]}>Archived</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.menuItem} onPress={() => setIsProfileMenuVisible(false)}>
                <View style={[styles.menuIconBox, { backgroundColor: theme.surface }]}>
                  <Text style={styles.menuIcon}>✓</Text>
                </View>
                <Text style={[styles.menuText, { color: theme.text }]}>Mark All as Read</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.menuItem} onPress={() => setIsProfileMenuVisible(false)}>
                <View style={[styles.menuIconBox, { backgroundColor: theme.surface }]}>
                  <Text style={styles.menuIcon}>✎</Text>
                </View>
                <Text style={[styles.menuText, { color: theme.text }]}>Edit Categories</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.menuItem} onPress={() => setIsProfileMenuVisible(false)}>
                <View style={[styles.menuIconBox, { backgroundColor: theme.surface }]}>
                  <Text style={styles.menuIcon}>🗑️</Text>
                </View>
                <Text style={[styles.menuText, { color: theme.text }]}>Recycle Bin</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  setIsProfileMenuVisible(false);
                  navigation.navigate('Settings');
                }}
              >
                <View style={[styles.menuIconBox, { backgroundColor: theme.surface }]}>
                  <Text style={styles.menuIcon}>⚙️</Text>
                </View>
                <Text style={[styles.menuText, { color: theme.text }]}>Settings</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.menuItem} onPress={() => setIsProfileMenuVisible(false)}>
                <View style={[styles.menuIconBox, { backgroundColor: theme.surface }]}>
                  <Text style={styles.menuIcon}>❓</Text>
                </View>
                <Text style={[styles.menuText, { color: theme.text }]}>Help & Feedback</Text>
              </TouchableOpacity>

              <View style={[styles.divider, { backgroundColor: theme.border }]} />

              <View style={[styles.menuItem, { justifyContent: 'space-between' }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={[styles.menuIconBox, { backgroundColor: theme.surface }]}>
                    <Text style={styles.menuIcon}>{theme.mode === 'light' ? '☀️' : '🌙'}</Text>
                  </View>
                  <Text style={[styles.menuText, { color: theme.text }]}>Dark Mode</Text>
                </View>
                <Switch
                  value={theme.mode === 'dark'}
                  onValueChange={toggleTheme}
                  trackColor={{ false: "#767577", true: theme.primary }}
                  thumbColor={theme.mode === 'dark' ? "#f4f3f4" : "#f4f3f4"}
                />
              </View>

              <View style={[styles.divider, { backgroundColor: theme.border }]} />

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  setIsProfileMenuVisible(false);
                  navigation.replace('InfoOne');
                }}
              >
                <View style={[styles.menuIconBox, { backgroundColor: theme.surface }]}>
                  <Text style={styles.menuIcon}>🚪</Text>
                </View>
                <Text style={[styles.menuText, { color: theme.danger }]}>Logout</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Floating Action Button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('NewChat')}
        activeOpacity={0.8}
      >
        <Text style={styles.fabText}>✎</Text>
      </TouchableOpacity>

      <DefaultSmsPrompt
        visible={showDefaultPrompt}
        onClose={() => setShowDefaultPrompt(false)}
        onSuccess={() => {
          setShowDefaultPrompt(false);
          Alert.alert('Success', 'App is now your default SMS app!');
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 0,
    elevation: 0,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#1a1a1a',
    flex: 1,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchInput: {
    flex: 1,
    fontSize: 18,
    color: '#333',
    paddingVertical: 0,
  },
  iconButton: {
    marginLeft: 16,
    padding: 8,
  },
  iconText: {
    fontSize: 20,
    color: '#333',
  },
  searchIconButton: {
    marginLeft: 12,
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
    color: '#333',
  },
  profileButton: {
    marginLeft: 12,
  },
  profileAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f0f2f5',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e1e4e8',
  },
  profileAvatarText: {
    fontSize: 18,
  },

  // Category Bar
  categoryBarContainer: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f2f5',
  },
  categoryScrollView: {
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  categoryPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#f0f2f5',
    borderRadius: 20,
    marginRight: 8,
  },
  categoryPillActive: {
    backgroundColor: '#2563eb',
  },
  categoryText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#65676b',
  },
  categoryTextActive: {
    color: '#ffffff',
  },
  addCategoryButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f0f2f5',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 4,
  },
  addCategoryText: {
    fontSize: 20,
    color: '#65676b',
    fontWeight: '300',
  },

  flatList: {
    flex: 1,
  },
  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  avatarText: {
    fontSize: 22,
    fontWeight: '600',
    color: '#ffffff',
  },
  chatContent: {
    flex: 1,
    justifyContent: 'center',
  },
  contactName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  lastMessage: {
    fontSize: 15,
    color: '#65676b',
  },
  timeContainer: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  timeText: {
    fontSize: 13,
    color: '#8a8d91',
    marginBottom: 6,
  },
  unreadBadge: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    minWidth: 24,
    alignItems: 'center',
  },
  unreadText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
  },

  // FAB
  fab: {
    position: 'absolute',
    bottom: 30,
    right: 30,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#2563eb',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  fabText: {
    fontSize: 28,
    color: '#ffffff',
    fontWeight: '400',
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
    minWidth: 180,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  menuIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#f0f2f5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  menuIcon: {
    fontSize: 16,
    color: '#555',
  },
  menuText: {
    fontSize: 16,
    fontWeight: '500',
  },
  divider: {
    height: 1,
    marginVertical: 4,
  },
});