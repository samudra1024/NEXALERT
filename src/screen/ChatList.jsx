// screens/ChatsList.js
import React, { useState, useEffect } from "react";
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
  AppState,
} from "react-native";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import SmsController from '../../Controller/SmsController';
import DefaultSmsPrompt from './DefaultSmsPrompt';


const getAvatarColor = (address) => {
  const colors = ['#2563eb', '#fd79a8', '#fdcb6e', '#e17055', '#1d4ed8', '#00b894'];
  const index = address.charCodeAt(0) % colors.length;
  return colors[index];
};

export default function ChatsList() {
  const navigation = useNavigation();
  const [contacts, setContacts] = useState([]);
  const [readContacts, setReadContacts] = useState(new Set());
  const [showDefaultPrompt, setShowDefaultPrompt] = useState(false);

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

  const loadSmsMessages = async () => {
    try {
      const hasPermissions = await requestSmsPermissions();
      if (!hasPermissions) return;
      
      const messages = await SmsController.fetchSmsMessages();
      console.log('Total SMS messages fetched:', messages.length);
      
      // Check if there are new unread messages and clear local read state for those contacts
      const currentUnreadContacts = new Set();
      messages.forEach(msg => {
        if (parseInt(msg.type) === 1 && parseInt(msg.read) === 0) {
          currentUnreadContacts.add(msg.address);
        }
      });
      
      // Remove contacts from readContacts if they have new unread messages
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
        
        // If contact is marked as read locally, show 0 unread
        const finalUnreadCount = readContacts.has(contact.id) ? 0 : unreadMessages.length;
        
        console.log(`Contact ${contact.id}: DB unread=${unreadMessages.length}, Local read=${readContacts.has(contact.id)}, Final=${finalUnreadCount}`);
        
        return {
          ...contact,
          lastMessage: latestMessage.body,
          time: new Date(latestMessage.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
          unread: finalUnreadCount,
          date: latestMessage.date,
          messageCount: contact.messages.length
        };
      }).sort((a, b) => b.date - a.date);
      
      setContacts(contactsList);
    } catch (error) {
      console.error('SMS fetch error:', error);
      Alert.alert('Error', 'Failed to fetch SMS messages: ' + error.message);
    }
  };

  useEffect(() => {
    checkDefaultSmsApp();
    loadSmsMessages();
    
    // Listen for app state changes
    const handleAppStateChange = (nextAppState) => {
      if (nextAppState === 'active') {
        checkDefaultSmsApp();
        loadSmsMessages(); // Refresh when app becomes active
      }
    };
    
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    
    // Periodic refresh to catch external changes (reduced frequency)
    const interval = setInterval(() => {
      if (AppState.currentState === 'active') {
        loadSmsMessages();
      }
    }, 10000); // Refresh every 10 seconds when app is active
    
    return () => {
      subscription?.remove();
      clearInterval(interval);
    };
  }, []);
  
  // Refresh when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      console.log('ChatsList focused, refreshing...');
      loadSmsMessages();
    }, [])
  );

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
      <StatusBar barStyle="dark-content" backgroundColor="#f8f9fa" />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Messages</Text>
        <TouchableOpacity 
          style={styles.logoutButton}
          onPress={() => {
            navigation.replace('InfoOne');
          }}
        >
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={contacts}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        showsVerticalScrollIndicator={true}
        style={styles.flatList}
        contentContainerStyle={{ paddingBottom: 100 }}
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('NewChat')}
      >
        <Text style={styles.fabText}>+</Text>
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
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#212529',
    flex: 1,
  },
  logoutButton: {
    backgroundColor: '#dc3545',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  logoutText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  flatList: {
    flex: 1,
  },
  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 8,
    marginVertical: 4,
    borderRadius: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#ffffff',
  },
  chatContent: {
    flex: 1,
  },
  contactName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212529',
    marginBottom: 2,
  },
  lastMessage: {
    fontSize: 14,
    color: '#6c757d',
    lineHeight: 18,
  },
  timeContainer: {
    alignItems: 'flex-end',
  },
  timeText: {
    fontSize: 12,
    color: '#adb5bd',
    marginBottom: 4,
  },
  unreadBadge: {
    backgroundColor: '#28a745',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 20,
    alignItems: 'center',
  },
  unreadText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#ffffff',
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
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
    fontSize: 24,
    fontWeight: '300',
    color: '#ffffff',
  },
});