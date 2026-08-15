import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/cn";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md text-[13px] font-medium transition-all duration-150 ease-out active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-1 focus-visible:ring-offset-bg",
  {
    variants: {
      variant: {
        // Charcoal — main workflow actions (submit, save, approve, navigate).
        primary:
          "bg-primary text-white shadow-[0_1px_2px_rgba(24,26,33,0.2)] hover:bg-primary-hover hover:shadow-[0_2px_8px_-2px_rgba(24,26,33,0.35)]",
        // Gold — reserved for money/creation moments (create PO, release payment).
        accent:
          "bg-accent text-white shadow-[0_1px_2px_rgba(24,26,33,0.2)] hover:bg-accent-hover hover:shadow-[0_2px_8px_-2px_rgba(151,113,21,0.4)]",
        secondary: "bg-overlay/[0.06] text-text hover:bg-overlay/[0.1] border border-border hover:border-border-strong",
        ghost: "text-text-dim hover:text-text hover:bg-overlay/[0.06]",
        outline: "border border-border text-text hover:border-border-strong hover:bg-overlay/[0.03]",
      },
      size: {
        sm: "h-7 px-2.5",
        md: "h-8 px-3",
        lg: "h-9 px-4",
      },
    },
    defaultVariants: { variant: "secondary", size: "md" },
  },
);

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return <button className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
