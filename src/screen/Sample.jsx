import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Alert,
  RefreshControl
} from 'react-native';
import SmsController from '../../Controller/SmsController';

const Sample = () => {
  const [smsMessages, setSmsMessages] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadSmsMessages = async () => {
    setLoading(true);
    try {
      const messages = await SmsController.fetchSmsMessages();
      setSmsMessages(messages);
    } catch (error) {
      Alert.alert('Error', 'Failed to fetch SMS messages: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSmsMessages();
  }, []);

  const formatDate = (timestamp) => {
    return new Date(timestamp).toLocaleString();
  };

  const renderSmsItem = ({ item }) => (
    <View style={styles.smsItem}>
      <Text style={styles.sender}>{item.address}</Text>
      <Text style={styles.message}>{item.body}</Text>
      <Text style={styles.date}>{formatDate(item.date)}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>SMS Messages</Text>
      <TouchableOpacity style={styles.refreshButton} onPress={loadSmsMessages}>
        <Text style={styles.refreshText}>Refresh</Text>
      </TouchableOpacity>
      <FlatList
        data={smsMessages}
        keyExtractor={(item) => item.id}
        renderItem={renderSmsItem}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={loadSmsMessages} />
        }
        ListEmptyComponent={
          <Text style={styles.emptyText}>No SMS messages found</Text>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  refreshButton: {
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    alignItems: 'center',
  },
  refreshText: {
    color: 'white',
    fontWeight: 'bold',
  },
  smsItem: {
    backgroundColor: 'white',
    padding: 16,
    marginBottom: 8,
    borderRadius: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  sender: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  message: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  date: {
    fontSize: 12,
    color: '#999',
    textAlign: 'right',
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 16,
    color: '#666',
    marginTop: 50,
  },
});

export default Sample;