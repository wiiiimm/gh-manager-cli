// Shared types and metadata for bulk (multi-select) operations.

export type BulkAction =
  | 'delete'
  | 'archive'
  | 'unarchive'
  | 'star'
  | 'unstar'
  | 'visibility'
  | 'transfer';

export type BulkVisibilityTarget = 'PUBLIC' | 'PRIVATE' | 'INTERNAL';

// Ink/chalk colour names used across the bulk modals.
export type BulkActionColor = 'red' | 'yellow' | 'green' | 'cyan' | 'magenta';

export interface BulkActionMeta {
  /** Short verb-style label, e.g. "Delete", "Make Private". */
  label: string;
  /** Present-continuous form for progress text, e.g. "Deleting", "Updating visibility for". */
  gerund: string;
  /** Colour used for borders/buttons/title. */
  color: BulkActionColor;
  /** Past-tense verb for completion text, e.g. "deleted", "made private". */
  pastVerb: string;
}

function visibilityLabel(target: BulkVisibilityTarget): string {
  return target === 'PUBLIC' ? 'Public' : target === 'PRIVATE' ? 'Private' : 'Internal';
}

/**
 * Resolve display metadata for a bulk action. For visibility the target is
 * required to render the concrete destination state.
 */
export function bulkActionMeta(action: BulkAction, visibilityTarget?: BulkVisibilityTarget): BulkActionMeta {
  switch (action) {
    case 'delete':
      return { label: 'Delete', gerund: 'Deleting', color: 'red', pastVerb: 'deleted' };
    case 'archive':
      return { label: 'Archive', gerund: 'Archiving', color: 'yellow', pastVerb: 'archived' };
    case 'unarchive':
      return { label: 'Unarchive', gerund: 'Unarchiving', color: 'green', pastVerb: 'unarchived' };
    case 'star':
      return { label: 'Star', gerund: 'Starring', color: 'cyan', pastVerb: 'starred' };
    case 'unstar':
      return { label: 'Unstar', gerund: 'Unstarring', color: 'magenta', pastVerb: 'unstarred' };
    case 'visibility': {
      const target = visibilityTarget ?? 'PRIVATE';
      const name = visibilityLabel(target);
      const color: BulkActionColor = target === 'PUBLIC' ? 'green' : target === 'PRIVATE' ? 'yellow' : 'cyan';
      return { label: `Make ${name}`, gerund: `Making ${name}`, color, pastVerb: `made ${name.toLowerCase()}` };
    }
    case 'transfer':
      return { label: 'Transfer', gerund: 'Transferring', color: 'yellow', pastVerb: 'transferred' };
  }
}
