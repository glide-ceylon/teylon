import { type ButtonHTMLAttributes, forwardRef } from "react";
import { Spinner } from "./Spinner";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  fullWidth?: boolean;
}

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-tea-600 text-white hover:bg-tea-700 active:scale-[0.98] disabled:bg-tea-300",
  secondary:
    "bg-white text-tea-700 border border-tea-200 hover:bg-tea-50 active:scale-[0.98] disabled:opacity-50",
  ghost:
    "bg-transparent text-tea-600 hover:bg-tea-100 active:scale-[0.98] disabled:opacity-50",
  danger:
    "bg-red-600 text-white hover:bg-red-700 active:scale-[0.98] disabled:opacity-50",
};

const sizeClasses: Record<Size, string> = {
  sm: "px-3 py-2 text-sm rounded-xl min-h-[36px]",
  md: "px-4 py-3 text-sm font-semibold rounded-xl min-h-[44px]",
  lg: "px-6 py-4 text-base font-semibold rounded-2xl min-h-[52px]",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      loading = false,
      fullWidth = false,
      children,
      disabled,
      className = "",
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={[
          "inline-flex items-center justify-center gap-2 transition-all",
          variantClasses[variant],
          sizeClasses[size],
          fullWidth ? "w-full" : "",
          className,
        ].join(" ")}
        {...props}
      >
        {loading && <Spinner size="sm" />}
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";
