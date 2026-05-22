export type WalletPassAvailability = {
  google: boolean;
  apple: boolean;
};

export async function fetchWalletPassAvailability(): Promise<WalletPassAvailability> {
  try {
    const res = await fetch("/api/tickets/wallet/status", {
      credentials: "same-origin",
    });
    const data = (await res.json().catch(() => ({}))) as Partial<WalletPassAvailability>;
    return {
      google: Boolean(data.google),
      apple: Boolean(data.apple),
    };
  } catch {
    return { google: false, apple: false };
  }
}
