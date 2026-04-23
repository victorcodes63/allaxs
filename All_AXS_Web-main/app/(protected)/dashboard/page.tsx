export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Organizer Dashboard</h1>
        <p className="text-lg text-black/60">(Protected area)</p>
      </div>

      <div className="bg-black/5 rounded-lg p-6 space-y-4">
        <p className="text-black/80">
          This is a protected route. Only authenticated users can access this page.
        </p>
        <p className="text-black/80">
          The route guard in <code className="bg-black/10 px-2 py-1 rounded text-sm">app/(protected)/layout.tsx</code> checks
          authentication status and redirects unauthenticated users to the login page.
        </p>
      </div>

      <div className="space-y-3">
        <button className="bg-primary text-white px-6 py-3 rounded-lg font-medium hover:opacity-90 transition-opacity">
          Create New Event
        </button>
        
        <div className="flex gap-3">
          <button className="border border-primary text-primary px-6 py-3 rounded-lg font-medium hover:bg-primary/5 transition-colors">
            View Events
          </button>
          <button className="border border-black/20 text-black px-6 py-3 rounded-lg font-medium hover:bg-black/5 transition-colors">
            Settings
          </button>
        </div>
      </div>
    </div>
  );
}

