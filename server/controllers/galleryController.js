'use strict';
const GalleryItem = require('../models/GalleryItem');
const images = require('../services/imageStorage');
const { HttpError } = require('../middleware/errorHandler');
const v = require('../middleware/validate');

const serialize = i => ({ id: i._id, caption: i.caption, image: images.url(i.image), sortOrder: i.sortOrder });

function parse(b) {
  const e = {};
  const data = {
    caption: v.text(b, 'caption', { max: 160, label: 'Caption' }, e),
    sortOrder: v.number(b, 'sortOrder', { min: -9999, max: 9999, integer: true, label: 'Order' }, e)
  };
  v.fail(e);
  return data;
}

exports.list = async (req, res) => {
  res.json((await GalleryItem.find().sort({ sortOrder: 1, createdAt: 1 }).lean()).map(serialize));
};

exports.create = async (req, res) => {
  const data = parse(req.body);
  if (!req.file) throw new HttpError(400, 'Please choose an image.', { image: 'Image is required.' });
  const image = await images.save(req.file);
  try { res.status(201).json(serialize(await GalleryItem.create({ ...data, image }))); }
  catch (e) { await images.remove(image); throw e; }
};

exports.update = async (req, res) => {
  const item = await GalleryItem.findById(req.params.id);
  if (!item) throw new HttpError(404, 'Gallery entry not found.');
  const data = parse(req.body);
  const old = item.image;
  const image = req.file ? await images.save(req.file) : old;
  Object.assign(item, data, { image });
  try { await item.save(); } catch (e) { if (image !== old) await images.remove(image); throw e; }
  if (image !== old) await images.remove(old);
  res.json(serialize(item));
};

exports.remove = async (req, res) => {
  const item = await GalleryItem.findByIdAndDelete(req.params.id);
  if (!item) throw new HttpError(404, 'Gallery entry not found.');
  await images.remove(item.image);
  res.json({ ok: true });
};
