/**
 * Session role -> queue role (UX-003).
 *
 * The app has never settled on one role vocabulary. The `users` table stores
 * `founder | finance | employee`, while the code says `finance_lead` (14 call
 * sites), `hr_lead`, `manager` and `hr` in different places. Rather than pick a
 * winner and break the other half, this normalises every spelling onto the four
 * roles the queue actually addresses.
 *
 * The default is deliberately the *least* privileged one. An unrecognised role
 * must not fall through to "sees everything" — that is how an intern ends up
 * looking at AP aging.
 */
import type { QueueRole } from './types';

/** Every spelling in the codebase and the database, mapped to a queue role. */
const ROLE_ALIASES: Record<string, QueueRole> = {
  founder: 'founder',
  owner: 'founder',
  admin: 'founder',

  finance: 'finance',
  finance_lead: 'finance',
  'finance-lead': 'finance',
  accountant: 'finance',

  hr: 'hr',
  hr_lead: 'hr',
  'hr-lead': 'hr',
  people: 'hr',

  employee: 'employee',
  manager: 'employee',
  intern: 'employee',
};

/**
 * Normalise a session's `actor_role` onto a queue role.
 *
 * Returns `employee` — not null, and not `founder` — for anything unrecognised,
 * so an unmapped role sees the narrowest queue rather than the widest.
 */
export function toQueueRole(actorRole: string | null | undefined): QueueRole {
  const key = actorRole?.trim().toLowerCase().replace(/\s+/g, '_') ?? '';
  return ROLE_ALIASES[key] ?? 'employee';
}

/**
 * Whether this role should see the whole queue.
 *
 * Founders own every consequence in the product, so they are never filtered.
 */
export function seesEverything(role: QueueRole): boolean {
  return role === 'founder';
}
