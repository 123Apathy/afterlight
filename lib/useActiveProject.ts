import { useLocalStorage } from './useLocalStorage';
import type { Project } from './api';

export type KnownProject = { id: string; name: string; inviteCode?: string };

function parseKnown(raw: string): KnownProject[] {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

// The active project lives in localStorage (no accounts yet). We also keep a
// list of every memorial this device has opened, so "switch memorial" returns
// you to a chooser instead of a dead end — you never lose a memorial you were
// part of. Families still enter a new one via their invite link (/join/<code>).
export function useActiveProject() {
  const [projectId, setProjectId] = useLocalStorage('everlit.activeProjectId', '');
  const [projectName, setProjectName] = useLocalStorage('everlit.activeProjectName', '');
  const [knownRaw, setKnownRaw] = useLocalStorage('everlit.knownProjects', '[]');
  const known = parseKnown(knownRaw);

  // Add/refresh a memorial in the remembered list (most-recent first).
  const remember = (p: KnownProject) => {
    const next = [
      { id: p.id, name: p.name, inviteCode: p.inviteCode },
      ...known.filter((k) => k.id !== p.id),
    ];
    setKnownRaw(JSON.stringify(next));
  };

  const setProject = (project: Project | KnownProject) => {
    setProjectId(project.id);
    setProjectName(project.name);
    remember({ id: project.id, name: project.name, inviteCode: (project as Project).inviteCode });
  };

  // Leave the current memorial but KEEP it in the remembered list so the
  // welcome screen can reopen it. This is what "switch memorial" calls.
  const clearProject = () => {
    setProjectId('');
    setProjectName('');
  };

  return { projectId, projectName, known, setProject, clearProject, remember };
}
