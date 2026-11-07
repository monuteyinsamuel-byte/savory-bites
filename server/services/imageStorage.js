'use strict';
/*
  Image storage: images live in MongoDB (collection "images") so they persist on hosts with
  ephemeral disks (Render, Railway, Heroku). To use S3/Cloudinary instead, keep the same
  functions (save, remove, url) and change the implementation here only.
*/
const path = require('path');
const Image = require('../models/Image');
const { HttpError } = require('../middleware/errorHandler');

const EXT_TYPE = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };

function sniff(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  return null;
}

async function save(file) {
  const real = sniff(file.buffer);
  const byExt = EXT_TYPE[path.extname(file.originalname || '').toLowerCase()];
  const claimed = file.mimetype === 'image/jpg' ? 'image/jpeg' : file.mimetype;
  if (!real || real !== byExt || real !== claimed) throw new HttpError(400, 'File is not a valid JPG, PNG or WebP image.');
  const doc = await Image.create({ data: file.buffer, contentType: real, size: file.size }); // filename is never stored or used
  return String(doc._id);
}

const remove = async id => { if (/^[a-f0-9]{24}$/.test(id || '')) await Image.deleteOne({ _id: id }).catch(() => {}); };
const url = id => (id ? `/media/${id}` : '');

module.exports = { save, remove, url, sniff };
