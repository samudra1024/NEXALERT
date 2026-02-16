import { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Alert,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
  Animated
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import SmsController from '../../Controller/SmsController';
import { useTheme } from '../context/ThemeContext';
import ScalePressable from '../components/animations/ScalePressable';
import SlideInList from '../components/animations/SlideInList';
import { Swipeable } from 'react-native-gesture-handler';
import { RotateCcw, Trash2, ArrowLeft } from 'lucide-react-native';

export default function RecycleBin() {
  const { theme } = useTheme();
  const navigation = useNavigation();
  const [recycledMessages, setRecycledMessages] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadRecycledMessages = async () => {
    setLoading(true);
    try {
      const messages = await SmsController.getRecycledConversations();
      setRecycledMessages(messages);
    } catch (error) {
      console.error('Error loading recycled messages:', error);
      Alert.alert('Error', 'Failed to load recycled messages.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRecycledMessages();
  }, []);

  const handleRestore = async (id) => {
    try {
      await SmsController.restoreConversation(id);
      Alert.alert('Restored', 'Conversation restored to main list.');
      loadRecycledMessages(); // Refresh list
    } catch (error) {
      console.error('Error restoring:', error);
      Alert.alert('Error', 'Failed to restore conversation.');
    }
  };

  const handleDeletePermanent = async (id) => {
    Alert.alert(
      "Permanent Delete",
      "Are you sure you want to permanently delete this conversation? This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await SmsController.permanentDeleteConversation(id);
              loadRecycledMessages(); // Refresh list
            } catch (error) {
              console.error('Error deleting:', error);
              Alert.alert('Error', 'Failed to delete conversation.');
            }
          }
        }
      ]
    );
  };

  const renderRightActions = (progress, dragX, item) => {
    const scale = dragX.interpolate({
      inputRange: [-100, 0],
      outputRange: [1, 0],
      extrapolate: 'clamp',
    });

    return (
      <View style={styles.actionsContainer}>
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: '#2563eb' }]} // Restore Blue
          onPress={() => handleRestore(item.id)}
        >
          <Animated.View style={{ transform: [{ scale }] }}>
            <RotateCcw size={24} color="#FFF" />
            <Text style={styles.actionText}>Restore</Text>
          </Animated.View>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: '#ef4444' }]} // Delete Red
          onPress={() => handleDeletePermanent(item.id)}
        >
          <Animated.View style={{ transform: [{ scale }] }}>
            <Trash2 size={24} color="#FFF" />
            <Text style={styles.actionText}>Delete</Text>
          </Animated.View>
        </TouchableOpacity>
      </View>
    );
  };

  const renderItem = ({ item }) => (
    <Swipeable renderRightActions={(progress, dragX) => renderRightActions(progress, dragX, item)}>
      <View style={[styles.chatItem, { backgroundColor: theme.background, borderBottomColor: theme.border }]}>
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
        </View>
      </View>
    </Swipeable>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={theme.statusBar} backgroundColor={theme.statusBg} />

      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <ScalePressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <ArrowLeft size={24} color={theme.text} />
        </ScalePressable>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Recycle Bin</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={theme.primary} style={styles.loader} />
      ) : (
        <SlideInList
          data={recycledMessages}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 20 }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Trash2 size={48} color={theme.textSecondary} />
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>Recycle Bin is empty</Text>
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
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#ffffff',
  },
  chatContent: {
    flex: 1,
    justifyContent: 'center',
  },
  contactName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  lastMessage: {
    fontSize: 14,
  },
  timeContainer: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  timeText: {
    fontSize: 12,
  },
  loader: {
    marginTop: 40,
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 60,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 16,
  },
  actionsContainer: {
    flexDirection: 'row',
    width: 160,
  },
  actionButton: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
});
