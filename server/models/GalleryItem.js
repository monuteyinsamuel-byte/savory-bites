'use strict';
const { Schema, model } = require('mongoose');
module.exports = model('GalleryItem', new Schema({
  image: { type: String, default: '' },
  caption: { type: String, default: '', maxlength: 160 },
  sortOrder: { type: Number, default: 0 }
}, { timestamps: true }));
