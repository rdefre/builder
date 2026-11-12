import { useState, type FormEvent } from 'react';
import { ROW_INPUT_CLS, RowButton, SettingsGroup, SettingsRow } from '../overlays/settings-shared';

interface Draft {
  id: string;
  websiteId: string;
  title: string;
  description: string;
}

const EMPTY_DRAFT: Draft = { id: '', websiteId: '', title: '', description: '' };

function readDrafts(prefix: string): Draft[] {
  const drafts: Draft[] = [];
  for (let index = 0; index < localStorage.length; index++) {
    const key = localStorage.key(index);
    if (!key?.startsWith(prefix)) continue;
    try {
      const draft = JSON.parse(localStorage.getItem(key) ?? 'null') as Draft | null;
      if (draft && key === prefix + draft.id && typeof draft.websiteId === 'string'
        && typeof draft.title === 'string' && typeof draft.description === 'string') drafts.push(draft);
    } catch { /* leave an unreadable draft in storage */ }
  }
  return drafts.sort((a, b) => a.title.localeCompare(b.title));
}

export default function LocalCreator({ workspaceId, websites }: {
  workspaceId: string;
  websites: Array<{ id: string; name: string }>;
}) {
  const prefix = `revyme:local-creator:${workspaceId}:`;
  const [draft, setDraft] = useState<Draft | null>(null);
  const [message, setMessage] = useState('');
  const [failed, setFailed] = useState(false);
  let drafts: Draft[] = [];
  let storageAvailable = true;
  try { drafts = readDrafts(prefix); }
  catch { storageAvailable = false; }

  function save(event: FormEvent) {
    event.preventDefault();
    if (!draft?.title.trim() || !websites.some(website => website.id === draft.websiteId)) return;
    try {
      const saved = { ...draft, id: draft.id || crypto.randomUUID(), title: draft.title.trim() };
      localStorage.setItem(prefix + saved.id, JSON.stringify(saved));
      setDraft(saved);
      setFailed(false);
      setMessage('Template draft saved in this browser.');
    } catch {
      setFailed(true);
      setMessage('Could not save this draft.');
    }
  }

  return (
    <div className="max-w-3xl space-y-5">
      <SettingsGroup title="Templates" action={<RowButton disabled={!storageAvailable || !websites.length} onClick={() => { setDraft(EMPTY_DRAFT); setMessage(''); }}>New template draft</RowButton>}>
        {!storageAvailable && <p role="alert" className="px-3 py-3 text-xs">Browser storage is unavailable.</p>}
        {storageAvailable && !drafts.length && <p className="px-3 py-3 text-xs text-[var(--text-secondary)]">{websites.length ? 'No template drafts yet.' : 'Create a website in this workspace to start a template draft.'}</p>}
        {drafts.map(item => (
          <SettingsRow key={item.id} label={item.title}>
            <RowButton onClick={() => { setDraft(item); setMessage(''); }}>Edit draft</RowButton>
          </SettingsRow>
        ))}
      </SettingsGroup>
      {draft && <form onSubmit={save}>
        <SettingsGroup title={draft.id ? 'Edit template draft' : 'New template draft'}>
          <SettingsRow label="Source website" htmlFor="creator-site">
            <select id="creator-site" required value={draft.websiteId} className={`${ROW_INPUT_CLS} w-full`}
              onChange={event => {
                const websiteId = event.target.value;
                const website = websites.find(site => site.id === websiteId);
                setDraft({ ...draft, websiteId, title: draft.title || website?.name || '' });
                setMessage('');
              }}>
              <option value="">Select a website</option>
              {draft.websiteId && !websites.some(website => website.id === draft.websiteId)
                && <option value={draft.websiteId} disabled>Source website unavailable</option>}
              {websites.map(site => <option key={site.id} value={site.id}>{site.name}</option>)}
            </select>
          </SettingsRow>
          <SettingsRow label="Template name" htmlFor="creator-title">
            <input id="creator-title" required maxLength={100} value={draft.title} className={`${ROW_INPUT_CLS} w-full`}
              onChange={event => { setDraft({ ...draft, title: event.target.value }); setMessage(''); }} />
          </SettingsRow>
          <SettingsRow label="Description" htmlFor="creator-description" align="top">
            <textarea id="creator-description" rows={4} maxLength={1000} value={draft.description} className={`${ROW_INPUT_CLS} h-auto w-full py-2`}
              onChange={event => { setDraft({ ...draft, description: event.target.value }); setMessage(''); }} />
          </SettingsRow>
        </SettingsGroup>
        <div className="flex flex-wrap items-center gap-3 px-3 pt-3">
          <button type="submit" disabled={!draft.title.trim() || !websites.some(website => website.id === draft.websiteId)}
            className="rounded-full bg-[var(--accent)] px-4 py-2 text-xs text-[var(--accent-fg)] disabled:opacity-50">Save draft</button>
          <button type="button" disabled className="rounded-full bg-[var(--bg-hover)] px-4 py-2 text-xs opacity-50">Submit for review</button>
          <p className="text-xs text-[var(--text-secondary)]">Review and publishing require the marketplace backend.</p>
        </div>
        {message && <p role={failed ? 'alert' : 'status'} className="px-3 pt-3 text-xs">{message}</p>}
      </form>}
    </div>
  );
}
