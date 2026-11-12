import { useState, type FormEvent } from 'react';
import { localDashboardPath, renameLocalWorkspace } from '@/backend/local-dashboard';
import { LocalConnectionsSection } from '../overlays/LocalConnectionsSection';
import { ROW_INPUT_CLS, RowButton, SettingsGroup, SettingsRow } from '../overlays/settings-shared';
import LocalDashboardDialog from './LocalDashboardDialog';

const PROFILE_KEY = 'revyme:local-profile';
const ACCOUNT_FIELDS = { firstName: '', lastName: '' };
const PUBLIC_FIELDS = { publicTag: '', bio: '', instagram: '', twitter: '', publicEmail: '', hidden: false };
type Profile = typeof ACCOUNT_FIELDS & typeof PUBLIC_FIELDS;

const ACCOUNT_PAGES = [['settings:account', 'Account'], ['settings:security', 'Security'], ['settings:api-tokens', 'API Tokens']] as const;
const WORKSPACE_PAGES = [['settings:details', 'General'], ['settings:members', 'Members'], ['settings:plans', 'Plans'], ['settings:credits', 'Credits'], ['settings:fonts', 'Fonts']] as const;

export function DashboardSettingsNavigation({ view, workspaceId }: { view?: string; workspaceId: string }) {
  const workspace = view === 'settings:ai' || WORKSPACE_PAGES.some(([path]) => view === path);
  const pages = workspace ? WORKSPACE_PAGES : ACCOUNT_PAGES;
  const tabs = [{ path: 'settings:account', label: 'Account', selected: !workspace }, { path: 'settings:details', label: 'Workspace', selected: workspace }];
  const rowClass = 'block rounded-md px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] aria-[current=page]:bg-[var(--bg-hover)] aria-[current=page]:font-semibold aria-[current=page]:text-[var(--text-primary)]';
  return (
    <aside aria-label="Dashboard settings" className="lg:w-[216px] lg:shrink-0">
      <a className="mb-3 block rounded-md px-3 py-1 text-xs hover:bg-[var(--bg-hover)]" href={localDashboardPath(workspaceId)}>
        <span aria-hidden="true" className="mr-2">←</span>Back to websites
      </a>
      <nav aria-label="Settings tabs" className="mb-4 grid grid-cols-2 rounded-md bg-[var(--grid-line)] p-0.5">
        {tabs.map(tab => (
          <a key={tab.path} href={localDashboardPath(workspaceId, tab.path)} aria-current={tab.selected ? 'true' : undefined}
            className="rounded px-2 py-1.5 text-center text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] aria-[current=true]:bg-[var(--bg-active)] aria-[current=true]:text-[var(--text-primary)]">{tab.label}</a>
        ))}
      </nav>
      <nav aria-label={workspace ? 'Workspace settings' : 'Account settings'} className="flex flex-col gap-0.5">
        <p className="mb-1 px-3 text-[10px] uppercase tracking-wide text-[var(--text-tertiary)]">{workspace ? 'Workspace' : 'General'}</p>
        {pages.map(([path, label]) => (
          <a key={path} className={rowClass} aria-current={view === path ? 'page' : undefined} href={localDashboardPath(workspaceId, path)}>{label}</a>
        ))}
      </nav>
      {workspace && <nav aria-label="Local settings" className="mt-4">
        <p className="mb-1 px-3 text-[10px] uppercase tracking-wide text-[var(--text-tertiary)]">Local</p>
        <a className={rowClass} aria-current={view === 'settings:ai' ? 'page' : undefined} href={localDashboardPath(workspaceId, 'settings:ai')}>AI &amp; MCP</a>
      </nav>}
    </aside>
  );
}

function readProfile(): Profile {
  const profile: Profile = { ...ACCOUNT_FIELDS, ...PUBLIC_FIELDS };
  try {
    const saved = JSON.parse(localStorage.getItem(PROFILE_KEY) ?? '{}');
    const { hidden: _hidden, ...textFields } = profile;
    for (const field of Object.keys(textFields) as Array<keyof typeof textFields>) {
      if (typeof saved?.[field] === 'string') profile[field] = saved[field];
    }
    if (typeof saved?.hidden === 'boolean') profile.hidden = saved.hidden;
  } catch { /* start with empty fields */ }
  return profile;
}

