import { describe, expect, it } from 'vitest';

import {
  buildPanelWindowUrl,
  buildWorkspaceExtensionWindowUrl,
  buildWorkspaceHubUrl,
  getCurrentShellRole,
  isWorkspaceExtensionUrl,
} from './workspacePanelRouting';

describe('workspace panel routing', () => {
  it('preserves the current role when building detached panel URLs', () => {
    const url = buildPanelWindowUrl('graph', 'https://example.test/app?role=admin&view=wide');

    expect(url.origin).toBe('https://example.test');
    expect(url.searchParams.get('role')).toBe('admin');
    expect(url.searchParams.get('panel')).toBe('graph');
    expect(url.searchParams.get('view')).toBe('wide');
  });

  it('falls back to the support role when the URL role is invalid', () => {
    expect(getCurrentShellRole('?role=unknown')).toBe('support');
    expect(buildPanelWindowUrl('docs', 'https://example.test/app?role=unknown').searchParams.get('role')).toBe('support');
  });

  it('removes detached workspace parameters when returning to the hub', () => {
    const url = buildWorkspaceHubUrl('https://example.test/app?role=home&panel=docs&workspace=extension&view=compact');

    expect(url.searchParams.get('panel')).toBeNull();
    expect(url.searchParams.get('workspace')).toBeNull();
    expect(url.searchParams.get('role')).toBe('home');
    expect(url.searchParams.get('view')).toBe('compact');
  });

  it('builds blank workspace extension URLs without a panel route', () => {
    const url = buildWorkspaceExtensionWindowUrl('https://example.test/app?role=admin&panel=docs&view=compact');

    expect(url.searchParams.get('panel')).toBeNull();
    expect(url.searchParams.get('role')).toBe('admin');
    expect(url.searchParams.get('workspace')).toBe('extension');
    expect(url.searchParams.get('view')).toBe('compact');
    expect(isWorkspaceExtensionUrl(url.search)).toBe(true);
  });
});
