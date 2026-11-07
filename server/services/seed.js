'use strict';
const config = require('../config');
const Settings = require('../models/RestaurantSettings');
const MenuItem = require('../models/MenuItem');
const GalleryItem = require('../models/GalleryItem');

const DEFAULTS = {
  name: 'Savory Bites',
  tagline: 'Seasonal ingredients, slow-crafted sauces and warm hospitality. Dine in with us, or order your favourites in seconds on WhatsApp.',
  introduction: 'Savory Bites is a fictional restaurant concept used for this sample site. Edit this text, the menu and every detail from the admin dashboard.',
  description: 'Savory Bites began with a simple belief: great food is made with patience. Our kitchen builds each plate from seasonal ingredients and honest technique.\n\nFrom the first warm bread to the last square of dark chocolate, every detail is considered, in a room designed to feel like an invitation. (Sample description - replace it with your own story.)',
  hours: [
    { day: 'Monday – Thursday', time: '12:00 – 22:00' },
    { day: 'Friday – Saturday', time: '12:00 – 23:30' },
    { day: 'Sunday', time: '10:00 – 21:00' }
  ],
  address: '123 Sample Street, Example City (fictional sample address)',
  currency: '₦',
  notice: 'Sample content: Savory Bites is a fictional restaurant. Hours, address and descriptions are placeholders.'
};

const MENU = [
  ['Truffle Mushroom Risotto', 'Creamy arborio, wild mushrooms, shaved black truffle.', 8500, 'Mains', true],
  ['Pan-Seared Salmon', 'Crisp skin, lemon beurre blanc, asparagus.', 12500, 'Mains', true],
  ['Wagyu Beef Burger', 'Brioche bun, aged cheddar, caramelised onion.', 9800, 'Mains', true],
  ['Lobster Linguine', 'Fresh pasta, half lobster, garlic tomato bisque.', 15500, 'Mains', false],
  ['Herb-Crusted Lamb Rack', 'Rosemary jus, garlic mash, glazed carrots.', 18000, 'Mains', false],
  ['Burrata & Heirloom Tomato', 'Basil oil, aged balsamic, toasted sourdough.', 6500, 'Starters', false],
  ['Saffron Seafood Paella', 'Prawns, mussels and calamari over saffron rice.', 14500, 'Mains', true],
  ['Dark Chocolate Fondant', 'Molten centre, vanilla cream, gold leaf.', 4500, 'Desserts', true]
];
const GALLERY = ['Truffle Risotto', 'Pan-Seared Salmon', 'Wagyu Burger', 'Lobster Linguine', 'Burrata Salad', 'Chocolate Fondant'];

// Creates the settings document, and (once only) fictional sample menu/gallery entries
// that use illustration fallbacks until real photos are uploaded.
async function ensureDefaults() {
  let settings = await Settings.findOne({ key: 'main' });
  if (!settings) settings = await Settings.create({ key: 'main', ...DEFAULTS });
  if (!settings.seeded) {
    if (config.seedSampleData && (await MenuItem.countDocuments()) === 0) {
      await MenuItem.insertMany(MENU.map(([name, description, price, category, isPopular], i) => ({ name, description, price, category, isPopular, sortOrder: i })));
      await GalleryItem.insertMany(GALLERY.map((caption, i) => ({ caption, sortOrder: i })));
    }
    settings.seeded = true;
    await settings.save();
  }
}
module.exports = { ensureDefaults, DEFAULTS };
