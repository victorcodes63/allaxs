import {
  useEffect,
  useRef,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from 'react';
import jsQR from 'jsqr';

export interface QrScannerHandle {
  pause: () => void;
  resume: () => void;
}

interface QrScannerProps {
  onDetect: (data: string) => void;
}

export const QrScanner = forwardRef<QrScannerHandle, QrScannerProps>(
  ({ onDetect }, ref) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const rafRef = useRef<number | null>(null);
    const pausedRef = useRef(false);
    const onDetectRef = useRef(onDetect);
    onDetectRef.current = onDetect;

    const stopLoop = useCallback(() => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    }, []);

    const scan = useCallback(() => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || pausedRef.current) return;

      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx.drawImage(video, 0, 0);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'dontInvert',
          });
          if (code?.data) {
            pausedRef.current = true;
            onDetectRef.current(code.data);
            return;
          }
        }
      }

      // ~10 fps — throttle with a short setTimeout
      rafRef.current = window.setTimeout(() => {
        rafRef.current = requestAnimationFrame(scan);
      }, 100) as unknown as number;
    }, []);

    useImperativeHandle(ref, () => ({
      pause() {
        pausedRef.current = true;
        stopLoop();
      },
      resume() {
        pausedRef.current = false;
        rafRef.current = requestAnimationFrame(scan);
      },
    }));

    useEffect(() => {
      let mounted = true;

      navigator.mediaDevices
        .getUserMedia({ video: { facingMode: 'environment' } })
        .then((stream) => {
          if (!mounted) {
            stream.getTracks().forEach((t) => t.stop());
            return;
          }
          streamRef.current = stream;
          const video = videoRef.current;
          if (video) {
            video.srcObject = stream;
            video.play().catch(() => void 0);
            rafRef.current = requestAnimationFrame(scan);
          }
        })
        .catch(() => {
          // Camera permission denied or unavailable — handled by parent
        });

      return () => {
        mounted = false;
        stopLoop();
        streamRef.current?.getTracks().forEach((t) => t.stop());
      };
    }, [scan, stopLoop]);

    return (
      <>
        <video
          ref={videoRef}
          playsInline
          muted
          className="absolute inset-0 h-full w-full object-cover"
          aria-hidden="true"
        />
        <canvas ref={canvasRef} className="hidden" aria-hidden="true" />
      </>
    );
  },
);

QrScanner.displayName = 'QrScanner';
