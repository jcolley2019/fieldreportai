import * as React from "react";
import { cn } from "@/lib/utils";

interface GlassNavbarProps extends React.HTMLAttributes<HTMLElement> {
  children: React.ReactNode;
  fixed?: boolean;
}

const GlassNavbar = React.forwardRef<HTMLElement, GlassNavbarProps>(
  ({ className, children, fixed = true, ...props }, ref) => {
    return (
      <header
        ref={ref}
        className={cn(
          "glass-nav z-50 w-full",
          fixed ? "fixed top-0 left-0 right-0" : "sticky top-0",
          className
        )}
        {...props}
      >
        <div className="flex items-center justify-between px-4 py-3 max-w-7xl mx-auto">
          {children}
        </div>
      </header>
    );
  }
);
GlassNavbar.displayName = "GlassNavbar";

interface NavbarContentProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

const NavbarLeft = React.forwardRef<HTMLDivElement, NavbarContentProps>(
  ({ className, children, ...props }, ref) => (
    <div ref={ref} className={cn("flex items-center gap-3", className)} {...props}>
      {children}
    </div>
  )
);
NavbarLeft.displayName = "NavbarLeft";

const NavbarCenter = React.forwardRef<HTMLDivElement, NavbarContentProps>(
  ({ className, children, ...props }, ref) => (
    <div ref={ref} className={cn("flex-1 flex items-center justify-center", className)} {...props}>
      {children}
    </div>
  )
);
NavbarCenter.displayName = "NavbarCenter";

const NavbarRight = React.forwardRef<HTMLDivElement, NavbarContentProps>(
  ({ className, children, ...props }, ref) => (
    <div ref={ref} className={cn("flex items-center gap-2", className)} {...props}>
      {children}
    </div>
  )
);
NavbarRight.displayName = "NavbarRight";

const NavbarTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, children, ...props }, ref) => (
    <h1
      ref={ref}
      className={cn("text-lg font-semibold text-foreground tracking-tight", className)}
      {...props}
    >
      {children}
    </h1>
  )
);
NavbarTitle.displayName = "NavbarTitle";

export { GlassNavbar, NavbarLeft, NavbarCenter, NavbarRight, NavbarTitle };
