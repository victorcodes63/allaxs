"use client";

import { useCallback, useEffect, useState, type ReactElement } from "react";
import Link from "next/link";
import axios, { isAxiosError } from "axios";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  formatTeamDate,
  orgMemberRoleHint,
  orgMemberRoleLabel,
  type OrganizerTeamOverview,
  type OrgMemberRole,
} from "@/lib/organizer-team";

const inviteFormSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  role: z.enum(["EDITOR", "SCANNER"]),
});

type InviteFormValues = z.infer<typeof inviteFormSchema>;

function RoleBadge({ role }: { role: OrgMemberRole }) {
  return (
    <span className="rounded-full border border-border bg-background/80 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-foreground/80">
      {orgMemberRoleLabel(role)}
    </span>
  );
}

export default function OrganizerTeamPage(): ReactElement {
  const [team, setTeam] = useState<OrganizerTeamOverview | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "error" | "forbidden" | "ready">("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);
  const [sendingInvite, setSendingInvite] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<InviteFormValues>({
    resolver: zodResolver(inviteFormSchema),
    defaultValues: { email: "", role: "EDITOR" },
  });

  const loadTeam = useCallback(async () => {
    setLoadState("loading");
    setLoadError(null);
    try {
      const res = await axios.get<OrganizerTeamOverview>("/api/organizer/team");
      setTeam(res.data);
      setLoadState("ready");
    } catch (err) {
      if (isAxiosError(err) && err.response?.status === 403) {
        setLoadState("forbidden");
        return;
      }
      const message =
        isAxiosError(err) && err.response?.data && typeof err.response.data === "object"
          ? (err.response.data as { message?: string }).message
          : undefined;
      setLoadError(message || "We could not load your team.");
      setLoadState("error");
    }
  }, []);

  useEffect(() => {
    void loadTeam();
  }, [loadTeam]);

  const onInvite = async (values: InviteFormValues) => {
    setInviteError(null);
    setInviteSuccess(null);
    setSendingInvite(true);
    try {
      await axios.post("/api/organizer/team/invites", values);
      reset({ email: "", role: values.role });
      setInviteSuccess(`Invitation sent to ${values.email}.`);
      await loadTeam();
    } catch (err) {
      const message =
        isAxiosError(err) && err.response?.data && typeof err.response.data === "object"
          ? (err.response.data as { message?: string }).message
          : undefined;
      setInviteError(message || "We could not send that invite.");
    } finally {
      setSendingInvite(false);
    }
  };

  const onRevokeInvite = async (inviteId: string) => {
    setActionId(`invite:${inviteId}`);
    try {
      await axios.delete(`/api/organizer/team/invites/${inviteId}`);
      await loadTeam();
    } catch (err) {
      const message =
        isAxiosError(err) && err.response?.data && typeof err.response.data === "object"
          ? (err.response.data as { message?: string }).message
          : undefined;
      setInviteError(message || "We could not revoke that invite.");
    } finally {
      setActionId(null);
    }
  };

  const onRemoveMember = async (memberId: string) => {
    setActionId(`member:${memberId}`);
    try {
      await axios.delete(`/api/organizer/team/members/${memberId}`);
      await loadTeam();
    } catch (err) {
      const message =
        isAxiosError(err) && err.response?.data && typeof err.response.data === "object"
          ? (err.response.data as { message?: string }).message
          : undefined;
      setInviteError(message || "We could not remove that member.");
    } finally {
      setActionId(null);
    }
  };

  if (loadState === "loading") {
    return (
      <div className="flex min-h-[30vh] flex-col items-center justify-center gap-2">
        <p className="text-sm font-medium text-foreground">Loading team…</p>
        <p className="text-xs text-muted">Members and pending invites</p>
      </div>
    );
  }

  if (loadState === "forbidden") {
    return (
      <div className="mx-auto max-w-lg space-y-4 text-center">
        <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">Team settings</h1>
        <p className="text-sm text-muted">
          Only the organization owner can manage team members and invitations.
        </p>
        <Link href="/organizer/dashboard">
          <Button variant="secondary" className="w-auto min-w-[10rem]">
            Back to overview
          </Button>
        </Link>
      </div>
    );
  }

  if (loadState === "error" || !team) {
    return (
      <div className="flex min-h-[30vh] flex-col items-center justify-center gap-4 text-center">
        <p className="max-w-md text-sm text-muted">{loadError}</p>
        <Button type="button" className="w-auto" onClick={() => void loadTeam()}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <header className="space-y-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">Organiser</p>
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl space-y-3">
            <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              Team
            </h1>
            <p className="text-sm leading-relaxed text-muted sm:text-base">
              Invite co-organizers to help run <span className="font-medium text-foreground">{team.orgName}</span>.
              Editors can manage events; scanners can check in guests at the door.
            </p>
          </div>
        </div>
      </header>

      <section
        aria-labelledby="invite-heading"
        className="rounded-[var(--radius-panel)] border border-border bg-surface/90 p-5 shadow-[0_1px_0_rgba(255,255,255,0.04)_inset] sm:p-6"
      >
        <h2 id="invite-heading" className="text-xs font-bold uppercase tracking-[0.14em] text-foreground/50">
          Invite teammate
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
          We&apos;ll email a secure link. The recipient must sign in with the invited address to join.
        </p>
        <form onSubmit={handleSubmit(onInvite)} className="mt-6 space-y-4">
          {inviteError ? (
            <div className="rounded-lg border border-primary/30 bg-primary/10 p-3 text-sm text-primary">
              {inviteError}
            </div>
          ) : null}
          {inviteSuccess ? (
            <div className="rounded-lg border border-green-300 bg-green-50 p-3 text-sm text-green-700">
              {inviteSuccess}
            </div>
          ) : null}
          <div className="grid gap-4 md:grid-cols-[1fr_min(12rem,100%)_auto] md:items-end">
            <Input
              label="Email"
              type="email"
              autoComplete="email"
              placeholder="teammate@example.com"
              {...register("email")}
              error={errors.email?.message}
            />
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-foreground" htmlFor="team-invite-role">
                Role
              </label>
              <select
                id="team-invite-role"
                className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
                {...register("role")}
              >
                <option value="EDITOR">Editor — manage events</option>
                <option value="SCANNER">Scanner — door check-in</option>
              </select>
              {errors.role?.message ? (
                <p className="text-sm text-primary" role="alert">
                  {errors.role.message}
                </p>
              ) : null}
            </div>
            <Button type="submit" className="w-auto min-w-[10rem] md:mb-0" disabled={sendingInvite}>
              {sendingInvite ? "Sending…" : "Send invite"}
            </Button>
          </div>
          <p className="text-xs text-muted">
            <span className="font-medium text-foreground/90">Editor:</span> {orgMemberRoleHint("EDITOR")}{" "}
            <span className="font-medium text-foreground/90">Scanner:</span> {orgMemberRoleHint("SCANNER")}
          </p>
        </form>
      </section>

      <section
        aria-labelledby="members-heading"
        className="rounded-[var(--radius-panel)] border border-border bg-surface/90 p-5 shadow-[0_1px_0_rgba(255,255,255,0.04)_inset] sm:p-6"
      >
        <h2 id="members-heading" className="text-xs font-bold uppercase tracking-[0.14em] text-foreground/50">
          Members
        </h2>
        <ul className="mt-4 grid gap-3 md:hidden">
          <li className="rounded-lg border border-border/80 bg-background/40 p-4">
            <p className="font-medium text-foreground">
              {team.owner.name?.trim() || team.owner.email || "Owner"}
            </p>
            {team.owner.email ? (
              <p className="text-xs text-muted">{team.owner.email}</p>
            ) : null}
            <span className="mt-2 inline-flex rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold uppercase text-primary">
              Owner
            </span>
          </li>
          {team.members.map((member) => (
            <li
              key={member.id}
              className="rounded-lg border border-border/80 bg-background/40 p-4"
            >
              <p className="font-medium text-foreground">
                {member.name?.trim() || member.email || "Member"}
              </p>
              {member.email ? <p className="text-xs text-muted">{member.email}</p> : null}
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <RoleBadge role={member.role} />
                <span className="text-xs text-muted">{formatTeamDate(member.joinedAt)}</span>
              </div>
              <Button
                type="button"
                variant="secondary"
                className="mt-3 w-auto min-w-[7rem]"
                disabled={actionId === `member:${member.id}`}
                onClick={() => void onRemoveMember(member.id)}
              >
                {actionId === `member:${member.id}` ? "Removing…" : "Remove"}
              </Button>
            </li>
          ))}
          {team.members.length === 0 ? (
            <li className="py-4 text-center text-sm text-muted">No teammates yet — send an invite above.</li>
          ) : null}
        </ul>
        <div className="mt-4 hidden overflow-x-auto md:block">
          <table className="w-full min-w-[32rem] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
                <th className="pb-3 pr-4 font-semibold">Person</th>
                <th className="pb-3 pr-4 font-semibold">Role</th>
                <th className="pb-3 pr-4 font-semibold">Joined</th>
                <th className="pb-3 font-semibold"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/80">
              <tr>
                <td className="py-3 pr-4">
                  <p className="font-medium text-foreground">{team.owner.name?.trim() || team.owner.email || "Owner"}</p>
                  {team.owner.email ? (
                    <p className="text-xs text-muted">{team.owner.email}</p>
                  ) : null}
                </td>
                <td className="py-3 pr-4">
                  <span className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-primary">
                    Owner
                  </span>
                </td>
                <td className="py-3 pr-4 text-muted">—</td>
                <td className="py-3" />
              </tr>
              {team.members.map((member) => (
                <tr key={member.id}>
                  <td className="py-3 pr-4">
                    <p className="font-medium text-foreground">{member.name?.trim() || member.email || "Member"}</p>
                    {member.email ? <p className="text-xs text-muted">{member.email}</p> : null}
                  </td>
                  <td className="py-3 pr-4">
                    <RoleBadge role={member.role} />
                  </td>
                  <td className="py-3 pr-4 text-muted">{formatTeamDate(member.joinedAt)}</td>
                  <td className="py-3 text-right">
                    <Button
                      type="button"
                      variant="secondary"
                      className="w-auto min-w-[7rem]"
                      disabled={actionId === `member:${member.id}`}
                      onClick={() => void onRemoveMember(member.id)}
                    >
                      {actionId === `member:${member.id}` ? "Removing…" : "Remove"}
                    </Button>
                  </td>
                </tr>
              ))}
              {team.members.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-sm text-muted">
                    No teammates yet — send an invite above.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section
        aria-labelledby="invites-heading"
        className="rounded-[var(--radius-panel)] border border-border bg-surface/90 p-5 shadow-[0_1px_0_rgba(255,255,255,0.04)_inset] sm:p-6"
      >
        <h2 id="invites-heading" className="text-xs font-bold uppercase tracking-[0.14em] text-foreground/50">
          Pending invites
        </h2>
        {team.pendingInvites.length === 0 ? (
          <p className="mt-4 text-sm text-muted">No open invitations.</p>
        ) : (
          <>
            <ul className="mt-4 grid gap-3 md:hidden">
              {team.pendingInvites.map((invite) => (
                <li
                  key={invite.id}
                  className="rounded-lg border border-border/80 bg-background/40 p-4"
                >
                  <p className="font-medium text-foreground">{invite.email}</p>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                    <RoleBadge role={invite.role} />
                    <span className="text-xs text-muted">{formatTeamDate(invite.expiresAt)}</span>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    className="mt-3 w-auto min-w-[7rem]"
                    disabled={actionId === `invite:${invite.id}`}
                    onClick={() => void onRevokeInvite(invite.id)}
                  >
                    {actionId === `invite:${invite.id}` ? "Revoking…" : "Revoke"}
                  </Button>
                </li>
              ))}
            </ul>
            <div className="mt-4 hidden overflow-x-auto md:block">
            <table className="w-full min-w-[32rem] text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
                  <th className="pb-3 pr-4 font-semibold">Email</th>
                  <th className="pb-3 pr-4 font-semibold">Role</th>
                  <th className="pb-3 pr-4 font-semibold">Expires</th>
                  <th className="pb-3 font-semibold"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/80">
                {team.pendingInvites.map((invite) => (
                  <tr key={invite.id}>
                    <td className="py-3 pr-4 font-medium text-foreground">{invite.email}</td>
                    <td className="py-3 pr-4">
                      <RoleBadge role={invite.role} />
                    </td>
                    <td className="py-3 pr-4 text-muted">{formatTeamDate(invite.expiresAt)}</td>
                    <td className="py-3 text-right">
                      <Button
                        type="button"
                        variant="secondary"
                        className="w-auto min-w-[7rem]"
                        disabled={actionId === `invite:${invite.id}`}
                        onClick={() => void onRevokeInvite(invite.id)}
                      >
                        {actionId === `invite:${invite.id}` ? "Revoking…" : "Revoke"}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
