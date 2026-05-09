## 1. PWA Manifests

- [x] 1.1 Create `apps/kiosk/public/manifest.json` with name "The Chennai Silks - Kiosk", short_name "TCS Kiosk", display "standalone", start_url "/", background_color "#F5C518", and icons array referencing `/favicon.svg`
- [x] 1.2 Create `apps/customer-form/public/manifest.json` with name "The Chennai Silks - Feedback", short_name "TCS Feedback", display "standalone", start_url "/", background_color "#F5C518", and icons array referencing `/favicon.svg`
- [x] 1.3 Create `apps/admin-dashboard/public/manifest.json` with name "The Chennai Silks - Admin", short_name "TCS Admin", display "standalone", start_url "/", background_color "#F5C518", and icons array referencing `/favicon.svg`

## 2. HTML Meta Tags - Kiosk

- [x] 2.1 Add `<link rel="manifest" href="/manifest.json" />` to `apps/kiosk/index.html` head
- [x] 2.2 Add `<link rel="apple-touch-icon" href="/favicon.svg" />` to `apps/kiosk/index.html` head
- [x] 2.3 Add `<meta name="theme-color" content="#F5C518" />` to `apps/kiosk/index.html` head
- [x] 2.4 Add Open Graph meta tags (og:type, og:title "The Chennai Silks - Kiosk", og:image "/logo.svg", og:description) to `apps/kiosk/index.html` head
- [x] 2.5 Add Twitter Card meta tags (twitter:card "summary", twitter:image "/favicon.svg") to `apps/kiosk/index.html` head

## 3. HTML Meta Tags - Customer Form

- [x] 3.1 Add `<link rel="manifest" href="/manifest.json" />` to `apps/customer-form/index.html` head
- [x] 3.2 Add `<link rel="apple-touch-icon" href="/favicon.svg" />` to `apps/customer-form/index.html` head
- [x] 3.3 Add `<meta name="theme-color" content="#F5C518" />` to `apps/customer-form/index.html` head
- [x] 3.4 Add Open Graph meta tags (og:type, og:title "The Chennai Silks - Feedback", og:image "/logo.svg", og:description) to `apps/customer-form/index.html` head
- [x] 3.5 Add Twitter Card meta tags (twitter:card "summary", twitter:image "/favicon.svg") to `apps/customer-form/index.html` head

## 4. HTML Meta Tags - Admin Dashboard

- [x] 4.1 Add `<link rel="manifest" href="/manifest.json" />` to `apps/admin-dashboard/index.html` head
- [x] 4.2 Add `<link rel="apple-touch-icon" href="/favicon.svg" />` to `apps/admin-dashboard/index.html` head
- [x] 4.3 Add `<meta name="theme-color" content="#F5C518" />` to `apps/admin-dashboard/index.html` head
- [x] 4.4 Add Open Graph meta tags (og:type, og:title "The Chennai Silks - Admin", og:image "/logo.svg", og:description) to `apps/admin-dashboard/index.html` head
- [x] 4.5 Add Twitter Card meta tags (twitter:card "summary", twitter:image "/favicon.svg") to `apps/admin-dashboard/index.html` head

## 5. Customer Form - Consistent Logo Usage

- [x] 5.1 Add logo `<img src="/logo.svg">` with onError fallback to the error screen section in `apps/customer-form/src/components/customer-form.tsx`
- [x] 5.2 Add logo `<img src="/logo.svg">` with onError fallback to the timeout/expired screen section in `apps/customer-form/src/components/customer-form.tsx`
- [x] 5.3 Add logo `<img src="/logo.svg">` with onError fallback to the already-used/submitted screen section in `apps/customer-form/src/components/customer-form.tsx`
- [x] 5.4 Add onError fallback handler to existing logo `<img>` elements in customer-form that currently lack it (lines 135, 164, 176, 245)
