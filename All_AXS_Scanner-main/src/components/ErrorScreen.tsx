interface ErrorScreenProps {
  message: string;
}

export function ErrorScreen({ message }: ErrorScreenProps) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-[#0f0f0f] px-8 text-center">
      <svg
        className="h-16 w-16 text-white/20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      <p className="text-2xl font-bold text-white">Scanner Unavailable</p>
      <p className="text-base text-white/50">{message}</p>
      <p className="mt-4 text-xs text-white/30">
        Ask the event organiser to generate a new scanner link.
      </p>
    </div>
  );
}
