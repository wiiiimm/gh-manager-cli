import { describe, it, expect } from 'vitest';
import {
  bulkActionMeta,
  type BulkAction,
  type BulkVisibilityTarget,
} from '../../src/ui/components/modals/bulkActions';

describe('bulkActionMeta', () => {
  it('returns delete metadata', () => {
    const meta = bulkActionMeta('delete');
    expect(meta).toEqual({ label: 'Delete', gerund: 'Deleting', color: 'red', pastVerb: 'deleted' });
  });

  it('returns archive metadata', () => {
    const meta = bulkActionMeta('archive');
    expect(meta).toEqual({ label: 'Archive', gerund: 'Archiving', color: 'yellow', pastVerb: 'archived' });
  });

  it('returns unarchive metadata', () => {
    const meta = bulkActionMeta('unarchive');
    expect(meta).toEqual({ label: 'Unarchive', gerund: 'Unarchiving', color: 'green', pastVerb: 'unarchived' });
  });

  it('returns star metadata', () => {
    const meta = bulkActionMeta('star');
    expect(meta).toEqual({ label: 'Star', gerund: 'Starring', color: 'cyan', pastVerb: 'starred' });
  });

  it('returns unstar metadata', () => {
    const meta = bulkActionMeta('unstar');
    expect(meta).toEqual({ label: 'Unstar', gerund: 'Unstarring', color: 'magenta', pastVerb: 'unstarred' });
  });

  it('returns transfer metadata', () => {
    const meta = bulkActionMeta('transfer');
    expect(meta).toEqual({ label: 'Transfer', gerund: 'Transferring', color: 'yellow', pastVerb: 'transferred' });
  });

  describe('visibility', () => {
    it('renders Public destination', () => {
      const meta = bulkActionMeta('visibility', 'PUBLIC');
      expect(meta).toEqual({ label: 'Make Public', gerund: 'Making Public', color: 'green', pastVerb: 'made public' });
    });

    it('renders Private destination', () => {
      const meta = bulkActionMeta('visibility', 'PRIVATE');
      expect(meta).toEqual({ label: 'Make Private', gerund: 'Making Private', color: 'yellow', pastVerb: 'made private' });
    });

    it('renders Internal destination', () => {
      const meta = bulkActionMeta('visibility', 'INTERNAL');
      expect(meta).toEqual({ label: 'Make Internal', gerund: 'Making Internal', color: 'cyan', pastVerb: 'made internal' });
    });

    it('defaults to Private when no target is supplied', () => {
      const meta = bulkActionMeta('visibility');
      expect(meta.label).toBe('Make Private');
      expect(meta.color).toBe('yellow');
    });
  });

  it('returns a defined metadata object for every BulkAction', () => {
    const actions: BulkAction[] = ['delete', 'archive', 'unarchive', 'star', 'unstar', 'visibility', 'transfer'];
    for (const action of actions) {
      const meta = bulkActionMeta(action);
      expect(meta.label).toBeTruthy();
      expect(meta.gerund).toBeTruthy();
      expect(meta.pastVerb).toBeTruthy();
      expect(['red', 'yellow', 'green', 'cyan', 'magenta']).toContain(meta.color);
    }
  });

  it('produces consistent metadata across all visibility targets', () => {
    const targets: BulkVisibilityTarget[] = ['PUBLIC', 'PRIVATE', 'INTERNAL'];
    for (const target of targets) {
      const meta = bulkActionMeta('visibility', target);
      expect(meta.label.startsWith('Make ')).toBe(true);
      expect(meta.gerund.startsWith('Making ')).toBe(true);
      expect(meta.pastVerb.startsWith('made ')).toBe(true);
    }
  });
});
