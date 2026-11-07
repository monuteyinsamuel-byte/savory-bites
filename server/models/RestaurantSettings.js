'use strict';
const { Schema, model } = require('mongoose');
module.exports = model('RestaurantSettings', new Schema({
  key: { type: String, default: 'main', unique: true, immutable: true },
  name: { type: String, default: 'Savory Bites', maxlength: 80 },
  tagline: { type: String, default: '', maxlength: 200 },
  introduction: { type: String, default: '', maxlength: 400 },
  description: { type: String, default: '', maxlength: 2000 },
  hours: [{ _id: false, day: { type: String, maxlength: 40 }, time: { type: String, maxlength: 40 } }],
  address: { type: String, default: '', maxlength: 200 },
  mapUrl: { type: String, default: '', maxlength: 500 },
  email: { type: String, default: '', maxlength: 254 },
  phone: { type: String, default: '', maxlength: 30 },
  currency: { type: String, default: '₦', maxlength: 4 },
  notice: { type: String, default: '', maxlength: 200 },
  seeded: { type: Boolean, default: false }
}, { timestamps: true }));
