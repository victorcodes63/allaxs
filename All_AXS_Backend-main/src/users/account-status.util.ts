import { UserStatus } from 'src/domain/enums';

export const CLOSED_ACCOUNT_EMAIL_SUFFIX = '@closed.allaxs.internal';
export const CLOSED_ACCOUNT_DISPLAY_NAME = 'Closed account';

export type AccountStatusSubject = {
  email: string;
  name?: string | null;
  status: UserStatus | string;
};

/** True when the user closed their own account (or legacy rows before CLOSED enum). */
export function isClosedAccount(user: AccountStatusSubject): boolean {
  if (user.status === UserStatus.CLOSED) {
    return true;
  }
  const email = user.email?.trim().toLowerCase() ?? '';
  return (
    email.endsWith(CLOSED_ACCOUNT_EMAIL_SUFFIX) ||
    user.name === CLOSED_ACCOUNT_DISPLAY_NAME
  );
}
