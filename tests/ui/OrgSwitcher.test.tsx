import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from 'ink-testing-library';
import OrgSwitcher from '../../src/ui/OrgSwitcher';

// Keep Box/Text real, stub useInput (raw mode is unavailable under the test stdin)
vi.mock('ink', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ink')>();
  return { ...actual, useInput: vi.fn() };
});

// Mock logger
vi.mock('../../src/lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }
}));

const mockOrgs = [
  { id: 'org-1', login: 'my-org', name: 'My Organisation', avatarUrl: '' },
  { id: 'org-2', login: 'another-org', name: 'Another', avatarUrl: '' }
];

vi.mock('../../src/services/github', () => ({
  makeClient: vi.fn(() => ({})),
  fetchViewerOrganizations: vi.fn(async () => mockOrgs),
  checkOrganizationIsEnterprise: vi.fn(async () => false)
}));

vi.mock('../../src/services/oauth', () => ({
  openGitHubAuthorizationPage: vi.fn()
}));

const flush = async () => {
  // Allow the mount effect's async loadOrgs() chain to settle.
  for (let i = 0; i < 5; i++) await Promise.resolve();
  await new Promise((r) => setTimeout(r, 0));
};

describe('OrgSwitcher', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.clearAllMocks());

  it('renders the organisation list for a personal context', async () => {
    const { lastFrame } = render(
      <OrgSwitcher token="t" currentContext="personal" onSelect={vi.fn()} onClose={vi.fn()} />
    );
    await flush();
    expect(lastFrame()).toContain('my-org');
  });

  it('does not crash when the persisted context is null/malformed', async () => {
    // `typeof null === "object"` would previously slip past the guard and throw
    // on `currentContext.login` while computing isActiveContext during render.
    const { lastFrame } = render(
      <OrgSwitcher token="t" currentContext={null as any} onSelect={vi.fn()} onClose={vi.fn()} />
    );
    await flush();
    const frame = lastFrame() || '';
    expect(frame).toContain('my-org');
    expect(frame).toContain('another-org');
  });
});
