export {};

declare global {
  interface Window {
    alentoDesktop?: {
      isDesktop: true;
      setWebViewBounds: (bounds: {
        x: number;
        y: number;
        width: number;
        height: number;
      }) => void;
      setWebViewVisible: (visible: boolean) => void;
      navigateWebView: (url: string) => void;
      reloadWebView: () => void;
    };
  }
}
