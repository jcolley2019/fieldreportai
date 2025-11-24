import { useTranslation } from "react-i18next";
import { Languages } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const LanguageSelector = () => {
  const { i18n } = useTranslation();

  const handleLanguageChange = (language: string) => {
    i18n.changeLanguage(language);
    // Store in localStorage for persistence before login
    localStorage.setItem('preferred_language', language);
  };

  return (
    <div className="flex items-center gap-2">
      <Languages className="h-5 w-5 text-primary" />
      <Select value={i18n.language} onValueChange={handleLanguageChange}>
        <SelectTrigger className="w-[140px] h-10 bg-background border-border font-medium">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="bg-popover border-border z-50">
          <SelectItem value="en" className="cursor-pointer hover:bg-accent">
            English
          </SelectItem>
          <SelectItem value="es" className="cursor-pointer hover:bg-accent">
            Español
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
};
