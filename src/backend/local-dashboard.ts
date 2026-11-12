import { LOCAL_PROJECT_PREFIX } from './local-backend';
import { PROJECT_NAME_PREFIX } from '@/code/stores/project-store';

export const DEFAULT_LOCAL_WORKSPACE = 'local';
const WORKSPACE_PREFIX = 'revyme:local-workspace:';
const MEMBERSHIP_PREFIX = 'revyme:local-project-workspace:';
const FOLDER_PREFIX = 'revyme:local-folder:';
const SITE_FOLDER_PREFIX = 'revyme:local-website-folder:';
const ARCHIVED_PREFIX = 'revyme:local-archived:';
const THEME_KEY = 'revyme:local-color-mode';
const isId = (value: string) => /^[A-Za-z0-9_-]+$/.test(value);
const freshId = () => typeof crypto.randomUUID === 'function' ? crypto.randomUUID()
  : `local-${Date.now()}-${crypto.getRandomValues(new Uint32Array(2)).join('-')}`;

function idsWithPrefix(storage: Storage, prefix: string): string[] {
  return Array.from({ length: storage.length }, (_, index) => storage.key(index))
    .flatMap(key => key?.startsWith(prefix) && isId(key.slice(prefix.length)) ? [key.slice(prefix.length)] : []);
}

export function listLocalWorkspaces(storage: Storage) {
  const defaultName = storage.getItem(WORKSPACE_PREFIX + DEFAULT_LOCAL_WORKSPACE) || 'Local Workspace';
  return [{ id: DEFAULT_LOCAL_WORKSPACE, name: defaultName }, ...idsWithPrefix(storage, WORKSPACE_PREFIX)
    .filter(id => id !== DEFAULT_LOCAL_WORKSPACE)
    .flatMap(id => {
      const name = storage.getItem(WORKSPACE_PREFIX + id);
      return name ? [{ id, name }] : [];
    })];
}

export function localWorkspaceForProject(storage: Storage, id: string): string {
  const workspace = storage.getItem(MEMBERSHIP_PREFIX + id);
  return workspace && isId(workspace) && storage.getItem(WORKSPACE_PREFIX + workspace) ? workspace : DEFAULT_LOCAL_WORKSPACE;
}

export function listLocalWebsites(storage: Storage, workspace: string) {
  return idsWithPrefix(storage, LOCAL_PROJECT_PREFIX)
    .filter(id => localWorkspaceForProject(storage, id) === workspace)
    .map(id => ({
      id,
      name: storage.getItem(PROJECT_NAME_PREFIX + id) || 'Untitled',
      updated: Number(storage.getItem('revyme:local-updated:' + id)) || 0,
      archived: storage.getItem(ARCHIVED_PREFIX + id) === 'yes',
      folder: storage.getItem(SITE_FOLDER_PREFIX + id),
    }))
    .sort((a, b) => b.updated - a.updated || a.name.localeCompare(b.name));
}

export function createLocalWorkspace(storage: Storage, name: string): string {
  const id = freshId();
  storage.setItem(WORKSPACE_PREFIX + id, name.trim());
  return id;
}

export function renameLocalWorkspace(storage: Storage, id: string, name: string): void {
  const key = WORKSPACE_PREFIX + id;
  if (!name.trim() || (id !== DEFAULT_LOCAL_WORKSPACE && !storage.getItem(key))) return;
  storage.setItem(key, name.trim());
}

export function listLocalFolders(storage: Storage, workspace: string) {
  const prefix = `${FOLDER_PREFIX}${workspace}:`;
  return idsWithPrefix(storage, prefix).flatMap(id => {
    const name = storage.getItem(prefix + id);
    return name ? [{ id, name }] : [];
  }).sort((a, b) => a.name.localeCompare(b.name));
}

export function createLocalFolder(storage: Storage, workspace: string, name: string): string {
  const id = freshId();
  storage.setItem(`${FOLDER_PREFIX}${workspace}:${id}`, name.trim());
  return id;
}

export function placeLocalWebsite(storage: Storage, id: string, folder: string | null): void {
  if (folder) storage.setItem(SITE_FOLDER_PREFIX + id, folder);
  else storage.removeItem(SITE_FOLDER_PREFIX + id);
}

export function archiveLocalWebsite(storage: Storage, id: string, archived: boolean): void {
  if (archived) storage.setItem(ARCHIVED_PREFIX + id, 'yes');
  else storage.removeItem(ARCHIVED_PREFIX + id);
}

export function newLocalWebsiteId(storage: Storage, workspace: string, folder: string | null = null): string {
  const id = freshId();
  if (workspace !== DEFAULT_LOCAL_WORKSPACE) storage.setItem(MEMBERSHIP_PREFIX + id, workspace);
  if (folder) placeLocalWebsite(storage, id, folder);
  return id;
}

export function renameLocalWebsite(storage: Storage, id: string, name: string): void {
  if (name.trim()) storage.setItem(PROJECT_NAME_PREFIX + id, name.trim());
}

export function duplicateLocalWebsite(storage: Storage, id: string, name: string, workspace: string, folder: string | null): void {
  const raw = storage.getItem(LOCAL_PROJECT_PREFIX + id);
  if (!raw) throw new Error('Website no longer exists');
  const copyId = newLocalWebsiteId(storage, workspace, folder);
  renameLocalWebsite(storage, copyId, `${name} copy`);
  storage.setItem(LOCAL_PROJECT_PREFIX + copyId, raw);
}

export function localDashboardPath(workspace: string, view?: string): string {
  const params = new URLSearchParams();
  if (workspace !== DEFAULT_LOCAL_WORKSPACE) params.set('ws', workspace);
  if (view) params.set('view', view);
  return params.size ? `/dashboard?${params}` : '/dashboard';
}

export function localProjectDashboardPath(projectId: string, settings = false): string {
  const view = settings ? 'settings:account' : undefined;
  try {
    return localDashboardPath(localWorkspaceForProject(localStorage, projectId), view);
  } catch { return localDashboardPath(DEFAULT_LOCAL_WORKSPACE, view); }
}

export function restoreLocalColorMode(): void {
  try { document.documentElement.classList.toggle('dark', localStorage.getItem(THEME_KEY) !== 'light'); }
  catch { /* retain the default theme */ }
}

export function setLocalColorMode(dark: boolean): void {
  localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light');
  restoreLocalColorMode();
}
