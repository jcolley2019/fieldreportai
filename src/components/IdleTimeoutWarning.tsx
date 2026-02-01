import { useTranslation } from "react-i18next";
import { Clock, LogOut } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

interface IdleTimeoutWarningProps {
  isOpen: boolean;
  remainingTime: number;
  onStayLoggedIn: () => void;
  onLogout: () => void;
}

export const IdleTimeoutWarning = ({
  isOpen,
  remainingTime,
  onStayLoggedIn,
  onLogout,
}: IdleTimeoutWarningProps) => {
  const { t } = useTranslation();

  return (
    <AlertDialog open={isOpen}>
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-warning/20">
            <Clock className="h-6 w-6 text-warning" />
          </div>
          <AlertDialogTitle className="text-center">
            Session Timeout Warning
          </AlertDialogTitle>
          <AlertDialogDescription className="text-center">
            <p className="mb-2">
              You've been inactive for a while. For your security, you'll be
              automatically logged out in:
            </p>
            <p className="text-3xl font-bold text-foreground">
              {remainingTime} {remainingTime === 1 ? "second" : "seconds"}
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col gap-2 sm:flex-row sm:justify-center">
          <Button
            variant="outline"
            onClick={onLogout}
            className="gap-2"
          >
            <LogOut className="h-4 w-4" />
            Log Out Now
          </Button>
          <AlertDialogAction onClick={onStayLoggedIn} className="gap-2">
            Stay Logged In
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
