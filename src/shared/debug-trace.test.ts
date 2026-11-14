// @vitest-environment node

import { expect, it } from 'vitest';
import { trace } from './debug-trace';

it('records an action without browser globals', () => {
  const payload = { branch: 'draft' };

  trace.action('branching-switch:late-bump', payload);
  payload.branch = 'another-branch';

  expect(trace.getEntries().slice(-1)[0]).toMatchObject({
    type: 'action',
    category: 'branching-switch:late-bump',
    data: { branch: 'draft' },
  });
});
