interface AuthCardProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

export function AuthCard({ title, subtitle, children }: AuthCardProps) {
  return (
    <div className="w-full max-w-md mx-auto">
      <div className="bg-white border border-black/10 rounded-lg shadow-sm p-8 space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-black">{title}</h1>
          {subtitle && (
            <p className="text-sm text-black/60">{subtitle}</p>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}

