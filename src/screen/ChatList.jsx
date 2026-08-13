// screens/ChatsList.js
import React, { useState, useEffect, useMemo, useRef, useCallback, memo } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Alert,
  StyleSheet,
  StatusBar,
  Platform,
  ScrollView,
  Modal,
  TouchableWithoutFeedback,
  TextInput,
  ActivityIndicator,
  Animated,
  InteractionManager,
  RefreshControl,
} from "react-native";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import SmsController from '../../Controller/SmsController';
import CategoryController from '../../Controller/CategoryController';
import DefaultSmsPrompt from './DefaultSmsPrompt';
import { useTheme } from '../context/ThemeContext';
import useSmsEvents from '../hooks/useSmsEvents';
import { Switch } from 'react-native';
import ScalePressable from '../components/animations/ScalePressable';
import { Swipeable } from 'react-native-gesture-handler';
import { Search, RotateCcw, User, Plus, Sun, Moon, LogOut, Settings, Archive, CheckSquare, Edit, Trash2, Shield, Pin, MessageSquare } from 'lucide-react-native';

const CHAT_ROW_HEIGHT = 80;

// Tab display label → ML category value (matches ml/model/config.py HAM_CATEGORIES)
const ML_TAB_FILTERS = {
  All: null,
  Personal: 'personal',
  Banking: 'banking',
  OTP: 'otp',
  Subscription: 'subscription',
  Promotions: 'promotional',
  Unknown: 'unknown',
};

const ChatRow = memo(function ChatRow({
  item,
  theme,
  onPress,
  onArchive,
  onDelete,
}) {
  const renderRightActions = useCallback((progress, dragX) => {
    const scale = dragX.interpolate({
      inputRange: [-100, 0],
      outputRange: [1, 0],
      extrapolate: 'clamp',
    });

    return (
      <TouchableOpacity
        style={[styles.swipeAction, { backgroundColor: '#ef4444' }]}
        onPress={() => onDelete(item)}
      >
        <Animated.View style={{ transform: [{ scale }], alignItems: 'center' }}>
          <Trash2 size={24} color="#FFF" />
        </Animated.View>
      </TouchableOpacity>
    );
  }, [item, onDelete]);

  const renderLeftActions = useCallback((progress, dragX) => {
    const scale = dragX.interpolate({
      inputRange: [0, 100],
      outputRange: [0, 1],
      extrapolate: 'clamp',
    });

    return (
      <TouchableOpacity
        style={[styles.swipeAction, { backgroundColor: '#1a73e8' }]}
        onPress={() => onArchive(item)}
      >
        <Animated.View style={{ transform: [{ scale }], alignItems: 'center' }}>
          <Archive size={24} color="#FFF" />
        </Animated.View>
      </TouchableOpacity>
    );
  }, [item, onArchive]);

  return (
    <Swipeable
      renderRightActions={renderRightActions}
      renderLeftActions={renderLeftActions}
      overshootRight={false}
      overshootLeft={false}
    >
      <ScalePressable
        style={[styles.chatItem, { backgroundColor: theme.background }]}
        onPress={() => onPress(item)}
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
      </ScalePressable>
    </Swipeable>
  );
});

