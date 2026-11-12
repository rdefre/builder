import { useEffect, useRef, useState, type FormEvent } from 'react';
import { LocalBackend } from '@/backend/local-backend';
import {
  archiveLocalWebsite, createLocalFolder, createLocalWorkspace, DEFAULT_LOCAL_WORKSPACE, duplicateLocalWebsite,
  listLocalFolders, listLocalWebsites, listLocalWorkspaces, localDashboardPath as dashboardLink,
  newLocalWebsiteId, placeLocalWebsite, renameLocalWebsite, setLocalColorMode,
} from '@/backend/local-dashboard';
import { PROJECT_FORMAT } from '@/backend/types';
import DropdownMenu, { type DropdownMenuEntry } from '@/design-system/DropdownMenu';
import { InsertPlusIcon, SettingsWebsiteIcon, ThemeMoonIcon, ThemeSunIcon } from '@/shared/icons';
import { trace } from '@/shared/debug-trace';
import { ROW_INPUT_CLS, RowButton } from '../overlays/settings-shared';
import LocalCreator from './LocalCreator';
import LocalDashboardDialog from './LocalDashboardDialog';
import LocalDashboardSettings, { DashboardSettingsNavigation } from './LocalDashboardSettings';

type NameAction = { type: 'workspace' | 'website' | 'folder' } | { type: 'rename'; id: string; name: string };
type DashboardDialog = { type: 'invite' | 'sign-out' } | { type: 'remix'; website: string };

function DashboardActionDialog({ action, workspace, onClose }: {
  action: DashboardDialog;
  workspace: string;
  onClose: () => void;
}) {
  if (action.type === 'invite') return (
    <LocalDashboardDialog title="Invite to workspace" onClose={onClose}>
      <div className="grid gap-3 text-sm">
        <p className="text-xs text-[var(--text-secondary)]">Workspace: {workspace}</p>
        <label htmlFor="invite-email">Email address</label>
        <input id="invite-email" type="email" autoComplete="off" maxLength={254} placeholder="name@example.com" className={ROW_INPUT_CLS} />
        <label htmlFor="invite-role">Role</label>
        <select id="invite-role" defaultValue="editor" className={ROW_INPUT_CLS}>
          <option value="admin">Admin</option><option value="editor">Editor</option><option value="viewer">Viewer</option>
        </select>
        <p className="text-xs text-[var(--text-secondary)]">Sending invitations requires workspace authentication and email delivery.</p>
        <RowButton disabled onClick={() => {}}>Send invite</RowButton>
      </div>
    </LocalDashboardDialog>
  );

  if (action.type === 'remix') return (
    <LocalDashboardDialog title="Copy Remix Link" onClose={onClose}>
      <div className="grid gap-3 text-sm">
        <p>Share an editable copy of {action.website}.</p>
        <p className="text-xs text-[var(--text-secondary)]">Creating a shareable remix link requires the template sharing service.</p>
        <RowButton disabled onClick={() => {}}>Create remix link</RowButton>
      </div>
    </LocalDashboardDialog>
  );

  return (
    <LocalDashboardDialog title="Sign out" onClose={onClose}>
      <div className="grid gap-3 text-sm">
        <p className="text-xs text-[var(--text-secondary)]">This installation has no active account session. Sign-out becomes available when local authentication is connected.</p>
        <RowButton disabled onClick={() => {}}>Sign out</RowButton>
      </div>
    </LocalDashboardDialog>
  );
}

function builderLink(id: string) {
  return id === 'local' ? '/' : `/builder/${encodeURIComponent(id)}`;
}

function WebsiteCard({ site, actions }: { site: ReturnType<typeof listLocalWebsites>[number]; actions: DropdownMenuEntry[] }) {
  const menu = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  return (
    <article className="min-w-0">
      <a aria-label={`Open ${site.name}`} href={builderLink(site.id)} className="group grid aspect-[3/4] place-items-center rounded-md bg-[var(--grid-line)] hover:bg-[var(--bg-hover)]">
        <img alt="" src="/favicon.svg" width={36} height={36} className="opacity-30 grayscale transition-opacity group-hover:opacity-60" />
      </a>
      <div className="mt-2 flex items-center gap-2">
        <a href={builderLink(site.id)} className="min-w-0 flex-1 truncate text-sm font-medium hover:underline">{site.name}</a>
        <button ref={menu} type="button" aria-label={`Actions for ${site.name}`} aria-expanded={open} onClick={() => setOpen(!open)} className="px-2 text-lg leading-6 text-[var(--text-secondary)] hover:text-[var(--text-primary)]">⋯</button>
      </div>
      {site.updated > 0 && <p className="mt-0.5 text-xs text-[var(--text-secondary)]">Updated {new Date(site.updated).toLocaleDateString()}</p>}
      <DropdownMenu isOpen={open} onClose={() => setOpen(false)} anchorRef={menu} position="bottom-right" items={actions} />
    </article>
  );
}

