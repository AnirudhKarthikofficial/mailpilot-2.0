type EmailData = {
  subject: string;
  bodyHtml: string;
  bodyText: string;
};

// Helper to check if extension context is still valid
function isExtensionContextValid(): boolean {
  try {
    return chrome.runtime?.id !== undefined;
  } catch {
    return false;
  }
}

function getComposeEmailData(): EmailData {

  const subjectInput = document.querySelector<HTMLInputElement>(
    'input[aria-label="Add a subject"], input[aria-label="Subject"], input[role="textbox"][name="Subject"]'
  );

  const bodyDiv =
    document.querySelector<HTMLDivElement>(
      'div[aria-label="Message body"][contenteditable="true"]'
    ) ??
    document.querySelector<HTMLDivElement>(
      'div[role="textbox"][contenteditable="true"]'
    );

  console.log('[MailPilot Outlook] Compose - Subject input found:', !!subjectInput);
  console.log('[MailPilot Outlook] Compose - Body div found:', !!bodyDiv);
  console.log('[MailPilot Outlook] Compose - Subject value:', subjectInput?.value);
  console.log(
    '[MailPilot Outlook] Compose - Body text length:',
    bodyDiv?.innerText?.length
  );

  return {
    subject: subjectInput?.value ?? '',
    bodyHtml: bodyDiv?.innerHTML ?? '',
    bodyText: bodyDiv?.innerText ?? '',
  };
}

function getOpenedEmailData(): EmailData {

  const subjectEl =
    document.querySelector<HTMLElement>('div[role="heading"][aria-level="1"]') ??
    document.querySelector<HTMLElement>('span[role="heading"]');

  const bodyEl =
    document.querySelector<HTMLElement>(
      'div[aria-label="Message body"] div[role="document"]'
    ) ??
    document.querySelector<HTMLElement>(
      'div[aria-label="Message body"], div[role="document"]'
    );

  console.log('[MailPilot Outlook] Read - Subject element found:', !!subjectEl);
  console.log('[MailPilot Outlook] Read - Body element found:', !!bodyEl);
  console.log('[MailPilot Outlook] Read - Subject text:', subjectEl?.textContent);
  console.log(
    '[MailPilot Outlook] Read - Body text length:',
    bodyEl?.innerText?.length
  );

  return {
    subject: subjectEl?.textContent?.trim() ?? '',
    bodyHtml: bodyEl?.innerHTML ?? '',
    bodyText: bodyEl?.innerText ?? '',
  };
}

function getCurrentEmailData(): EmailData {

  const isCompose = document.querySelector(
    'input[aria-label="Add a subject"], input[aria-label="Subject"], input[role="textbox"][name="Subject"]'
  );
  console.log('[MailPilot Outlook] Is compose mode:', !!isCompose);

  const email = isCompose ? getComposeEmailData() : getOpenedEmailData();
  console.log('[MailPilot Outlook] Extracted email data:', email);

  return email;
}

function addMailPilotButtonNearSend(): void {
  if (!isExtensionContextValid()) return;

  const sendWrapper = document.querySelector<HTMLElement>(
    'div[data-testid="ComposeSendButton"]'
  );
  if (!sendWrapper) {
    console.log('[MailPilot Outlook] Send wrapper not found');
    return;
  }

  // Avoid duplicates
  if (sendWrapper.parentElement?.querySelector('.mailpilot-button')) {
    return;
  }

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'mailpilot-button';
  btn.style.marginLeft = '8px';
  btn.style.display = 'inline-flex';
  btn.style.alignItems = 'center';
  btn.style.justifyContent = 'center';
  btn.style.cursor = 'pointer';
  btn.style.border = '1px solid transparent'; // looks separate from Send
  btn.style.borderRadius = '4px';
  btn.style.background = 'transparent';

  const img = document.createElement('img');
    try {
    img.src = chrome.runtime.getURL('icons/icon32.png');
  } catch (err) {
    console.error('[MailPilot] Failed to get icon URL:', err);
    return; // Don't add button if we can't get the icon
  }
  img.alt = 'Mail Pilot';
  img.width = 24;
  img.height = 24;
  btn.appendChild(img);

  btn.addEventListener('click', () => {
    const email = getCurrentEmailData();
    chrome.runtime.sendMessage({ type: 'OPEN_SIDE_PANEL', payload: email });
  });

  const parent = sendWrapper.parentElement;
  if (parent) {
    // Insert AFTER the whole split button, not inside it
    parent.insertBefore(btn, sendWrapper.nextSibling);
  }
}



chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'APPLY_EMAIL') {
    const { subject, body } = message as { subject: string; body: string };

    console.log('[MailPilot Outlook] Applying email to Outlook web:', {
      subject,
      bodyPreview: body.slice(0, 120),
    });

    const subjectInput = document.querySelector<HTMLInputElement>(
      'input[aria-label="Add a subject"], input[aria-label="Subject"], input[role="textbox"][name="Subject"]'
    );
    if (subjectInput) {
      subjectInput.value = subject;
      subjectInput.dispatchEvent(new Event('input', { bubbles: true }));
      subjectInput.dispatchEvent(new Event('change', { bubbles: true }));
    }

    const bodyDiv =
      document.querySelector<HTMLDivElement>(
        'div[aria-label="Message body"][contenteditable="true"]'
      ) ??
      document.querySelector<HTMLDivElement>(
        'div[role="textbox"][contenteditable="true"]'
      );

    if (bodyDiv) {
        bodyDiv.focus();

        bodyDiv.style.fontFamily = 'Aptos, "Segoe UI", sans-serif';
        bodyDiv.style.margin = '0';
        bodyDiv.style.padding = '0';
        bodyDiv.style.lineHeight = 'normal';

        bodyDiv.innerHTML = '';

        const trimmedBody = body.trim();

        let formattedBody = trimmedBody
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/\n/g, '<br>');

        formattedBody = formattedBody.replace(/^(<br\s*\/?>)+/i, '');

        bodyDiv.textContent = '';
        bodyDiv.innerHTML = formattedBody;
        
        const firstChild = bodyDiv.firstChild;
        if (firstChild && firstChild.nodeType === Node.TEXT_NODE && firstChild.textContent?.trim() === '') {
            firstChild.remove();
        }

        bodyDiv.dispatchEvent(new Event('input', { bubbles: true }));
        bodyDiv.dispatchEvent(new Event('change', { bubbles: true }));
        bodyDiv.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter' }));
        bodyDiv.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'Enter' }));

        // setTimeout(() => {
        //     try {
        //         const selection = window.getSelection();
        //         if (selection && bodyDiv.contains(selection.anchorNode)) {
        //             const range = document.createRange();
        //             range.selectNodeContents(bodyDiv);
        //             selection.removeAllRanges();
        //             selection.addRange(range);
        //             document.execCommand('fontName', false, 'Aptos');
        //     }
        //     } catch (e) {
        //     console.log('[MailPilot Outlook] execCommand not available');
        //     }
        // }, 100);
    }
  }

  if (message?.type === 'GET_EMAIL_DATA') {
    const email = getCurrentEmailData();
    console.log('[MailPilot Outlook content] GET_EMAIL_DATA ->', email);
    sendResponse(email);
  }

  return false;
});

function watchForOutlookCompose() {
  const maybeAddButton = () => addMailPilotButtonNearSend();

  maybeAddButton();

  const observer = new MutationObserver(() => {
    if (!isExtensionContextValid()) {
      observer.disconnect();
      return;
    }
    maybeAddButton();
  });

  observer.observe(document.body, { childList: true, subtree: true });
}

watchForOutlookCompose();
