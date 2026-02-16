// screens/ChatsList.js
import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Alert,
  StyleSheet,
  PermissionsAndroid,
  Platform,
  ScrollView,
  Modal,
  TouchableWithoutFeedback,
  TextInput,
  ActivityIndicator,
  Image
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import SmsController from '../../Controller/SmsController';
import DefaultSmsPrompt from './DefaultSmsPrompt';
import ProfilePhotoModal from '../components/ProfilePhotoModal';
import { useTheme } from "../context/ThemeContext";

const getAvatarColor = (address) => {
  const colors = ['#2563eb', '#fd79a8', '#fdcb6e', '#e17055', '#1d4ed8', '#00b894'];
  const index = address.charCodeAt(0) % colors.length;
  return colors[index];
};

const CATEGORIES = ['All', 'Family', 'Official', 'Important'];

export default function ChatsList() {
  const navigation = useNavigation();
  const { theme, toggleTheme } = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);

  const [contacts, setContacts] = useState([]);
  const [readContacts, setReadContacts] = useState(new Set());
  const [showDefaultPrompt, setShowDefaultPrompt] = useState(false);
  const [smsLoaded, setSmsLoaded] = useState(false);

  // Pagination State
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // UI States
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [isProfileMenuVisible, setIsProfileMenuVisible] = useState(false);
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [profilePhoto, setProfilePhoto] = useState(null);
  const [isPhotoModalVisible, setIsPhotoModalVisible] = useState(false);
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

  const loadSmsMessages = async (refresh = false, nextPage = 1) => {
    try {
      if (smsLoaded && !refresh && nextPage === 1) {
        return;
      }

      if (nextPage === 1) {
        const hasPermissions = await requestSmsPermissions();
        if (!hasPermissions) {
          setSmsLoaded(true);
          return;
        }
      }

      if (nextPage > 1) {
        setLoadingMore(true);
      }

      console.log('Loading conversations page:', nextPage);
      const result = await SmsController.getConversations(nextPage);

      if (nextPage === 1) {
        setContacts(result.conversations);
      } else {
        setContacts(prev => [...prev, ...result.conversations]);
      }

      setHasMore(result.hasMore);
      setPage(result.page);
      setSmsLoaded(true);

    } catch (error) {
      console.error('SMS fetch error:', error);
      Alert.alert('Error', 'Failed to fetch SMS messages: ' + error.message);
      setSmsLoaded(true);
    } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    checkDefaultSmsApp();
    initializeData();
    loadProfilePhoto();
  }, []);

  const initializeData = async () => {
    await SmsController.prefetchContacts();
    await loadSmsMessages();
  };

  const loadProfilePhoto = async () => {
    const uri = await SmsController.getProfilePhoto();
    if (uri) {
      setProfilePhoto(uri);
    }
  };

  const handleImageSelected = async (uri) => {
    setProfilePhoto(uri);
    await SmsController.saveProfilePhoto(uri);
  };

  const refreshSmsData = async () => {
    setSmsLoaded(false);
    await loadSmsMessages(true, 1);
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
      style={styles.chatItem}
      onPress={() => {
        markAsRead(item.id);
        navigation.navigate("Chat", { contactId: item.id, name: item.name });
      }}
    >
      <View style={[styles.avatar, { backgroundColor: item.avatarColor }]}>
        <Text style={styles.avatarText}>{item.avatar}</Text>
      </View>

      <View style={styles.chatContent}>
        <Text style={styles.contactName}>{item.name}</Text>
        <Text style={styles.lastMessage} numberOfLines={1}>
          {item.lastMessage}
        </Text>
      </View>

      <View style={styles.timeContainer}>
        <Text style={styles.timeText}>{item.time}</Text>
        {item.unread > 0 && (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadText}>{item.unread}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Enhanced Header */}
      <View style={styles.header}>
        {isSearchVisible ? (
          <TextInput
            style={styles.searchInput}
            placeholder="Search messages..."
            placeholderTextColor={theme.colors.placeholder}
            value={searchText}
            onChangeText={setSearchText}
            autoFocus
            onBlur={() => !searchText && setIsSearchVisible(false)}
          />
        ) : (
          <Text style={styles.headerTitle}>Messages</Text>
        )}

        <View style={styles.headerActions}>
          {!isSearchVisible && (
            <TouchableOpacity style={styles.iconButton} onPress={() => setIsSearchVisible(true)}>
              <Text style={styles.iconText}>🔍</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.iconButton}
            onPress={refreshSmsData}
          >
            <Text style={styles.iconText}>↻</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.profileButton} onPress={() => setIsProfileMenuVisible(true)}>
            <View style={styles.profileAvatar}>
              {profilePhoto ? (
                <Image source={{ uri: profilePhoto }} style={styles.profileImage} />
              ) : (
                <Text style={styles.profileAvatarText}>👤</Text>
              )}
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {/* Category Bar */}
      <View style={styles.categoryBarContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryScrollView}>
          {CATEGORIES.map(cat => (
            <TouchableOpacity
              key={cat}
              style={[styles.categoryPill, selectedCategory === cat && styles.categoryPillActive]}
              onPress={() => setSelectedCategory(cat)}
            >
              <Text style={[styles.categoryText, selectedCategory === cat && styles.categoryTextActive]}>{cat}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={styles.addCategoryButton}>
            <Text style={styles.addCategoryText}>+</Text>
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
        onEndReached={() => {
          if (hasMore && !loadingMore && !searchText && selectedCategory === 'All') {
            loadSmsMessages(false, page + 1);
          }
        }}
        onEndReachedThreshold={0.5}
        ListFooterComponent={loadingMore ? <ActivityIndicator size="small" color={theme.colors.primary} style={{ marginVertical: 20 }} /> : null}
      />

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
              <TouchableOpacity style={styles.menuItem} onPress={toggleTheme}>
                <Text style={styles.menuText}>{theme.dark ? "Switch to Light Mode" : "Switch to Dark Mode"}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  setIsProfileMenuVisible(false);
                  setIsPhotoModalVisible(true);
                }}
              >
                <Text style={styles.menuText}>Change Profile Photo</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.menuItem} onPress={() => setIsProfileMenuVisible(false)}>
                <Text style={styles.menuText}>Settings</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  setIsProfileMenuVisible(false);
                  navigation.navigate('ContactUs');
                }}
              >
                <Text style={styles.menuText}>Contact Us</Text>
              </TouchableOpacity>
              <View style={styles.divider} />
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  setIsProfileMenuVisible(false);
                  navigation.replace('InfoOne');
                }}
              >
                <Text style={[styles.menuText, { color: '#dc3545' }]}>Logout</Text>
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </TouchableOpacity>
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

      <ProfilePhotoModal
        visible={isPhotoModalVisible}
        onClose={() => setIsPhotoModalVisible(false)}
        onImageSelected={handleImageSelected}
      />
    </View>
  );
}