export default function ChatsList() {
  const { theme, toggleTheme } = useTheme();
  const navigation = useNavigation();
  const [contacts, setContacts] = useState([]);
  const [showDefaultPrompt, setShowDefaultPrompt] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadTotal, setUnreadTotal] = useState(0);
  const [pinnedIds, setPinnedIds] = useState([]);

  // Pagination State
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const loadingMoreRef = useRef(false);

  // UI States
  const [searchText, setSearchText] = useState('');
  // Collections State — tabs aligned to ML category labels
  const [collections, setCollections] = useState(Object.keys(ML_TAB_FILTERS));
  const [selectedCategory, setSelectedCategory] = useState('All');
  const categoryScrollRef = useRef(null);
  const [isAddCollectionVisible, setIsAddCollectionVisible] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [editingCategory, setEditingCategory] = useState(null);

  // UI Visibility States
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [isProfileMenuVisible, setIsProfileMenuVisible] = useState(false);

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

  const loadSmsMessages = useCallback(async (refresh = false, nextPage = 1) => {
    if (loadingMoreRef.current && nextPage > 1) {
      return;
    }

    try {
      if (nextPage === 1) {
        const hasPermissions = await requestSmsPermissions();
        if (!hasPermissions) {
          setInitialLoading(false);
          setRefreshing(false);
          return;
        }
      }

      if (nextPage > 1) {
        loadingMoreRef.current = true;
        setLoadingMore(true);
      }

      if (refresh) {
        SmsController.clearCache();
      }

      const result = await SmsController.getConversations(nextPage);

      if (nextPage === 1) {
        setContacts(result.conversations);
      } else {
        setContacts(prev => {
          const existingIds = new Set(prev.map(c => c.id));
          const merged = result.conversations.filter(c => !existingIds.has(c.id));
          return merged.length > 0 ? [...prev, ...merged] : prev;
        });
      }

      setHasMore(result.hasMore);
      setPage(result.page);

      if (nextPage === 1) {
        const total = await SmsController.getUnreadCount();
        setUnreadTotal(total);
        setPinnedIds(await SmsController.getPinnedConversations());
      }
    } catch (error) {
      console.error('SMS fetch error:', error);
      if (nextPage === 1) {
        Alert.alert('Error', 'Failed to fetch SMS messages: ' + error.message);
      }
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
      setInitialLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    checkDefaultSmsApp();
  }, []);

  useFocusEffect(
    useCallback(() => {
      const task = InteractionManager.runAfterInteractions(() => {
        loadSmsMessages(true, 1);
      });
      return () => task.cancel();
    }, [loadSmsMessages]),
  );

  const handleIncomingSms = useCallback(() => {
    SmsController.clearCache();
    loadSmsMessages(true, 1);
  }, [loadSmsMessages]);

  useSmsEvents(handleIncomingSms);

  useEffect(() => {
    if (!categoryScrollRef.current || selectedCategory === 'All') return;

    const index = collections.indexOf(selectedCategory);
    if (index >= 0) {
      categoryScrollRef.current.scrollTo({ x: Math.max(0, index * 110), animated: true });
    }
  }, [collections, selectedCategory]);

  const refreshSmsData = useCallback(async () => {
    setRefreshing(true);
    setHasMore(true);
    await loadSmsMessages(true, 1);
  }, [loadSmsMessages]);

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

  const handleMarkAllAsRead = async () => {
    try {
      await SmsController.markAllAsRead();
      setContacts(prev => prev.map(c => ({ ...c, unread: 0 })));
      Alert.alert("Success", "All messages marked as read.");
    } catch (e) {
      console.error("Error marking all as read", e);
    }
  };

  const markAsRead = useCallback(async (contactId) => {
    setContacts(prev =>
      prev.map(c => (c.id === contactId ? { ...c, unread: 0 } : c)),
    );

    try {
      await SmsController.markAsRead(contactId);
    } catch (dbError) {
      console.warn('Database mark as read failed:', dbError);
    }
  }, []);

  const handleOpenChat = useCallback((item) => {
    markAsRead(item.id);
    navigation.navigate("Chat", { contactId: item.id, name: item.name });
  }, [markAsRead, navigation]);

  const handleArchiveConversation = useCallback((item) => {
    SmsController.archiveConversation(item.id).then(() => {
      setContacts(prev => prev.filter(c => c.id !== item.id));
    });
  }, []);

  const handlePinConversation = useCallback(async (item) => {
    const pinned = await SmsController.getPinnedConversations();
    if (pinned.includes(item.id)) {
      await SmsController.unpinConversation(item.id);
    } else {
      await SmsController.pinConversation(item.id);
    }
    loadSmsMessages(true, 1);
  }, [loadSmsMessages]);

  const handleDeleteConversation = useCallback((item) => {
    Alert.alert(
      "Move to Recycle Bin?",
      `Are you sure you want to delete conversation with ${item.name}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await SmsController.recycleConversation(item.id);
            setContacts(prev => prev.filter(c => c.id !== item.id));
          },
        },
      ],
    );
  }, []);

  const handleAddCollection = async () => {
    if (newCollectionName.trim()) {
      const updated = await CategoryController.addCategory(newCollectionName.trim());
      setCollections(updated);
      setNewCollectionName('');
      setIsAddCollectionVisible(false);
    }
  };

  const handleRenameCategory = async () => {
    if (newCollectionName.trim() && editingCategory) {
      try {
        const updated = await CategoryController.renameCategory(editingCategory, newCollectionName.trim());
        setCollections(updated);
        // Update selection if we renamed the currently selected one
        if (selectedCategory === editingCategory) {
          setSelectedCategory(newCollectionName.trim());
        }
        setNewCollectionName('');
        setEditingCategory(null);
        setIsAddCollectionVisible(false);
      } catch (e) {
        Alert.alert("Error", e.message);
      }
    }
  };

  const initiateEditCategory = (category) => {
    if (category === 'All') return; // Cannot edit 'All'
    setEditingCategory(category);
    setNewCollectionName(category);
    setIsAddCollectionVisible(true);
  };

  // Filter Logic
  const filteredContacts = useMemo(() => {
    let result = contacts;

    // Category Filter — match conversation ML category to selected tab
    if (selectedCategory !== 'All') {
      const mlCategory = ML_TAB_FILTERS[selectedCategory] ?? selectedCategory.toLowerCase();
      result = result.filter(c => c.category === mlCategory);
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
  }, [contacts, selectedCategory, searchText]);

  const renderItem = useCallback(({ item }) => (
    <ChatRow
      item={item}
      theme={theme}
      onPress={handleOpenChat}
      onArchive={handleArchiveConversation}
      onDelete={handleDeleteConversation}
    />
  ), [theme, handleOpenChat, handleArchiveConversation, handleDeleteConversation]);

  const keyExtractor = useCallback((item) => item.id, []);
  const flatListContentStyle = useMemo(() => ({ paddingBottom: 100 }), []);
  const getItemLayout = useCallback(
    (_, index) => ({
      length: CHAT_ROW_HEIGHT,
      offset: CHAT_ROW_HEIGHT * index,
      index,
    }),
    [],
  );
  const handleEndReached = useCallback(() => {
    if (hasMore && !loadingMoreRef.current && !searchText && selectedCategory === 'All') {
      loadSmsMessages(false, page + 1);
    }
  }, [hasMore, searchText, selectedCategory, page, loadSmsMessages]);

  const listEmptyComponent = useMemo(() => (
    initialLoading ? (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
          Loading conversations...
        </Text>
      </View>
    ) : (
      <View style={styles.loadingContainer}>
        <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
          No conversations found
        </Text>
      </View>
    )
  ), [initialLoading, theme.primary, theme.textSecondary]);

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
          <View style={{ flex: 1 }}>
            <Text style={[styles.headerTitle, { color: theme.text }]}>Messages</Text>
            {unreadTotal > 0 ? (
              <Text style={{ color: theme.textSecondary, fontSize: 13 }}>
                {unreadTotal} unread
              </Text>
            ) : null}
          </View>
        )}

        <View style={styles.headerActions}>
          {!isSearchVisible && (
            <TouchableOpacity style={[styles.searchIconButton, { backgroundColor: theme.surface, borderColor: theme.border }]} onPress={() => setIsSearchVisible(true)}>
              <Search size={22} color={theme.text} />
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.iconButton, { marginLeft: 12 }]}
            onPress={refreshSmsData}
          >
            <RotateCcw size={22} color={theme.text} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.profileButton} onPress={() => setIsProfileMenuVisible(true)}>
            <View style={[styles.profileAvatar, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <User size={20} color={theme.text} />
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {/* Collections Bar */}
      <View style={[styles.categoryBarContainer, { borderBottomColor: theme.border }]}>
        <ScrollView
          ref={categoryScrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          nestedScrollEnabled={true}
          bounces={true}
          style={styles.categoryScroll}
          contentContainerStyle={styles.categoryScrollView}
        >
          {collections.map(cat => (
            <TouchableOpacity
              key={cat}
              style={[
                styles.categoryPill,
                { backgroundColor: selectedCategory === cat ? theme.primary : theme.surface },
                selectedCategory === cat && styles.categoryPillActive
              ]}
              onPress={() => setSelectedCategory(cat)}
              onLongPress={() => initiateEditCategory(cat)}
              delayLongPress={500}
            >
              <Text style={[
                styles.categoryText,
                { color: selectedCategory === cat ? theme.onPrimary : theme.textSecondary }
              ]}>{cat}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={[styles.categoryPill, { backgroundColor: theme.surface }]}
            onPress={() => navigation.navigate('Spam')}
          >
            <Shield size={16} color={theme.textSecondary} />
            <Text style={[styles.categoryText, { color: theme.textSecondary, marginLeft: 6 }]}>Spam</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.addCategoryButton, { backgroundColor: theme.surface }]}
            onPress={() => setIsAddCollectionVisible(true)}
          >
            <Plus size={20} color={theme.textSecondary} />
          </TouchableOpacity>
        </ScrollView>
      </View>

      <FlatList
        data={filteredContacts}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
        style={styles.flatList}
        contentContainerStyle={flatListContentStyle}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.4}
        getItemLayout={getItemLayout}
        removeClippedSubviews={true}
        maxToRenderPerBatch={12}
        windowSize={8}
        initialNumToRender={12}
        updateCellsBatchingPeriod={100}
        ListEmptyComponent={listEmptyComponent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refreshSmsData}
            colors={[theme.primary]}
            tintColor={theme.primary}
          />
        }
        ListFooterComponent={
          loadingMore ? (
            <ActivityIndicator size="small" color={theme.primary} style={{ marginVertical: 20 }} />
          ) : null
        }
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
                  navigation.navigate('Blocked');
                }}
              >
                <View style={[styles.menuIconBox, { backgroundColor: theme.surface }]}>
                  <Shield size={18} color={theme.text} />
                </View>
                <Text style={[styles.menuText, { color: theme.text }]}>Blocked Contacts</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  setIsProfileMenuVisible(false);
                  navigation.navigate('Spam');
                }}
              >
                <View style={[styles.menuIconBox, { backgroundColor: theme.surface }]}>
                  <MessageSquare size={18} color={theme.text} />
                </View>
                <Text style={[styles.menuText, { color: theme.text }]}>Spam Folder</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  setIsProfileMenuVisible(false);
                  navigation.navigate('YourProfile');
                }}
              >
                <View style={[styles.menuIconBox, { backgroundColor: theme.surface }]}>
                  <User size={18} color={theme.text} />
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
                  <Archive size={18} color={theme.text} />
                </View>
                <Text style={[styles.menuText, { color: theme.text }]}>Archived</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.menuItem} onPress={() => {
                setIsProfileMenuVisible(false);
                handleMarkAllAsRead();
              }}>
                <View style={[styles.menuIconBox, { backgroundColor: theme.surface }]}>
                  <CheckSquare size={18} color={theme.text} />
                </View>
                <Text style={[styles.menuText, { color: theme.text }]}>Mark All as Read</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.menuItem} onPress={() => {
                setIsProfileMenuVisible(false);
                navigation.navigate('RecycleBin');
              }}>
                <View style={[styles.menuIconBox, { backgroundColor: theme.surface }]}>
                  <Trash2 size={18} color={theme.text} />
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
                  <Settings size={18} color={theme.text} />
                </View>
                <Text style={[styles.menuText, { color: theme.text }]}>Settings</Text>
              </TouchableOpacity>

              <View style={[styles.divider, { backgroundColor: theme.border }]} />

              <View style={[styles.menuItem, { justifyContent: 'space-between' }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={[styles.menuIconBox, { backgroundColor: theme.surface }]}>
                    {theme.mode === 'light' ? <Sun size={18} color={theme.text} /> : <Moon size={18} color={theme.text} />}
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
                  navigation.replace('Onboarding');
                }}
              >
                <View style={[styles.menuIconBox, { backgroundColor: theme.surface }]}>
                  <LogOut size={18} color={theme.danger} />
                </View>
                <Text style={[styles.menuText, { color: theme.danger }]}>Logout</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Add/Edit Collection Modal */}
      <Modal
        visible={isAddCollectionVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setIsAddCollectionVisible(false);
          setEditingCategory(null);
          setNewCollectionName('');
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.menuContainer, { backgroundColor: theme.background, alignSelf: 'center', top: '30%', minWidth: 250 }]}>
            <Text style={[styles.menuText, { marginBottom: 12, color: theme.text }]}>
              {editingCategory ? "Edit Category" : "New Collection"}
            </Text>
            <TextInput
              style={{ borderWidth: 1, borderColor: theme.border, borderRadius: 8, padding: 8, color: theme.text, marginBottom: 16 }}
              placeholder="Collection Name"
              placeholderTextColor={theme.textSecondary}
              value={newCollectionName}
              onChangeText={setNewCollectionName}
              autoFocus
            />
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
              <TouchableOpacity
                onPress={() => {
                  setIsAddCollectionVisible(false);
                  setEditingCategory(null);
                  setNewCollectionName('');
                }}
                style={{ marginRight: 16 }}
              >
                <Text style={{ color: theme.textSecondary, fontWeight: '600' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={editingCategory ? handleRenameCategory : handleAddCollection}>
                <Text style={{ color: theme.primary, fontWeight: '600' }}>
                  {editingCategory ? "Save" : "Add"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Floating Action Button */}
      <ScalePressable
        style={styles.fab}
        onPress={() => navigation.navigate('NewChat')}
      >
        <Plus size={32} color="#ffffff" />
      </ScalePressable>

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
  categoryScroll: {
    flexGrow: 0,
  },
  categoryScrollView: {
    paddingHorizontal: 20,
    alignItems: 'center',
    paddingRight: 8,
  },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
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
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
  },
  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 20,
    paddingVertical: 14,
    minHeight: CHAT_ROW_HEIGHT,
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

  // Swipe Actions
  swipeAction: {
    width: 70,
    justifyContent: 'center',
    alignItems: 'center',
  },
  archiveAction: {
    width: 60,
    height: 60,
    backgroundColor: '#ef4444',
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 10,
    marginHorizontal: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
  },
  actionText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
    display: 'none', // Hiding text as per Screenshot 2 which has just icon
  },
});