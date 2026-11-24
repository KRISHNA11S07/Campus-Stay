# 🏠 CampusStay

**Student accommodation, sorted.** A premium, ultra-modern platform that helps college freshers find verified Rooms, Hostels, PGs and Flats within **5 km** of their college — ranked by real student ratings and reviews.

## ✨ Features

- **College-first search** — enter your college, allow location access, and see every stay within a 5 km radius (haversine distance, computed client-side)
- **Rating-first ranking** — highest-rated listings always appear on top
- **Advanced filters** — rent, distance, accommodation type, minimum rating, facilities, verified-only, availability
- **Property details** — image gallery, rent & deposit, facilities, Google Maps embed, distance from college, hostel rules (for hostels), availability status
- **Direct contact** — Call and WhatsApp buttons connect students straight to verified owners (zero brokerage)
- **Ratings & reviews** — signed-in students can post reviews that update the listing's average
- **Wishlist** — save favourites with one tap (saved privately to the signed-in student’s Supabase account)
- **Accounts** — Supabase sign-in, email confirmation and Google OAuth. Owner privileges require application review.
- **Design** — liquid-glass / glassmorphism UI, gradient mesh background, floating cards, scroll-triggered reveals, animated counters, micro-interactions, dark/light mode, fully responsive

## 🚀 Run locally

No build step — it's a clean static site.

```bash
# any static server works, e.g.:
python3 -m http.server 8000
# then open http://localhost:8000
```

> Geolocation requires `localhost` or HTTPS.

## Authentication and hosting

Serve this directory as the static site root. Supabase Auth, PostgreSQL and private Storage power the application. The Express/MongoDB folder is a separate backend foundation. The working local configuration is ignored by Git. A Pages artifact must supply the original project URL and its browser publishable key. See [setup and migration notes](supabase/README.md).

## Implementation and verification

The student experience uses real approved inventory within 5 km of KIT. Owners can apply, save property drafts and submit listings. Administrators review applications, moderate listings and reports, and inspect the audit trail. The [engineering report](supabase/ENGINEERING.md) identifies verified workflows, local test boundaries and outstanding release checks. The [production assessment](supabase/PRODUCTION-REVIEW.md) covers the legacy role-promotion function and migration-history preflight.
