import React, { useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import OptimizedList from '../components/OptimizedList';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import SmsController from '../../Controller/SmsController';
import { formatPhoneNumber } from '../utils/contactUtils';
import { ScreenContainer } from '../components/ScreenContainer';
import ContactRow from '../components/ContactRow';
import useContacts from '../hooks/useContacts';
import { ChatListSkeleton } from '../components/SkeletonLoader';
import { ArrowLeft, Users, MoreVertical } from 'lucide-react-native';

export default function NewChat() {
  const navigation = useNavigation();
  const { theme } = useTheme();

  const {
    contacts,
    loading,
    loadingMore,
    syncing,
    fromCache,
    searchQuery,
    permissionDenied,
    setSearchQuery,
    refresh,
    handleEndReached,
  } = useContacts({ includeConversations: true, autoLoad: true });

  const isPhoneNumber = useCallback((text) => {
    return /^[\d\s+\-()]+$/.test(text.trim()) && text.trim().length >= 3;
  }, []);

  const startChat = useCallback((contactId, contactName) => {
    navigation.navigate('Chat', {
      contactId,
      name: contactName || formatPhoneNumber(contactId),
    });
  }, [navigation]);

  const handleStartNewChat = useCallback(() => {
    const trimmed = searchQuery.trim();
    if (trimmed.length > 0) {
      startChat(trimmed, formatPhoneNumber(trimmed));
    } else {
      Alert.alert('Error', 'Please enter a phone number or name');
    }
  }, [searchQuery, startChat]);

  const handleGrantPermission = useCallback(async () => {
    const granted = await SmsController.requestAllSmsPermissions();
    if (granted) {
      refresh(true);
    }
  }, [refresh]);

  const renderContactItem = useCallback(({ item }) => (
    <ContactRow item={item} theme={theme} onPress={startChat} />
  ), [theme, startChat]);

  const showSkeleton = loading && contacts.length === 0 && !fromCache;

  const listHeader = useMemo(() => (
    <View>
      {searchQuery.trim().length > 0 && isPhoneNumber(searchQuery) && (
        <TouchableOpacity
          style={styles.newChatOption}
          onPress={handleStartNewChat}
          activeOpacity={0.6}
        >
          <View style={[styles.avatar, { backgroundColor: theme.primary }]}>
            <Users size={22} color="#FFFFFF" />
          </View>
          <View style={styles.contactInfo}>
            <Text style={[styles.contactName, { color: theme.primary }]}>
              Send to {searchQuery.trim()}
            </Text>
            <Text style={[styles.contactNumber, { color: theme.textSecondary }]}>
              Start a new conversation
            </Text>
          </View>
        </TouchableOpacity>
      )}

      <View style={[styles.sectionHeader, { borderBottomColor: theme.border }]}>
        <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>
          {contacts.length > 0 ? 'Contacts' : 'Start a conversation'}
        </Text>
        {syncing && contacts.length > 0 && (
          <ActivityIndicator size="small" color={theme.primary} style={styles.syncIndicator} />
        )}
      </View>
    </View>
  ), [searchQuery, isPhoneNumber, handleStartNewChat, theme, contacts.length, syncing]);

  const listFooter = useMemo(() => {
    if (!loadingMore) {
      return null;
    }
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={theme.primary} />
      </View>
    );
  }, [loadingMore, theme.primary]);

  return (
    <ScreenContainer
      backgroundColor={theme.background}
      statusBarStyle={theme.statusBar}
      statusBarBackgroundColor={theme.statusBg}
    >
      <View style={[styles.header, { backgroundColor: theme.background, borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton} activeOpacity={0.6}>
          <ArrowLeft size={24} color={theme.text} />
        </TouchableOpacity>

        <TextInput
          style={[styles.searchInput, { color: theme.text }]}
          placeholder="Search for name or number"
          placeholderTextColor={theme.textSecondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoFocus
          returnKeyType="search"
          onSubmitEditing={() => {
            if (isPhoneNumber(searchQuery)) handleStartNewChat();
          }}
        />

        <TouchableOpacity style={styles.gridButton} activeOpacity={0.6}>
          <MoreVertical size={22} color={theme.textSecondary} />
        </TouchableOpacity>
      </View>

      {permissionDenied ? (
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
            Contacts permission is required to show your contact list.
          </Text>
          <TouchableOpacity
            style={[styles.startChatButton, { backgroundColor: theme.primary }]}
            onPress={handleGrantPermission}
          >
            <Text style={styles.startChatButtonText}>Grant Permission</Text>
          </TouchableOpacity>
        </View>
      ) : showSkeleton ? (
        <ChatListSkeleton count={10} theme={theme} />
      ) : (
        <OptimizedList
          data={contacts}
          keyExtractor={(item) => item.contactId || item.id}
          renderItem={renderContactItem}
          estimatedItemSize={68}
          useFixedItemLayout
          ListHeaderComponent={listHeader}
          ListFooterComponent={listFooter}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.4}
          ListEmptyComponent={
            !loading ? (
              <View style={styles.emptyContainer}>
                <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                  {searchQuery ? 'No contacts found' : 'No contacts on this device'}
                </Text>
                {searchQuery.trim().length > 0 && isPhoneNumber(searchQuery) && (
                  <TouchableOpacity
                    style={[styles.startChatButton, { backgroundColor: theme.primary }]}
                    onPress={handleStartNewChat}
                  >
                    <Text style={styles.startChatButtonText}>
                      Chat with {searchQuery.trim()}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : null
          }
        />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderBottomWidth: 1,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  backButton: { padding: 8, marginRight: 4 },
  searchInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: Platform.OS === 'ios' ? 10 : 6,
    paddingHorizontal: 4,
  },
  gridButton: { padding: 10, marginLeft: 4 },
  listContent: { paddingBottom: 30 },
  newChatOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sectionTitle: { fontSize: 13, fontWeight: '500', letterSpacing: 0.3, flex: 1 },
  syncIndicator: { marginLeft: 8 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  contactInfo: { flex: 1, justifyContent: 'center' },
  contactName: { fontSize: 16, fontWeight: '500', marginBottom: 2 },
  contactNumber: { fontSize: 14 },
  footerLoader: { paddingVertical: 16, alignItems: 'center' },
  emptyContainer: { paddingTop: 60, alignItems: 'center', paddingHorizontal: 20 },
  emptyText: { fontSize: 15, textAlign: 'center' },
  startChatButton: {
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  startChatButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
});
