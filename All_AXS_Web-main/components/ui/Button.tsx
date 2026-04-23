import { ButtonHTMLAttributes, forwardRef } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary";
}

/**
 * Form / app actions: same min-height, padding, radius, and weight as `ArrowCta` — no trailing arrow
 * (keeps dense flows readable). Tokens: `--btn-*` in `app/globals.css`.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = "", variant = "primary", disabled, children, ...props }, ref) => {
    const baseStyles =
      "inline-flex items-center justify-center min-h-[var(--btn-min-h)] px-[var(--btn-pad-x)] py-[var(--btn-pad-y)] text-sm font-semibold tracking-tight rounded-[var(--radius-button)] transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-200 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 active:scale-[0.99]";

    const widthClass = className.includes("w-") ? "" : "w-full";

    const variantStyles = {
      primary:
        "bg-primary text-white border border-transparent shadow-[var(--btn-shadow-primary)] hover:bg-primary-dark disabled:hover:bg-primary",
      secondary:
        "bg-surface text-foreground border border-border shadow-[var(--btn-shadow-outline)] hover:bg-wash hover:border-primary/35 disabled:hover:bg-surface",
    };

    const disabledStyles = disabled ? "opacity-50 cursor-not-allowed active:scale-100" : "";

    return (
      <button
        ref={ref}
        className={`${baseStyles} ${widthClass} ${variantStyles[variant]} ${disabledStyles} ${className}`}
        disabled={disabled}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
