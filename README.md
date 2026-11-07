# Savory Bites — restaurant website with admin dashboard

Node.js + Express + MongoDB (Mongoose) backend, vanilla HTML/CSS/JS frontend.
Savory Bites is a **fictional** restaurant; all seeded content is labelled as sample and is editable in the dashboard.

## Features
- Public site: nav, hero, welcome, popular dishes, full menu with category filter, about, gallery, opening hours, location, contact, footer. All content loads from the API, with loading, empty and error states.
- WhatsApp ordering (hero, nav, floating button, every dish, contact form) from **one** server-side config value.
- Admin dashboard at `/admin`: overview, menu CRUD (images, categories, popular, enable/disable), gallery CRUD, restaurant info, enquiries (read/handled/delete), password change.

## Folder structure
```
savory-bites/
├── client/                 public site (served statically)
│   ├── index.html
│   ├── css/styles.css      media queries last, largest → smallest
│   ├── js/shared.js, main.js
│   ├── assets/favicon.svg
│   └── admin/              login.html, setup.html, css/admin.css, js/{login,setup,admin}.js
├── server/
│   ├── config/index.js     env + central WHATSAPP_NUMBER
│   ├── controllers/  middleware/  models/  routes/  services/
│   ├── views/dashboard.html   only served to signed-in admins
│   ├── scripts/create-admin.js
│   ├── tests/              static, unit and API integration tests
│   ├── app.js              Express app factory
│   └── server.js           DB connection + listen
├── .env.example  .gitignore  package.json  README.md
```

## Run locally
1. Install Node.js 18.18+ and have a MongoDB (local, or a free MongoDB Atlas cluster).
2. `npm install`
3. `cp .env.example .env`, then set `MONGODB_URI`, `SESSION_SECRET` (optional in dev) and `SETUP_TOKEN`.
4. `npm run dev` (auto-restart) or `npm start`, then open http://localhost:3000.
On first start the settings document and fictional sample menu/gallery entries are created once (`SEED_SAMPLE_DATA=false` skips the samples).

## MongoDB
- **Atlas (recommended):** create a free cluster, add a database user, allow your host's IP (or 0.0.0.0/0 for hosts with changing IPs), copy the `mongodb+srv://…` string into `MONGODB_URI`, adding a database name such as `/savory-bites`.
- **Local:** `mongodb://127.0.0.1:27017/savory-bites`.

## Create the first admin (no public registration exists)
- **Option A, web (no terminal):** set `SETUP_TOKEN` on the server, open `/admin/setup.html`, enter the token, your email and a password (10+ characters, letters and numbers). It works only while no admin exists, then closes permanently. Afterwards you may remove `SETUP_TOKEN`.
- **Option B, terminal:** `npm run create-admin` (prompts), or `ADMIN_EMAIL=… ADMIN_PASSWORD=… npm run create-admin`.
Then sign in at `/admin`. Only one owner account exists by design.

## Environment variables
| Variable | Required | Purpose |
|---|---|---|
| `MONGODB_URI` | production | MongoDB connection string |
| `SESSION_SECRET` | production | 32+ random characters; signs session cookies |
| `SETUP_TOKEN` | for web setup | One-time token for `/admin/setup.html` |
| `WHATSAPP_NUMBER` | no | Digits only, international format. Default `2348164212898` (from 08164212898) |
| `MAX_IMAGE_MB` | no | Upload limit per image (default 3) |
| `ALLOWED_ORIGINS` | no | Extra origins allowed to call the API (same-origin needs none) |
| `SEED_SAMPLE_DATA` | no | `false` skips fictional sample menu/gallery |
| `PORT`, `NODE_ENV` | no | Set `NODE_ENV=production` when deployed (enables secure cookies, HSTS, config checks) |

## WhatsApp configuration
The number is defined once, in `server/config/index.js` (`WHATSAPP_NUMBER`, overridable by env). The API serves it to the page and `client/js/main.js` is the only file that builds `https://wa.me/…` links.

## Image storage
Uploaded images are stored **in MongoDB** (`images` collection) and served from `/media/<id>`. This survives redeploys on hosts with temporary disks (Render, Railway, Heroku) with no extra service. Uploads are limited to JPG/PNG/WebP, checked by extension, MIME type **and file signature**; SVG is rejected; the original filename is never used. Atlas free tier has 512 MB, so keep photos around 200–800 KB. To move to S3/Cloudinary later, change only `server/services/imageStorage.js`.

## Tests
`npm test` runs static checks (media-query order, CSP-safe HTML, single WhatsApp number) and unit tests. Add a MongoDB URI to run the full API suite (it **drops that database**, so use a throwaway one):
`TEST_MONGODB_URI=mongodb://127.0.0.1:27017/savory-bites-test npm test`

## Deploy (Render + Atlas, works from a phone)
1. Push the project to GitHub (`.env` is git-ignored).
2. Render → New → **Web Service** → connect the repo. Build command `npm install`, start command `npm start`.
3. Environment: `NODE_ENV=production`, `MONGODB_URI`, `SESSION_SECRET`, `SETUP_TOKEN` (optionally `WHATSAPP_NUMBER`).
4. Deploy, open `https://<your-app>.onrender.com/admin/setup.html` and create the owner account.
5. Add real photos from the dashboard. Use a custom domain if you like; HTTPS is required for the admin cookie in production.
Any VPS works too: Node 18+, `NODE_ENV=production npm start` behind nginx/Caddy with HTTPS (the app already trusts one proxy hop).

## Security summary
bcrypt-hashed password (cost 12); server-side sessions in MongoDB with HttpOnly, SameSite=Lax, Secure (production) cookies and session regeneration on login; every `/api/admin` route and the dashboard page checked server-side; CSRF header + origin check on all state-changing requests; login (10/15 min), setup, enquiry and global rate limits; Helmet with strict CSP (no inline scripts); input whitelisting and validation, `$`-operator stripping, ObjectId checks; output rendered with `textContent`; 20 KB JSON limit; honeypot on the contact form.

## Limitations
- Enquiries are stored, but no email/WhatsApp notification is sent to the owner (check the dashboard).
- Orders are WhatsApp messages; there is no cart, payment or order tracking.
- Single owner account; no password-reset email (re-run `create-admin` after removing the admin document in the database if locked out).
- The map is a placeholder; add a "directions" link in Restaurant info.
- Rate-limit counters are in memory (per server instance).
