'use strict';
const Enquiry = require('../models/Enquiry');
const { HttpError } = require('../middleware/errorHandler');

const serialize = e => ({ id: e._id, name: e.name, message: e.message, status: e.status, createdAt: e.createdAt });

exports.list = async (req, res) => {
  res.json((await Enquiry.find().sort({ createdAt: -1 }).limit(300).lean()).map(serialize));
};
exports.setStatus = async (req, res) => {
  const status = req.body.status;
  if (!['new', 'read', 'handled'].includes(status)) throw new HttpError(400, 'Invalid status.');
  const e = await Enquiry.findByIdAndUpdate(req.params.id, { $set: { status } }, { new: true }).lean();
  if (!e) throw new HttpError(404, 'Enquiry not found.');
  res.json(serialize(e));
};
exports.remove = async (req, res) => {
  if (!(await Enquiry.findByIdAndDelete(req.params.id))) throw new HttpError(404, 'Enquiry not found.');
  res.json({ ok: true });
};
