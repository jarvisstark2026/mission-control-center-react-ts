import type { WorkspaceWidget } from '../workspaceTypes';
import { TaskBoardWidget } from './TaskBoardWidget';

export function ProjectWidget({
  onLaunchWorkspaceWidget,
}: {
  onLaunchWorkspaceWidget?: (kind: WorkspaceWidget['kind']) => void;
}) {
  return <TaskBoardWidget variant="project" onLaunchWorkspaceWidget={onLaunchWorkspaceWidget} />;
}
