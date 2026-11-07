'use strict';
const { Schema, model } = require('mongoose');
module.exports = model('MenuItem', new Schema({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  description: { type: String, default: '', maxlength: 600 },
  price: { type: Number, required: true, min: 0, max: 10000000 },
  category: { type: String, default: 'Mains', trim: true, maxlength: 40 },
  image: { type: String, default: '' }, // Image document id; empty = illustration fallback
  isPopular: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  sortOrder: { type: Number, default: 0 }
}, { timestamps: true }));
