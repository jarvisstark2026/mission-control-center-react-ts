import type { ButtonHTMLAttributes } from 'react';

import { classNames } from '../../lib/classNames';
import { WorkspaceButton } from './workspaceBlocks';

export function WorkspaceNewScreenButton({
  className,
  label = 'Create blank workspace',
  title = label,
  ...buttonProps
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  label?: string;
}) {
  return (
    <WorkspaceButton
      {...buttonProps}
      className={classNames('workspace-launch-button workspace-new-screen-button', className)}
      aria-label={label}
      title={title}
    >
      <span className="workspace-new-screen-icon" aria-hidden="true">
        <span className="workspace-new-screen-frame" />
        <span className="workspace-new-screen-plus" />
      </span>
    </WorkspaceButton>
  );
}

export function WorkspaceCloseScreenButton({
  className,
  label = 'Close workspace extension',
  title = label,
  ...buttonProps
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  label?: string;
}) {
  return (
    <WorkspaceButton
      {...buttonProps}
      className={classNames('workspace-launch-button workspace-new-screen-button workspace-extension-close-button', className)}
      aria-label={label}
      title={title}
    >
      <span className="workspace-extension-close-icon" aria-hidden="true" />
    </WorkspaceButton>
  );
}
