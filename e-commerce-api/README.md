# E-Commerce Platform

A high-performance, full-stack e-commerce monorepo built with modern technologies. This project leverages **Turborepo** and **pnpm** for ultimate developer experience and build performance.

---

## 🏗️ Project Structure

This monorepo consists of multiple applications and shared packages:

### Applications (`/apps`)

- **[web](./apps/web/README.md)**: A modern storefront built with Next.js 16 (App Router), Tailwind CSS, and HeroUI.
- **[e-commerce-api](./apps/e-commerce-api/README.md)**: A high-performance backend API built with Fastify, TypeORM, and PostgreSQL.

### Shared Packages (`/packages`)

- **@repo/ui**: Shared React component library.
- **@repo/eslint-config**: Centralized ESLint configurations.
- **@repo/typescript-config**: Shared TypeScript configurations.

---

## 🛠️ Tech Stack

### Core Monorepo

- **Package Manager**: [pnpm](https://pnpm.io/)
- **Monorepo Management**: [Turborepo](https://turbo.build/)
- **Language**: [TypeScript](https://www.typescriptlang.org/)

### Frontend (web)

- **Framework**: [Next.js](https://nextjs.org/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Auth**: [Clerk](https://clerk.com/)
- **Payments**: [Stripe](https://stripe.com/)

### Backend (e-commerce-api)

- **Framework**: [Fastify](https://fastify.dev/)
- **ORM**: [TypeORM](https://typeorm.io/)
- **Database**: [PostgreSQL](https://www.postgresql.org/)
- **Validation**: JSON Schema (Fastify native)

---

## 🏁 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or higher
- [pnpm](https://pnpm.io/) v9 or higher

### Installation

1. Clone the repository:

   ```bash
   git clone git@gitlab.asoft-python.com:du.nguyen/nodejs-training.git
   cd e-commerce-api
   ```

2. Install dependencies:

   ```bash
   pnpm install
   ```

3. Configure Environment Variables:
   Follow the instructions in the respective applications:
   - [Frontend Configuration](./apps/web/README.md#-getting-started)
   - [Backend Configuration](./apps/e-commerce-api/README.md#-environment-setup)

---

## 📜 Development Scripts

Run scripts from the root directory using pnpm:

- `pnpm dev`: Start both `web` and `e-commerce-api` in development mode.
- `pnpm build`: Build all applications and packages.
- `pnpm lint`: Run linting across the entire monorepo.
- `pnpm check-types`: Run type checking across all packages.
- `pnpm test`: Run all tests.
- `pnpm format`: Format all files with Prettier.

---

## 🔐 Security & Optimization

- **Type Safety**: End-to-end TypeScript implementation.
- **Performance**: Schema-based JSON serialization in Fastify and optimized Next.js rendering.
- **Scalability**: Decoupled micro-services architecture managed in a single monorepo.

---

## 📄 License

This project is licensed under the ISC License.
