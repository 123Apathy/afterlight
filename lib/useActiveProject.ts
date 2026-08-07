import { useEffect } from 'react';
import { useLocalStorage } from './useLocalStorage';
import { setInviteCode, type Member, type Project } from './api';
import { DEMO, DEMO_PROJECT_NAME } from '../constants/demo';

export type KnownProject = {
  id: string;
  name: string;
  inviteCode?: string;
  // Durable identity in this memorial, once the person has entered a name.
  memberId?: string;
  memberToken?: string;
  memberRole?: 'owner' | 'member';
  // Held from creation until the creator claims the owner member at the gate.
  ownerClaimToken?: string;
};

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

  // Keep the API layer's write-auth header in sync with the active project.
  useEffect(() => {
    const match = known.find((k) => k.id === projectId);
    setInviteCode(match && match.inviteCode);
  }, [projectId, knownRaw]);

  // Add/refresh a memorial in the remembered list (most-recent first).
  // Identity fields merge with what is already remembered, so re-opening a
  // memorial never wipes the member identity attached to it.
  const remember = (p: KnownProject) => {
    const prev = known.find((k) => k.id === p.id);
    const next = [
      {
        id: p.id,
        name: p.name,
        inviteCode: p.inviteCode ?? prev?.inviteCode,
        memberId: p.memberId ?? prev?.memberId,
        memberToken: p.memberToken ?? prev?.memberToken,
        memberRole: p.memberRole ?? prev?.memberRole,
        // '' means "spend it" (set after the owner claim succeeds); undefined
        // means "keep whatever was remembered".
        ownerClaimToken:
          p.ownerClaimToken !== undefined ? p.ownerClaimToken || undefined : prev?.ownerClaimToken,
      },
      ...known.filter((k) => k.id !== p.id),
    ];
    setKnownRaw(JSON.stringify(next));
  };

  const setProject = (project: Project | KnownProject) => {
    setProjectId(project.id);
    setProjectName(project.name);
    const asProject = project as Project;
    remember({
      id: project.id,
      name: project.name,
      inviteCode: asProject.inviteCode,
      ownerClaimToken: asProject.owner?.claimToken,
      memberId: asProject.member?.id ?? (project as KnownProject).memberId,
      memberToken: asProject.member?.transferToken ?? (project as KnownProject).memberToken,
      memberRole: asProject.member?.role ?? (project as KnownProject).memberRole,
    });
  };

  // Attach (or refresh) the durable identity for a memorial after the person
  // has entered their name -- or arrived via a keep-your-place link.
  const rememberMember = (projectId2: string, name: string, member: Member) => {
    const entry = known.find((k) => k.id === projectId2);
    remember({
      id: projectId2,
      name: entry?.name || name,
      memberId: member.id,
      memberToken: member.transferToken,
      memberRole: member.role,
      // The claim is spent once a member exists ('' = clear, see remember).
      ownerClaimToken: '',
    });
  };

  const activeEntry = known.find((k) => k.id === projectId);

  // Leave the current memorial but KEEP it in the remembered list so the
  // welcome screen can reopen it. This is what "switch memorial" calls.
  const clearProject = () => {
    setProjectId('');
    setProjectName('');
  };

  // Sales demo: present the fictional memorial as the active project so every
  // screen titles itself for Margaret, without touching this device's real
  // localStorage state (a rep's phone may hold real memorials too). Screens
  // that talk to the backend all branch on DEMO before using projectId.
  if (DEMO) {
    return {
      projectId: 'demo',
      projectName: DEMO_PROJECT_NAME,
      known,
      activeEntry: undefined,
      setProject,
      clearProject,
      remember,
      rememberMember,
    };
  }

  return { projectId, projectName, known, activeEntry, setProject, clearProject, remember, rememberMember };
}
