import { useState } from "react";
import { Eye, EyeOff, Fingerprint, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const Index = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Login attempted with:", { email, password });
  };

  const handleBiometricLogin = () => {
    console.log("Biometric login attempted");
  };

  return (
    <div className="dark min-h-screen">
      <div className="flex min-h-screen w-full flex-col items-center justify-center bg-background p-4">
        <div className="w-full max-w-sm">
          {/* Logo */}
          <div className="flex justify-center pb-8">
            <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-primary/20">
              <FileText className="h-10 w-10 text-primary" strokeWidth={2} />
            </div>
          </div>

          {/* Headline */}
          <h1 className="pb-8 text-center text-[32px] font-bold leading-tight tracking-tight text-foreground">
            Field Reporting, Simplified
          </h1>

          {/* Form */}
          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            {/* Email Field */}
            <div className="flex w-full flex-col">
              <Label htmlFor="email" className="pb-2 text-base font-medium text-foreground/90">
                Email Address
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-12 rounded-lg border-input bg-input/50 text-base text-foreground placeholder:text-muted-foreground focus-visible:ring-primary"
                required
              />
            </div>

            {/* Password Field */}
            <div className="flex w-full flex-col">
              <Label htmlFor="password" className="pb-2 text-base font-medium text-foreground/90">
                Password
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-12 rounded-lg border-input bg-input/50 pr-12 text-base text-foreground placeholder:text-muted-foreground focus-visible:ring-primary"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>

            {/* Forgot Password Link */}
            <div className="flex justify-end">
              <a
                href="#"
                className="text-sm font-medium text-primary hover:underline"
                onClick={(e) => {
                  e.preventDefault();
                  console.log("Forgot password clicked");
                }}
              >
                Forgot Password?
              </a>
            </div>

            {/* Login Button */}
            <Button
              type="submit"
              className="h-12 w-full rounded-lg bg-primary text-base font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Log In
            </Button>

            {/* Biometric Login Button */}
            <Button
              type="button"
              variant="outline"
              onClick={handleBiometricLogin}
              className="h-12 w-full rounded-lg border-input bg-transparent text-base font-medium text-foreground hover:bg-input/30 transition-colors"
            >
              <Fingerprint className="mr-2 h-5 w-5" />
              Login with Biometrics
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Index;
