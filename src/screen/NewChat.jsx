import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';

export default function NewChat() {
  const navigation = useNavigation();
  const [phoneNumber, setPhoneNumber] = useState('');
  const { theme } = useTheme();

  const startChat = () => {
    if (phoneNumber.trim().length > 0) {
      navigation.navigate('Chat', {
        contactId: phoneNumber.trim(),
        name: phoneNumber.trim(),
      });
    } else {
      Alert.alert('Error', 'Please enter a phone number');
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={theme.primary} />

      <View style={[styles.header, { backgroundColor: theme.primary }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Chat</Text>
      </View>

      <View style={styles.content}>
        <Text style={styles.label}>Enter phone number:</Text>
        <TextInput
          style={styles.input}
          value={phoneNumber}
          onChangeText={setPhoneNumber}
          placeholder="Enter phone number"
          placeholderTextColor="#adb5bd"
          keyboardType="phone-pad"
        />

        <TouchableOpacity
          style={[styles.startButton, phoneNumber.trim() ? [styles.startButtonActive, { backgroundColor: theme.primary }] : null]}
          onPress={startChat}
          disabled={!phoneNumber.trim()}
        >
          <Text style={styles.startButtonText}>Start Chat</Text>
        </TouchableOpacity>
      </View>
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
    backgroundColor: '#2563eb',
    paddingHorizontal: 16,
    paddingVertical: 12,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  backButton: {
    fontSize: 24,
    color: '#ffffff',
    marginRight: 16,
    fontWeight: '300',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
  },
  content: {
    padding: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212529',
    marginBottom: 12,
  },
  input: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#212529',
    borderWidth: 1,
    borderColor: '#e9ecef',
    marginBottom: 24,
  },
  startButton: {
    backgroundColor: '#e9ecef',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  startButtonActive: {
    backgroundColor: '#2563eb',
  },
  startButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
});