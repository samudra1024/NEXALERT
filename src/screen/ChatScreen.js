// screens/ChatScreen.js
import React, { useState, useEffect } from "react";
import { 
  View, 
  Text, 
  FlatList, 
  TextInput, 
  TouchableOpacity, 
  Alert, 
  StyleSheet,
  StatusBar,
  KeyboardAvoidingView,
  Platform
} from "react-native";
import { useNavigation, useRoute } from '@react-navigation/native';
import SmsController from '../../Controller/SmsController';

export default function ChatScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { name } = route.params || {};

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");

  const loadSmsMessages = React.useCallback(async () => {
    if (!name) return;
    try {
      const smsMessages = await SmsController.fetchSmsMessages();
      const formattedMessages = smsMessages
        .filter(sms => sms.address === name)
        .map((sms, index) => ({
          id: `${sms.address}-${sms.date}-${index}`,
          sender: sms.address === 'me' ? 'me' : sms.address,
          text: sms.body,
          time: new Date(sms.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
        }))
        .sort((a, b) => new Date(a.time) - new Date(b.time));
      setMessages(formattedMessages);
    } catch (error) {
      Alert.alert('Error', 'Failed to fetch SMS messages: ' + error.message);
    }
  }, [name]);

  useEffect(() => {
    loadSmsMessages();
  }, [loadSmsMessages]);

  const sendMessage = React.useCallback(() => {
    if (input.trim().length > 0) {
      const newMessage = {
        id: `me-${Date.now()}`,
        sender: "me",
        text: input,
        time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
      };
      setMessages(prev => [...prev, newMessage]);
      setInput("");
    }
  }, [input]);

  const renderMessage = React.useCallback(({ item }) => (
    <View style={[
      styles.messageContainer,
      item.sender === "me" ? styles.myMessage : styles.otherMessage
    ]}>
      <Text style={[
        styles.messageText,
        item.sender === "me" ? styles.myMessageText : styles.otherMessageText
      ]}>
        {item.text}
      </Text>
      <Text style={[
        styles.timeText,
        item.sender === "me" ? styles.myTimeText : styles.otherTimeText
      ]}>
        {item.time}
      </Text>
    </View>
  ), []);

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar barStyle="light-content" backgroundColor="#2563eb" />
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerName}>{name}</Text>
          <Text style={styles.headerStatus}>Online</Text>
        </View>
      </View>

      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        style={styles.messagesList}
        contentContainerStyle={styles.messagesContainer}
        showsVerticalScrollIndicator={false}
      />

      <View style={styles.inputContainer}>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Type a message..."
          placeholderTextColor="#adb5bd"
          style={styles.textInput}
          multiline
        />
        <TouchableOpacity 
          onPress={sendMessage} 
          style={[styles.sendButton, input.trim() ? styles.sendButtonActive : null]}
        >
          <Text style={styles.sendButtonText}>→</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
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
  headerInfo: {
    flex: 1,
  },
  headerName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
  },
  headerStatus: {
    fontSize: 12,
    color: '#bfdbfe',
    marginTop: 2,
  },
  messagesList: {
    flex: 1,
  },
  messagesContainer: {
    paddingVertical: 16,
    paddingHorizontal: 12,
  },
  messageContainer: {
    maxWidth: '80%',
    marginVertical: 4,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 18,
  },
  myMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#2563eb',
    borderBottomRightRadius: 4,
  },
  otherMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#ffffff',
    borderBottomLeftRadius: 4,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 20,
  },
  myMessageText: {
    color: '#ffffff',
  },
  otherMessageText: {
    color: '#212529',
  },
  timeText: {
    fontSize: 11,
    marginTop: 4,
  },
  myTimeText: {
    color: '#bfdbfe',
    textAlign: 'right',
  },
  otherTimeText: {
    color: '#adb5bd',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
  },
  textInput: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    color: '#212529',
    maxHeight: 100,
    marginRight: 12,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e9ecef',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonActive: {
    backgroundColor: '#2563eb',
  },
  sendButtonText: {
    fontSize: 18,
    color: '#ffffff',
    fontWeight: '300',
  },
});