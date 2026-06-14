import { type InputHTMLAttributes, forwardRef } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, className = "", ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label className="text-sm font-medium text-tea-700">{label}</label>
        )}
        <input
          ref={ref}
          className={[
            "w-full rounded-xl border bg-white px-4 py-3 text-tea-900 transition-colors",
            "placeholder:text-tea-300",
            "focus:outline-none focus:ring-2 focus:ring-tea-500 focus:border-transparent",
            error ? "border-red-400" : "border-tea-200",
            className,
          ].join(" ")}
          {...props}
        />
        {error && <p className="text-xs text-red-500">{error}</p>}
        {hint && !error && <p className="text-xs text-tea-400">{hint}</p>}
      </div>
    );
  }
);
Input.displayName = "Input";