function AccountSettings() {
  const [profile, setProfile] = useState(readProfile);
  const [saved, setSaved] = useState(profile);
  const [status, setStatus] = useState('');
  const [failed, setFailed] = useState(false);

  function save(event: FormEvent, fields: Array<keyof Profile>) {
    event.preventDefault();
    try {
      const next = { ...readProfile(), ...Object.fromEntries(fields.map(field => [field, profile[field]])) };
      localStorage.setItem(PROFILE_KEY, JSON.stringify(next));
      setSaved(next);
      setFailed(false);
      setStatus('Profile saved in this browser.');
    } catch {
      setFailed(true);
      setStatus('Could not save the local profile.');
    }
  }

  const accountFields = Object.keys(ACCOUNT_FIELDS) as Array<keyof typeof ACCOUNT_FIELDS>;
  const publicFields = Object.keys(PUBLIC_FIELDS) as Array<keyof typeof PUBLIC_FIELDS>;
  const dirty = (fields: Array<keyof Profile>) => fields.some(field => profile[field] !== saved[field]);
  const saveClass = 'min-w-[72px] rounded-full bg-[var(--accent)] px-4 py-2 text-xs text-[var(--accent-fg)] disabled:bg-[var(--bg-hover)] disabled:text-[var(--text-disabled)]';
  function field(key: Exclude<keyof Profile, 'hidden' | 'bio'>, label: string, placeholder: string, type = 'text') {
    return <SettingsRow label={label} htmlFor={`local-profile-${key}`}>
      <input id={`local-profile-${key}`} type={type} value={profile[key]} placeholder={placeholder} maxLength={100} className={ROW_INPUT_CLS}
        onChange={event => { setStatus(''); setProfile({ ...profile, [key]: event.target.value }); }} />
    </SettingsRow>;
  }

  return (
    <div className="space-y-9">
      <form onSubmit={event => save(event, accountFields)}>
        <SettingsGroup title="Account Information" action={<button type="submit" aria-label="Save account information" disabled={!dirty(accountFields)} className={saveClass}>Save</button>}>
          <SettingsRow label="Email" interactive={false}><span className="text-sm text-[var(--text-secondary)]">Local account</span></SettingsRow>
          {field('firstName', 'First name', 'First name')}
          {field('lastName', 'Last name', 'Last name')}
        </SettingsGroup>
      </form>
      <form onSubmit={event => save(event, publicFields)}>
        <SettingsGroup title="Profile" action={<button type="submit" aria-label="Save profile" disabled={!dirty(publicFields)} className={saveClass}>Save</button>}>
          <SettingsRow label="Avatar" interactive={false}>
            <span aria-label="Profile initials" className="grid h-14 w-14 place-items-center rounded-full bg-[var(--accent)] text-2xl text-[var(--accent-fg)]">{(saved.firstName.trim()[0] || 'L').toUpperCase()}</span>
          </SettingsRow>
          {field('publicTag', 'Public tag', 'username')}
          <SettingsRow label="Bio" htmlFor="local-profile-bio" align="top">
            <textarea id="local-profile-bio" value={profile.bio} placeholder="Tell us about yourself…" maxLength={500} rows={2} className={`${ROW_INPUT_CLS} h-auto w-full py-2`}
              onChange={event => { setStatus(''); setProfile({ ...profile, bio: event.target.value }); }} />
          </SettingsRow>
          {field('instagram', 'Instagram', '@handle')}
          {field('twitter', 'X (Twitter)', '@handle')}
          {field('publicEmail', 'Public email', 'hello@example.com', 'email')}
          <SettingsRow label="Hide public profile" htmlFor="local-profile-hidden">
            <button id="local-profile-hidden" type="button" role="switch" aria-checked={profile.hidden} aria-label="Hide public profile"
              onClick={() => { setStatus(''); setProfile({ ...profile, hidden: !profile.hidden }); }}
              className="group relative h-5 w-10 rounded-full bg-[var(--bg-active)] aria-checked:bg-[var(--accent)]">
              <span className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white group-aria-checked:translate-x-5" />
            </button>
          </SettingsRow>
        </SettingsGroup>
      </form>
      {status && <p role={failed ? 'alert' : 'status'} className="px-3 text-xs">{status}</p>}
      <SettingsGroup title="Delete account">
        <SettingsRow label="Delete account" interactive={false}><span className="text-sm text-[var(--text-secondary)]">Account deletion requires a connected authentication service.</span></SettingsRow>
      </SettingsGroup>
    </div>
  );
}

