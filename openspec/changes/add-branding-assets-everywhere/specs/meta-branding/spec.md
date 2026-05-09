## ADDED Requirements

### Requirement: Apple touch icon declared in each app
Each app's `index.html` SHALL include a `<link rel="apple-touch-icon" href="/favicon.svg" />` tag in the `<head>` section.

#### Scenario: Apple touch icon link present
- **WHEN** the app's index.html head section is inspected
- **THEN** it SHALL contain a `<link>` element with `rel="apple-touch-icon"` and `href="/favicon.svg"`

### Requirement: Theme color meta tag in each app
Each app's `index.html` SHALL include a `<meta name="theme-color" content="#F5C518" />` tag in the `<head>` section.

#### Scenario: Theme color meta present
- **WHEN** the app's index.html head section is inspected
- **THEN** it SHALL contain a `<meta>` element with `name="theme-color"` and `content="#F5C518"`

### Requirement: Open Graph meta tags in each app
Each app's `index.html` SHALL include Open Graph meta tags: `og:type`, `og:title`, `og:image`, and `og:description`.

#### Scenario: OG image references logo
- **WHEN** the app's index.html is inspected
- **THEN** it SHALL contain `<meta property="og:image" content="/logo.svg" />`

#### Scenario: OG title matches app name
- **WHEN** the kiosk app's index.html is inspected
- **THEN** it SHALL contain `<meta property="og:title" content="The Chennai Silks - Kiosk" />`

#### Scenario: OG type is website
- **WHEN** any app's index.html is inspected
- **THEN** it SHALL contain `<meta property="og:type" content="website" />`

### Requirement: Twitter Card meta tags in each app
Each app's `index.html` SHALL include `<meta name="twitter:card" content="summary" />` and `<meta name="twitter:image" content="/favicon.svg" />`.

#### Scenario: Twitter card meta present
- **WHEN** the app's index.html head section is inspected
- **THEN** it SHALL contain a `<meta>` with `name="twitter:card"` and `content="summary"`

#### Scenario: Twitter image references favicon
- **WHEN** the app's index.html head section is inspected
- **THEN** it SHALL contain a `<meta>` with `name="twitter:image"` and `content="/favicon.svg"`
