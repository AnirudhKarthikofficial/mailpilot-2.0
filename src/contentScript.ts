function getDraftBodyFromCompose(composeEl: HTMLElement | null): string {
  if (!composeEl) return '';
  const editor =
    composeEl.querySelector<HTMLElement>(
      '[aria-label="Message Body"], div[contenteditable="true"]',
    );
  if (!editor) return '';
  return editor.innerText || editor.textContent || '';
}

function addMailPilotButton(anchorEl: HTMLElement) {
  const composeRow = anchorEl.closest('.btC');
  if (!composeRow) return;

  // Work at the table-cell level
  const td = anchorEl.closest('td') as HTMLTableCellElement | null;
  if (!td) return;

  // Avoid duplicates: if we've already inserted a Mail Pilot cell in this row, bail
  if (composeRow.querySelector('td.mailpilot-cell')) return;

  console.log('[MailPilot] Adding Mail Pilot cell next to Aa', td);

  // Clone the Aa <td> but without its children, so we get identical sizing/hover behavior
  const mailpilotTd = td.cloneNode(false) as HTMLTableCellElement;
  mailpilotTd.classList.add('mailpilot-cell');

  // Now put our own content inside this new cell
  const btn = document.createElement('div');
  btn.className = 'mailpilot-button';
  btn.style.cursor = 'pointer';
  btn.style.userSelect = 'none';
  btn.style.display = 'flex';
  btn.style.alignItems = 'center';
  btn.style.justifyContent = 'center';

  btn.style.marginLeft = '4px';
  btn.style.marginRight = '4px';

  const img = document.createElement('img');
  const iconUrl = chrome.runtime.getURL('icons/icon32.png');
  img.src = iconUrl;
  img.alt = 'Mail Pilot';
  img.width = 25;
  img.height = 25;
  img.style.width = '25px';
  img.style.height = '25px';
  img.style.display = 'block';
  img.style.objectFit = 'contain';
  img.style.filter = 'none';

  btn.appendChild(img);
  mailpilotTd.appendChild(btn);

  btn.addEventListener('click', () => {
    const compose = composeRow.closest<HTMLElement>(
      'div[role="dialog"], div[role="region"]',
    );
    const body = getDraftBodyFromCompose(compose || null);
    chrome.runtime.sendMessage({ type: 'MAILPILOT_OPEN', body });
  });

  const tr = td.parentElement;
  if (tr && tr.tagName === 'TR') {
    tr.insertBefore(mailpilotTd, td);
  }
}

function findComposeAnchors(root: ParentNode): HTMLElement[] {
  const anchors: HTMLElement[] = [];

  // Each compose row is `.btC`
  const rows = root.querySelectorAll<HTMLElement>('.btC');
  rows.forEach((row) => {
    // Your snippet: <div class="dv"><div class="a3I">...</div></div>
    const dvNodes = row.querySelectorAll<HTMLElement>('div.dv > div.a3I');
    dvNodes.forEach((a3I) => {
      const dv = a3I.parentElement as HTMLElement | null;
      if (dv) anchors.push(dv);
    });
  });

  console.log('[MailPilot] Found dv/a3I anchors:', anchors.length);
  return anchors;
}

function watchForGmailCompose() {
  const maybeAddButtons = (root: ParentNode) => {
    const anchors = findComposeAnchors(root);
    anchors.forEach(addMailPilotButton);
  };

  // Initial pass
  maybeAddButtons(document);

  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      m.addedNodes.forEach((node) => {
        if (node instanceof HTMLElement || node instanceof DocumentFragment) {
          maybeAddButtons(node);
        }
      });
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
}

function handleApplyMessage() {
  chrome.runtime.onMessage.addListener(
    (message: { type?: string; text?: string }, _sender: chrome.runtime.MessageSender) => {
      if (message.type === 'MAILPILOT_APPLY') {
        const compose = document.querySelector<HTMLElement>(
          'div[role="dialog"], div[role="region"]',
        );
        if (!compose) return;
        const editor =
          compose.querySelector<HTMLElement>(
            '[aria-label="Message Body"], div[contenteditable="true"]',
          );
        if (!editor) return;
        editor.focus();
        editor.innerText = message.text ?? '';
      }
    },
  );
}

(function init() {
  try {
    console.log('[MailPilot] content script init');
    watchForGmailCompose();
    handleApplyMessage();
  } catch (e) {
    console.error('Mail Pilot content script error', e);
  }
})();