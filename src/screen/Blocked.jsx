import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { ArrowLeft } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import SmsController from '../../Controller/SmsController';
import { ScreenContainer } from '../components/ScreenContainer';

export default function Blocked() {
  const { theme } = useTheme();
  const navigation = useNavigation();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadBlocked = useCallback(async () => {
    try {
      setLoading(true);
      const conversations = await SmsController.getBlockedConversations();
      setItems(conversations);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadBlocked();
    }, [loadBlocked]),
  );

  const handleUnblock = (item) => {
    Alert.alert('Unblock contact?', `Allow messages from ${item.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Unblock',
        onPress: async () => {
          await SmsController.unblockNumber(item.id);
          loadBlocked();
        },
      },
    ]);
  };

  return (
    <ScreenContainer
      backgroundColor={theme.background}
      statusBarStyle={theme.statusBar}
      statusBarBackgroundColor={theme.statusBg}
    >
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <ArrowLeft size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.text }]}>Blocked</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={theme.primary} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={
            <Text style={[styles.empty, { color: theme.textSecondary }]}>
              No blocked contacts
            </Text>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.row, { backgroundColor: theme.surface }]}
              onPress={() => handleUnblock(item)}
              onLongPress={() => handleUnblock(item)}
            >
              <View style={[styles.avatar, { backgroundColor: item.avatarColor }]}>
                <Text style={styles.avatarText}>{item.avatar}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.name, { color: theme.text }]}>{item.name}</Text>
                <Text style={{ color: theme.textSecondary }} numberOfLines={1}>
                  {item.lastMessage || 'Blocked contact'}
                </Text>
              </View>
              <Text style={{ color: theme.primary, fontWeight: '600' }}>Unblock</Text>
            </TouchableOpacity>
          )}
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
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  backButton: { padding: 8, marginRight: 8 },
  title: { flex: 1, fontSize: 20, fontWeight: '700', textAlign: 'center' },
  empty: { textAlign: 'center', marginTop: 48, fontSize: 16 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  avatarText: { color: '#fff', fontSize: 18, fontWeight: '600' },
  name: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
});
