import React, { createContext, useContext, useState, useEffect } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

interface PWAInstallContextType {
  isInstallable: boolean;
  isInstalled: boolean;
  isModalOpen: boolean;
  openInstallModal: () => void;
  closeInstallModal: () => void;
  triggerInstall: () => Promise<void>;
}

const PWAInstallContext = createContext<PWAInstallContextType | null>(null);

let globalDeferredPrompt: BeforeInstallPromptEvent | null = null;

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    globalDeferredPrompt = e as BeforeInstallPromptEvent;
  });

  window.addEventListener('appinstalled', () => {
    globalDeferredPrompt = null;
  });
}

export const PWAInstallProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(globalDeferredPrompt);
  const [isInstalled, setIsInstalled] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.matchMedia('(display-mode: fullscreen)').matches ||
      window.matchMedia('(display-mode: minimal-ui)').matches ||
      (window.navigator as any).standalone === true ||
      document.referrer.includes('android-app://');
    const localFlag = localStorage.getItem('tx_pwa_installed') === 'true';
    return isStandalone || localFlag;
  });
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    // Check if already in standalone display mode or recorded in localStorage
    const checkInstalled = () => {
      const isStandalone =
        window.matchMedia('(display-mode: standalone)').matches ||
        window.matchMedia('(display-mode: fullscreen)').matches ||
        window.matchMedia('(display-mode: minimal-ui)').matches ||
        (window.navigator as any).standalone === true ||
        document.referrer.includes('android-app://');
      const localFlag = localStorage.getItem('tx_pwa_installed') === 'true';

      if (isStandalone || localFlag) {
        setIsInstalled(true);
      }
    };

    checkInstalled();

    // Check navigator.getInstalledRelatedApps if supported
    if ('getInstalledRelatedApps' in navigator) {
      (navigator as any)
        .getInstalledRelatedApps()
        .then((apps: any[]) => {
          if (apps && apps.length > 0) {
            setIsInstalled(true);
            localStorage.setItem('tx_pwa_installed', 'true');
          }
        })
        .catch(() => {});
    }

    if (typeof window !== 'undefined' && (window as any).__TX_DEFERRED_PROMPT__) {
      globalDeferredPrompt = (window as any).__TX_DEFERRED_PROMPT__;
      setDeferredPrompt((window as any).__TX_DEFERRED_PROMPT__);
    }

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      const promptEvent = e as BeforeInstallPromptEvent;
      globalDeferredPrompt = promptEvent;
      (window as any).__TX_DEFERRED_PROMPT__ = promptEvent;
      setDeferredPrompt(promptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      try {
        localStorage.setItem('tx_pwa_installed', 'true');
      } catch (_) {}
      globalDeferredPrompt = null;
      if (typeof window !== 'undefined') {
        (window as any).__TX_DEFERRED_PROMPT__ = null;
      }
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const openInstallModal = () => setIsModalOpen(true);
  const closeInstallModal = () => setIsModalOpen(false);

  const triggerInstall = async () => {
    const promptEvent =
      deferredPrompt ||
      globalDeferredPrompt ||
      (typeof window !== 'undefined' ? (window as any).__TX_DEFERRED_PROMPT__ : null);

    if (promptEvent && typeof promptEvent.prompt === 'function') {
      try {
        await promptEvent.prompt();
        const choice = await promptEvent.userChoice;
        if (choice && choice.outcome === 'accepted') {
          setIsInstalled(true);
          try {
            localStorage.setItem('tx_pwa_installed', 'true');
          } catch (_) {}
          globalDeferredPrompt = null;
          setDeferredPrompt(null);
          if (typeof window !== 'undefined') {
            (window as any).__TX_DEFERRED_PROMPT__ = null;
          }
        }
        return;
      } catch (err) {
        console.warn('Chrome install prompt error, showing guide:', err);
      }
    }

    // Only fallback to 3-step text popup if Chrome native popup is not available or supported
    setIsModalOpen(true);
  };

  return (
    <PWAInstallContext.Provider
      value={{
        isInstallable: Boolean(deferredPrompt || globalDeferredPrompt),
        isInstalled,
        isModalOpen,
        openInstallModal,
        closeInstallModal,
        triggerInstall,
      }}
    >
      {children}
    </PWAInstallContext.Provider>
  );
};

export const usePWAInstall = () => {
  const context = useContext(PWAInstallContext);
  if (!context) {
    throw new Error('usePWAInstall must be used within a PWAInstallProvider');
  }
  return context;
};
