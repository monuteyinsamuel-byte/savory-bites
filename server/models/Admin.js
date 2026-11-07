'use strict';
const { Schema, model } = require('mongoose');
// Single-owner design: the unique "key" guarantees only one admin can ever exist.
const schema = new Schema({
  key: { type: String, default: 'owner', unique: true, immutable: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
  passwordHash: { type: String, required: true, select: false },
  lastLoginAt: Date
}, { timestamps: true });
module.exports = model('Admin', schema);
