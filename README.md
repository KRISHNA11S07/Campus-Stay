# 🏠 CampusStay

**Student accommodation, sorted.** A premium, ultra-modern platform that helps college freshers find verified Rooms, Hostels, PGs and Flats within **5 km** of their college — ranked by real student ratings and reviews.

## ✨ Features

- **College-first search** — enter your college, allow location access, and see every stay within a 5 km radius (haversine distance, computed client-side)
- **Rating-first ranking** — highest-rated listings always appear on top
- **Advanced filters** — rent, distance, accommodation type, minimum rating, facilities, verified-only, availability
- **Property details** — image gallery, rent & deposit, facilities, Google Maps embed, distance from college, hostel rules (for hostels), availability status
- **Direct contact** — Call and WhatsApp buttons connect students straight to verified owners (zero brokerage)
- **Ratings & reviews** — signed-in students can post reviews that update the listing's average
- **Wishlist** — save favourites with one tap (persisted in localStorage)
- **Accounts** — student and property-owner sign in / sign up (mock auth, ready to swap for a real API)
- **Design** — liquid-glass / glassmorphism UI, gradient mesh background, floating cards, scroll-triggered reveals, animated counters, micro-interactions, dark/light mode, fully responsive

## 🚀 Run locally

No build step — it's a clean static site.

```bash
# any static server works, e.g.:
python3 -m http.server 8000
# then open http://localhost:8000
```

> Geolocation requires `localhost` or HTTPS.

## 🌐 Deployment

Pushing to the default branch deploys automatically to **GitLab Pages** via `.gitlab-ci.yml`.

## 🗂️ Structure

```
├── index.html        # Homepage (hero, search, categories, featured, stats, FAQ)
├── listings.html     # Search results — 5 km radius, filters, sorting, wishlist view
├── property.html     # Property details — gallery, map, reviews, contact
├── auth.html         # Student / owner sign in & sign up
├── css/styles.css    # Liquid-glass design system (light + dark themes)
└── js/
    ├── data.js       # Mock data layer (colleges, listings) — swap for API
    ├── main.js       # Shared core: theme, nav, reveal animations, wishlist, helpers
    ├── home.js       # Homepage: search flow, geolocation, counters, FAQ
    ├── listings.js   # Radius filtering, rating-first ranking, filter UI
    ├── property.js   # Details page, gallery swap, review posting
    └── auth.js       # Mock authentication
```

## 🔮 Next steps

- Replace `js/data.js` with a real backend API (the data shape is documented there)
- Real authentication (OAuth / OTP) replacing the localStorage mock
- Owner dashboard for managing listings
- Google Maps JS API with clustered pins on the listings page
