const STORAGE_KEY = 'jukebox_admin_onboarding_seen';
const SHOW_FLAG_KEY = 'jukebox_show_onboarding';

export function shouldShowAdminOnboarding(isVenueAdmin: boolean): boolean {
  if (typeof window === 'undefined' || !isVenueAdmin) return false;
  if (sessionStorage.getItem(SHOW_FLAG_KEY) === '1') return true;
  return localStorage.getItem(STORAGE_KEY) !== 'true';
}

export function setShowOnboardingAfterRegister(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(SHOW_FLAG_KEY, '1');
}

export function markOnboardingSeen(): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, 'true');
  sessionStorage.removeItem(SHOW_FLAG_KEY);
}

