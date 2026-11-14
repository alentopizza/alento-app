export {};

declare global {
  interface Window {
    alentoDesktop?: {
      isDesktop: true;
      setWhatsAppBounds: (bounds: {
        x: number;
        y: number;
        width: number;
        height: number;
      }) => void;
      setWhatsAppVisible: (visible: boolean) => void;
      reloadWhatsApp: () => void;
    };
  }
}
