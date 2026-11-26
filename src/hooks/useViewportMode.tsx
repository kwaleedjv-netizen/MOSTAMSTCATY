import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export type DeviceMode = 'desktop' | 'tablet' | 'mobile';
export type ViewportModePreference = 'auto' | DeviceMode;

const STORAGE_KEY = 'mostamsakati_viewport_mode';

export interface ViewportModeState {
  deviceMode: DeviceMode;
  modePreference: ViewportModePreference;
  setModePreference: (pref: ViewportModePreference) => void;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isLandscape: boolean;
  width: number;
  height: number;
}

const LayoutModeContext = createContext<ViewportModeState>({
  deviceMode: 'desktop',
  modePreference: 'auto',
  setModePreference: () => {},
  isMobile: false,
  isTablet: false,
  isDesktop: true,
  isLandscape: true,
  width: 1440,
  height: 900,
});

function detectAutoDeviceMode(width: number, height: number, isCoarsePointer: boolean): DeviceMode {
  // Phone mode: narrow screens (< 768px) or touch phones in compact landscape (height <= 540 and width < 960)
  if (width < 768 || (isCoarsePointer && height <= 540 && width < 960)) {
    return 'mobile';
  }
  // Tablet mode: 768px..1180px (covers iPad portrait/landscape, Android tablets) or coarse touch up to 1280px
  if (width < 1180 || (isCoarsePointer && width <= 1280)) {
    return 'tablet';
  }
  // Browser / Desktop mode
  return 'desktop';
}

function buildState(_preference: ViewportModePreference, setPreference: (p: ViewportModePreference) => void): ViewportModeState {
  if (typeof window === 'undefined') {
    return {
      deviceMode: 'desktop',
      modePreference: 'auto',
      setModePreference: setPreference,
      isMobile: false,
      isTablet: false,
      isDesktop: true,
      isLandscape: true,
      width: 1440,
      height: 900,
    };
  }

  const width = window.innerWidth;
  const height = window.innerHeight;
  const isCoarsePointer = window.matchMedia?.('(pointer: coarse)')?.matches ?? false;
  const deviceMode: DeviceMode = detectAutoDeviceMode(width, height, isCoarsePointer);

  return {
    deviceMode,
    modePreference: 'auto',
    setModePreference: setPreference,
    isMobile: deviceMode === 'mobile',
    isTablet: deviceMode === 'tablet',
    isDesktop: deviceMode === 'desktop',
    isLandscape: width > height,
    width,
    height,
  };
}

export const LayoutModeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const setModePreference = useCallback((_pref: ViewportModePreference) => {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {}
  }, []);

  const [state, setState] = useState<ViewportModeState>(() =>
    buildState('auto', setModePreference)
  );

  useEffect(() => {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {}
    const update = () => {
      setState(buildState('auto', setModePreference));
    };

    update();
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, [setModePreference]);

  return <LayoutModeContext.Provider value={state}>{children}</LayoutModeContext.Provider>;
};

export function useLayoutMode(): ViewportModeState {
  return useContext(LayoutModeContext);
}

