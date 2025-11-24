import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Settings } from "lucide-react";

interface BackButtonProps {
  className?: string;
  fallbackPath?: string;
  showSettings?: boolean;
}

export const BackButton = ({ className = "", fallbackPath = "/dashboard", showSettings = true }: BackButtonProps) => {
  const navigate = useNavigate();

  return (
    <header className={`flex items-center justify-between ${className}`}>
      <Button
        onClick={() => navigate(fallbackPath)}
        size="sm"
        className="gap-2 transition-transform duration-200 hover:scale-105"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </Button>
      
      {showSettings && (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/settings")}
        >
          <Settings className="h-5 w-5 text-foreground" />
        </Button>
      )}
    </header>
  );
};
