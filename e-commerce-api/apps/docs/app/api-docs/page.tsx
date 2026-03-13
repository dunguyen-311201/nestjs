export default function ApiDocsPage() {
  return (
    <main style={{ padding: 16 }}>
      <h1 style={{ marginBottom: 8 }}>API Documentation</h1>
      <p style={{ marginTop: 0, marginBottom: 16 }}>
        If you don’t see anything below, make sure the API is running at{' '}
        <code>http://localhost:8080</code>.
      </p>

      <div
        style={{
          border: '1px solid #e5e7eb',
          borderRadius: 12,
          overflow: 'hidden',
          height: 'calc(100vh - 140px)',
        }}
      >
        <iframe
          title="Swagger UI"
          src="http://localhost:8080/docs"
          style={{ width: '100%', height: '100%', border: 0 }}
        />
      </div>
    </main>
  )
}
