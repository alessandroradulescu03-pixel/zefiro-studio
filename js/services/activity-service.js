/**
 * Registro attività (store "timeline").
 * I moduli chiameranno logActivity() dopo ogni operazione rilevante:
 * la dashboard e il modulo Timeline leggono da qui.
 */

import { STORES, create, getAll } from '../core/database.js';
import { ENTITY_TYPES } from '../config/domain.js';

/**
 * @param {{ entityType: keyof ENTITY_TYPES, entityId: string, action: string, title: string, meta?: object }} entry
 */
export async function logActivity({ entityType, entityId, action, title, meta = {} }) {
  if (!ENTITY_TYPES[entityType]) throw new Error(`Tipo di entità non valido: ${entityType}`);
  return create(STORES.TIMELINE, { entityType, entityId, action, title, meta });
}

/** Ultime attività registrate, dalla più recente. */
export function getRecentActivity(limit = 6) {
  return getAll(STORES.TIMELINE, { sortBy: 'createdAt', direction: 'desc', limit });
}
