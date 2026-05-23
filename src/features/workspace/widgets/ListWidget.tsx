import type { WorkspaceWidget } from '../workspaceTypes';
import { TaskBoardWidget } from './TaskBoardWidget';

export function ListWidget({
  onLaunchWorkspaceWidget,
}: {
  onLaunchWorkspaceWidget?: (kind: WorkspaceWidget['kind']) => void;
}) {
  return <TaskBoardWidget variant="list" onLaunchWorkspaceWidget={onLaunchWorkspaceWidget} />;
}
