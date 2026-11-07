# Savory Bites

Static restaurant website and admin dashboard, hosted on Netlify with Supabase Auth, Database and Storage. The existing HTML, CSS and vanilla JavaScript design is retained. The legacy Express/MongoDB code remains in `server/` for reference only; Netlify publishes only `client/`.

## Configure Supabase

The browser uses the Supabase JavaScript client v2 from jsDelivr. Only a public project URL and publishable key are used in the browser; never put a `service_role`, `sb_secret_`, database password or other private key in `client/` or Netlify frontend variables.

Set these Netlify build environment variables:

| Variable | Value |
|---|---|
| `SUPABASE_URL` | Existing Supabase project URL, e.g. `https://<project-ref>.supabase.co` |
| `SUPABASE_PUBLISHABLE_KEY` | Existing project's publishable key (or legacy anon public JWT) |

`npm run build` validates these values and generates `client/js/supabase-config.js`. The generated file is public by design. `WHATSAPP_NUMBER` is kept in that config and defaults to `2348164212898`; edit the source config before deployment if the restaurant number should differ.

Locally, set the two environment variables in the shell before running `npm run build`, then serve `client/` using any static web server. The values in `.env.example` are documentation only; the build does not load dotenv files.

The checked-in `client/js/supabase-config.js` contains only the WhatsApp number; the build injects the Supabase URL and publishable key. Netlify's smart secrets detection may flag the deliberately public Supabase publishable key in the generated file. If the deploy log confirms this exact false positive, add the Netlify environment variable `SECRETS_SCAN_SMART_DETECTION_OMIT_VALUES` in **Project configuration → Environment variables** and set its value to the same `SUPABASE_PUBLISHABLE_KEY` value used by the build. This safelists only that public key; do not add a secret/service-role key, omit the whole file, or disable secrets scanning. See [Netlify secret scanning](https://docs.netlify.com/manage/security/secret-scanning/) for the supported safelist setting.

## Existing Supabase data and policies

The frontend uses the existing tables `admin_users`, `menu_items`, `gallery_items`, `restaurant_settings` and `enquiries`, plus the public Storage bucket `restaurant-images`. It maps snake_case database columns into camelCase where applicable, including `is_active` → `isActive`, `sort_order` → `sortOrder`, and timestamps. Menu and gallery image URLs are stored directly in each table's `image` column.

Before deploying, check the existing schema and Row Level Security policies in the Supabase dashboard. The implementation expects:

- `admin_users.user_id` to contain the associated Supabase Auth user UUID. A signed-in user may read only their own membership row.
- `menu_items` to have `id`, `name`, `description`, `price`, `category`, `image`, `is_active`, `is_popular`, and `sort_order`.
- `gallery_items` to have `id`, `caption`, `image`, and `sort_order`.
- `restaurant_settings` to have one existing row identified by `key`, plus the restaurant fields and an `hours` JSON/JSONB array of `{day, time}` objects.
- `enquiries` to have `id`, `name`, `message`, `status`, and `created_at`.
- Anonymous users to read public restaurant settings, active menu rows and gallery rows, and insert enquiries only. Public enquiry inserts must not permit writes to `admin_users` or any other administrative table.
- Admin database reads and writes to be limited by RLS to authenticated users who have a matching `admin_users.user_id` row.
- The `restaurant-images` bucket to allow public reads; uploads and deletes must be restricted to authenticated administrators. The browser uploads under `menu/` and `gallery/`.

Do not disable RLS to make the site work. The browser-side membership check controls the UI, but **RLS is the security boundary** for database and Storage operations. The source does not provide the Supabase project's actual schema or policies. Verify these expectations against the existing project rather than applying guessed migrations.

The existing Supabase Auth administrator account is used as-is. Public registration is not implemented. `/admin/setup.html` displays that administrator setup is disabled.

## Netlify deployment

1. Connect the project repository to Netlify.
2. The included `netlify.toml` sets build command `npm run build` and publish directory `client`.
3. Add `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` in **Site configuration → Environment variables**. Use only the public publishable key.
4. Trigger a deploy. Netlify builds a static configuration file; no Express process, MongoDB connection, session store or server runtime is used.
5. Test `/`, `/admin`, and `/admin/login.html` over the deployed HTTPS domain.

`client/_redirects` routes `/admin` and `/admin/` to the static dashboard entry point. `client/_headers` sets basic browser security headers and prevents caching of the generated public configuration.

## Features

- Public restaurant information, active menu, popular dishes, category filters, gallery, opening hours and directions.
- WhatsApp ordering for the main buttons, each dish and contact form using the one configured international number.
- Public contact form writes enquiries to Supabase.
- Admin sign-in uses Supabase Auth and checks membership in `admin_users`.
- Admin overview, menu and gallery management, image uploads, restaurant settings, enquiries and password changes.
- Uploaded JPG, PNG and WebP files are limited to 3 MB and stored in the `restaurant-images` bucket. Images are replaced/deleted after their corresponding record operation succeeds.

## Checks

Run `npm test` for database-free frontend mapping, static asset, responsive stylesheet, Netlify routing and retired-API checks. The build requires the two Supabase environment variables above. No live Supabase, Auth, RLS, Storage or browser test is included; those require the configured project and a deployed or locally served site.

The old server implementation and its MongoDB tests are not part of the Netlify build or test command. Do not run legacy destructive database tests as part of this static deployment.
