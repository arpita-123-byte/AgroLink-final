const mongoose = require("mongoose");

const chatSchema = new mongoose.Schema({
  sender: String,              // email of sender
  receiver: String,            // email of receiver (optional but helpful)
  text: String,                // renamed from message to match frontend
  role: String,                // "farmer" or "buyer"
  roomId: String,              // derived from [sender, receiver].sort().join("_")
  timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Chat", chatSchema);
