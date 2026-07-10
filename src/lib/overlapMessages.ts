import type {Category} from '../types';

/**
 * "You crossed paths" message bank for the in-app dialog shown when you and
 * a friend both saved the same place — same category-aware, randomized
 * template pattern as notificationMessages.ts (proximity), so the two
 * notification surfaces share a voice without sharing copy.
 */

const TITLES = [
  'You crossed paths! 📍',
  'Great minds strike again.',
  'Same place, same energy.',
  'Well, this is a coincidence.',
  'Synced up. 📍',
  'Someone else gets it.',
];

const OVERLAP_MESSAGES: Record<
  Category,
  Array<(friend: string, name: string) => string>
> = {
  Food: [
    (friend, name) =>
      `You and ${friend} both saved ${name}. Great taste runs in the friend group.`,
    (friend, name) =>
      `${friend} also saved ${name}. A meal together seems inevitable now.`,
    (friend, name) =>
      `You and ${friend} both saved ${name}. Coincidence has a seat at the table.`,
    (friend, name) =>
      `${friend} saved ${name} too. That's basically a reservation.`,
    (friend, name) =>
      `You and ${friend} both saved ${name}. Someone should say something.`,
  ],

  Cafe: [
    (friend, name) =>
      `You and ${friend} both saved ${name}. Matching caffeine agendas.`,
    (friend, name) =>
      `${friend} also saved ${name}. A coffee date is writing itself.`,
    (friend, name) =>
      `You and ${friend} both saved ${name}. The algorithm didn't do this, you did.`,
    (friend, name) =>
      `${friend} saved ${name} too. Suspiciously aligned taste.`,
    (friend, name) =>
      `You and ${friend} both saved ${name}. Two people, one bean-water dream.`,
  ],

  Bar: [
    (friend, name) =>
      `You and ${friend} both saved ${name}. This feels like a sign.`,
    (friend, name) =>
      `${friend} also saved ${name}. The group chat should probably know.`,
    (friend, name) =>
      `You and ${friend} both saved ${name}. A night out is forming on its own.`,
    (friend, name) => `${friend} saved ${name} too. Say less.`,
    (friend, name) =>
      `You and ${friend} both saved ${name}. Coincidence, or destiny with a tab?`,
  ],

  Experience: [
    (friend, name) =>
      `You and ${friend} both saved ${name}. The universe is nudging you two.`,
    (friend, name) =>
      `${friend} also saved ${name}. A shared side quest has appeared.`,
    (friend, name) =>
      `You and ${friend} both saved ${name}. Make it a plan, not just a coincidence.`,
    (friend, name) => `${friend} saved ${name} too. Lore is forming.`,
    (friend, name) =>
      `You and ${friend} both saved ${name}. This is how the good stories start.`,
  ],

  Shopping: [
    (friend, name) =>
      `You and ${friend} both saved ${name}. Two wallets, one target.`,
    (friend, name) =>
      `${friend} also saved ${name}. Enabling each other, respectfully.`,
    (friend, name) =>
      `You and ${friend} both saved ${name}. A joint impulse purchase awaits.`,
    (friend, name) =>
      `${friend} saved ${name} too. Shared taste, shared consequences.`,
    (friend, name) =>
      `You and ${friend} both saved ${name}. This was always going to happen.`,
  ],

  Other: [
    (friend, name) =>
      `You and ${friend} both saved ${name}. Interesting overlap.`,
    (friend, name) =>
      `${friend} also saved ${name}. Worth turning into a plan.`,
    (friend, name) =>
      `You and ${friend} both saved ${name}. Noted by the system.`,
    (friend, name) =>
      `${friend} saved ${name} too. Not a coincidence, a pattern.`,
    (friend, name) => `You and ${friend} both saved ${name}. Make it official.`,
  ],
};

/** Kept short and friend-agnostic: several fresh overlaps land in one pass. */
const MULTI_MESSAGES: Array<(places: string) => string> = [
  places => `You and your friends have both saved ${places}.`,
  places => `Great minds: you're not the only one who saved ${places}.`,
  places => `Turns out you're all over ${places} too.`,
];

function pickRandom<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

/** A random title for the crossed-paths dialog/push. */
export function overlapTitle(): string {
  return pickRandom(TITLES);
}

/** A random single-place message, flavored by the place's category. */
export function overlapMessageSingle(
  category: Category | null,
  friend: string,
  place: string,
): string {
  const bank = OVERLAP_MESSAGES[category ?? 'Other'];
  return pickRandom(bank)(friend, place);
}

/** Fallback for when multiple fresh overlaps surface in the same pass. */
export function overlapMessageMultiple(places: string[]): string {
  const head = places.slice(0, 3).join(', ');
  const more = places.length > 3 ? `, and ${places.length - 3} more` : '';
  return pickRandom(MULTI_MESSAGES)(`${head}${more}`);
}
