import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";
import { useRouterState } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

export function InstallAppPrompt() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [installEvent, setInstallEvent] = useState<InstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [instructionsOpen, setInstructionsOpen] = useState(false);

  useEffect(() => {
    const userAgent = window.navigator.userAgent;
    const ios = /iPad|iPhone|iPod/.test(userAgent) ||
      (window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1);
    const standalone = window.matchMedia("(display-mode: standalone)").matches ||
      ("standalone" in window.navigator && window.navigator.standalone === true);
    const dismissed = window.localStorage.getItem("meetup-install-dismissed") === "yes";

    setIsIos(ios);
    setShowPrompt(!standalone && !dismissed && /Android|iPad|iPhone|iPod/i.test(userAgent));

    const handleInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as InstallPromptEvent);
      setShowPrompt(!dismissed);
    };
    const handleInstalled = () => {
      setShowPrompt(false);
      setInstallEvent(null);
    };

    window.addEventListener("beforeinstallprompt", handleInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  if (!showPrompt || pathname.startsWith("/chat") || pathname.startsWith("/calls/")) return null;

  const dismiss = () => {
    window.localStorage.setItem("meetup-install-dismissed", "yes");
    setShowPrompt(false);
  };

  const install = async () => {
    if (!installEvent) {
      setInstructionsOpen(true);
      return;
    }
    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    if (choice.outcome === "accepted") setShowPrompt(false);
    setInstallEvent(null);
  };

  return (
    <>
      <aside className="fixed inset-x-3 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-50 mx-auto flex max-w-md items-center gap-3 rounded-lg border border-border bg-background p-3 shadow-lg md:hidden">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground">
          <Download className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">Install Meetup</p>
          <p className="text-xs text-muted-foreground">Open it from your home screen</p>
        </div>
        <Button size="sm" onClick={() => void install()}>
          Install
        </Button>
        <Button size="icon" variant="ghost" aria-label="Dismiss install prompt" onClick={dismiss}>
          <X aria-hidden="true" />
        </Button>
      </aside>

      <Dialog open={instructionsOpen} onOpenChange={setInstructionsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Meetup to your home screen</DialogTitle>
            <DialogDescription>
              {isIos
                ? "In Safari, tap Share, then choose Add to Home Screen and confirm."
                : "Open your browser menu, choose Install app or Add to Home screen, then confirm."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-3 rounded-md border border-border p-3 text-sm text-foreground">
            {isIos ? <Share className="h-5 w-5 shrink-0" aria-hidden="true" /> : <Download className="h-5 w-5 shrink-0" aria-hidden="true" />}
            <span>{isIos ? "Share → Add to Home Screen" : "Browser menu → Install app"}</span>
          </div>
          <Button onClick={() => setInstructionsOpen(false)}>Got it</Button>
        </DialogContent>
      </Dialog>
    </>
  );
}