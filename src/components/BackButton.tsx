import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

interface BackButtonProps {
  className?: string;
  fallbackPath?: string;
}

export const BackButton = ({ className = "", fallbackPath = "/dashboard" }: BackButtonProps) => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <Button
      onClick={() => navigate(fallbackPath)}
      size="sm"
      className={`gap-2 transition-transform duration-200 hover:scale-105 ${className}`}
    >
      <ArrowLeft className="h-4 w-4" />
      {t('common.back')}
    </Button>
  );
};
