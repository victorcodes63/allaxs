/** Shapes from `GET /organizers/team` (proxied as `/api/organizer/team`). */

export type OrgMemberRole = "EDITOR" | "SCANNER";

export type OrganizerTeamMember = {
  id: string;
  userId: string;
  email: string | null;
  name: string | null;
  role: OrgMemberRole;
  joinedAt: string;
};

export type OrganizerPendingInvite = {
  id: string;
  email: string;
  role: OrgMemberRole;
  expiresAt: string;
  createdAt: string;
};

export type OrganizerTeamOverview = {
  orgName: string;
  organizerProfileId: string;
  owner: {
    userId: string;
    email: string | null;
    name: string | null;
  };
  members: OrganizerTeamMember[];
  pendingInvites: OrganizerPendingInvite[];
};

export type OrganizerInvitePreview = {
  orgName: string;
  role: OrgMemberRole;
  email: string;
  expiresAt: string;
};

export type OrganizerInviteAcceptResult = {
  memberId: string;
  organizerProfileId: string;
  orgName: string;
  role: OrgMemberRole;
};

export function orgMemberRoleLabel(role: OrgMemberRole): string {
  return role === "SCANNER" ? "Scanner" : "Editor";
}

export function orgMemberRoleHint(role: OrgMemberRole): string {
  return role === "SCANNER"
    ? "Door scan and ticket check-in only."
    : "Create and manage events for this organization.";
}

export function formatTeamDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
