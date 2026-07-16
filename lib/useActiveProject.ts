import { useLocalStorage } from './useLocalStorage';
import type { Project } from './api';

// Temporary safety net until real accounts/login exist: a browser that has
// never set an active project (new tab, cleared storage, different device)
// falls back to the one real project in use right now instead of showing an
// empty "no project" screen that reads as data loss. Remove once there's
// more than one project in real use, or once login makes this unnecessary.
const DEFAULT_PROJECT_ID = '7b511145-1786-490d-a81a-ab03ff0097b9';
const DEFAULT_PROJECT_NAME = 'Brenda';

export function useActiveProject() {
  const [projectId, setProjectId] = useLocalStorage('afterlight.activeProjectId', DEFAULT_PROJECT_ID);
  const [projectName, setProjectName] = useLocalStorage('afterlight.activeProjectName', DEFAULT_PROJECT_NAME);

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
