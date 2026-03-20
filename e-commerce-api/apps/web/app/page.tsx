import Link from 'next/link'

export default function Home() {
  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="flex flex-col gap-8">
        <div className="text-center py-12 space-y-4">
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-primary to-purple-600">
            Welcome to MyStore
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Your one-stop destination for premium products.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto w-full">
          {/* Explore Products Card */}
          <Link
            href="/products"
            className="group relative overflow-hidden rounded-xl border bg-card text-card-foreground shadow transition-all hover:shadow-lg hover:-translate-y-1 block h-full"
          >
            <div className="p-6 flex flex-col items-center text-center h-full justify-center space-y-4">
              <div className="p-4 bg-primary/10 rounded-full group-hover:bg-primary/20 transition-colors">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="48"
                  height="48"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-primary"
                >
                  <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                  <path d="M3.27 6.96 12 12.01l8.73-5.05" />
                  <path d="M12 22.08V12" />
                </svg>
              </div>
              <div>
                <h2 className="text-2xl font-bold">Explore Products</h2>
                <p className="text-muted-foreground mt-2">
                  Browse our full collection of items.
                </p>
              </div>
            </div>
          </Link>

          {/* My Orders Card */}
          <Link
            href="/orders"
            className="group relative overflow-hidden rounded-xl border bg-card text-card-foreground shadow transition-all hover:shadow-lg hover:-translate-y-1 block h-full"
          >
            <div className="p-6 flex flex-col items-center text-center h-full justify-center space-y-4">
              <div className="p-4 bg-blue-500/10 rounded-full group-hover:bg-blue-500/20 transition-colors">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="48"
                  height="48"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-blue-600"
                >
                  <line x1="16.5" x2="7.5" y1="9.4" y2="4.21" />
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                  <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                  <line x1="12" x2="12" y1="22.08" y2="12" />
                </svg>
              </div>
              <div>
                <h2 className="text-2xl font-bold">My Orders</h2>
                <p className="text-muted-foreground mt-2">
                  Track and manage your recent purchases.
                </p>
              </div>
            </div>
          </Link>

          {/* Account/Profile Card (Placeholder for now) */}
          <Link
            href="/user-profile"
            className="group relative overflow-hidden rounded-xl border bg-card text-card-foreground shadow transition-all hover:shadow-lg hover:-translate-y-1 block h-full"
          >
            <div className="p-6 flex flex-col items-center text-center h-full justify-center space-y-4">
              <div className="p-4 bg-green-500/10 rounded-full group-hover:bg-green-500/20 transition-colors">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="48"
                  height="48"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-green-600"
                >
                  <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </div>
              <div>
                <h2 className="text-2xl font-bold">My Profile</h2>
                <p className="text-muted-foreground mt-2">
                  Manage your account settings.
                </p>
              </div>
            </div>
          </Link>
        </div>
      </div>
    </main>
  )
}