export default function LocalDashboard() {
  const params = new URLSearchParams(window.location.search);
  const requestedWorkspace = params.get('ws');
  const requestedView = params.get('view');
  const view = requestedView === 'settings:workspace' ? 'settings:details' : requestedView ?? undefined;
  const settings = view?.startsWith('settings:') ?? false;
  const creator = view === 'creator';
  const archived = view === 'archive';
  const anchor = useRef<HTMLButtonElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'));
  const [action, setAction] = useState<NameAction | null>(null);
  const [dialog, setDialog] = useState<DashboardDialog | null>(null);
  const [name, setName] = useState('');
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [, setRevision] = useState(0);
  const refresh = () => setRevision(current => current + 1);
  useEffect(() => {
    window.addEventListener('storage', refresh);
    window.addEventListener('pageshow', refresh);
    return () => {
      window.removeEventListener('storage', refresh);
      window.removeEventListener('pageshow', refresh);
    };
  }, []);

  let workspaces = [{ id: DEFAULT_LOCAL_WORKSPACE, name: 'Local Workspace' }];
  let workspace = workspaces[0];
  let sites: ReturnType<typeof listLocalWebsites> = [];
  let folders: ReturnType<typeof listLocalFolders> = [];
  let storageBlocked = false;
  try {
    workspaces = listLocalWorkspaces(localStorage);
    workspace = workspaces.find(ws => ws.id === requestedWorkspace) ?? workspaces[0];
    sites = listLocalWebsites(localStorage, workspace.id);
    folders = listLocalFolders(localStorage, workspace.id);
  } catch { storageBlocked = true; }
  const folder = folders.find(f => view === `folder:${f.id}`);
  const visibleSites = sites.filter(site => site.archived === archived && (!folder || site.folder === folder.id)
    && site.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));

  function start(next: NameAction) {
    setError('');
    setName(next.type === 'rename' ? next.name : '');
    setAction(next);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!action || !name.trim() || busy) return;
    setBusy(true);
    setError('');
    try {
      if (action.type === 'workspace') {
        window.location.assign(dashboardLink(createLocalWorkspace(localStorage, name)));
      } else if (action.type === 'folder') {
        const id = createLocalFolder(localStorage, workspace.id, name);
        window.location.assign(dashboardLink(workspace.id, `folder:${id}`));
      } else if (action.type === 'website') {
        const { createEmptyProject } = await import('@/code/project/project-fs');
        const id = newLocalWebsiteId(localStorage, workspace.id, folder?.id);
        renameLocalWebsite(localStorage, id, name);
        await new LocalBackend().saveProject(id, { format: PROJECT_FORMAT, files: Object.fromEntries(createEmptyProject()) });
        trace.action('local-dashboard:created-website');
        window.location.assign(builderLink(id));
      } else if (action.type === 'rename') {
        renameLocalWebsite(localStorage, action.id, name);
        refresh();
        setAction(null);
      }
    } catch {
      setError('Could not save the change. Check that browser storage is available and has free space.');
      trace.error('local-dashboard:save-failed', { type: action.type });
    } finally { setBusy(false); }
  }

  function updateWebsite(operation: () => void, done: string) {
    setError('');
    setNotice('');
    try { operation(); refresh(); setNotice(done); }
    catch { setError('Could not update this website. Check that browser storage is available and has free space.'); }
  }

  function siteActions(site: typeof sites[number]): DropdownMenuEntry[] {
    const href = builderLink(site.id);
    return [
      { id: 'open', label: 'Open in New Tab', onClick: () => { window.open(href, '_blank', 'noopener'); } },
      { id: 'copy', label: 'Copy Link', onClick: () => {
        setNotice('');
        setError('');
        if (!navigator.clipboard) { setError('Clipboard access is unavailable.'); return; }
        void navigator.clipboard.writeText(new URL(href, location.origin).href)
          .then(() => setNotice('Local link copied.')).catch(() => setError('Could not copy the link.'));
      } },
      { id: 'remix', label: 'Copy Remix Link', onClick: () => setDialog({ type: 'remix', website: site.name }) },
      { id: 'duplicate', label: 'Duplicate', onClick: () => updateWebsite(() => duplicateLocalWebsite(localStorage, site.id, site.name, workspace.id, site.folder), 'Website duplicated.') },
      ...(folders.length && !site.archived ? [{
        id: 'move', label: 'Move', onClick: () => {}, submenuItems: [
          { id: 'unfiled', label: 'No folder', onClick: () => updateWebsite(() => placeLocalWebsite(localStorage, site.id, null), 'Website removed from folder.') },
          ...folders.map(f => ({ id: f.id, label: f.name, onClick: () => updateWebsite(() => placeLocalWebsite(localStorage, site.id, f.id), 'Website moved.') })),
        ],
      }] : []),
      { id: 'rename', label: 'Rename', onClick: () => start({ type: 'rename', id: site.id, name: site.name }) },
      { id: 'archive', label: site.archived ? 'Restore' : 'Archive', onClick: () => updateWebsite(() => archiveLocalWebsite(localStorage, site.id, !site.archived), site.archived ? 'Website restored.' : 'Website archived.') },
    ];
  }

  const items: DropdownMenuEntry[] = [
    ...workspaces.map(ws => ({
      id: `workspace-${ws.id}`, label: ws.name,
      trailingIcon: ws.id === workspace.id ? <span aria-label="Current workspace">✓</span> : undefined,
      onClick: () => window.location.assign(dashboardLink(ws.id, settings || creator ? view : undefined)),
    })),
    { type: 'separator' },
    { id: 'add', label: 'Add workspace', icon: <InsertPlusIcon className="w-4 h-4" />, disabled: storageBlocked, onClick: () => start({ type: 'workspace' }) },
    { id: 'invite', label: 'Invite to workspace', onClick: () => setDialog({ type: 'invite' }) },
    { type: 'separator' },
    { id: 'creator', label: creator ? 'Switch to Websites' : 'Switch to Creator', onClick: () => window.location.assign(dashboardLink(workspace.id, creator ? undefined : 'creator')) },
    { type: 'separator' },
    { id: 'theme', label: dark ? 'Light mode' : 'Dark mode', icon: dark ? <ThemeSunIcon className="w-4 h-4" /> : <ThemeMoonIcon className="w-4 h-4" />, onClick: () => {
      try { setLocalColorMode(!dark); setDark(!dark); }
      catch { setError('Could not save the appearance preference.'); }
    } },
    { id: 'settings', label: 'Settings', icon: <SettingsWebsiteIcon size={16} />, onClick: () => window.location.assign(dashboardLink(workspace.id, 'settings:account')) },
    { type: 'separator' },
    { id: 'sign-out', label: 'Sign out', onClick: () => setDialog({ type: 'sign-out' }) },
  ];

  const title = action?.type === 'workspace' ? 'Add workspace' : action?.type === 'folder' ? 'New folder' : action?.type === 'rename' ? 'Rename website' : 'New website';
  const navClass = 'rounded px-3 py-2 hover:bg-[var(--bg-hover)] aria-[current=page]:bg-[var(--bg-active)]';
  return (
    <div className="h-full overflow-y-auto bg-[var(--bg-surface)] text-[var(--text-primary)] md:flex">
      <aside className="shrink-0 border-b border-[var(--border-light)] p-3 md:w-[252px] md:border-b-0 md:border-r" aria-label="Workspace navigation">
        <button ref={anchor} type="button" aria-label="Workspace menu" aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)} className="flex h-11 w-full items-center gap-2 rounded-md px-2 text-left text-sm font-semibold hover:bg-[var(--bg-hover)]">
          <span aria-hidden="true" className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-[var(--accent)] text-[var(--accent-fg)]">{workspace.name.charAt(0).toUpperCase()}</span>
          <span className="flex-1 truncate">{workspace.name}</span><span aria-hidden="true" className="text-[var(--text-secondary)]">⌄</span>
        </button>
        <DropdownMenu isOpen={menuOpen} onClose={() => setMenuOpen(false)} anchorRef={anchor} items={items} matchAnchorWidth />
        {!creator && <>
        <input type="search" aria-label="Search websites" placeholder="Search…" value={query} onChange={event => setQuery(event.target.value)} disabled={settings} className={`${ROW_INPUT_CLS} my-3 h-[34px] w-full rounded-md bg-[var(--grid-line)] px-3 text-xs`} />
        <button type="button" disabled={storageBlocked} onClick={() => start({ type: 'website' })} className="flex h-9 w-full items-center justify-center gap-2 rounded-md bg-[var(--accent)] text-xs font-semibold text-[var(--accent-fg)] disabled:opacity-50"><InsertPlusIcon className="w-4 h-4" />New Website</button>
        <nav aria-label="Projects" className="mt-4 flex flex-col gap-1 border-t border-[var(--border-light)] pt-3 text-sm">
          <span className="px-3 py-1 text-[10px] uppercase tracking-wide text-[var(--text-secondary)]">Projects</span>
          <a href={dashboardLink(workspace.id)} aria-current={!settings && !archived && !folder ? 'page' : undefined} className={`${navClass} ${settings ? 'bg-[var(--bg-hover)]' : ''}`}>All</a>
          <a href={dashboardLink(workspace.id, 'archive')} aria-current={archived ? 'page' : undefined} className={navClass}>Archive</a>
          {folders.map(f => <a key={f.id} href={dashboardLink(workspace.id, `folder:${f.id}`)} aria-current={folder?.id === f.id ? 'page' : undefined} className={`${navClass} truncate`}>{f.name}</a>)}
          <button type="button" disabled={storageBlocked || settings} onClick={() => start({ type: 'folder' })} className={`${navClass} text-left text-[var(--text-secondary)] disabled:opacity-50`}>New Folder…</button>
        </nav>
        </>}
        {creator && <nav aria-label="Creator" className="mt-4 border-t border-[var(--border-light)] pt-3 text-sm">
          <a href={dashboardLink(workspace.id)} className={`block ${navClass}`}>Back to websites</a>
          <a href={dashboardLink(workspace.id, 'creator')} aria-current="page" className={`block ${navClass}`}>Templates</a>
        </nav>}
      </aside>
      <main className="min-w-0 flex-1 px-5 py-5 md:px-8">
        <header className={settings ? 'sr-only' : 'mb-4 flex flex-wrap items-center justify-between gap-2'}>
          <h1 className="text-sm font-medium">{settings ? 'Local Settings' : creator ? 'Creator' : `${visibleSites.length} website${visibleSites.length === 1 ? '' : 's'}`}</h1>
        </header>
        {storageBlocked && <p role="alert" className="mb-4 text-sm">Browser storage is unavailable.</p>}
        {error && <p role="alert" className="mb-4 text-sm">{error}</p>}
        {notice && <p role="status" className="mb-4 text-sm">{notice}</p>}
        {action && <form onSubmit={submit} className="mb-6 max-w-md rounded border border-[var(--border-light)] p-4">
          <label className="mb-2 block text-sm font-medium" htmlFor="dashboard-name">{title}</label>
          <input autoFocus id="dashboard-name" value={name} onChange={e => setName(e.target.value)} maxLength={100} className={`${ROW_INPUT_CLS} w-full`} required />
          <div className="mt-3 flex gap-3">
            <button type="submit" disabled={busy || !name.trim()} className="rounded px-3 py-1.5 text-sm bg-[var(--accent)] text-[var(--accent-fg)] disabled:opacity-50">{action.type === 'rename' ? 'Save name' : 'Create'}</button>
            <button type="button" disabled={busy} onClick={() => { setAction(null); setError(''); }} className="rounded px-3 py-1.5 text-sm hover:bg-[var(--bg-hover)]">Cancel</button>
          </div>
        </form>}
        {settings ? <div className="flex flex-col gap-5 pt-2 lg:flex-row lg:gap-9">
          <DashboardSettingsNavigation view={view} workspaceId={workspace.id} />
          <section className="min-w-0 w-full max-w-[768px] lg:flex-1">
            <LocalDashboardSettings view={view} workspace={workspace} onWorkspaceChanged={refresh} onInvite={() => setDialog({ type: 'invite' })} />
          </section>
        </div> : creator ? <LocalCreator workspaceId={workspace.id} websites={sites.filter(site => !site.archived)} /> : visibleSites.length ? (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,240px),280px))] gap-5">
            {visibleSites.map(site => <WebsiteCard key={site.id} site={site} actions={siteActions(site)} />)}
          </div>
        ) : !storageBlocked && <p className="text-sm text-[var(--text-secondary)]">{query ? 'No websites match your search.' : archived ? 'No archived websites.' : folder ? 'No websites in this folder yet.' : 'No websites in this workspace yet.'}</p>}
      </main>
      {dialog && <DashboardActionDialog action={dialog} workspace={workspace.name} onClose={() => setDialog(null)} />}
    </div>
  );
}
