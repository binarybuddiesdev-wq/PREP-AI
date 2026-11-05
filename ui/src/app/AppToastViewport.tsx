import { ToastViewport } from '@/components/layout';
import { useToastViewportController } from '@/logic';

export const AppToastViewport = () => {
  const { toasts, theme, dismiss } = useToastViewportController();

  return <ToastViewport toasts={toasts} theme={theme} onDismiss={dismiss} />;
};
