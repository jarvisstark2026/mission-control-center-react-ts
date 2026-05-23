import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ShellRoleMenu, ShellThemeMenu } from './ShellChrome';

describe('Shell top-bar menus', () => {
  it('closes the access menu when clicking outside it', () => {
    const onNavigateRole = vi.fn();

    render(
      <>
        <ShellRoleMenu activeRole="admin" activeRoleLabel="Admin" onNavigateRole={onNavigateRole} />
        <button type="button">Outside</button>
      </>,
    );

    fireEvent.click(screen.getByRole('button', { name: /Access/i }));
    expect(screen.getByRole('menu', { name: 'Access scope menu' })).toBeInTheDocument();

    fireEvent.pointerDown(screen.getByRole('button', { name: 'Outside' }));
    expect(screen.queryByRole('menu', { name: 'Access scope menu' })).not.toBeInTheDocument();
    expect(onNavigateRole).not.toHaveBeenCalled();
  });

  it('closes the theme menu on Escape', () => {
    const onSelectTheme = vi.fn();

    render(<ShellThemeMenu activeTheme="jarvis" onSelectTheme={onSelectTheme} />);

    fireEvent.click(screen.getByRole('button', { name: 'Theme Jarvis Prime' }));
    expect(screen.getByRole('menu', { name: 'Theme menu' })).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu', { name: 'Theme menu' })).not.toBeInTheDocument();
    expect(onSelectTheme).not.toHaveBeenCalled();
  });
});
