import { useEffect } from 'react';
import { CrossIcon } from './Icons';
import { DrainBar } from './DrainBar';
import { REASON_LABEL, type InvalidReason } from '../types';

const DISPLAY_MS = 2500;

interface InvalidScreenProps {
  reason: InvalidReason;
  onDone: () => void;
}

export function InvalidScreen({ reason, onDone }: InvalidScreenProps) {
  useEffect(() => {
    const id = setTimeout(onDone, DISPLAY_MS);
    return () => clearTimeout(id);
  }, [onDone]);

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-6 bg-[#dc2626] px-8">
      <CrossIcon className="h-28 w-28 text-white drop-shadow-lg" />
      <div className="text-center">
        <p className="text-3xl font-extrabold tracking-tight text-white">
          {REASON_LABEL[reason]}
        </p>
      </div>
      <div className="w-full max-w-xs">
        <DrainBar durationMs={DISPLAY_MS} color="bg-white" />
      </div>
    </div>
  );
}
