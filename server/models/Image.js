'use strict';
const { Schema, model } = require('mongoose');
module.exports = model('Image', new Schema({
  data: { type: Buffer, required: true },
  contentType: { type: String, enum: ['image/jpeg', 'image/png', 'image/webp'], required: true },
  size: Number
}, { timestamps: true }));
