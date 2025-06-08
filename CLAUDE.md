# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start development server with Turbopack
npm run build     # Create production build
npm run start     # Start production server
npm run lint      # Run ESLint
```

## Architecture

This is a Next.js 15 application using the App Router pattern.

### Key Technologies
- **Next.js 15.3.3** with App Router and Turbopack
- **React 19.0.0** 
- **TypeScript 5** with strict mode
- **Tailwind CSS 4** (latest version using @tailwindcss/postcss)
- **ESLint 9** with Next.js configuration

### Project Structure
- `/src/app/` - App Router directory containing pages, layouts, and styles
- `/public/` - Static assets
- Path alias: `@/*` maps to `./src/*`

### Important Patterns
1. **App Router**: All pages and layouts go in `/src/app/`
2. **Font Loading**: Uses `next/font` with Geist Sans and Geist Mono fonts
3. **Styling**: Tailwind CSS with dark mode support via CSS variables
4. **TypeScript**: Strict mode enabled, use type safety throughout

### Development Notes
- Development server uses Turbopack for fast refresh
- The project is optimized for Vercel deployment
- Dark mode is handled through CSS custom properties and `prefers-color-scheme`