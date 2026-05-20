export type DesktopAppRecord = {
  name: string;
  note: string;
};

export const defaultDesktopApps: DesktopAppRecord[] = [
  { name: 'Mission Control Center', note: 'primary desktop hub' },
  { name: 'DailyForge', note: 'separate planning surface' },
  { name: 'Browser', note: 'external web window' },
  { name: 'Files', note: 'native file manager' },
  { name: 'Terminal', note: 'command-line session' },
];

export function rememberDesktopApp(
  apps: DesktopAppRecord[],
  appName: string,
  options: { note?: string; maxItems?: number } = {},
) {
  const name = appName.trim();
  if (!name) return apps;

  const normalizedName = name.toLocaleLowerCase();
  const note = options.note ?? 'loaded into desktop memory';
  const maxItems = options.maxItems ?? 8;
  const nextApps = [{ name, note }, ...apps.filter((app) => app.name.toLocaleLowerCase() !== normalizedName)];

  return nextApps.slice(0, maxItems);
}
