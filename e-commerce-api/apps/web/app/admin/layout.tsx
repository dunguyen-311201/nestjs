import Link from 'next/link'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen bg-muted/40">
      <aside className="hidden w-64 border-r bg-background lg:block">
        <div className="flex h-16 items-center border-b px-6">
          <Link href="/admin" className="font-bold text-lg">
            Admin Panel
          </Link>
        </div>
        <nav className="flex flex-col gap-2 p-4">
          <Link
            href="/admin"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-foreground"
          >
            Dashboard
          </Link>
          <Link
            href="/admin/products"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-foreground"
          >
            Products
          </Link>
          <Link
            href="/admin/categories"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-foreground"
          >
            Categories
          </Link>
          <Link
            href="/admin/orders"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-foreground"
          >
            Orders
          </Link>
        </nav>
      </aside>
      <main className="flex-1 p-6 lg:p-10">{children}</main>
    </div>
  )
}
