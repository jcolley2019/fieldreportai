import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Settings } from "lucide-react";

interface PageHeaderProps {
  className?: string;
  fallbackPath?: string;
}

export const PageHeader = ({ className = "", fallbackPath = "/dashboard" }: PageHeaderProps) => {
  const navigate = useNavigate();

  return (
    <div className={`flex justify-between items-center ${className}`}>
      <Button
        onClick={() => navigate(fallbackPath)}
        size="sm"
        className="gap-2 transition-transform duration-200 hover:scale-105"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </Button>
      
      <Button
        onClick={() => navigate("/settings")}
        size="sm"
        variant="ghost"
        className="gap-2 transition-transform duration-200 hover:scale-105"
      >
        <Settings className="h-4 w-4" />
        Settings
      </Button>
    </div>
  );
};
