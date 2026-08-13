import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { ArrowLeft } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import SmsController from '../../Controller/SmsController';
import ScalePressable from '../components/animations/ScalePressable';

export default function Spam() {
  const { theme } = useTheme();
  const navigation = useNavigation();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const loadSpam = useCallback(async (nextPage = 1, append = false) => {
    try {
      if (nextPage === 1) setLoading(true);
      const result = await SmsController.getSpamConversations(nextPage);
      setItems(prev => (append ? [...prev, ...result.conversations] : result.conversations));
      setHasMore(result.hasMore);
      setPage(result.page);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadSpam(1, false);
    }, [loadSpam]),
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={theme.statusBar} backgroundColor={theme.statusBg} />
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <ArrowLeft size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.text }]}>Spam & Blocked</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={theme.primary} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          onEndReached={() => hasMore && loadSpam(page + 1, true)}
          onEndReachedThreshold={0.4}
          ListEmptyComponent={
            <Text style={[styles.empty, { color: theme.textSecondary }]}>
              No spam messages detected
            </Text>
          }
          renderItem={({ item }) => (
            <ScalePressable
              style={[styles.row, { backgroundColor: theme.surface }]}
              onPress={() => navigation.navigate('Chat', { contactId: item.id, name: item.name })}
            >
              <View style={[styles.avatar, { backgroundColor: '#ef4444' }]}>
                <Text style={styles.avatarText}>{item.avatar}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.name, { color: theme.text }]}>{item.name}</Text>
                <Text style={{ color: theme.textSecondary }} numberOfLines={1}>
                  {item.lastMessage}
                </Text>
              </View>
              <Text style={{ color: theme.textSecondary, fontSize: 12 }}>{item.time}</Text>
            </ScalePressable>
          )}
        />
      )}
    </View>
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
