import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

interface BackButtonProps {
  className?: string;
  variant?: "ghost" | "outline" | "default";
  fallbackPath?: string;
}

export const BackButton = ({ className = "", variant = "ghost", fallbackPath = "/dashboard" }: BackButtonProps) => {
  const navigate = useNavigate();

  const handleBack = () => {
    // Check if there's a history to go back to
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      // Fallback to dashboard if no history
      navigate(fallbackPath);
    }
  };

  return (
    <Button
      variant={variant}
      size="icon"
      onClick={handleBack}
      className={className}
    >
      <ArrowLeft className="h-5 w-5" />
    </Button>
  );
};
