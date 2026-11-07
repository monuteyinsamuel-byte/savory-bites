'use strict';
const config = require('../config');
const MenuItem = require('../models/MenuItem');
const GalleryItem = require('../models/GalleryItem');
const Enquiry = require('../models/Enquiry');
const Settings = require('../models/RestaurantSettings');
const { formatDisplay } = require('../services/whatsapp');

exports.get = async (req, res) => {
  const [menuTotal, menuActive, menuPopular, gallery, enquiries, enquiriesNew, s] = await Promise.all([
    MenuItem.countDocuments(), MenuItem.countDocuments({ isActive: true }), MenuItem.countDocuments({ isPopular: true }),
    GalleryItem.countDocuments(), Enquiry.countDocuments(), Enquiry.countDocuments({ status: 'new' }),
    Settings.findOne({ key: 'main' }).lean()
  ]);
  res.json({
    menuTotal, menuActive, menuPopular, gallery, enquiries, enquiriesNew,
    site: { name: s.name, hoursRows: s.hours.length, address: s.address, email: s.email, phone: s.phone, updatedAt: s.updatedAt, whatsapp: formatDisplay(config.whatsappNumber) }
  });
};
