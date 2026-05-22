import type { AppState, AppAction } from './types';

export const initialState: AppState = { screen: 'LOADING_SESSION' };

export function reducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SESSION_LOADED':
      return {
        screen: 'READY',
        sessionLabel: action.sessionLabel,
        eventTitle: action.eventTitle,
      };
    case 'SESSION_ERROR':
      return { screen: 'ERROR', message: action.message };
    case 'SCAN_VALID':
      return { screen: 'RESULT_VALID', firstName: action.firstName, tier: action.tier };
    case 'SCAN_INVALID':
      return { screen: 'RESULT_INVALID', reason: action.reason };
    case 'RESET':
      if (state.screen === 'READY') return state;
      // Return to READY state if we have session info cached
      return state;
    default:
      return state;
  }
}
