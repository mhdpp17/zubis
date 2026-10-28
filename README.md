# Zubi's storefront

Run `npm start`, then open http://localhost:8082. This site now needs its Node server for the shared product catalogue.

Admin portal: http://localhost:8082/admin. Username: `admin`. Initial password: `admin123`.

Add or edit products with a category, name, description, rupee price and photo. Existing products are imported on first start. Photos accept JPG, PNG or WebP up to 25 MB, with framing sliders and a live preview. Saved changes appear on storefront refresh or when switching back to its tab.

Products and uploaded images persist in `data/`; back up this folder. Set `DATA_DIR` to use another persistent disk location. Run `npm test` for API integration checks. Sessions expire after eight hours or a server restart. `PORT` defaults to 8082 and `HOST` to 127.0.0.1.

Before public hosting, set a strong `ADMIN_PASSWORD`, use HTTPS and set `COOKIE_SECURE=true`. `ADMIN_USERNAME` can also override the username. Deploy with persistent disk storage; a static host or ephemeral filesystem will not support saved catalogue updates.

The website uses a server-backed catalogue and a client-side WhatsApp order flow. Replace the demonstration prices, product details, customer review, and the example `zubis.example` sitemap URL with approved Zubi's information before launch.

The product cart is persisted locally in the visitor's browser. There is no online payment, customer account, or inventory reservation system.
