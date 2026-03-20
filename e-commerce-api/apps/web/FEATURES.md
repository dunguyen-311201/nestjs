# E-Commerce API - Feature Documentation

This document summarizes the features implemented in the **web** application of the e-commerce monorepo.

## 1. Authentication & Authorization

- **Integration**: Powered by [Clerk](https://clerk.dev/).
- **Middleware**: Configured via `proxy.ts` (Next.js Proxy convention) to intercept requests and protect routes.
- **Custom Pages**: Dedicated `/sign-in` and `/sign-up` pages utilizing Clerk components.
- **Admin Protection**: Server-side utility `checkAdmin` to restrict access to the `/admin` route.
- **Persistence**: User session and metadata are used throughout the checkout and order history flows.

## 2. Storefront Features

- **Product Catalog**:
  - Responsive grid display with optimized images.
  - **Search**: Real-time search by product name.
  - **Category Filtering**: Dynamic filtering based on product categories (e.g., Apparel, Electronics, Home).
  - **Sorting**: Support for sorting by Price (Asc/Desc), Name (A-Z/Z-A), and Stock levels.
  - **Pagination**: Server-side pagination for efficient data loading.
- **Product Details**:
  - Dynamic routing at `/products/[id]`.
  - Detailed view including description, price, category, and stock status.
- **Shopping Cart**:
  - Context-based state management (`CartContext`).
  - LocalStorage persistence (cart remains after page refresh).
  - Add/Remove items and update quantities directly in the cart.

## 3. Checkout & Orders

- **Checkout Flow**:
  - Multi-section form: Contact Info, Shipping Address, and Payment Details.
  - **Validation**: Strict client-side validation using `react-hook-form` and `zod`.
  - **Order Processing**: Server Action handles order creation and cart clearing.
- **Order History**:
  - User-specific order history at `/orders`.
  - Detailed breakdown of order date, status, items purchased, and totals.

## 4. Admin Panel

- **Dashboard**: High-level metrics showing Total Products, Total Inventory count, and Total Inventory Value.
- **Product Management**:
  - Full CRUD (Create, Read, Update, Delete) interface.
  - Table view with integrated Search, Filter, Sort, and Pagination.
  - **Product Form**: Validated form for adding/editing product details, including inventory stock.
- **Order Management**:
  - View all system orders.
  - **Status Management**: Admins can update order status (Pending, Processing, Shipped, Delivered, Cancelled) via Server Actions.

## 5. UI/UX & Design System

- **Theming**:
  - Robust **Dark/Light Mode** support using `next-themes`.
  - Modern color palette based on CSS variables (shadcn-like system).
  - Mode toggle component in the header.
- **Feedback**:
  - **Toasts**: Instant feedback via `sonner` for actions like "Added to cart" or "Product saved".
  - **Confirm Popups**: `Radix UI` Alert Dialog for destructive actions (e.g., deleting products).
- **Responsive Design**: Built with **Tailwind CSS**, fully optimized for mobile, tablet, and desktop views.

## 6. Technical Implementation Details

- **Framework**: Next.js 16 (App Router).
- **Language**: TypeScript with strict type checking.
- **State**: React Context for client-side state (Cart).
- **Data Layer**: Mocked in-memory data store with server-simulated delays to mimic real API behavior.
- **Icons**: Lucide React.
- **Forms**: React Hook Form + Zod.
