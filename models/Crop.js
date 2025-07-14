const mongoose = require('mongoose');

const cropSchema = new mongoose.Schema({
  name: { type: String, required: true },           // Corrected from title → name
  category: { type: String, required: true },
  price: { type: String, required: true },
  quantity: { type: String, required: true },
  location: { type: String, required: true },
  description: { type: String },
  image: { type: String } ,// URL or filename, optional
  sellerEmail: { type: String, required: true },

    status: { type: String, default: 'Available' }
}, {
  timestamps: true
});

const Crop = mongoose.model('Crop', cropSchema);




module.exports = Crop;