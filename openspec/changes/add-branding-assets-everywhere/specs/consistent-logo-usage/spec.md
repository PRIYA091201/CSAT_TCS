## ADDED Requirements

### Requirement: Logo displayed on all customer-form screens
The customer-form app SHALL display the logo (`/logo.svg`) on every screen state including error, timeout, and already-used states.

#### Scenario: Logo on error screen
- **WHEN** the customer-form displays an error state
- **THEN** the logo image SHALL be visible with `src="/logo.svg"` and `alt="The Chennai Silks"`

#### Scenario: Logo on timeout screen
- **WHEN** the customer-form displays a timeout/expired state
- **THEN** the logo image SHALL be visible with `src="/logo.svg"` and `alt="The Chennai Silks"`

#### Scenario: Logo on already-used screen
- **WHEN** the customer-form displays an already-used/submitted state
- **THEN** the logo image SHALL be visible with `src="/logo.svg"` and `alt="The Chennai Silks"`

### Requirement: All logo images have onError fallback
Every `<img>` element rendering the logo in all 3 apps SHALL include an `onError` handler that hides the image and reveals a text fallback element.

#### Scenario: Customer-form logo onError handling
- **WHEN** the logo image fails to load in the customer-form app
- **THEN** the `<img>` element SHALL be hidden (display: none) and a text fallback element SHALL become visible

#### Scenario: Existing onError handlers preserved
- **WHEN** the kiosk or admin-dashboard logo images fail to load
- **THEN** the existing onError fallback behavior SHALL continue to function (image hidden, text fallback shown)

### Requirement: Logo styling is consistent across screens
All logo `<img>` elements within the customer-form app SHALL use `object-contain` fitting and appropriate height classes consistent with other logo usages in the same app.

#### Scenario: Logo dimensions on error screens
- **WHEN** the logo is displayed on error/timeout/already-used screens in customer-form
- **THEN** the logo SHALL use a height class of `h-12` and `w-auto` with `object-contain`, matching the no-token screen styling