function WorkspaceSettings({ workspace, onChanged }: { workspace: { id: string; name: string }; onChanged: () => void }) {
  const [name, setName] = useState(workspace.name);
  const [status, setStatus] = useState('');
  const [failed, setFailed] = useState(false);

  function save(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    try {
      renameLocalWorkspace(localStorage, workspace.id, name);
      setName(name.trim());
      setFailed(false);
      setStatus('Workspace name saved.');
      onChanged();
    } catch {
      setFailed(true);
      setStatus('Could not save the workspace name.');
    }
  }

  return (
    <form onSubmit={save} className="space-y-9">
      <SettingsGroup title="Identity" action={<button type="submit" aria-label="Save workspace" disabled={!name.trim() || name.trim() === workspace.name}
        className="min-w-[72px] rounded-full bg-[var(--accent)] px-4 py-2 text-xs text-[var(--accent-fg)] disabled:bg-[var(--bg-hover)] disabled:text-[var(--text-disabled)]">Save</button>}>
        <SettingsRow label="Workspace logo" interactive={false}>
          <span aria-label="Workspace initials" className="grid h-12 w-12 place-items-center rounded-md bg-[var(--accent)] text-sm font-semibold text-[var(--accent-fg)]">{workspace.name.charAt(0).toUpperCase()}</span>
        </SettingsRow>
        <SettingsRow label="Workspace name" htmlFor="local-workspace-name">
          <input id="local-workspace-name" value={name} maxLength={100} required className={`${ROW_INPUT_CLS} w-full`}
            onChange={event => { setStatus(''); setName(event.target.value); }} />
        </SettingsRow>
      </SettingsGroup>
      {status && <p role={failed ? 'alert' : 'status'} className="px-3 text-xs">{status}</p>}
      <SettingsGroup title="Danger zone">
        <SettingsRow label="Delete this workspace" interactive={false}><span className="text-sm text-[var(--text-secondary)]">Workspace deletion is unavailable in local mode.</span></SettingsRow>
      </SettingsGroup>
    </form>
  );
}

function TokenSettings() {
  const [open, setOpen] = useState(false);
  return (
    <SettingsGroup title="MCP tokens">
      <SettingsRow label="About" interactive={false}>
        <p className="text-sm text-[var(--text-secondary)]">MCP tokens authorize AI assistants to access your projects through the project’s MCP endpoint. Connect a local MCP server to issue and manage tokens.</p>
      </SettingsRow>
      <SettingsRow label="" interactive={false}>
        <button type="button" onClick={() => setOpen(true)} className="text-sm text-[var(--accent-text)] hover:underline">＋ Create MCP token</button>
      </SettingsRow>
      {open && <LocalDashboardDialog title="Create MCP token" onClose={() => setOpen(false)}>
        <div className="grid gap-3 text-sm">
          <label htmlFor="local-token-name">Token name</label>
          <input id="local-token-name" maxLength={100} placeholder="e.g. Codex" className={ROW_INPUT_CLS} />
          <label htmlFor="local-token-expiry">Expiration</label>
          <select id="local-token-expiry" defaultValue="30" className={ROW_INPUT_CLS}>
            <option value="7">7 days</option><option value="30">30 days</option><option value="90">90 days</option>
          </select>
          <p className="text-xs text-[var(--text-secondary)]">Token creation requires the local MCP server.</p>
          <RowButton disabled onClick={() => {}}>Create token</RowButton>
        </div>
      </LocalDashboardDialog>}
    </SettingsGroup>
  );
}

function SecuritySettings() {
  return <div className="space-y-9">
    <SettingsGroup title="Sign-in methods">
      <SettingsRow label="Email magic link" interactive={false}><span className="text-sm text-[var(--text-secondary)]">Unavailable in local mode</span></SettingsRow>
      <SettingsRow label="Google" interactive={false}><span className="text-sm text-[var(--text-secondary)]">Not linked</span></SettingsRow>
    </SettingsGroup>
    <SettingsGroup title="Active sessions">
      <p className="px-3 py-3 text-sm text-[var(--text-secondary)]">This installation has no authenticated sessions.</p>
    </SettingsGroup>
  </div>;
}

