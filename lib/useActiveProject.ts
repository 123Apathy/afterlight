import { useLocalStorage } from './useLocalStorage';
import type { Project } from './api';

// The active project lives in localStorage only (no accounts yet). A browser
// with no project selected sees the onboarding screen; families enter via
// their invite link (/join/<code>), which sets this. Deliberately NO default
// project: defaulting strangers into a real family's photos is a privacy
// leak the moment a second customer exists.
export function useActiveProject() {
  const [projectId, setProjectId] = useLocalStorage('afterlight.activeProjectId', '');
  const [projectName, setProjectName] = useLocalStorage('afterlight.activeProjectName', '');

  const setProject = (project: Project) => {
    setProjectId(project.id);
    setProjectName(project.name);
  };

  const clearProject = () => {
    setProjectId('');
    setProjectName('');
  };

  return { projectId, projectName, setProject, clearProject };
}
