# Mobile Menu Implementation

## Overview
A custom mobile menu has been implemented using a slide-in sheet component. The menu appears from the right side of the screen when the hamburger button is clicked on mobile devices.

## Components Created

### 1. Sheet Component (`/src/components/ui/Sheet.tsx`)
A reusable sheet/drawer component with the following features:
- Slide-in animation from the right
- Backdrop overlay with click-to-close functionality
- ESC key support for closing
- Focus trap for accessibility
- Proper ARIA attributes for screen readers
- Body scroll lock when open
- Dark mode support

### 2. Updated Header Component (`/src/components/layout/Header.tsx`)
- Added state management for mobile menu open/closed state
- Connected hamburger button to open the sheet
- Integrated Sheet component with navigation content
- Mobile menu includes:
  - App logo/name with link to home
  - Close button (X icon)
  - Navigation links (記事一覧, カテゴリ)
  - Search button placeholder

## Features

### Accessibility
- Focus management: Returns focus to trigger button when closed
- Keyboard navigation: Tab key cycles through interactive elements
- ESC key closes the menu
- ARIA attributes for screen readers
- Semantic HTML structure

### User Experience
- Smooth slide-in/out animations (300ms)
- Backdrop prevents interaction with page content
- Clicking backdrop or close button closes the menu
- Clicking navigation links closes the menu
- Body scroll is locked when menu is open

### Responsive Design
- Menu button only appears on mobile devices (md:hidden)
- Desktop navigation remains unchanged
- Consistent styling with the rest of the application

## Usage
The mobile menu is automatically available on all pages since it's part of the Header component. No additional setup is required.

## Future Enhancements
- Add search functionality when clicked
- Add user account/profile section if authentication is implemented
- Consider adding more navigation items as the app grows
- Add animation to the hamburger icon (transform to X when open)