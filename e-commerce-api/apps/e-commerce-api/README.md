# E-Commerce Backend API

A modern, production-ready e-commerce backend built with Fastify, TypeORM, PostgreSQL, Clerk Auth, and Stripe Payments.

[![Node.js](https://img.shields.io/badge/Node.js-18.x-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![Fastify](https://img.shields.io/badge/Fastify-5.x-black.svg)](https://fastify.dev/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15+-blue.svg)](https://www.postgresql.org/)

---

## 📋 Table of Contents

- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Architecture](#-architecture)
- [Prerequisites](#-prerequisites)
- [Installation](#-installation)
- [Environment Setup](#-environment-setup)
- [Running the Application](#-running-the-application)
- [Database Migrations](#-database-migrations)
- [Testing](#-testing)
- [API Documentation](#-api-documentation)
- [Project Structure](#-project-structure)
- [Security](#-security)
- [Performance Optimization](#-performance-optimization)
- [Deployment](#-deployment)
- [Troubleshooting](#-troubleshooting)
- [Contributing](#-contributing)

---

## ✨ Features

### Core Features

- 🛍️ **Product Catalog Management**: Create, read, update, delete products with categories
- 🛒 **Shopping Cart**: Session-based cart management
- 💳 **Payment Processing**: Integrated Stripe payment gateway with webhook support
- 📦 **Order Management**: Complete order lifecycle from checkout to fulfillment
- 👥 **User Management**: Role-based access control (User, Admin)
- 📧 **Email Notifications**: Order confirmation emails via SendGrid

### Security Features

- 🔐 **Authentication**: Clerk-based JWT authentication
- 🛡️ **Authorization**: Role-based permissions with hierarchical access control
- 🚨 **Rate Limiting**: API rate limiting to prevent abuse
- 🔒 **Input Validation**: Fastify Schema (JSON Schema) validation for all endpoints with strict typing
- 🧹 **CORS Protection**: Configurable CORS with origin whitelisting
- 🪖 **HTTP Security Headers**: Fastify Helmet integration

### Technical Features

- 🔄 **Database Transactions**: ACID compliance with pessimistic locking
- 📊 **Soft Deletes**: Reversible data deletion for Product entities
- 🔍 **Advanced Filtering**: Search, sort, and filter across all resources
- 📄 **Pagination**: Cursor-based pagination for large datasets
- 🧪 **Unit Testing**: Vitest test suite with extensive coverage

---

## 🛠️ Tech Stack

### Core

- **Runtime**: [Node.js 18+](https://nodejs.org/)
- **Language**: [TypeScript 5.x](https://www.typescriptlang.org/)
- **Framework**: [Fastify 5.x](https://fastify.dev/)
- **Database**: [PostgreSQL 15+](https://www.postgresql.org/)
- **ORM**: [TypeORM 0.3.x](https://typeorm.io/)

### Authentication & Payments

- **Auth Provider**: [Clerk](https://clerk.com/)
- **Payment Gateway**: [Stripe](https://stripe.com/)
- **Email Service**: [SendGrid](https://sendgrid.com/)

### Development Tools

- **Package Manager**: pnpm (recommended) or npm
- **Testing**: [Vitest](https://vitest.dev/)
- **Type Checking**: TypeScript strict mode
- **Validation**: [JSON Schema](https://json-schema.org/) & [fastify-type-provider-json-schema-to-ts](https://github.com/fastify/fastify-type-provider-json-schema-to-ts)

### Security & Middleware

- **Security Headers**: @fastify/helmet
- **Rate Limiting**: @fastify/rate-limit
- **CORS**: @fastify/cors
- **Environment Config**: dotenv

---

## 🏛️ Architecture

### Design Patterns

- **Dependency Injection**: Custom container-based DI (`src/utils/container.ts`) for loose coupling and testability
- **Repository Pattern**: Abstraction layer for data access (`src/repositories`)
- **Service Layer Pattern**: Business logic separation (`src/services`)
- **Interface Segregation**: Clean abstractions for external adapters (Email, Payment)

## 📦 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js**: v18.x or higher
- **pnpm**: (Recommended) or npm
- **PostgreSQL**: v15 or higher
- **Git**: For version control

### External Services

You'll need accounts and API keys for:

- [Clerk](https://clerk.com/) - Authentication
- [Stripe](https://stripe.com/) - Payment processing
- [SendGrid](https://sendgrid.com/) - Email delivery

---

## 🚀 Installation

### 1. Clone the Repository

```bash
git clone git@gitlab.asoft-python.com:du.nguyen/nodejs-training.git
cd e-commerce/apps/e-commerce-api
```

### 2. Install Dependencies

```bash
pnpm install
# or
npm install
```

## 🔧 Environment Setup

### 1. Create Environment File

```bash
cp .env.example .env
```

### 2. Configure Environment Variables

Edit `.env` with your actual values:

```env
# Application
NODE_ENV=development
PORT=8080
API_VERSION=v1
CLIENT_BASE_URL=http://localhost:3000

# Database
DB_HOST=localhost
DB_USERNAME=postgres
DB_PASSWORD=your_secure_password_here
DB_NAME=e_commerce

# Clerk Authentication
CLERK_PUBLISHABLE_KEY=pk_test_xxxxxxxxxxxxx
CLERK_SECRET_KEY=sk_test_xxxxxxxxxxxxx

# Stripe Payment
STRIPE_PUBLISHABLE_KEY=pk_test_xxxxxxxxxxxxx
STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx

# SendGrid Email
SENDGRID_API_KEY=SG.xxxxxxxxxxxxx
EMAIL_FROM=noreply@yourdomain.com

# Security
ALLOWED_ORIGINS=http://localhost:3000
```

---

## 🏃 Running the Application

### Development Mode (with hot reload)

```bash
npm run dev
```

Server will start at `http://localhost:8080`

### Production Build

```bash
# Build TypeScript to JavaScript
npm run build

# Start production server
node dist/src/server.js
```

### Verify Server is Running

```bash
curl http://localhost:8080/api/v1/health
```

---

## 🗄️ Database Migrations

### Run Migrations

```bash
npm run migration:run
```

### Create New Migration

```bash
npm run migration:generate -- src/database/migrations/YourMigrationName
```

### Revert Last Migration

```bash
npm run revert-migration
```

### Seed Database

Populate database with sample data:

```bash
npm run seed-data
```

To revert seed data:

```bash
npm run revert-data
```

This will create:

- Sample categories
- Sample products
- Administrative users

---

## 🧪 Testing

### Run All Tests

```bash
npm test
```

This runs the Vitest test runner.

### Run Tests in Watch Mode

```bash
npm run test:watch
```

### Generate Coverage Report

```bash
npm run test:coverage
```

Coverage reports will be generated in the `coverage/` directory.

---

## 📚 API Documentation

### Base URL

```
http://localhost:8080/api/v1
```

### Swagger UI

Documentation is available at:

```
http://localhost:8080/documentation
```

### Authentication

All protected endpoints require a Clerk JWT token in the Authorization header:

```http
Authorization: Bearer <clerk-jwt-token>
```

### Key Endpoints

#### Products

- `GET /api/v1/products` - List all products (with filters: query, category, status)
- `GET /api/v1/products/:id` - Get product details
- `POST /api/v1/admin/products` - Create product (Admin only)
- `PUT /api/v1/admin/products/:id` - Update product (Admin only)
- `DELETE /api/v1/admin/products/:id` - Delete product (Admin only)

#### Categories

- `GET /api/v1/categories` - List categories

#### Cart

- `GET /api/v1/cart` - Get current user's cart
- `POST /api/v1/cart/add-item` - Add item to cart
- `PUT /api/v1/cart/items/:id` - Update item quantity
- `DELETE /api/v1/cart/items/:id` - Remove item from cart

#### Orders

- `GET /api/v1/orders` - Get current user's orders
- `GET /api/v1/orders/:id` - Get order details
- `PATCH /api/v1/orders/:id/cancel` - Cancel order

#### Checkout

- `POST /api/v1/checkout/payment-intents` - Initialize payment intent
- `POST /api/v1/checkout/stripe-webhooks` - Handle Stripe events

#### Auth

- `POST /api/v1/auth/login` - User login
- `POST /api/v1/auth/register` - User registration (Clerk Webhook)

For detailed API documentation, start the server and visit the Swagger UI at `/documentation`.

---

## 📁 Project Structure

```
src/
├── adapters/            # External service adapters (Email, Payment)
├── configs/             # Configuration files
├── constants/           # Global constants
├── controllers/         # HTTP request handlers
├── database/            # TypeORM entities, migrations, data source
├── dtos/                # Data Transfer Objects
├── middlewares/         # Fastify middlewares
├── plugins/             # Fastify plugins
├── repositories/        # Data access layer
├── routes/              # Route definitions
├── schemas/             # JSON Schemas
├── services/            # Business logic
├── types/               # TypeScript type definitions
├── utils/               # Utility functions (Container, Response)
├── server.ts            # Application entry point
└── test-utils.ts        # Testing utilities
```

---

## 🔐 Security

- **Authentication & Authorization**: Clerk JWT + RBAC.
- **Input Validation**: Strict JSON Schemas for all inputs.
- **Rate Limiting**: Protected against abuse via `@fastify/rate-limit`.
- **Security Headers**: Helmet.js integration.
- **CORS**: Restricted cross-origin resource sharing.

---

## ⚡ Performance Optimization

- **Fastify**: Low overhead web framework (up to 2x faster than Express).
- **Database**: Optimized indexes, connection pooling via TypeORM.
- **JSON Serialization**: Fastify's schema-based serialization.

---

## 🤝 Contributing

1. Create a feature branch: `git checkout -b feature/amazing-feature`
2. Commit your changes.
3. Push to branch.
4. Open a Pull Request.

---

## 📄 License

This project is licensed under the ISC License.
