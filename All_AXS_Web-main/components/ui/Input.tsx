import { InputHTMLAttributes, forwardRef } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className = "", label, error, id, ...props }, ref) => {
    const inputId = id || `input-${label?.toLowerCase().replace(/\s+/g, "-")}`;

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="block font-medium mb-1 text-sm text-black"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={error ? "true" : "false"}
          aria-describedby={error ? `${inputId}-error` : undefined}
          className={`w-full border ${
            error ? "border-primary" : "border-black/20"
          } rounded-lg px-4 py-2 bg-white text-black focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-colors ${className}`}
          {...props}
        />
        {error && (
          <p className="mt-1 text-sm text-primary" role="alert" id={`${inputId}-error`}>
            {error}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";

