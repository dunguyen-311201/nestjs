# E-Commerce Web Application

A modern, full-featured e-commerce storefront built with Next.js 16, TypeScript, and Tailwind CSS. This application serves as the customer-facing interface for the E-Commerce Monorepo, providing a seamless shopping experience with real-time product search, cart management, and secure checkout.

## 🚀 Features

The application includes a comprehensive set of features for a complete e-commerce experience:

- **Authentication & Authorization**: Secure user authentication powered by [Clerk](https://clerk.dev/), including protected routes and admin access controls.
- **Product Catalog**: fast and responsive product listing with:
  - Real-time search and filtering by category.
  - Sorting options (Price, Name, Stock).
  - Pagination for efficient browsing.
- **Product Details**: Dedicated pages for each product with detailed descriptions, pricing, and stock status.
- **Shopping Cart**: robust cart management with local persistence and real-time updates.
- **Checkout Flow**: Multi-step checkout process with form validation for shipping and payment details.
- **Order Management**: User-specific order history and tracking.
- **Admin Dashboard**: a protected area for administrators to manage products, view orders, and monitor inventory.
- **Responsive Design**: Mobile-first UI built with Tailwind CSS, ensuring a great experience on all devices.
- **Theming**: comprehensive Dark/Light mode support.

## 🛠 Tech Stack

- **Framework**: [Next.js 16](https://nextjs.org/) (App Router)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **UI Components**: [HeroUI](https://heroui.com/), [Radix UI](https://www.radix-ui.com/), [Lucide React](https://lucide.dev/)
- **Authentication**: [Clerk](https://clerk.com/)
- **State Management**: React Context & Hooks
- **Forms**: [React Hook Form](https://react-hook-form.com/) + [Zod](https://zod.dev/)
- **Data Fetching**: [TanStack Query](https://tanstack.com/query/latest)

## 🏁 Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm, pnpm, or yarn

### Installation

1. Navigate to the web application directory:

   ```bash
   cd apps/web
   ```

2. Install dependencies:

   ```bash
   npm install
   # or
   pnpm install
   ```

3. Configure Environment Variables:
   Create a `.env` file in the `apps/web` directory and add the necessary environment variables (e.g., Clerk API keys, Backend API URL).

4. Run the development server:

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## 📜 Scripts

- `npm run dev`: Starts the development server.
- `npm run build`: Builds the application for production.
- `npm start`: Starts the production server.
- `npm run lint`: Runs ESLint to check for code quality issues.
- `npm run check-types`: Runs TypeScript type checking.

## 📂 Project Structure

- `app/`: Next.js App Router pages and layouts.
- `components/`: Reusable UI components.
- `context/`: React Context providers (e.g., CartContext).
- `lib/`: Utility functions and shared logic.
- `public/`: Static assets.
