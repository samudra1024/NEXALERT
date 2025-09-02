// screens/ChatScreen.js
import React, { useState } from "react";
import { View, Text, FlatList, TextInput, TouchableOpacity } from "react-native";
import { useRoute } from "@react-navigation/native";

export default function ChatScreen() {
  const route = useRoute();
  const { name } = route.params; // coming from ChatsList

  const [messages, setMessages] = useState([
    { sender: "me", text: "Hello!", time: "10:00 AM" },
    { sender: name, text: "Hey there!", time: "10:02 AM" },
  ]);
  const [input, setInput] = useState("");

  const sendMessage = () => {
    if (input.trim().length > 0) {
      setMessages([...messages, { sender: "me", text: input, time: new Date().toLocaleTimeString() }]);
      setInput("");
    }
  };

  return (
    <View style={{ flex: 1, padding: 10 }}>
      <FlatList
        data={messages}
        keyExtractor={(item, index) => index.toString()}
        renderItem={({ item }) => (
          <View
            style={{
              alignSelf: item.sender === "me" ? "flex-end" : "flex-start",
              backgroundColor: item.sender === "me" ? "#DCF8C6" : "#EAEAEA",
              padding: 10,
              borderRadius: 10,
              marginVertical: 5,
            }}
          >
            <Text>{item.text}</Text>
            <Text style={{ fontSize: 10, color: "gray" }}>{item.time}</Text>
          </View>
        )}
      />

      {/* Input box */}
      <View style={{ flexDirection: "row", alignItems: "center", borderTopWidth: 1, padding: 5 }}>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Type a message"
          style={{ flex: 1, padding: 10 }}
        />
        <TouchableOpacity onPress={sendMessage} style={{ padding: 10 }}>
          <Text style={{ color: "blue" }}>Send</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
