import { useEffect } from 'react';
import { CheckIcon } from './Icons';
import { DrainBar } from './DrainBar';

const DISPLAY_MS = 2500;

interface ValidScreenProps {
  firstName: string;
  tier: string;
  onDone: () => void;
}

export function ValidScreen({ firstName, tier, onDone }: ValidScreenProps) {
  useEffect(() => {
    const id = setTimeout(onDone, DISPLAY_MS);
    return () => clearTimeout(id);
  }, [onDone]);

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-6 bg-[#16a34a] px-8">
      <CheckIcon className="h-28 w-28 text-white drop-shadow-lg" />
      <div className="text-center">
        <p className="text-4xl font-extrabold tracking-tight text-white">{firstName}</p>
        <p className="mt-1 text-lg font-medium text-white/80">{tier}</p>
      </div>
      <div className="w-full max-w-xs">
        <DrainBar durationMs={DISPLAY_MS} color="bg-white" />
      </div>
    </div>
  );
}
