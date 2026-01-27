# FlashMan - Real-time Flashlight Synchronization Platform

## Overview

FlashMan is a real-time flashlight synchronization application that enables crowd coordination at events. A host creates an event and controls synchronized light effects across all connected attendee devices. The platform consists of a web application (React frontend + Express backend) and companion mobile apps (React Native/Expo for production, Flutter starter code provided).

**Core functionality:**
- Hosts create events with auto-generated PINs and passwords
- Attendees join via 9-character PIN (8 digits + 1 letter)
- Real-time effect broadcasting via Socket.IO (torch on/off, strobe, pulse, screen flash)
- Time synchronization for coordinated light shows
- Session tracking with participant counts

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework:** React 18 with TypeScript
- **Routing:** Wouter (lightweight alternative to React Router)
- **State Management:** TanStack Query for server state, React hooks for local state
- **Styling:** Tailwind CSS with shadcn/ui component library (New York style)
- **Animations:** Framer Motion for UI transitions and effects
- **Real-time:** Socket.IO client for WebSocket communication
- **Build Tool:** Vite with path aliases (@/, @shared/, @assets/)

### Backend Architecture
- **Runtime:** Node.js with Express
- **Language:** TypeScript with tsx for development
- **API Design:** RESTful endpoints defined in shared/routes.ts with Zod validation
- **Real-time:** Socket.IO server attached to HTTP server
- **Database ORM:** Drizzle ORM with PostgreSQL
- **Build:** esbuild for production bundling with selective dependency bundling

### Data Storage
- **Database:** PostgreSQL via Drizzle ORM
- **Schema Location:** shared/schema.ts (shared between frontend and backend)
- **Tables:**
  - `events` - Event details (id, pin, password, name, hostId, isActive, createdAt)
  - `sessions` - Active connections (id, eventId, role, isActive, timestamps)
  - `songs` - Music library with sync data (id, eventId, title, artist, url, syncData, duration)

### Authentication Pattern
- Anonymous authentication using UUID-based host IDs
- No traditional user accounts - hosts identified by generated hostId
- Event access controlled via PIN (attendees) and password (host re-login)
- Session persistence via connect-pg-simple for Express sessions

### Real-time Communication
- Socket.IO with WebSocket transport preferred
- Events: join_event, effect, time_sync, participant updates
- Effect payloads include type, duration, frequency, color, and startAt timestamp
- Client-side time offset calculation for synchronized effects

### Mobile Architecture
- **Primary:** React Native with Expo (in /mobile directory)
- **Alternative:** Flutter starter code provided in flutter_starter.md
- **Features:** Camera-based torch control, QR scanning, Socket.IO connectivity

## External Dependencies

### Database
- PostgreSQL (required, connection via DATABASE_URL environment variable)
- Drizzle Kit for migrations (`npm run db:push`)

### Key NPM Packages
- `socket.io` / `socket.io-client` - Real-time bidirectional communication
- `drizzle-orm` / `drizzle-zod` - Database ORM with schema validation
- `@tanstack/react-query` - Server state management
- `framer-motion` - Animation library
- `zod` - Runtime type validation
- `uuid` - Unique identifier generation

### UI Component Library
- shadcn/ui components (Radix UI primitives)
- Configured via components.json with @/ path aliases
- Full component set available in client/src/components/ui/

### Development Tools
- Vite with HMR and Replit-specific plugins
- TypeScript with strict mode
- PostCSS with Tailwind and Autoprefixer