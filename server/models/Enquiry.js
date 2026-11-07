'use strict';
const { Schema, model } = require('mongoose');
module.exports = model('Enquiry', new Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  message: { type: String, required: true, maxlength: 1000 },
  status: { type: String, enum: ['new', 'read', 'handled'], default: 'new' }
}, { timestamps: true }));
