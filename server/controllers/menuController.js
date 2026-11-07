'use strict';
const MenuItem = require('../models/MenuItem');
const images = require('../services/imageStorage');
const { HttpError } = require('../middleware/errorHandler');
const v = require('../middleware/validate');

const serialize = i => ({ id: i._id, name: i.name, description: i.description, price: i.price, category: i.category, image: images.url(i.image), isPopular: i.isPopular, isActive: i.isActive, sortOrder: i.sortOrder });

function parse(b) {
  const e = {};
  const data = {
    name: v.text(b, 'name', { max: 120, required: true, label: 'Name' }, e),
    description: v.text(b, 'description', { max: 600, label: 'Description' }, e),
    category: v.text(b, 'category', { max: 40, label: 'Category' }, e) || 'Mains',
    price: v.number(b, 'price', { min: 0, max: 10000000, required: true, label: 'Price' }, e),
    sortOrder: v.number(b, 'sortOrder', { min: -9999, max: 9999, integer: true, label: 'Order' }, e),
    isPopular: v.bool(b.isPopular),
    isActive: v.bool(b.isActive, true)
  };
  v.fail(e);
  return data;
}

exports.list = async (req, res) => {
  res.json((await MenuItem.find().sort({ sortOrder: 1, createdAt: 1 }).lean()).map(serialize));
};

exports.create = async (req, res) => {
  const data = parse(req.body);
  const image = req.file ? await images.save(req.file) : '';
  try { res.status(201).json(serialize(await MenuItem.create({ ...data, image }))); }
  catch (e) { await images.remove(image); throw e; }
};

exports.update = async (req, res) => {
  const item = await MenuItem.findById(req.params.id);
  if (!item) throw new HttpError(404, 'Menu item not found.');
  const data = parse(req.body);
  const old = item.image;
  let image = old;
  if (req.file) image = await images.save(req.file);
  else if (v.bool(req.body.removeImage)) image = '';
  Object.assign(item, data, { image });
  try { await item.save(); } catch (e) { if (image !== old) await images.remove(image); throw e; }
  if (image !== old) await images.remove(old);
  res.json(serialize(item));
};

exports.remove = async (req, res) => {
  const item = await MenuItem.findByIdAndDelete(req.params.id);
  if (!item) throw new HttpError(404, 'Menu item not found.');
  await images.remove(item.image);
  res.json({ ok: true });
};
