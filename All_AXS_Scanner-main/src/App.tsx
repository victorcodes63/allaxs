import { useCallback, useEffect, useReducer, useRef } from 'react';
import { reducer, initialState } from './reducer';
import { extractToken } from './token';
import { fetchSessionInfo, validateQr } from './api';
import { type QrScannerHandle } from './components/QrScanner';
import { ReadyScreen } from './components/ReadyScreen';
import { ValidScreen } from './components/ValidScreen';
import { InvalidScreen } from './components/InvalidScreen';
import { ErrorScreen } from './components/ErrorScreen';
import type { InvalidReason } from './types';

// Stable session token for the lifetime of the page
const SESSION_TOKEN = extractToken();

function LoadingScreen() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-[#0f0f0f]">
      <div className="flex flex-col items-center gap-4">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
        <p className="text-sm text-white/40">Connecting…</p>
      </div>
    </div>
  );
}

export function App() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const scannerRef = useRef<QrScannerHandle>(null);

  // Cache session info for returning to READY after results
  const sessionInfoRef = useRef<{ sessionLabel: string; eventTitle: string } | null>(null);

  // Load session on mount
  useEffect(() => {
    if (!SESSION_TOKEN) {
      dispatch({
        type: 'SESSION_ERROR',
        message: 'Invalid scanner link. Ask the organiser for a new one.',
      });
      return;
    }

    fetchSessionInfo(SESSION_TOKEN)
      .then((info) => {
        sessionInfoRef.current = {
          sessionLabel: info.label,
          eventTitle: info.eventTitle,
        };
        dispatch({
          type: 'SESSION_LOADED',
          sessionLabel: info.label,
          eventTitle: info.eventTitle,
        });
      })
      .catch((err: unknown) => {
        const msg =
          err instanceof Error && err.message === 'EXPIRED_SESSION'
            ? 'This scanner link has expired. Ask the organiser for a new one.'
            : 'Unable to connect to the server. Check your internet connection.';
        dispatch({ type: 'SESSION_ERROR', message: msg });
      });
  }, []);

  const handleDetect = useCallback(
    async (qrData: string) => {
      if (!SESSION_TOKEN) return;
      scannerRef.current?.pause();

      try {
        const result = await validateQr(SESSION_TOKEN, qrData);
        if (result.valid) {
          dispatch({ type: 'SCAN_VALID', firstName: result.firstName, tier: result.tier });
        } else {
          const reason = (result.reason ?? 'INVALID_SIGNATURE') as InvalidReason;
          dispatch({ type: 'SCAN_INVALID', reason });
        }
      } catch {
        dispatch({ type: 'SCAN_INVALID', reason: 'NETWORK_ERROR' });
      }
    },
    [],
  );

  const handleResultDone = useCallback(() => {
    const cached = sessionInfoRef.current;
    if (cached) {
      dispatch({
        type: 'SESSION_LOADED',
        sessionLabel: cached.sessionLabel,
        eventTitle: cached.eventTitle,
      });
      // Resume scanner after a brief delay so the READY screen renders first
      setTimeout(() => scannerRef.current?.resume(), 100);
    }
  }, []);

  return (
    <div className="h-screen w-screen overflow-hidden">
      {state.screen === 'LOADING_SESSION' && <LoadingScreen />}

      {state.screen === 'READY' && (
        <ReadyScreen
          sessionLabel={state.sessionLabel}
          onDetect={handleDetect}
          scannerRef={scannerRef}
        />
      )}

      {state.screen === 'RESULT_VALID' && (
        <ValidScreen
          firstName={state.firstName}
          tier={state.tier}
          onDone={handleResultDone}
        />
      )}

      {state.screen === 'RESULT_INVALID' && (
        <InvalidScreen reason={state.reason} onDone={handleResultDone} />
      )}

      {state.screen === 'ERROR' && <ErrorScreen message={state.message} />}
    </div>
  );
}
