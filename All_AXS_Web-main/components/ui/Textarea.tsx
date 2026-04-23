import { TextareaHTMLAttributes, forwardRef } from "react";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className = "", label, error, id, ...props }, ref) => {
    const textareaId = id || `textarea-${label?.toLowerCase().replace(/\s+/g, "-")}`;

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={textareaId}
            className="block font-medium mb-1 text-sm text-black"
          >
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          aria-invalid={error ? "true" : "false"}
          aria-describedby={error ? `${textareaId}-error` : undefined}
          className={`w-full border ${
            error ? "border-primary" : "border-black/20"
          } rounded-lg px-4 py-2 bg-white text-black focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-colors resize-y ${className}`}
          {...props}
        />
        {error && (
          <p id={`${textareaId}-error`} className="mt-1 text-sm text-primary" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }
);

Textarea.displayName = "Textarea";

