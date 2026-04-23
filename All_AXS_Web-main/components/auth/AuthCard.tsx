interface AuthCardProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

export function AuthCard({ title, subtitle, children }: AuthCardProps) {
  return (
    <div className="w-full max-w-md mx-auto">
      <div className="space-y-5 rounded-lg border border-border bg-surface p-6 shadow-[0_12px_40px_-24px_rgba(0,0,0,0.45)] sm:p-7 sm:space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-foreground">{title}</h1>
          {subtitle && (
            <p className="text-sm text-muted">{subtitle}</p>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}

