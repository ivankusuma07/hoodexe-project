import { lightTheme, type Theme } from '@rainbow-me/rainbowkit';

const base = lightTheme({ accentColor: '#245edc', accentColorForeground: '#fff', borderRadius: 'none', fontStack: 'system' });

/** RainbowKit skinned to the hood.exe window chrome. */
export const xpRainbowTheme: Theme = {
  ...base,
  colors: {
    ...base.colors,
    accentColor: '#245edc',
    actionButtonBorder: '#003c74',
    actionButtonSecondaryBackground: '#ece9d8',
    closeButton: '#fff',
    closeButtonBackground: '#d9541f',
    connectButtonBackground: '#ece9d8',
    connectButtonInnerBackground: '#f5f5f5',
    connectButtonText: '#000',
    connectionIndicator: '#4a8c25',
    error: '#c91f00',
    generalBorder: '#7f9db9',
    generalBorderDim: '#d0d0bf',
    menuItemBackground: '#c1d2ee',
    modalBackdrop: 'rgba(0, 0, 0, 0.25)',
    modalBackground: '#ece9d8',
    modalBorder: '#0054e8',
    modalText: '#000',
    modalTextDim: '#7a7869',
    modalTextSecondary: '#4b4b4b',
    profileAction: '#f5f5f5',
    profileActionHover: '#c1d2ee',
    profileForeground: '#ece9d8',
    selectedOptionBorder: '#316ac5',
    standby: '#d78a00',
  },
  fonts: { body: 'Tahoma, "Trebuchet MS", "Segoe UI", Arial, sans-serif' },
  radii: {
    actionButton: '3px',
    connectButton: '3px',
    menuButton: '3px',
    modal: '8px 8px 0 0',
    modalMobile: '0',
  },
  shadows: {
    ...base.shadows,
    dialog: '2px 3px 8px rgba(0, 0, 0, 0.35)',
    connectButton: 'none',
    profileDetailsAction: 'none',
    selectedOption: 'none',
    selectedWallet: 'none',
    walletLogo: 'none',
  },
  blurs: { modalOverlay: 'none' },
};
