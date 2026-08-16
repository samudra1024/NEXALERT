import { useState, useEffect, useCallback, memo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  StyleSheet,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import SmsController from '../../Controller/SmsController';
import { useTheme } from '../context/ThemeContext';
import ScalePressable from '../components/animations/ScalePressable';
import OptimizedList from '../components/OptimizedList';
import { Swipeable } from 'react-native-gesture-handler';
import { RotateCcw, Trash2, ArrowLeft } from 'lucide-react-native';
import { ScreenContainer } from '../components/ScreenContainer';

const ROW_HEIGHT = 76;

const RecycleRow = memo(function RecycleRow({
  item,
  theme,
  onRestore,
  onDeletePermanent,
}) {
  const renderRightActions = useCallback((progress, dragX) => {
    const scale = dragX.interpolate({
      inputRange: [-160, 0],
      outputRange: [1, 0.5],
      extrapolate: 'clamp',
    });

    return (
      <View style={styles.actionsContainer}>
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: '#2563eb' }]}
          onPress={() => onRestore(item.id)}
        >
          <Animated.View style={{ transform: [{ scale }], alignItems: 'center' }}>
            <RotateCcw size={22} color="#FFF" />
            <Text style={styles.actionText}>Restore</Text>
          </Animated.View>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: '#ef4444' }]}
          onPress={() => onDeletePermanent(item.id)}
        >
          <Animated.View style={{ transform: [{ scale }], alignItems: 'center' }}>
            <Trash2 size={22} color="#FFF" />
            <Text style={styles.actionText}>Delete</Text>
          </Animated.View>
        </TouchableOpacity>
      </View>
    );
  }, [item.id, onRestore, onDeletePermanent]);

  return (
    <Swipeable renderRightActions={renderRightActions} overshootRight={false} friction={2}>
      <View style={[styles.chatItem, { backgroundColor: theme.background, borderBottomColor: theme.border }]}>
        <View style={[styles.avatar, { backgroundColor: item.avatarColor }]}>
          <Text style={styles.avatarText}>{item.avatar}</Text>
        </View>

        <View style={styles.chatContent}>
          <Text style={[styles.contactName, { color: theme.text }]}>{item.name}</Text>
          <Text style={[styles.lastMessage, { color: theme.textSecondary }]} numberOfLines={1}>
            {item.lastMessage || 'No preview'}
          </Text>
        </View>

        <View style={styles.timeContainer}>
          <Text style={[styles.timeText, { color: theme.textSecondary }]}>{item.time}</Text>
        </View>
      </View>
    </Swipeable>
  );
});

export default function RecycleBin() {
  const { theme } = useTheme();
  const navigation = useNavigation();
  const [recycledMessages, setRecycledMessages] = useState([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadRecycledMessages = useCallback(async (background = false) => {
    if (!background) {
      setRefreshing(true);
    }

    try {
      const messages = await SmsController.getRecycledConversations();
      setRecycledMessages(messages);
    } catch (error) {
      console.error('Error loading recycled messages:', error);
      if (!background) {
        Alert.alert('Error', 'Failed to load recycled messages.');
      }
    } finally {
      setInitialLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadRecycledMessages(recycledMessages.length > 0);
    }, [loadRecycledMessages, recycledMessages.length]),
  );

  const handleRestore = async (id) => {
    try {
      await SmsController.restoreConversation(id);
      setRecycledMessages(prev => prev.filter(item => item.id !== id));
      Alert.alert('Restored', 'Conversation restored to main list.');
    } catch (error) {
      console.error('Error restoring:', error);
      Alert.alert('Error', 'Failed to restore conversation.');
    }
  };

  const handleDeletePermanent = async (id) => {
    Alert.alert(
      'Permanent Delete',
      'Are you sure you want to permanently delete this conversation? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await SmsController.permanentDeleteConversation(id);
              setRecycledMessages(prev => prev.filter(item => item.id !== id));
            } catch (error) {
              console.error('Error deleting:', error);
              Alert.alert('Error', 'Failed to delete conversation.');
            }
          },
        },
      ],
    );
  };

  const renderItem = useCallback(({ item }) => (
    <RecycleRow
      item={item}
      theme={theme}
      onRestore={handleRestore}
      onDeletePermanent={handleDeletePermanent}
    />
  ), [theme, handleRestore, handleDeletePermanent]);

  const keyExtractor = useCallback(item => item.id, []);

  return (
    <ScreenContainer
      backgroundColor={theme.background}
      statusBarStyle={theme.statusBar}
      statusBarBackgroundColor={theme.statusBg}
    >
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <ScalePressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <ArrowLeft size={24} color={theme.text} />
        </ScalePressable>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Recycle Bin</Text>
        <View style={{ width: 40 }} />
      </View>

      {initialLoading && recycledMessages.length === 0 ? (
        <ActivityIndicator size="large" color={theme.primary} style={styles.loader} />
      ) : (
        <OptimizedList
          data={recycledMessages}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          estimatedItemSize={ROW_HEIGHT}
          useFixedItemLayout
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshing={refreshing}
          onRefresh={() => loadRecycledMessages(false)}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Trash2 size={48} color={theme.textSecondary} />
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                Recycle Bin is empty
              </Text>
            </View>
          }
        />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
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
    minHeight: ROW_HEIGHT,
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
  listContent: {
    paddingBottom: 20,
    flexGrow: 1,
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
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
  },
});