function MembersSettings({ onInvite }: { onInvite: () => void }) {
  return <div className="space-y-9">
    <SettingsGroup title="Members">
      <p className="px-3 py-3 text-sm text-[var(--text-secondary)]">The workspace is available in this browser. A membership list requires local authentication.</p>
    </SettingsGroup>
    <SettingsGroup title="Seats">
      <SettingsRow label="Paid members" interactive={false}>
        <div className="flex items-center justify-between gap-3 text-sm text-[var(--text-secondary)]">
          <span>Seat management requires billing.</span><RowButton disabled onClick={() => {}}>Add seat</RowButton>
        </div>
      </SettingsRow>
    </SettingsGroup>
    <SettingsGroup title="Invite members">
      <SettingsRow label="Shareable link" interactive={false}>
        <div className="flex items-center justify-between gap-3 text-sm text-[var(--text-secondary)]">
          <span>Available after workspace authentication is connected.</span><RowButton disabled onClick={() => {}}>Copy</RowButton>
        </div>
      </SettingsRow>
      <SettingsRow label="Send invites"><RowButton onClick={onInvite}>Invite to workspace</RowButton></SettingsRow>
      <SettingsRow label="Pending invites" interactive={false}><span className="text-sm text-[var(--text-secondary)]">Invitation service unavailable.</span></SettingsRow>
    </SettingsGroup>
  </div>;
}

function FontsSettings() {
  const [open, setOpen] = useState(false);
  return <div className="space-y-9">
    <SettingsGroup title="Custom fonts">
      <SettingsRow label="Library" interactive={false}>
        <p className="text-sm text-[var(--text-secondary)]">Add licensed WOFF2, WOFF, OTF, or TTF files to your workspace font library.</p>
      </SettingsRow>
      <SettingsRow label="Add a font"><RowButton variant="accent" onClick={() => setOpen(true)}>＋ Upload font</RowButton></SettingsRow>
    </SettingsGroup>
    <SettingsGroup title="Installed">
      <p className="px-3 py-3 text-sm text-[var(--text-secondary)]">Workspace font storage is unavailable in local mode.</p>
    </SettingsGroup>
    {open && <LocalDashboardDialog title="Upload font" onClose={() => setOpen(false)}>
      <div className="grid gap-3 text-sm">
        <label htmlFor="workspace-font-file">Font file</label>
        <input id="workspace-font-file" type="file" accept=".woff2,.woff,.otf,.ttf" className={ROW_INPUT_CLS} />
        <p className="text-xs text-[var(--text-secondary)]">Uploading requires a workspace font library.</p>
        <RowButton disabled onClick={() => {}}>Upload</RowButton>
      </div>
    </LocalDashboardDialog>}
  </div>;
}

export default function LocalDashboardSettings({ view, workspace, onWorkspaceChanged, onInvite }: {
  view: string | undefined;
  workspace: { id: string; name: string };
  onWorkspaceChanged: () => void;
  onInvite: () => void;
}) {
  if (view === 'settings:ai') return <LocalConnectionsSection />;
  if (view === 'settings:api-tokens') return <TokenSettings />;
  if (view === 'settings:details') return <WorkspaceSettings workspace={workspace} onChanged={onWorkspaceChanged} />;
  if (view === 'settings:security') return <SecuritySettings />;
  if (view === 'settings:members') return <MembersSettings onInvite={onInvite} />;
  if (view === 'settings:fonts') return <FontsSettings />;
  if (view === 'settings:plans') return <SettingsGroup title="Plans">
    <SettingsRow label="Current plan" interactive={false}><span className="text-sm">Local installation</span></SettingsRow>
    <SettingsRow label="Billing" interactive={false}><span className="text-sm text-[var(--text-secondary)]">Plans and payments require a billing service.</span></SettingsRow>
  </SettingsGroup>;
  if (view === 'settings:credits') return <SettingsGroup title="Credits">
    <SettingsRow label="Credit balance" interactive={false}><span className="text-sm text-[var(--text-secondary)]">Credit metering is unavailable in local mode.</span></SettingsRow>
  </SettingsGroup>;
  return <AccountSettings />;
}
