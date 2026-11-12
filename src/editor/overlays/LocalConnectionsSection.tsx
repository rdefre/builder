import { useEffect, useRef, useState } from 'react';
import { fetchAgentEngines } from '@/ai/agent/agent-client';
import { registerSettingsSection } from '@/plugins/plugin-registry';
import { trace } from '@/shared/debug-trace';
import { SettingsConnectAiIcon } from '@/shared/icons';
import { ROW_INPUT_CLS, RowButton, SettingsGroup, SettingsRow } from './settings-shared';

const VIBE_PREFERENCE_KEY = 'revyme:local-vibe-preference';
const VIBE_PROVIDERS = ['Ollama', 'Codex', 'Claude Code'] as const;
type VibeProvider = typeof VIBE_PROVIDERS[number];

function readVibePreference(): VibeProvider {
  try {
    const saved = VIBE_PROVIDERS.find(provider => provider === localStorage.getItem(VIBE_PREFERENCE_KEY));
    if (saved) return saved;
  } catch { /* browser storage may be disabled */ }
  return 'Ollama';
}

async function localRequest<T>(path: string, options: RequestInit): Promise<T> {
  const response = await fetch(path, options);
  const data = await response.json().catch(() => null);
  if (!response.ok || !data) throw new Error(data?.error || 'The local AI endpoint is unavailable.');
  return data as T;
}

export function initLocalSettings() {
  registerSettingsSection({
    id: 'local-connections', label: 'AI & MCP', category: 'Local Admin',
    icon: SettingsConnectAiIcon, order: 0, component: LocalConnectionsSection,
  });
}

export function LocalConnectionsSection() {
  const [provider, setProvider] = useState(readVibePreference);
  const [preferenceMessage, setPreferenceMessage] = useState('');
  const [models, setModels] = useState<string[] | null>(null);
  const [model, setModel] = useState('');
  const [status, setStatus] = useState('Checking for Ollama…');
  const [busy, setBusy] = useState(true);
  const [vibeStatus, setVibeStatus] = useState('Not checked');
  const [checkingVibe, setCheckingVibe] = useState(false);
  const pending = useRef<AbortController | null>(null);
  const vibeCheck = useRef<AbortController | null>(null);

  async function run(testModel?: string) {
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true);
    setStatus(testModel ? 'Running the model test…' : 'Checking for Ollama…');
    try {
      if (testModel) {
        const { reply } = await localRequest<{ reply: string }>(`/api/local-ai/test?${new URLSearchParams({ model: testModel })}`, {
          method: 'POST', signal: controller.signal,
        });
        if (!controller.signal.aborted) setStatus(`Model responded: ${reply}`);
      } else {
        const { models: available } = await localRequest<{ models: string[] }>('/api/local-ai/models', { signal: controller.signal });
        if (controller.signal.aborted) return;
        setModels(available);
        setModel(previous => available.includes(previous) ? previous : (available[0] ?? ''));
        setStatus(available.length ? `${available.length} installed model${available.length === 1 ? '' : 's'} found.` : 'Ollama is running. No models are installed.');
      }
      trace.action('local-connections:ollama-ok', { test: !!testModel });
    } catch (err) {
      if (controller.signal.aborted) return;
      if (!testModel) { setModels(null); setModel(''); }
      setStatus(err instanceof Error ? err.message : 'Ollama connection failed.');
      trace.error('local-connections:ollama-failed', { test: !!testModel });
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }

  useEffect(() => {
    void run();
    return () => { pending.current?.abort(); vibeCheck.current?.abort(); };
  }, []);

  async function checkVibe() {
    const controller = new AbortController();
    vibeCheck.current?.abort();
    vibeCheck.current = controller;
    setCheckingVibe(true);
    const engines = await fetchAgentEngines(AbortSignal.any([controller.signal, AbortSignal.timeout(5000)]));
    if (controller.signal.aborted) return;
    setVibeStatus(!engines ? 'Compatible service not reachable.' : engines.length ? `Service reports: ${engines.join(', ')}` : 'Service reachable; no engines reported.');
    setCheckingVibe(false);
    trace.action('local-connections:vibe-checked', { reachable: engines !== null });
  }

  return (
    <div className="max-w-[720px] mx-auto flex flex-col gap-6">
      <SettingsGroup title="Ollama on this computer">
        <SettingsRow label="Test model" htmlFor="local-test-model">
          <div className="flex flex-wrap items-center gap-2">
            <select id="local-test-model" className={`${ROW_INPUT_CLS} min-w-40`} value={model} onChange={e => setModel(e.target.value)} disabled={busy || !models?.length}>
              {!models?.length && <option value="">No models available</option>}
              {models?.map(name => <option key={name} value={name}>{name}</option>)}
            </select>
            <RowButton disabled={busy || !model} onClick={() => void run(model)}>Test model</RowButton>
            <RowButton disabled={busy} onClick={() => void run()}>Refresh models</RowButton>
          </div>
          <p role="status" className="mt-2 text-xs text-[var(--text-secondary)]">{status}</p>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">Sends a short test prompt. This does not select a model for Vibe or send any project files.</p>
        </SettingsRow>
      </SettingsGroup>
      <SettingsGroup title="Editor AI">
        <SettingsRow label="Preferred Vibe provider" htmlFor="local-vibe-provider">
          <div className="flex flex-wrap items-center gap-2">
            <select id="local-vibe-provider" className={`${ROW_INPUT_CLS} min-w-40`} value={provider}
              onChange={event => {
                const next = VIBE_PROVIDERS.find(option => option === event.target.value);
                if (next) setProvider(next);
                setPreferenceMessage('');
              }}>
              {VIBE_PROVIDERS.map(option => <option key={option}>{option}</option>)}
            </select>
            <RowButton onClick={() => {
              try {
                localStorage.setItem(VIBE_PREFERENCE_KEY, provider);
                setPreferenceMessage('Preference saved in this browser.');
              } catch { setPreferenceMessage('Could not save the provider preference.'); }
            }}>Save preference</RowButton>
          </div>
          {preferenceMessage && <p role="status" className="mt-2 text-xs">{preferenceMessage}</p>}
          <p className="mt-1 text-xs text-[var(--text-secondary)]">Using this provider in Vibe requires a compatible adapter.</p>
        </SettingsRow>
        <SettingsRow label="Vibe service">
          <RowButton disabled={checkingVibe} onClick={() => void checkVibe()}>Check Vibe service</RowButton>
          <p role="status" className="mt-2 text-xs text-[var(--text-secondary)]">{checkingVibe ? 'Checking…' : vibeStatus}</p>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">Vibe needs a Revyme-compatible AI service. An Ollama connection alone does not enable Vibe editing.</p>
        </SettingsRow>
      </SettingsGroup>
      <SettingsGroup title="External AI assistants">
        <SettingsRow label="MCP API">
          <p className="text-xs text-[var(--text-secondary)]">This checkout contains the editor bridge, but does not supply an MCP server or issue local API tokens. Codex and Claude Code need a compatible local MCP server to control the canvas. Your hosted Revyme token is for hosted projects.</p>
        </SettingsRow>
      </SettingsGroup>
    </div>
  );
}
