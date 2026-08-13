import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  StatusBar,
  Alert,
  ActivityIndicator,
  Platform,
  PermissionsAndroid,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import SmsController from '../../Controller/SmsController';
import { ArrowLeft, Users, MoreVertical } from 'lucide-react-native';

const getAvatarColor = (name) => {
  const colors = [
    '#4285F4', '#EA4335', '#FBBC05', '#34A853',
    '#7B1FA2', '#E91E63', '#00ACC1', '#FF7043',
    '#5C6BC0', '#26A69A', '#8D6E63', '#78909C',
  ];
  if (!name) return colors[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

const getInitial = (name) => {
  if (!name) return '?';
  return name.charAt(0).toUpperCase();
};

export default function NewChat() {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const [searchText, setSearchText] = useState('');
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadContacts();
  }, []);

  const loadContacts = async () => {
    try {
      setLoading(true);
      const [deviceContacts, conversationsResult] = await Promise.all([
        SmsController.getAllContacts(),
        SmsController.getConversations(1, 50),
      ]);

      const merged = new Map();
      (conversationsResult.conversations || []).forEach(c => {
        merged.set(c.id, { id: c.id, name: c.name, source: 'sms' });
      });
      (deviceContacts || []).forEach(c => {
        if (!merged.has(c.id)) {
          merged.set(c.id, { id: c.id, name: c.name, source: 'phone' });
        }
      });

      setContacts(Array.from(merged.values()).sort((a, b) => a.name.localeCompare(b.name)));
    } catch (error) {
      console.error('Error loading contacts:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredContacts = useMemo(() => {
    if (!searchText.trim()) return contacts;
    const lower = searchText.toLowerCase();
    return contacts.filter(c =>
      (c.name && c.name.toLowerCase().includes(lower)) ||
      (c.id && c.id.toLowerCase().includes(lower))
    );
  }, [contacts, searchText]);

  const isPhoneNumber = (text) => {
    return /^[\d\s\+\-\(\)]+$/.test(text.trim()) && text.trim().length >= 3;
  };

  const startChat = (contactId, name) => {
    navigation.navigate('Chat', {
      contactId: contactId,
      name: name || contactId,
    });
  };

  const handleStartNewChat = () => {
    const trimmed = searchText.trim();
    if (trimmed.length > 0) {
      startChat(trimmed, trimmed);
    } else {
      Alert.alert('Error', 'Please enter a phone number or name');
    }
  };

  const renderContactItem = ({ item }) => {
    const avatarColor = item.avatarColor || getAvatarColor(item.name);
    const initial = getInitial(item.name);
    const phoneNumber = item.id;
    const displayName = item.name || item.id;

    return (
      <TouchableOpacity
        style={styles.contactItem}
        onPress={() => startChat(item.id, displayName)}
        activeOpacity={0.6}
      >
        <View style={[styles.avatar, { backgroundColor: avatarColor }]}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>
        <View style={styles.contactInfo}>
          <Text style={[styles.contactName, { color: theme.text }]}>{displayName}</Text>
          <Text style={[styles.contactNumber, { color: theme.textSecondary }]}>{phoneNumber}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderHeader = () => (
    <View>
      {/* Start new chat with typed number */}
      {searchText.trim().length > 0 && isPhoneNumber(searchText) && (
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
              Send to {searchText.trim()}
            </Text>
            <Text style={[styles.contactNumber, { color: theme.textSecondary }]}>
              Start a new conversation
            </Text>
          </View>
        </TouchableOpacity>
      )}

      {/* Section header */}
      <View style={[styles.sectionHeader, { borderBottomColor: theme.border }]}>
        <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>
          Recent contacts
        </Text>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar
        barStyle={theme.statusBar}
        backgroundColor={theme.statusBg}
      />

      {/* Header with inline search */}
      <View style={[styles.header, { backgroundColor: theme.background, borderBottomColor: theme.border }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          activeOpacity={0.6}
        >
          <ArrowLeft size={24} color={theme.text} />
        </TouchableOpacity>

        <TextInput
          style={[styles.searchInput, { color: theme.text }]}
          placeholder="Search for name or number"
          placeholderTextColor={theme.textSecondary}
          value={searchText}
          onChangeText={setSearchText}
          autoFocus
          returnKeyType="search"
          onSubmitEditing={() => {
            if (isPhoneNumber(searchText)) {
              handleStartNewChat();
            }
          }}
        />

        <TouchableOpacity style={styles.gridButton} activeOpacity={0.6}>
          <MoreVertical size={22} color={theme.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Contact List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : (
        <FlatList
          data={filteredContacts}
          keyExtractor={(item) => item.id}
          renderItem={renderContactItem}
          ListHeaderComponent={renderHeader}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                {searchText ? 'No contacts found' : 'No recent contacts'}
              </Text>
              {searchText.trim().length > 0 && isPhoneNumber(searchText) && (
                <TouchableOpacity
                  style={[styles.startChatButton, { backgroundColor: theme.primary }]}
                  onPress={handleStartNewChat}
                >
                  <Text style={styles.startChatButtonText}>
                    Chat with {searchText.trim()}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
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
  backButton: {
    padding: 8,
    marginRight: 4,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: Platform.OS === 'ios' ? 10 : 6,
    paddingHorizontal: 4,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
  },
  gridButton: {
    padding: 10,
    marginLeft: 4,
  },
  listContent: {
    paddingBottom: 30,
  },
  newChatOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  sectionHeader: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 0.3,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  contactInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  contactName: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 2,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium',
  },
  contactNumber: {
    fontSize: 14,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    paddingTop: 60,
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  emptyText: {
    fontSize: 15,
    textAlign: 'center',
  },
  startChatButton: {
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  startChatButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
});