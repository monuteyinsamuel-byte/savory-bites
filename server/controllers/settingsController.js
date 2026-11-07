'use strict';
const Settings = require('../models/RestaurantSettings');
const v = require('../middleware/validate');
const { HttpError } = require('../middleware/errorHandler');

const FIELDS = ['name', 'tagline', 'introduction', 'description', 'hours', 'address', 'mapUrl', 'email', 'phone', 'currency', 'notice', 'updatedAt'];
const pick = s => Object.fromEntries(FIELDS.map(k => [k, s[k]]));

exports.get = async (req, res) => res.json(pick(await Settings.findOne({ key: 'main' }).lean()));

exports.update = async (req, res) => {
  const b = req.body, e = {};
  const data = {
    name: v.text(b, 'name', { max: 80, required: true, label: 'Restaurant name' }, e),
    tagline: v.text(b, 'tagline', { max: 200, label: 'Hero text' }, e),
    introduction: v.text(b, 'introduction', { max: 400, label: 'Introduction' }, e),
    description: v.text(b, 'description', { max: 2000, label: 'About text' }, e),
    address: v.text(b, 'address', { max: 200, label: 'Address' }, e),
    mapUrl: v.text(b, 'mapUrl', { max: 500, label: 'Directions link' }, e),
    email: v.text(b, 'email', { max: 254, label: 'Email' }, e),
    phone: v.text(b, 'phone', { max: 30, label: 'Phone' }, e),
    currency: v.text(b, 'currency', { max: 4, label: 'Currency symbol' }, e),
    notice: v.text(b, 'notice', { max: 200, label: 'Footer notice' }, e)
  };
  if (data.email && !v.isEmail(data.email)) e.email = 'Enter a valid email address.';
  if (data.phone && !/^[0-9+()\-\s]+$/.test(data.phone)) e.phone = 'Use digits, spaces, + ( ) and - only.';
  if (data.mapUrl && !v.isHttpsUrl(data.mapUrl)) e.mapUrl = 'Link must start with https://';
  data.hours = [];
  if (!Array.isArray(b.hours) || b.hours.length > 14) e.hours = 'Provide up to 14 opening-hours rows.';
  else b.hours.forEach((row, i) => {
    const re = {};
    const day = v.text(row || {}, 'day', { max: 40, required: true, label: 'Day' }, re);
    const time = v.text(row || {}, 'time', { max: 40, required: true, label: 'Time' }, re);
    if (Object.keys(re).length) e.hours = `Row ${i + 1}: day and time are required (max 40 characters).`;
    else data.hours.push({ day, time });
  });
  v.fail(e);
  const s = await Settings.findOneAndUpdate({ key: 'main' }, { $set: data }, { new: true, upsert: true }).lean();
  if (!s) throw new HttpError(500, 'Could not save settings.');
  res.json(pick(s));
};
