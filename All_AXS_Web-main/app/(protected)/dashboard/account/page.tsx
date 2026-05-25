"use client";

import { useEffect, useState, type ReactElement } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import axios, { isAxiosError } from "axios";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth, type AuthUser } from "@/lib/auth";
import {
  changePasswordSchema,
  updateProfileSchema,
  type ChangePasswordInput,
  type UpdateProfileInput,
} from "@/lib/validation/auth";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { userInitials } from "@/lib/hub-user";
import { userHasRole } from "@/lib/auth/hub-routing";
import {
  DEFAULT_NOTIFICATION_PREFS,
  fetchNotificationPrefs,
  saveNotificationPrefs,
  type NotificationPrefs,
} from "@/lib/fan-notification-prefs";
import { PushNotificationsToggle } from "@/components/pwa/PushNotificationsToggle";

function formatMemberSince(iso?: string): string | null {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleDateString(undefined, {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return null;
  }
}

export default function FanAccountPage(): ReactElement {
  const router = useRouter();
  const { user, loading: authLoading, setUser } = useAuth();
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [savingPassword, setSavingPassword] = useState(false);
  const [closeError, setCloseError] = useState<string | null>(null);
  const [closingAccount, setClosingAccount] = useState(false);
  const [closeConfirm, setCloseConfirm] = useState("");
  const [closePassword, setClosePassword] = useState("");
  const [signOutAllError, setSignOutAllError] = useState<string | null>(null);
  const [signingOutAll, setSigningOutAll] = useState(false);
  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPrefs>(
    DEFAULT_NOTIFICATION_PREFS,
  );
  const [prefsLoading, setPrefsLoading] = useState(true);
  const [prefsError, setPrefsError] = useState<string | null>(null);
  const [prefsSaving, setPrefsSaving] = useState(false);

  const {
    register: registerProfile,
    handleSubmit: handleProfileSubmit,
    reset: resetProfileForm,
    formState: { errors: profileErrors },
  } = useForm<UpdateProfileInput>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: { name: "", phone: "" },
  });

  const {
    register: registerPassword,
    handleSubmit: handlePasswordSubmit,
    reset: resetPasswordForm,
    formState: { errors: passwordErrors },
  } = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
  });

  useEffect(() => {
    if (!user) return;
    resetProfileForm({
      name: user.name?.trim() || "",
      phone: user.phone?.trim() || "",
    });
  }, [user, resetProfileForm]);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    setPrefsLoading(true);
    setPrefsError(null);
    fetchNotificationPrefs()
      .then((prefs) => {
        if (!cancelled) setNotificationPrefs(prefs);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setPrefsError(
            err instanceof Error
              ? err.message
              : "Could not load notification preferences",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setPrefsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const onToggleNotificationPref = async (key: keyof NotificationPrefs) => {
    if (!user?.id || prefsLoading || prefsSaving) return;
    const previous = notificationPrefs;
    const next = { ...previous, [key]: !previous[key] };
    setNotificationPrefs(next);
    setPrefsError(null);
    setPrefsSaving(true);
    try {
      const saved = await saveNotificationPrefs({ [key]: next[key] });
      setNotificationPrefs(saved);
    } catch (err: unknown) {
      setNotificationPrefs(previous);
      setPrefsError(
        err instanceof Error
          ? err.message
          : "Could not save notification preferences",
      );
    } finally {
      setPrefsSaving(false);
    }
  };

  const onSaveProfile = async (values: UpdateProfileInput) => {
    setProfileError(null);
    setProfileSuccess(null);
    setSavingProfile(true);
    try {
      const res = await axios.patch<{ user?: AuthUser }>("/api/auth/me", {
        name: values.name.trim(),
        phone: values.phone?.trim() ? values.phone.trim() : "",
      });
      if (res.data.user) {
        setUser(res.data.user);
      }
      setProfileSuccess("Your profile was updated.");
    } catch (err) {
      const message =
        isAxiosError(err) && err.response?.data && typeof err.response.data === "object"
          ? (err.response.data as { message?: string }).message
          : undefined;
      setProfileError(message || "Could not save your profile. Try again.");
    } finally {
      setSavingProfile(false);
    }
  };

  const onChangePassword = async (values: ChangePasswordInput) => {
    setPasswordError(null);
    setPasswordSuccess(null);
    setSavingPassword(true);
    try {
      await axios.post("/api/auth/change-password", {
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });
      resetPasswordForm();
      setPasswordSuccess("Password changed. Please sign in again.");
      setUser(null);
      window.setTimeout(() => {
        router.replace("/login");
      }, 1200);
    } catch (err) {
      const message =
        (err as { response?: { data?: { message?: string } } }).response?.data
          ?.message || "We couldn't change your password.";
      setPasswordError(message);
    } finally {
      setSavingPassword(false);
    }
  };

  const onSignOutAll = async () => {
    setSignOutAllError(null);
    setSigningOutAll(true);
    try {
      await axios.post("/api/auth/logout-all");
      setUser(null);
      router.replace("/login");
    } catch (err) {
      const message =
        isAxiosError(err) && err.response?.data && typeof err.response.data === "object"
          ? (err.response.data as { message?: string }).message
          : undefined;
      setSignOutAllError(message || "Could not sign out everywhere.");
    } finally {
      setSigningOutAll(false);
    }
  };

  const onCloseAccount = async () => {
    setCloseError(null);
    if (closeConfirm !== "CLOSE") {
      setCloseError("Type CLOSE in the confirmation field to continue.");
      return;
    }
    setClosingAccount(true);
    try {
      await axios.post("/api/auth/close-account", {
        confirmation: "CLOSE",
        password: closePassword.trim() || undefined,
      });
      setUser(null);
      router.replace("/?account=closed");
    } catch (err) {
      const message =
        isAxiosError(err) && err.response?.data && typeof err.response.data === "object"
          ? (err.response.data as { message?: string }).message
          : undefined;
      setCloseError(message || "Could not close your account.");
    } finally {
      setClosingAccount(false);
    }
  };

  if (authLoading || !user) {
    return (
      <div className="flex min-h-[30vh] flex-col items-center justify-center gap-2">
        <p className="text-sm font-medium text-foreground">Loading account…</p>
        <p className="text-xs text-muted">Your profile and security settings</p>
      </div>
    );
  }

  const memberSince = formatMemberSince(user.createdAt);
  const isOrganizer = userHasRole(user, "ORGANIZER");
  const requiresPasswordToClose = user.hasPassword !== false;

  return (
    <div className="space-y-10 pb-12">
      <header className="space-y-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
          Account
        </p>
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl space-y-3">
            <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              Profile &amp; security
            </h1>
            <p className="text-sm leading-relaxed text-muted sm:text-base">
              Update how you appear on tickets and receipts, manage your sign-in, or close your
              fan account when you no longer need it.
            </p>
          </div>
          <div className="flex items-center gap-3 rounded-[var(--radius-panel)] border border-border bg-surface/90 px-4 py-3">
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border/80 bg-background text-sm font-semibold text-foreground ring-2 ring-primary/10"
              aria-hidden
            >
              {userInitials(user)}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">
                {user.name?.trim() || "Member"}
              </p>
              <p className="truncate text-xs text-muted">{user.email}</p>
            </div>
          </div>
        </div>
      </header>

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(280px,340px)] xl:items-start">
        <div className="space-y-8">
          <section
            aria-labelledby="profile-heading"
            className="rounded-[var(--radius-panel)] border border-border bg-surface/90 p-5 shadow-[0_1px_0_rgba(255,255,255,0.04)_inset] sm:p-6"
          >
            <h2
              id="profile-heading"
              className="text-xs font-bold uppercase tracking-[0.14em] text-foreground/50"
            >
              Personal details
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
              Your name appears on tickets and payment receipts. Email is your sign-in username and
              cannot be changed here.
            </p>
            <dl className="mt-6 grid gap-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium text-muted">Email</dt>
                <dd className="mt-0.5 truncate font-medium text-foreground">{user.email}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-muted">Verification</dt>
                <dd className="mt-0.5 font-medium text-foreground">
                  {user.emailVerified ? "Verified" : "Not verified yet"}
                </dd>
              </div>
              {memberSince ? (
                <div className="sm:col-span-2">
                  <dt className="text-xs font-medium text-muted">Member since</dt>
                  <dd className="mt-0.5 font-medium text-foreground">{memberSince}</dd>
                </div>
              ) : null}
            </dl>
            <form
              onSubmit={handleProfileSubmit(onSaveProfile)}
              className="mt-6 space-y-4 border-t border-border/80 pt-6"
            >
              {profileError ? (
                <div className="rounded-lg border border-primary/30 bg-primary/10 p-3 text-sm text-primary">
                  {profileError}
                </div>
              ) : null}
              {profileSuccess ? (
                <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-3 text-sm text-green-200">
                  {profileSuccess}
                </div>
              ) : null}
              <div className="grid gap-4 md:grid-cols-2">
                <Input
                  label="Display name"
                  autoComplete="name"
                  placeholder="Your name"
                  {...registerProfile("name")}
                  error={profileErrors.name?.message}
                />
                <Input
                  label="Phone (optional)"
                  type="tel"
                  autoComplete="tel"
                  placeholder="+254 7XX XXX XXX"
                  {...registerProfile("phone")}
                  error={profileErrors.phone?.message}
                />
              </div>
              <Button type="submit" className="w-auto min-w-[10rem]" disabled={savingProfile}>
                {savingProfile ? "Saving…" : "Save profile"}
              </Button>
            </form>
          </section>

          <section
            aria-labelledby="security-heading"
            className="rounded-[var(--radius-panel)] border border-border bg-surface/90 p-5 shadow-[0_1px_0_rgba(255,255,255,0.04)_inset] sm:p-6"
          >
            <h2
              id="security-heading"
              className="text-xs font-bold uppercase tracking-[0.14em] text-foreground/50"
            >
              Password
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
              {user.hasPassword === false
                ? "This account was created at checkout without a password. Use forgot password on the sign-in page to set one."
                : "Changing your password signs you out everywhere and requires a fresh sign-in."}
            </p>
            {user.hasPassword === false ? (
              <div className="mt-6">
                <Link href="/forgot-password">
                  <Button type="button" variant="secondary" className="w-auto min-w-[10rem]">
                    Set a password
                  </Button>
                </Link>
              </div>
            ) : (
              <form
                onSubmit={handlePasswordSubmit(onChangePassword)}
                className="mt-6 space-y-4 border-t border-border/80 pt-6"
              >
                {passwordError ? (
                  <div className="rounded-lg border border-primary/30 bg-primary/10 p-3 text-sm text-primary">
                    {passwordError}
                  </div>
                ) : null}
                {passwordSuccess ? (
                  <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-3 text-sm text-green-200">
                    {passwordSuccess}
                  </div>
                ) : null}
                <div className="grid gap-4 md:grid-cols-2">
                  <PasswordInput
                    label="Current password"
                    autoComplete="current-password"
                    placeholder="••••••••"
                    {...registerPassword("currentPassword")}
                    error={passwordErrors.currentPassword?.message}
                  />
                  <div />
                  <PasswordInput
                    label="New password"
                    autoComplete="new-password"
                    placeholder="••••••••"
                    {...registerPassword("newPassword")}
                    error={passwordErrors.newPassword?.message}
                  />
                  <PasswordInput
                    label="Confirm new password"
                    autoComplete="new-password"
                    placeholder="••••••••"
                    {...registerPassword("confirmNewPassword")}
                    error={passwordErrors.confirmNewPassword?.message}
                  />
                </div>
                <Button type="submit" className="w-auto min-w-[10rem]" disabled={savingPassword}>
                  {savingPassword ? "Updating…" : "Update password"}
                </Button>
              </form>
            )}
          </section>

          <section
            aria-labelledby="sessions-heading"
            className="rounded-[var(--radius-panel)] border border-border bg-surface/90 p-5 shadow-[0_1px_0_rgba(255,255,255,0.04)_inset] sm:p-6"
          >
            <h2
              id="sessions-heading"
              className="text-xs font-bold uppercase tracking-[0.14em] text-foreground/50"
            >
              Active sessions
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
              Sign out of All AXS on every device where you are currently signed in. You will need
              to sign in again on this browser too.
            </p>
            {signOutAllError ? (
              <div className="mt-4 rounded-lg border border-primary/30 bg-primary/10 p-3 text-sm text-primary">
                {signOutAllError}
              </div>
            ) : null}
            <div className="mt-4">
              <Button
                type="button"
                variant="secondary"
                className="w-full sm:w-auto min-w-[10rem]"
                disabled={signingOutAll}
                onClick={() => void onSignOutAll()}
              >
                {signingOutAll ? "Signing out…" : "Sign out everywhere"}
              </Button>
            </div>
          </section>

          <section
            aria-labelledby="notifications-heading"
            className="rounded-[var(--radius-panel)] border border-border bg-surface/90 p-5 shadow-[0_1px_0_rgba(255,255,255,0.04)_inset] sm:p-6"
          >
            <h2
              id="notifications-heading"
              className="text-xs font-bold uppercase tracking-[0.14em] text-foreground/50"
            >
              Notification preferences
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
              Choose which emails you want from All AXS. Preferences are saved to
              your account and apply across devices. Transactional messages respect
              your order and reminder settings.
            </p>
            {prefsError ? (
              <p className="mt-3 text-sm text-red-400" role="alert">
                {prefsError}
              </p>
            ) : null}
            <ul className="mt-6 divide-y divide-border/70">
              {(
                [
                  {
                    key: "ordersEmail" as const,
                    label: "Order & ticket emails",
                    hint: "Receipts, pass delivery, and refund updates for your purchases.",
                  },
                  {
                    key: "reminders" as const,
                    label: "Event & payment reminders",
                    hint: "Installment due dates and friendly nudges before shows you have tickets for.",
                  },
                  {
                    key: "marketingEmail" as const,
                    label: "Discover & promotions",
                    hint: "New events, featured listings, and occasional offers.",
                  },
                ] as const
              ).map((item) => (
                <li
                  key={item.key}
                  className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">{item.label}</p>
                    <p className="mt-0.5 text-sm text-muted">{item.hint}</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={notificationPrefs[item.key]}
                    aria-label={`${item.label}: ${notificationPrefs[item.key] ? "on" : "off"}`}
                    disabled={prefsLoading || prefsSaving}
                    onClick={() => void onToggleNotificationPref(item.key)}
                    className={[
                      "relative inline-flex h-8 w-14 shrink-0 items-center rounded-full border transition-colors",
                      notificationPrefs[item.key]
                        ? "border-primary/60 bg-primary/80"
                        : "border-border bg-background/80",
                    ].join(" ")}
                  >
                    <span
                      className={[
                        "inline-block h-6 w-6 rounded-full bg-white shadow transition-transform",
                        notificationPrefs[item.key] ? "translate-x-7" : "translate-x-1",
                      ].join(" ")}
                      aria-hidden
                    />
                  </button>
                </li>
              ))}
            </ul>
            <PushNotificationsToggle />
          </section>

          <section
            aria-labelledby="danger-heading"
            className="rounded-[var(--radius-panel)] border border-red-500/35 bg-red-950/20 p-5 shadow-[0_1px_0_rgba(255,255,255,0.04)_inset] sm:p-6"
          >
            <h2
              id="danger-heading"
              className="text-xs font-bold uppercase tracking-[0.14em] text-red-300/90"
            >
              Close account
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
              {isOrganizer
                ? "Organizer accounts must contact support to close. You can sign out anytime and stop using the platform."
                : "Closing your account removes access to this email on All AXS. Tickets already issued stay valid for entry, but you will no longer be able to sign in to view them here."}
            </p>
            {!isOrganizer ? (
              <div className="mt-6 space-y-4 border-t border-red-500/25 pt-6">
                {closeError ? (
                  <div className="rounded-lg border border-red-400/40 bg-red-500/10 p-3 text-sm text-red-200">
                    {closeError}
                  </div>
                ) : null}
                {requiresPasswordToClose ? (
                  <PasswordInput
                    label="Current password"
                    autoComplete="current-password"
                    value={closePassword}
                    onChange={(e) => setClosePassword(e.target.value)}
                    placeholder="••••••••"
                  />
                ) : null}
                <Input
                  label="Type CLOSE to confirm"
                  value={closeConfirm}
                  onChange={(e) => setCloseConfirm(e.target.value)}
                  placeholder="CLOSE"
                  autoComplete="off"
                />
                <Button
                  type="button"
                  variant="secondary"
                  className="w-auto min-w-[10rem] border-red-500/40 text-red-200 hover:border-red-400 hover:bg-red-500/10"
                  disabled={closingAccount}
                  onClick={() => void onCloseAccount()}
                >
                  {closingAccount ? "Closing…" : "Close my account"}
                </Button>
              </div>
            ) : null}
          </section>
        </div>

        <aside className="space-y-4 xl:sticky xl:top-6">
          <div className="rounded-[var(--radius-panel)] border border-border bg-surface/90 p-5 sm:p-6">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
              Quick links
            </p>
            <ul className="mt-4 space-y-3 text-sm">
              <li>
                <Link
                  href="/dashboard/orders"
                  className="font-medium text-foreground underline decoration-primary/40 underline-offset-4 hover:decoration-primary"
                >
                  My orders
                </Link>
              </li>
              <li>
                <a
                  href="mailto:hello@allaxs.com?subject=All%20AXS%20support"
                  className="font-medium text-foreground underline decoration-primary/40 underline-offset-4 hover:decoration-primary"
                >
                  Contact support
                </a>
              </li>
              <li>
                <Link
                  href="/tickets"
                  className="font-medium text-foreground underline decoration-primary/40 underline-offset-4 hover:decoration-primary"
                >
                  My tickets
                </Link>
              </li>
              <li>
                <Link
                  href="/dashboard/events"
                  className="font-medium text-foreground underline decoration-primary/40 underline-offset-4 hover:decoration-primary"
                >
                  Browse events
                </Link>
              </li>
              {isOrganizer ? (
                <li>
                  <Link
                    href="/organizer/account"
                    className="font-medium text-foreground underline decoration-primary/40 underline-offset-4 hover:decoration-primary"
                  >
                    Organizer account
                  </Link>
                </li>
              ) : null}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
