import { useEffect, useState } from 'react';

export function SidePanelApp() {
  const [draft, setDraft] = useState('');
  const [suggestion, setSuggestion] = useState('');

  useEffect(() => {
        chrome.storage.local.get(
            'mailpilotDraft',
            (data: { mailpilotDraft?: string }) => {
            setDraft(data.mailpilotDraft ?? '');
            },
        );
    }, []);

  const handleGenerate = async () => {
    // TODO: call your AI backend or local logic; for now, fake it
    setSuggestion(`AI suggestion based on:\n\n${draft}`);
  };

  const handleApply = () => {
    chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
      const tabId = tabs[0]?.id;
      if (!tabId) return;

      chrome.tabs.sendMessage(tabId, {
        type: 'MAILPILOT_APPLY',
        text: suggestion || draft,
      });
    });
  };

  return (
    <div style={{ padding: 12, fontFamily: 'system-ui', fontSize: 14 }}>
      <h2>Mail Pilot</h2>
      <p>Draft from Gmail:</p>
      <textarea
        style={{ width: '100%', height: 120, marginBottom: 8 }}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
      />
      <button onClick={handleGenerate}>Generate with AI</button>

      <p style={{ marginTop: 12 }}>Suggestion:</p>
      <textarea
        style={{ width: '100%', height: 120, marginBottom: 8 }}
        value={suggestion}
        onChange={(e) => setSuggestion(e.target.value)}
      />
      <button onClick={handleApply} disabled={!suggestion && !draft}>
        Insert into email
      </button>
    </div>
  );
}