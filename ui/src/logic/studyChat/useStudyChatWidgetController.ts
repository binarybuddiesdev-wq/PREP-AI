import { useEffect, useRef, useState } from 'react';

import type { IStudyChatConversationSummary } from '@/core';
import { createStudyChatIdempotencyKey } from './studyChatIdempotency';
import { getStudyChatErrorMessage } from './studyChatError';
import { useStudyChatCommands } from './useStudyChatCommands';
import {
  useStudyChatConversationReader,
  useStudyChatConversationsReader,
} from './useStudyChatReaders';

interface IStudyChatOperation {
  kind: 'create' | 'send';
  message: string;
  idempotencyKey: string;
  conversationId?: string;
}

export const useStudyChatWidgetController = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [view, setView] = useState<'transcript' | 'list'>('transcript');
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [failedOperation, setFailedOperation] = useState<IStudyChatOperation | null>(null);
  const [sendErrorMessage, setSendErrorMessage] = useState<string | null>(null);
  const [conversationToDelete, setConversationToDelete] =
    useState<IStudyChatConversationSummary | null>(null);
  const [deleteErrorMessage, setDeleteErrorMessage] = useState<string | null>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);
  const conversationContextVersion = useRef(0);

  const listQuery = useStudyChatConversationsReader(isOpen && view === 'list');
  const conversationQuery = useStudyChatConversationReader(
    selectedConversationId ?? '',
    isOpen && view === 'transcript'
  );
  const commands = useStudyChatCommands();
  const isSending = commands.createConversation.isPending || commands.sendMessage.isPending;
  const conversations = listQuery.data?.pages.flatMap((page) => page.items) ?? [];
  const activeConversation = conversationQuery.data;
  const isTurnLimitReached = Boolean(activeConversation && activeConversation.turnCount >= 30);

  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !conversationToDelete) {
        event.preventDefault();
        setIsOpen(false);
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [conversationToDelete, isOpen]);

  useEffect(() => {
    if (!wasOpen.current && isOpen) {
      const panel = document.getElementById('prepai-study-chat');
      const initialFocus =
        panel?.querySelector<HTMLElement>('textarea:not(:disabled)') ??
        panel?.querySelector<HTMLElement>('button:not(:disabled)');
      initialFocus?.focus();
    } else if (wasOpen.current && !isOpen) {
      launcherRef.current?.focus();
    }
    wasOpen.current = isOpen;
  }, [isOpen]);

  const clearSendFailure = () => {
    setFailedOperation(null);
    setSendErrorMessage(null);
  };

  const runOperation = async (operation: IStudyChatOperation) => {
    const operationContextVersion = conversationContextVersion.current;
    setSendErrorMessage(null);
    try {
      if (operation.kind === 'create') {
        const conversation = await commands.createConversation.mutateAsync({
          body: { message: operation.message },
          idempotencyKey: operation.idempotencyKey,
        });
        if (operationContextVersion !== conversationContextVersion.current) return;
        setSelectedConversationId(conversation.id);
      } else if (operation.conversationId) {
        await commands.sendMessage.mutateAsync({
          conversationId: operation.conversationId,
          body: { message: operation.message },
          idempotencyKey: operation.idempotencyKey,
        });
        if (operationContextVersion !== conversationContextVersion.current) return;
      }
      setView('transcript');
      setDraft('');
      clearSendFailure();
    } catch (error) {
      if (operationContextVersion !== conversationContextVersion.current) return;
      setFailedOperation(operation);
      setSendErrorMessage(getStudyChatErrorMessage(error, { operation: operation.kind }));
    }
  };

  const handleSend = (message: string) => {
    const trimmedMessage = message.trim();
    if (!trimmedMessage || trimmedMessage.length > 4000 || isSending || isTurnLimitReached) return;

    if (failedOperation?.message === trimmedMessage) {
      void runOperation(failedOperation);
      return;
    }

    const operation: IStudyChatOperation = selectedConversationId
      ? {
          kind: 'send',
          conversationId: selectedConversationId,
          message: trimmedMessage,
          idempotencyKey: createStudyChatIdempotencyKey(),
        }
      : {
          kind: 'create',
          message: trimmedMessage,
          idempotencyKey: createStudyChatIdempotencyKey(),
        };
    void runOperation(operation);
  };

  const handleDraftChange = (value: string) => {
    setDraft(value);
    if (failedOperation && value.trim() !== failedOperation.message) clearSendFailure();
  };

  const startNewConversation = () => {
    conversationContextVersion.current += 1;
    setSelectedConversationId(null);
    setView('transcript');
    setDraft('');
    clearSendFailure();
  };

  const retryFailedOperation = () => {
    if (failedOperation && !isSending) void runOperation(failedOperation);
  };

  const handleDelete = async () => {
    if (!conversationToDelete || commands.deleteConversation.isPending) return;
    setDeleteErrorMessage(null);
    try {
      await commands.deleteConversation.mutateAsync(conversationToDelete.id);
      if (selectedConversationId === conversationToDelete.id) {
        conversationContextVersion.current += 1;
        setSelectedConversationId(null);
        setDraft('');
        clearSendFailure();
      }
      setConversationToDelete(null);
    } catch (error) {
      setDeleteErrorMessage(getStudyChatErrorMessage(error, { operation: 'delete' }));
    }
  };

  const closeDeleteDialog = () => {
    if (!commands.deleteConversation.isPending) {
      setConversationToDelete(null);
      setDeleteErrorMessage(null);
    }
  };

  const selectConversation = (conversationId: string) => {
    conversationContextVersion.current += 1;
    setSelectedConversationId(conversationId);
    setView('transcript');
    clearSendFailure();
  };

  const requestDelete = (conversation: IStudyChatConversationSummary) => {
    setDeleteErrorMessage(null);
    setConversationToDelete(conversation);
  };

  return {
    activeConversation,
    closeDeleteDialog,
    commands,
    conversationQuery,
    conversationToDelete,
    conversations,
    deleteErrorMessage,
    draft,
    failedOperation,
    handleDelete,
    handleDraftChange,
    handleSend,
    isFullscreen,
    isOpen,
    isSending,
    isTurnLimitReached,
    launcherRef,
    listQuery,
    requestDelete,
    retryFailedOperation,
    selectedConversationId,
    selectConversation,
    sendErrorMessage,
    setIsFullscreen,
    setIsOpen,
    setView,
    startNewConversation,
    view,
    clearSendFailure,
  };
};
