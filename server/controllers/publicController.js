'use strict';
const config = require('../config');
const Settings = require('../models/RestaurantSettings');
const MenuItem = require('../models/MenuItem');
const GalleryItem = require('../models/GalleryItem');
const Enquiry = require('../models/Enquiry');
const images = require('../services/imageStorage');
const { formatDisplay } = require('../services/whatsapp');
const v = require('../middleware/validate');

exports.site = async (req, res) => {
  const s = await Settings.findOne({ key: 'main' }).lean();
  res.json({
    name: s.name, tagline: s.tagline, introduction: s.introduction, description: s.description,
    hours: s.hours, address: s.address, mapUrl: s.mapUrl, email: s.email, phone: s.phone,
    currency: s.currency, notice: s.notice,
    whatsappNumber: config.whatsappNumber, whatsappDisplay: formatDisplay(config.whatsappNumber)
  });
};

exports.menu = async (req, res) => {
  const items = await MenuItem.find({ isActive: true }).sort({ sortOrder: 1, createdAt: 1 }).lean();
  res.json(items.map(i => ({ id: i._id, name: i.name, description: i.description, price: i.price, category: i.category, isPopular: i.isPopular, image: images.url(i.image) })));
};

exports.gallery = async (req, res) => {
  const items = await GalleryItem.find().sort({ sortOrder: 1, createdAt: 1 }).lean();
  res.json(items.map(i => ({ id: i._id, caption: i.caption, image: images.url(i.image) })));
};

exports.createEnquiry = async (req, res) => {
  if (req.body.website) return res.status(201).json({ ok: true }); // honeypot: bots fill this hidden field
  const errors = {};
  const name = v.text(req.body, 'name', { max: 80, required: true, label: 'Name' }, errors);
  const message = v.text(req.body, 'message', { max: 1000, required: true, label: 'Message' }, errors);
  v.fail(errors);
  await Enquiry.create({ name, message });
  res.status(201).json({ ok: true });
};

exports.media = async (req, res) => {
  const Image = require('../models/Image');
  const img = await Image.findById(req.params.id);
  if (!img) return res.status(404).end();
  res.set({
    'Content-Type': img.contentType,
    'Cache-Control': 'public, max-age=31536000, immutable',
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'none'; sandbox"
  });
  res.send(Buffer.from(img.data));
};
