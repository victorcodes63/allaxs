import { useEffect, useState } from 'react';

interface DrainBarProps {
  durationMs: number;
  color?: string;
}

export function DrainBar({ durationMs, color = 'bg-white' }: DrainBarProps) {
  const [started, setStarted] = useState(false);

  useEffect(() => {
    // Defer one frame so the CSS transition actually plays
    const id = requestAnimationFrame(() => setStarted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div className="h-1.5 w-full rounded-full bg-white/20 overflow-hidden">
      <div
        className={`h-full ${color} rounded-full transition-all ease-linear`}
        style={{
          width: started ? '0%' : '100%',
          transitionDuration: `${durationMs}ms`,
        }}
      />
    </div>
  );
}
