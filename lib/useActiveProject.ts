import { useLocalStorage } from './useLocalStorage';
import type { Project } from './api';

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
