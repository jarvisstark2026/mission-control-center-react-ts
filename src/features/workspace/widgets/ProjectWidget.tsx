import type { OperationalOsRuntime } from '../../operational-os';
import type { ShellRole } from '../../shell/roles';
import type { WorkspaceWidget } from '../workspaceTypes';
import { TaskBoardWidget } from './TaskBoardWidget';

export function ProjectWidget({
  onLaunchWorkspaceWidget,
  role,
  operationalOs,
}: {
  onLaunchWorkspaceWidget?: (kind: WorkspaceWidget['kind']) => void;
  role: ShellRole;
  operationalOs: OperationalOsRuntime;
}) {
  return <TaskBoardWidget variant="project" onLaunchWorkspaceWidget={onLaunchWorkspaceWidget} role={role} operationalOs={operationalOs} />;
}
