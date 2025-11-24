import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Settings } from "lucide-react";

export const SettingsButton = () => {
  const navigate = useNavigate();

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => navigate("/settings")}
    >
      <Settings className="h-5 w-5 text-foreground" />
    </Button>
  );
};
