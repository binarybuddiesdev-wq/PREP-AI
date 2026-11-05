import type { IStudyChatWidgetProps } from './StudyChatWidget.types';
import { getStudyChatErrorMessage, useStudyChatWidgetController } from '@/logic/studyChat';
import {
  StudyChatComposer,
  StudyChatConversationList,
  StudyChatDeleteDialog,
  StudyChatLauncher,
  StudyChatPanel,
  StudyChatTranscript,
} from '@/components/studyChat';

export const StudyChatWidget = ({ theme }: IStudyChatWidgetProps) => {
  const chat = useStudyChatWidgetController();

  return (
    <>
      {chat.isOpen && (
        <StudyChatPanel
          isOpen
          isFullscreen={chat.isFullscreen}
          theme={theme}
          view={chat.view}
          onClose={() => chat.setIsOpen(false)}
          onToggleFullscreen={() => chat.setIsFullscreen((previous) => !previous)}
          onToggleView={() =>
            chat.setView((previous) => (previous === 'transcript' ? 'list' : 'transcript'))
          }
          onNewConversation={chat.startNewConversation}
        >
          {chat.view === 'list' ? (
            <StudyChatConversationList
              conversations={chat.conversations}
              selectedConversationId={chat.selectedConversationId}
              isLoading={chat.listQuery.isPending}
              isLoadingMore={chat.listQuery.isFetchingNextPage}
              hasMore={Boolean(chat.listQuery.hasNextPage)}
              errorMessage={
                chat.listQuery.isError ? getStudyChatErrorMessage(chat.listQuery.error) : null
              }
              theme={theme}
              onSelect={chat.selectConversation}
              onDelete={chat.requestDelete}
              onLoadMore={() => void chat.listQuery.fetchNextPage()}
              onNewConversation={chat.startNewConversation}
              onRetry={() => void chat.listQuery.refetch()}
            />
          ) : (
            <>
              <StudyChatTranscript
                messages={chat.activeConversation?.messages ?? []}
                theme={theme}
                isLoading={Boolean(chat.selectedConversationId) && chat.conversationQuery.isPending}
                errorMessage={
                  chat.conversationQuery.isError
                    ? getStudyChatErrorMessage(chat.conversationQuery.error)
                    : null
                }
                sendErrorMessage={chat.sendErrorMessage}
                isSending={chat.isSending}
                isTurnLimitReached={chat.isTurnLimitReached}
                onRetry={() => void chat.conversationQuery.refetch()}
                onBackToList={() => chat.setView('list')}
                onRetrySend={chat.failedOperation ? chat.retryFailedOperation : undefined}
                onDismissSendError={chat.failedOperation ? chat.clearSendFailure : undefined}
                onNewConversation={chat.startNewConversation}
              />
              <StudyChatComposer
                draft={chat.draft}
                maxLength={4000}
                isDisabled={chat.isTurnLimitReached || chat.conversationQuery.isError}
                isSending={chat.isSending}
                theme={theme}
                onDraftChange={chat.handleDraftChange}
                onSubmit={chat.handleSend}
              />
            </>
          )}
        </StudyChatPanel>
      )}
      <StudyChatLauncher
        buttonRef={chat.launcherRef}
        isOpen={chat.isOpen}
        onToggle={() => chat.setIsOpen((previous) => !previous)}
      />
      <StudyChatDeleteDialog
        conversation={chat.conversationToDelete}
        errorMessage={chat.deleteErrorMessage}
        isPending={chat.commands.deleteConversation.isPending}
        theme={theme}
        onClose={chat.closeDeleteDialog}
        onConfirm={() => void chat.handleDelete()}
      />
    </>
  );
};
