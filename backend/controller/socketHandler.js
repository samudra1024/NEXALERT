
const messageStore = {}; // chatId -> [{id, text, ...}]

export const socketHandler = (io) => {
  io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    // Join a specific chat room
    socket.on("join_room", (room) => {
      socket.join(room);
      console.log(`User ${socket.id} joined room ${room}`);

      // Initialize store for room if not exists
      if (!messageStore[room]) {
        messageStore[room] = [];
      }
    });

    // Fetch History
    socket.on("fetch_history", ({ chatId, limit = 20, beforeId }) => {
      const roomMessages = messageStore[chatId] || [];
      // Assuming messages are stored in chronological order (oldest -> newest)
      // We want to return chunk ending at beforeId

      // Reverse copy to search from newest
      const reversed = [...roomMessages].reverse();

      let startIndex = 0;
      if (beforeId) {
        const foundIndex = reversed.findIndex(m => m.id === beforeId);
        if (foundIndex !== -1) {
          startIndex = foundIndex + 1;
        }
      }

      const chunk = reversed.slice(startIndex, startIndex + limit);
      // Send back as newest-first (because frontend will use inverted list)
      // or whatever convention. Let's send them as is (newest first).

      socket.emit("history_response", {
        messages: chunk,
        hasMore: startIndex + limit < reversed.length
      });
    });

    // Send a message
    socket.on("send_message", (message) => {
      if (!message.chatId) return;

      // Store message
      if (!messageStore[message.chatId]) {
        messageStore[message.chatId] = [];
      }
      messageStore[message.chatId].push(message);

      // Broadcast to others in the room
      socket.to(message.chatId).emit("receive_message", message);
    });

    // Typing indicators
    socket.on("typing", ({ chatId, userId, isTyping }) => {
      socket.to(chatId).emit("user_typing", { userId, isTyping });
    });

    // Read receipts
    socket.on("read_message", ({ chatId, messageId, userId }) => {
      socket.to(chatId).emit("message_read", { messageId, userId });
    });

    // Reactions
    socket.on("add_reaction", ({ chatId, messageId, reaction, userId }) => {
      const roomMessages = messageStore[chatId];
      if (roomMessages) {
        const msg = roomMessages.find(m => m.id === messageId);
        if (msg) {
          msg.reaction = reaction;
        }
      }
      socket.to(chatId).emit("reaction_added", { messageId, reaction, userId });
    });

    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.id);
    });
  });
};
