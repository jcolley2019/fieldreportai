import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

interface BackButtonProps {
  className?: string;
  fallbackPath?: string;
}

export const BackButton = ({ className = "", fallbackPath = "/dashboard" }: BackButtonProps) => {
  const navigate = useNavigate();

  const handleBack = () => {
    navigate(fallbackPath);
  };

  return (
    <Button
      onClick={handleBack}
      size="sm"
      className={`gap-2 ${className}`}
    >
      <ArrowLeft className="h-4 w-4" />
      Back
    </Button>
  );
};
