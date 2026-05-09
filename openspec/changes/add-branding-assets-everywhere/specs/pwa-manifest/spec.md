## ADDED Requirements

### Requirement: Each app has a web app manifest
Each of the 3 apps (kiosk, customer-form, admin-dashboard) SHALL have a `manifest.json` file in their `public/` directory that conforms to the W3C Web App Manifest specification.

#### Scenario: Manifest file exists for each app
- **WHEN** the app is built and served
- **THEN** a `manifest.json` file SHALL be accessible at the root URL `/manifest.json`

### Requirement: Manifest declares app identity
Each manifest SHALL include a `name`, `short_name`, `start_url`, `display`, and `background_color` field appropriate to the specific app.

#### Scenario: Kiosk app manifest identity
- **WHEN** the kiosk manifest is loaded
- **THEN** `name` SHALL be "The Chennai Silks - Kiosk", `short_name` SHALL be "TCS Kiosk", `display` SHALL be "standalone", and `start_url` SHALL be "/"

#### Scenario: Customer form app manifest identity
- **WHEN** the customer-form manifest is loaded
- **THEN** `name` SHALL be "The Chennai Silks - Feedback", `short_name` SHALL be "TCS Feedback", `display` SHALL be "standalone", and `start_url` SHALL be "/"

#### Scenario: Admin dashboard app manifest identity
- **WHEN** the admin-dashboard manifest is loaded
- **THEN** `name` SHALL be "The Chennai Silks - Admin", `short_name` SHALL be "TCS Admin", `display` SHALL be "standalone", and `start_url` SHALL be "/"

### Requirement: Manifest declares favicon as icon
Each manifest SHALL include an `icons` array with at least one entry referencing `/favicon.svg` with type `image/svg+xml` and sizes `any`.

#### Scenario: SVG icon declared in manifest
- **WHEN** the manifest icons array is inspected
- **THEN** it SHALL contain an entry with `src` of `/favicon.svg`, `type` of `image/svg+xml`, and `sizes` of `any`

### Requirement: Manifest is linked from index.html
Each app's `index.html` SHALL include a `<link rel="manifest" href="/manifest.json" />` tag in the `<head>`.

#### Scenario: Manifest link present in HTML
- **WHEN** the app's index.html is loaded in a browser
- **THEN** the document head SHALL contain a link element with `rel="manifest"` pointing to `/manifest.json`
