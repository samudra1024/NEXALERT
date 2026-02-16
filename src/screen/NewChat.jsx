import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from "../context/ThemeContext";

export default function NewChat() {
  const navigation = useNavigation();
  const [phoneNumber, setPhoneNumber] = useState('');
  const { theme } = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);

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

      <View style={styles.header}>
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
          placeholderTextColor={theme.colors.placeholder}
          keyboardType="phone-pad"
          autoFocus
        />

        <TouchableOpacity
          style={[styles.startButton, phoneNumber.trim() ? styles.startButtonActive : null]}
          onPress={startChat}
          disabled={!phoneNumber.trim()}
        >
          <Text style={[styles.startButtonText, phoneNumber.trim() ? styles.startButtonTextActive : styles.startButtonTextInactive]}>Start Chat</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const getStyles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.headerBackground,
    paddingHorizontal: 16,
    paddingVertical: 12,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  backButton: {
    fontSize: 24,
    color: theme.colors.iconColor,
    marginRight: 16,
    fontWeight: '300',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text,
  },
  content: {
    padding: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 12,
  },
  input: {
    backgroundColor: theme.colors.inputBackground,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: theme.colors.inputText,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 24,
  },
  startButton: {
    backgroundColor: theme.colors.secondary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  startButtonActive: {
    backgroundColor: theme.colors.primary,
  },
  startButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  startButtonTextActive: {
    color: '#ffffff',
  },
  startButtonTextInactive: {
    color: theme.colors.textSecondary,
  },
});