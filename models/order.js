const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema({
  customer: {
    fullName: String,
    email: String,
    phone: String,
    address: String,
    city: String,
    state: String,
    pincode: String,
  },
  items: [
    {
      id: String,
      name: String,
      quantity: Number,
      price: Number,
      image: String,
    },
  ],
  totalAmount: Number,
  gst: Number,
  delivery: Number,
  placedAt: {
    type: Date,
    default: Date.now
  },

  status: {
    type: String,
    enum: [
      "Confirmed",
      "Packed",
      "Shipped",
      "Out for Delivery",
      "Delivered",
      "Cancelled",
      "Returned",
      "Paid"
    ],
    default: "Confirmed"
  },

  expectedDeliveryDate: {
    type: Date,
    required: false
  },

  paymentMethod: {
    type: String,
    enum: ["razorpay", "cod"],
    required: true
  },

  paymentId: {
    type: String
  },

  razorpayOrderId: {
    type: String
  }
});

module.exports = mongoose.model("Order", orderSchema);


