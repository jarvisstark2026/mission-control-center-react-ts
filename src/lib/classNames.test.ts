import { describe, expect, it } from 'vitest';

import { classNames } from './classNames';

describe('classNames', () => {
  it('joins truthy class tokens and skips empty values', () => {
    expect(classNames('base', false, null, undefined, 'active')).toBe('base active');
  });
});
