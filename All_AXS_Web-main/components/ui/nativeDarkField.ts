/**
 * Styling for native `<input>`, `<select>`, and `<textarea>` on dark hub / organiser pages.
 */
const shellCore = [
  "w-full rounded-[var(--radius-button)] border px-4 text-sm text-foreground",
  "bg-white/[0.07] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]",
  "placeholder:text-muted/65 scheme-dark",
  "transition-[border-color,box-shadow,opacity]",
  "focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary/40",
  "disabled:cursor-not-allowed disabled:opacity-55",
].join(" ");

function borderPart(error?: boolean) {
  return error ? "border-primary" : "border-border hover:border-white/15";
}

export function nativeDarkControlClass(error?: boolean, extra?: string) {
  return [shellCore, "min-h-[2.75rem] py-2.5", borderPart(error), extra]
    .filter(Boolean)
    .join(" ");
}

export function nativeDarkTextareaClass(error?: boolean, extra?: string) {
  return [shellCore, "min-h-[9rem] resize-y py-3", borderPart(error), extra]
    .filter(Boolean)
    .join(" ");
}
