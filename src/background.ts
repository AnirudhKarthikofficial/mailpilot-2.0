chrome.runtime.onMessage.addListener(
  (message: { type?: string; body?: string }, sender: chrome.runtime.MessageSender) => {
    if (message.type === 'MAILPILOT_OPEN' && sender.tab) {
      const tabId = sender.tab.id;
      if (tabId == null) return;

      chrome.storage.local.set({ mailpilotDraft: message.body ?? '' }, () => {
        chrome.sidePanel
          .setOptions({
            tabId,
            path: 'sidepanel.html',
            enabled: true,
          })
          .then(() => chrome.sidePanel.open({ tabId }))
          .catch((err) => {
            console.error('Failed to open side panel', err);
          });
      });
    }
  },
);