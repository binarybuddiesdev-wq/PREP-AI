export type ToastKind = 'success' | 'error' | 'info';

export interface IToastMessage {
  id: string;
  kind: ToastKind;
  message: string;
}

export type IEnqueueToast = Omit<IToastMessage, 'id'>;
