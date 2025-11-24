import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Settings } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown } from "lucide-react";

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
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 hover:bg-secondary rounded-md px-2 py-1 transition-colors">
              <span className="text-sm font-medium text-foreground">Menu</span>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 bg-popover">
            <DropdownMenuItem onClick={() => navigate("/settings")} className="cursor-pointer">
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </header>
  );
};
