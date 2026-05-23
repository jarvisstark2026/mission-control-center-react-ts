import { describe, expect, it } from 'vitest';

import { addLiveTvFavorite, createLiveTvSource, getLiveTvStreamType, rememberLiveTvDraft } from './workspaceLiveTvModel';

describe('workspaceLiveTvModel', () => {
  it('detects stream types from source URLs', () => {
    expect(getLiveTvStreamType('https://example.com/live.m3u8')).toBe('hls');
    expect(getLiveTvStreamType('https://example.com/movie.mp4')).toBe('mp4');
  });

  it('creates and dedupes local favorite sources', () => {
    const source = createLiveTvSource('https://example.com/live.m3u8', 'Roof antenna');
    const state = addLiveTvFavorite({ favorites: [] }, source);
    const deduped = addLiveTvFavorite(state, source);

    expect(source).toMatchObject({ name: 'Roof antenna', badge: 'HLS', streamType: 'hls' });
    expect(deduped.favorites).toHaveLength(1);
  });

  it('remembers a custom source draft before it is saved as a favorite', () => {
    const source = createLiveTvSource('https://example.com/local.mp4', 'Local feed');

    expect(rememberLiveTvDraft({ favorites: [] }, source).draftSource).toMatchObject({
      name: 'Local feed',
      streamType: 'mp4',
    });
  });
});
