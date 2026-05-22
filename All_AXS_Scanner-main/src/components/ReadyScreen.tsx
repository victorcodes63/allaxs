import { QrScanner, type QrScannerHandle } from './QrScanner';

interface ReadyScreenProps {
  sessionLabel: string;
  onDetect: (data: string) => void;
  scannerRef: React.Ref<QrScannerHandle>;
}

export function ReadyScreen({ sessionLabel, onDetect, scannerRef }: ReadyScreenProps) {
  return (
    <div className="relative flex h-full w-full flex-col items-center justify-between bg-[#0f0f0f]">
      {/* Header */}
      <div className="relative z-10 flex w-full items-center justify-between px-5 pt-safe-top pb-3 pt-6 bg-gradient-to-b from-black/80 to-transparent">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-white/40">
            All AXS Scanner
          </p>
          <p className="text-sm font-medium text-white/80">{sessionLabel}</p>
        </div>
        {/* Live indicator */}
        <div className="flex items-center gap-1.5">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
          </span>
          <span className="text-xs text-white/50">Live</span>
        </div>
      </div>

      {/* Camera feed */}
      <div className="relative flex flex-1 items-center justify-center w-full overflow-hidden">
        <QrScanner ref={scannerRef} onDetect={onDetect} />

        {/* Viewfinder overlay */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="relative h-64 w-64 animate-pulse-slow">
            {/* Corner marks */}
            {['top-0 left-0', 'top-0 right-0', 'bottom-0 left-0', 'bottom-0 right-0'].map(
              (pos, i) => (
                <span
                  key={i}
                  className={`absolute ${pos} h-10 w-10 rounded-[2px] border-white
                    ${pos.includes('top') && pos.includes('left') ? 'border-t-4 border-l-4' : ''}
                    ${pos.includes('top') && pos.includes('right') ? 'border-t-4 border-r-4' : ''}
                    ${pos.includes('bottom') && pos.includes('left') ? 'border-b-4 border-l-4' : ''}
                    ${pos.includes('bottom') && pos.includes('right') ? 'border-b-4 border-r-4' : ''}
                  `}
                />
              ),
            )}
          </div>
        </div>

        {/* Dark vignette around camera to focus attention on viewfinder */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_45%,rgba(0,0,0,0.75)_80%)]" />
      </div>

      {/* Footer hint */}
      <div className="relative z-10 w-full px-5 pb-8 pt-4 bg-gradient-to-t from-black/80 to-transparent text-center">
        <p className="text-sm text-white/40">Point camera at attendee QR code</p>
      </div>
    </div>
  );
}
