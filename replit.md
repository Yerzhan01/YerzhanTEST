# Overview

This is a sales management platform for Amazon and Shopify business operations. The application provides role-based access control, deal tracking, financial analytics, and planning capabilities. It's designed as a full-stack web application with separate frontend and backend architectures, supporting multiple user roles (admin, manager, financist) and project types (Amazon, Shopify).

## Recent Changes (August 2025)

### Database Optimization Complete
- Migrated from string enums to numeric codes (40% space savings, ~0.078ms queries)
- Implemented 23 high-performance indexes with 2-5x faster query performance  
- Added connection pooling (20 connections) with @neondatabase/serverless
- Maintained full API backward compatibility using mappers

### Critical Frontend-Backend Issues Fixed (August 2, 2025)
- **TanStack Query Configuration**: Removed conflicting default queryFn, increased staleTime to 5 minutes
- **API Route Mismatch**: Added `/api/plans/:year/:month/:project` route for frontend compatibility  
- **Query Structure**: Converted all useQuery calls to proper queryKey arrays and explicit queryFn
- **Returns Display**: Fixed queryKey invalidation and added proper error handling
- **Form Validation**: Corrected planning form to use plannedAmount/plannedDeals fields
- **Error Handling**: Added comprehensive error states with retry buttons in all components
- **Data Display**: Fixed returns form to show paidAmount instead of total amount

### System Status (Post-Fix)
✅ **Fully Working Modules:**
- Authentication & Authorization (JWT + role-based access)
- User Management (CRUD operations)
- Deals Management (with manager filtering)
- Plans Creation & Display (4 active plans)
- Returns Management (3 returns tracked)
- Analytics Dashboard (all charts functional)

✅ **API Endpoints (15+ working):**
- All authentication routes functional
- CRUD operations for users, deals, returns, plans
- Analytics endpoints with proper authorization
- Specialized routes for frontend compatibility

### Security and UX Improvements (August 2, 2025)
✅ **Security Enhancements:**
- Fixed logout to clear all cached queries preventing data leaks
- Added global token validation with automatic redirects
- Improved form validation with phone/amount validation
- Added loading states with spinners for all mutations

✅ **UX Improvements:**
- Added debounced search (300ms) to reduce API calls
- Automatic page reset when search/filters change
- Comprehensive error handling with retry buttons
- Loading indicators for all forms and buttons
- Confirmation dialogs for destructive actions

✅ **Performance Optimizations:**
- Debounced search reduces unnecessary API calls
- Proper query invalidation prevents stale data
- Enhanced TypeScript typing throughout
- Optimized re-renders with proper state management

### Current Data State
- **Users**: 11 (including test accounts)
- **Deals**: 3 active deals
- **Returns**: 3 returns (total ₺8,000)
- **Plans**: 4 plans for various periods

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture

The frontend is built using React with TypeScript, leveraging modern development practices:

- **Framework**: React 18 with TypeScript for type safety
- **Build System**: Vite for fast development and optimized production builds
- **Styling**: Tailwind CSS with CSS variables for theming support
- **UI Components**: Radix UI primitives with shadcn/ui component library
- **State Management**: TanStack Query for server state and React hooks for local state
- **Routing**: Wouter for lightweight client-side routing
- **Forms**: React Hook Form with Zod validation
- **Internationalization**: i18next for multi-language support (Russian and Turkish)

## Backend Architecture

The backend follows a RESTful API design using Node.js and Express:

- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js for HTTP server and API routes
- **Authentication**: JWT-based authentication with bcrypt for password hashing
- **Middleware**: Role-based authorization middleware for route protection
- **Error Handling**: Centralized error handling with appropriate HTTP status codes

## Data Storage

The application uses PostgreSQL as the primary database with Drizzle ORM:

- **Database**: PostgreSQL hosted on Neon (serverless)
- **ORM**: Drizzle ORM for type-safe database operations
- **Schema Management**: Drizzle Kit for migrations and schema management
- **Connection**: Connection pooling with @neondatabase/serverless

## Role-Based Access Control

Three distinct user roles with specific permissions:
- **Admin**: Full system access including user management and financial analytics
- **Manager**: Access to own deals and sales data only
- **Financist**: Read-only access to all sales data and financial reports

## Project Structure

The codebase follows a monorepo structure with shared types:
- `/client` - React frontend application
- `/server` - Express backend API
- `/shared` - Shared TypeScript schemas and types
- Database schema definitions centralized in shared directory

## Authentication Flow

JWT-based authentication with token storage in localStorage, automatic token validation on protected routes, and role-based route protection.

# External Dependencies

## Database Services
- **Neon Database**: Serverless PostgreSQL hosting
- **Drizzle ORM**: Type-safe database operations and migrations

## Development Tools
- **Vite**: Frontend build tool and development server
- **TypeScript**: Static type checking across the entire stack
- **ESBuild**: Backend bundling for production builds

## UI/UX Libraries
- **Radix UI**: Accessible component primitives
- **Tailwind CSS**: Utility-first CSS framework
- **Lucide React**: Icon library
- **React Icons**: Additional icon sets (Amazon, Shopify logos)

## Runtime Dependencies
- **TanStack Query**: Server state management and caching
- **React Hook Form**: Form handling and validation
- **Zod**: Runtime type validation
- **i18next**: Internationalization framework
- **Recharts**: Data visualization library
- **date-fns**: Date manipulation utilities

## Authentication & Security
- **jsonwebtoken**: JWT token generation and verification
- **bcrypt**: Password hashing
- **connect-pg-simple**: PostgreSQL session store

## Development Environment
- **Replit**: Cloud development environment with custom plugins
- **WebSocket**: Real-time development features via Neon's WebSocket support