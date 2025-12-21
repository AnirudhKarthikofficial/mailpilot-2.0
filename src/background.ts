console.log('[MailPilot background] loaded');

chrome.tabs.onUpdated.addListener(async (tabId, _info, tab) => {
  if (!tab.url) return;

  const url = new URL(tab.url);

  if (url.origin === 'https://mail.google.com') {
    await chrome.sidePanel.setOptions({
      tabId,
      path: 'sidepanel.html',
      enabled: true,
    });
  } else {
    await chrome.sidePanel.setOptions({
      tabId,
      enabled: false,
    });
  }
});

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  const tab = await chrome.tabs.get(tabId);
  if (!tab.url) return;

  const url = new URL(tab.url);
  const isGmail = url.origin === 'https://mail.google.com';

  await chrome.sidePanel.setOptions({
    tabId,
    path: 'sidepanel.html',
    enabled: isGmail,
  });
});

chrome.runtime.onMessage.addListener(async (message, sender, _sendResponse) => {
  if (message?.type === 'OPEN_SIDE_PANEL') {
    console.log('[MailPilot bg] got OPEN_SIDE_PANEL', message.payload);

    chrome.storage.local.set(
      { 
        mailpilotEmailData: message.payload,
        mailpilotActiveTabId: sender.tab?.id,   // <‑‑ store the tab id here
      },
      () => console.log('[MailPilot bg] stored mailpilotEmailData + tabId'),
    );

    if (sender.tab?.id !== undefined) {
      chrome.sidePanel.open({ tabId: sender.tab.id });
    } else if (sender.tab?.windowId !== undefined) {
      chrome.sidePanel.open({ windowId: sender.tab.windowId });
    }
  }

  // Handle rewrite request
  if (message?.type === 'REWRITE_EMAIL') {
    const { email, tone, translate } = message;
    
    console.log('[MailPilot bg] Got REWRITE_EMAIL request', { email, tone, translate });
    
    try {
      // IMPORTANT: Replace with your Render URL if deployed, or keep localhost for local dev
      const backendUrl = 'https://mailpilot-backend-21rf.onrender.com/api/rewrite'; // Change to your Render URL when deployed
      
      console.log('[MailPilot bg] Calling backend:', backendUrl);
      
      const response = await fetch(backendUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          email, 
          tone,
          translate
        }),
      });

      console.log('[MailPilot bg] Backend response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('[MailPilot bg] Backend error:', errorData);
        throw new Error(errorData.error || `Backend error: ${response.status}`);
      }

      const data = await response.json();
      console.log('[MailPilot bg] Got rewritten data:', data);
      
      // Store in storage so side panel can pick it up
      chrome.storage.local.set(
        { mailpilotRewrittenEmail: data.rewritten },
        () => {
          console.log('[MailPilot bg] Stored rewritten email');
          // Also send via message for immediate update
          chrome.runtime.sendMessage({
            type: 'REWRITE_COMPLETE',
            rewritten: data.rewritten,
          });
        }
      );
      
      // Return true to keep message channel open for async operations
      return true;
    } catch (error) {
      console.error('[MailPilot] Rewrite error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Store error in storage
      chrome.storage.local.set(
        { mailpilotRewriteError: errorMessage },
        () => {
          // Also send via message
          chrome.runtime.sendMessage({
            type: 'REWRITE_ERROR',
            error: errorMessage,
          });
        }
      );
      
      return true;
    }
  }

  if (message?.type === 'APPLY_EMAIL') {
    const { subject, body } = message;

    chrome.storage.local.get('mailpilotActiveTabId', (res) => {
      const tabId = res.mailpilotActiveTabId as number | undefined;
      if (!tabId) {
        console.error('[MailPilot bg] No active tab stored');
        return;
      }

      console.log('[MailPilot bg] Sending APPLY_EMAIL to tab:', tabId);

      chrome.tabs.sendMessage(tabId, {
        type: 'APPLY_EMAIL',
        subject,
        body,
      }).catch((error) => {
        console.error('[MailPilot bg] Error sending message to content script:', error);
      });
    });

    return true;
  }
  
  // Return true to indicate we'll send response asynchronously
  return true;
});