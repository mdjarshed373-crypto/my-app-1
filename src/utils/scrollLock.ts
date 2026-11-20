/**
 * Global Scroll Lock Manager
 * Ensures that when any popup/modal (Welcome Notice / Admin Inbox, Auth, etc.)
 * is open, scrolling is cleanly locked, and as soon as it is closed, scrolling
 * is IMMEDIATELY and unconditionally unlocked.
 */

import { useEffect } from 'react';

let modalLockCount = 0;

export function lockBodyScroll(): void {
  if (typeof document === 'undefined') return;
  modalLockCount++;
  if (modalLockCount === 1) {
    const mainContainer = document.getElementById('main-scroll-container');
    if (mainContainer) {
      mainContainer.style.overflow = 'hidden';
    }
  }
}

export function unlockBodyScroll(): void {
  if (typeof document === 'undefined') return;
  modalLockCount = Math.max(0, modalLockCount - 1);
  if (modalLockCount === 0) {
    const mainContainer = document.getElementById('main-scroll-container');
    if (mainContainer) {
      mainContainer.style.overflow = '';
    }
  }
}

export function forceResetBodyScroll(): void {
  if (typeof document === 'undefined') return;
  modalLockCount = 0;
  const mainContainer = document.getElementById('main-scroll-container');
  if (mainContainer) {
    mainContainer.style.overflow = '';
  }
}

/**
 * React hook to lock scroll when a modal/popup is open,
 * and immediately restore smooth scrolling when it closes or unmounts.
 */
export function useLockBodyScroll(isLocked: boolean): void {
  useEffect(() => {
    if (!isLocked) return;
    lockBodyScroll();
    return () => {
      unlockBodyScroll();
    };
  }, [isLocked]);
}