const getStyles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.headerBackground,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 0,
    elevation: 0,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: theme.colors.text,
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
    color: theme.colors.text,
    paddingVertical: 0,
  },
  iconButton: {
    marginLeft: 16,
    padding: 8,
  },
  iconText: {
    fontSize: 20,
    color: theme.colors.iconColor,
  },
  profileButton: {
    marginLeft: 12,
  },
  profileAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
  },
  profileImage: {
    width: 36,
    height: 36,
  },
  profileAvatarText: {
    fontSize: 18,
    color: theme.colors.text,
  },

  // Category Bar
  categoryBarContainer: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.secondary,
  },
  categoryScrollView: {
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  categoryPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: theme.colors.secondary,
    borderRadius: 20,
    marginRight: 8,
  },
  categoryPillActive: {
    backgroundColor: theme.colors.primary,
  },
  categoryText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  categoryTextActive: {
    color: '#ffffff',
  },
  addCategoryButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 4,
  },
  addCategoryText: {
    fontSize: 20,
    color: theme.colors.textSecondary,
    fontWeight: '300',
  },

  flatList: {
    flex: 1,
  },
  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.card,
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
    color: theme.colors.text,
    marginBottom: 4,
  },
  lastMessage: {
    fontSize: 15,
    color: theme.colors.textSecondary,
  },
  timeContainer: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  timeText: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginBottom: 6,
  },
  unreadBadge: {
    backgroundColor: theme.colors.primary,
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
    backgroundColor: theme.colors.primary,
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
    minWidth: 180,
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
  divider: {
    height: 1,
    backgroundColor: theme.colors.divider,
    marginVertical: 4,
  },
});