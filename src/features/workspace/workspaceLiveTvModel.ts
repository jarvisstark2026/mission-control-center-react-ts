import { readLocalStorageJson, writeLocalStorageJson } from './browserStorage';

export type LiveTvStreamType = 'hls' | 'mp4';

export type LocalLiveTvSource = {
  name: string;
  badge: string;
  description: string;
  url: string;
  streamType: LiveTvStreamType;
};

export type LocalLiveTvState = {
  favorites: LocalLiveTvSource[];
  draftSource?: LocalLiveTvSource | null;
};

export const liveTvStorageKey = 'mission-control-center.live-tv.v1';

export function getLiveTvStreamType(url: string): LiveTvStreamType {
  return /\.m3u8($|\?)/i.test(url.trim()) ? 'hls' : 'mp4';
}

export function createLiveTvSource(url: string, name = 'Custom feed'): LocalLiveTvSource {
  const streamType = getLiveTvStreamType(url);
  return {
    name,
    badge: streamType === 'hls' ? 'HLS' : 'URL',
    description: 'saved local media source',
    url: url.trim(),
    streamType,
  };
}

export function addLiveTvFavorite(state: LocalLiveTvState, source: LocalLiveTvSource): LocalLiveTvState {
  if (!source.url.trim()) return state;

  return {
    ...state,
    favorites: [source, ...state.favorites.filter((favorite) => favorite.url !== source.url)].slice(0, 12),
  };
}

export function rememberLiveTvDraft(state: LocalLiveTvState, source: LocalLiveTvSource): LocalLiveTvState {
  if (!source.url.trim()) return state;
  if (state.draftSource?.url === source.url && state.draftSource.name === source.name) return state;
  return {
    ...state,
    draftSource: source,
  };
}

export function loadLiveTvState(): LocalLiveTvState {
  const parsed = readLocalStorageJson<LocalLiveTvState>(liveTvStorageKey);
  if (!Array.isArray(parsed?.favorites)) return { favorites: [], draftSource: null };
  return {
    favorites: parsed.favorites,
    draftSource: parsed.draftSource?.url ? parsed.draftSource : null,
  };
}

export function saveLiveTvState(state: LocalLiveTvState) {
  return writeLocalStorageJson(liveTvStorageKey, state);
}
