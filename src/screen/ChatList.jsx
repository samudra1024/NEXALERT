// screens/ChatsList.js
import React from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
} from "react-native";
import { useNavigation } from "@react-navigation/native";

const contacts = [
  {
    id: "1",
    name: "Mansa",
    lastMessage: "Thank youuu!!",
    time: "19:44",
    unread: 0,
    avatar: "https://randomuser.me/api/portraits/women/44.jpg",
  },
  {
    id: "2",
    name: "Infosys Team A",
    lastMessage: "Guys did anyone receive??",
    time: "18:31",
    unread: 5,
    avatar: "https://randomuser.me/api/portraits/men/40.jpg",
  },
  {
    id: "3",
    name: "Pappa",
    lastMessage: "reached just now..",
    time: "16:04",
    unread: 0,
    avatar: "https://randomuser.me/api/portraits/men/34.jpg",
  },
  {
    id: "4",
    name: "Ansh(R.N.S)",
    lastMessage: "Yes, that’s gonna work, hopefully.",
    time: "06:12",
    unread: 0,
    avatar: "https://randomuser.me/api/portraits/women/20.jpg",
  },
  {
    id: "5",
    name: "Bhai",
    lastMessage: "Thanks dude 😁",
    time: "Yesterday",
    unread: 0,
    avatar: "https://randomuser.me/api/portraits/men/10.jpg",
  },
  {
    id: "6",
    name: "Trishul",
    lastMessage: "I’m happy this anime has such grea...",
    time: "15/02/25",
    unread: 0,
    avatar: "https://randomuser.me/api/portraits/men/30.jpg",
  },
];

export default function ChatsList() {
  const navigation = useNavigation();

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={{
        flexDirection: "row",
        alignItems: "center",
        padding: 12,
        borderBottomWidth: 0.5,
        borderColor: "#ddd",
      }}
      onPress={() =>
        navigation.navigate("Chat", { contactId: item.id, name: item.name })
      }
    >
      {/* Avatar */}
      <Image
        source={{ uri: item.avatar }}
        style={{ width: 50, height: 50, borderRadius: 25, marginRight: 12 }}
      />

      {/* Name + Last message */}
      <View style={{ flex: 1 }}>
        <Text style={{ fontWeight: "bold", fontSize: 16 }}>{item.name}</Text>
        <Text style={{ color: "gray" }} numberOfLines={1}>
          {item.lastMessage}
        </Text>
      </View>

      {/* Time + Unread badge */}
      <View style={{ alignItems: "flex-end" }}>
        <Text style={{ color: "gray", fontSize: 12 }}>{item.time}</Text>
        {item.unread > 0 && (
          <View
            style={{
              backgroundColor: "#007bff",
              borderRadius: 12,
              paddingHorizontal: 6,
              paddingVertical: 2,
              marginTop: 4,
            }}
          >
            <Text style={{ color: "white", fontSize: 12 }}>{item.unread}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={{ flex: 1, backgroundColor: "white" }}>
      {/* Header */}
      <Text style={{ fontSize: 20, fontWeight: "bold", margin: 15 }}>
        Personal Chats
      </Text>

      {/* Chat list */}
      <FlatList
        data={contacts}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
      />

      {/* Floating button */}
      <TouchableOpacity
        style={{
          position: "absolute",
          bottom: 20,
          right: 20,
          backgroundColor: "#007bff",
          width: 55,
          height: 55,
          borderRadius: 30,
          justifyContent: "center",
          alignItems: "center",
          shadowColor: "#000",
          shadowOpacity: 0.2,
          shadowRadius: 4,
          elevation: 5,
        }}
        onPress={() => alert("New chat")}
      >
        <Text style={{ fontSize: 28, color: "white" }}>+</Text>
      </TouchableOpacity>
    </View>
  );
}
