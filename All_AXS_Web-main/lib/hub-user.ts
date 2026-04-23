export function userInitials(user: { name?: string; email: string }): string {
  const name = user.name?.trim();
  if (name) {
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0]![0]}${parts[1]![0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }
  const local = user.email.split("@")[0] ?? "AX";
  return local.slice(0, 2).toUpperCase();
}
