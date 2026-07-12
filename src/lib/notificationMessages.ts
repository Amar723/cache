import type {Category, Stash} from '../types';

/**
 * Tier 1 (arrived) and tier 2 (nearby) message banks, one set of templates per
 * category plus a generic 'Other' fallback. A random template is picked each
 * time so the same stash doesn't nag with identical copy on every visit.
 */
const ARRIVED_MESSAGES: Record<Category, Array<(name: string) => string>> = {
  Food: [
    name => `You made it to ${name}. The meal arc begins.`,
    name => `${name}: reached. Elite decision-making.`,
    name => `You're at ${name}. Time to make this worth the walk.`,
    name => `${name} secured. Hunger never stood a chance.`,
    name => `You pulled up to ${name}. Respectable behaviour.`,
    name => `${name}: unlocked. The fork is mightier than the plan.`,
    name => `You're at ${name}. This is what discipline looks like, apparently.`,
    name => `${name} reached. Your stomach has been briefed.`,
    name => `You made it to ${name}. A strong showing from everyone involved.`,
    name => `${name} secured. The appetite was not imaginary.`,
  ],

  Cafe: [
    name => `You made it to ${name}. Caffeine era loading.`,
    name => `${name}: reached. The day may now begin.`,
    name => `You're at ${name}. Go order like you have a usual.`,
    name => `${name} secured. Productivity cosplay starts now.`,
    name => `You arrived at ${name}. Your brain has requested assistance.`,
    name => `${name}: unlocked. One coffee away from being useful.`,
    name => `You're at ${name}. Time to pay $7 for clarity.`,
    name => `${name} reached. A small win for the nervous system.`,
    name => `You made it to ${name}. The vibe has been recalibrated.`,
    name => `${name} secured. Pretend this was the plan all along.`,
  ],

  Bar: [
    name => `You made it to ${name}. Behave accordingly.`,
    name => `${name}: reached. The plot thickens.`,
    name => `You're at ${name}. A respectable decline begins.`,
    name => `${name} secured. Nothing good happens after this, which is ideal.`,
    name => `You arrived at ${name}. The evening has entered its risky phase.`,
    name => `${name}: unlocked. Your group chat may hear about this.`,
    name => `You're at ${name}. Hydration is now a legal technicality.`,
    name => `${name} reached. This feels like foreshadowing.`,
    name => `You made it to ${name}. A decision was made.`,
    name => `${name} secured. The night has gained complexity.`,
  ],

  Experience: [
    name => `You made it to ${name}. Main-character behaviour.`,
    name => `${name}: reached. This one might actually become a story.`,
    name => `You're at ${name}. Do something worth remembering.`,
    name => `${name} secured. Side quest complete.`,
    name => `You arrived at ${name}. The itinerary has aura now.`,
    name => `${name}: unlocked. Touch grass, but with structure.`,
    name => `You're at ${name}. Go earn the camera roll space.`,
    name => `${name} reached. Solid side-quest execution.`,
    name => `You made it to ${name}. This is the good part.`,
    name => `${name} secured. Lore has been added.`,
  ],

  Shopping: [
    name => `You made it to ${name}. Financial restraint is now optional.`,
    name => `${name}: reached. The cart is already judging you.`,
    name => `You're at ${name}. Browse responsibly. Or don't.`,
    name => `${name} secured. The wishlist had it coming.`,
    name => `You arrived at ${name}. Your budget just looked away.`,
    name => `${name}: unlocked. A purchase is thinking about you.`,
    name => `You're at ${name}. Stay strong. Or at least look strong.`,
    name => `${name} reached. The receipt era begins.`,
    name => `You made it to ${name}. Minimal damage, ideally.`,
    name => `${name} secured. The impulse has a location now.`,
  ],

  Other: [
    name => `You made it to ${name}. Lock it in.`,
    name => `${name}: reached. The map was right for once.`,
    name => `You're at ${name}. Make it official.`,
    name => `${name} secured. Quietly iconic.`,
    name => `You arrived at ${name}. Noted by the system.`,
    name => `${name}: unlocked. Low-key important.`,
    name => `You're at ${name}. This counts.`,
    name => `${name} reached. A clean little win.`,
    name => `You made it to ${name}. No notes.`,
    name => `${name} secured. The record will show this happened.`,
  ],
};

const NEARBY_MESSAGES: Record<Category, Array<(name: string) => string>> = {
  Food: [
    name => `${name} is nearby. Your standards are about to be tested.`,
    name => `${name} is close. Hunger has entered the chat.`,
    name => `You're near ${name}. A meal decision is forming.`,
    name => `${name} is within range. Dangerous information.`,
    name => `${name} is nearby. This could fix a lot, actually.`,
    name => `You're close to ${name}. The stomach agenda is clear.`,
    name => `${name} is within striking distance. Do what must be done.`,
    name => `${name} is nearby. The snack-to-meal pipeline is real.`,
    name => `You're near ${name}. Ignoring this would be dramatic.`,
    name => `${name} is close. The universe has plated something.`,
  ],

  Cafe: [
    name => `${name} is nearby. The caffeine economy needs you.`,
    name => `You're close to ${name}. Suddenly, coffee makes sense.`,
    name =>
      `${name} is within range. Very convenient. Suspiciously convenient.`,
    name => `${name} is nearby. Your personality may improve shortly.`,
    name => `You're near ${name}. A latte would change the tone.`,
    name => `${name} is close. Productivity is making threats.`,
    name => `${name} is within range. One cup from becoming reasonable.`,
    name => `${name} is nearby. Your inbox fears this location.`,
    name => `You're close to ${name}. The bean water is calling.`,
    name => `${name} is nearby. Emotionally, this seems necessary.`,
  ],

  Bar: [
    name => `${name} is nearby. This could become a problem.`,
    name => `You're close to ${name}. The evening has options.`,
    name => `${name} is within range. Do with that what you will.`,
    name => `${name} is nearby. A questionable decision is available.`,
    name => `You're near ${name}. The group chat would understand.`,
    name => `${name} is close. Your responsible era is under review.`,
    name => `${name} is within range. Not saying go. Just saying.`,
    name => `${name} is nearby. The vibes have submitted a request.`,
    name => `You're close to ${name}. A plot development is possible.`,
    name => `${name} is nearby. Proceed with style.`,
  ],

  Experience: [
    name => `${name} is nearby. Side quest available.`,
    name => `You're close to ${name}. The day just got less boring.`,
    name => `${name} is within range. Worth investigating.`,
    name => `${name} is nearby. Go collect the memory.`,
    name => `You're near ${name}. The main route can wait.`,
    name => `${name} is close. This is what outside is for.`,
    name => `${name} is within range. The lore demands it.`,
    name => `${name} is nearby. A better story is available.`,
    name => `You're close to ${name}. Low commitment, high upside.`,
    name => `${name} is nearby. The side quest has good timing.`,
  ],

  Shopping: [
    name => `${name} is nearby. Your wallet sensed danger.`,
    name => `You're close to ${name}. Looking is free. Usually.`,
    name => `${name} is within range. The budget is pretending not to notice.`,
    name => `${name} is nearby. The impulse purchase window is open.`,
    name => `You're near ${name}. Financial character development awaits.`,
    name => `${name} is close. A cart somewhere just got nervous.`,
    name => `${name} is within range. No one has to know.`,
    name => `${name} is nearby. The wishlist is acting innocent.`,
    name =>
      `You're close to ${name}. Enter with discipline. Leave with evidence.`,
    name => `${name} is nearby. The receipt printer is warming up.`,
  ],

  Other: [
    name => `${name} is nearby. Interesting.`,
    name => `You're close to ${name}. Might be worth a look.`,
    name => `${name} is within range. The map is nudging you.`,
    name => `${name} is nearby. Low effort, high potential.`,
    name => `You're near ${name}. Something about this feels useful.`,
    name => `${name} is close. Not urgent, but not nothing.`,
    name => `${name} is within range. A clean little detour.`,
    name => `${name} is nearby. The signal is subtle, but it's there.`,
    name => `You're close to ${name}. Could be a move.`,
    name => `${name} is nearby. File that under opportunity.`,
  ],
};

function pickRandom<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

/** A random tier-1 (arrived) message for the stash's category. */
export function arrivedMessage(stash: Stash): string {
  const bank = ARRIVED_MESSAGES[stash.category ?? 'Other'];
  return pickRandom(bank)(stash.place_name);
}

/** A random tier-2 (nearby) message for the stash's category. */
export function nearbyMessage(stash: Stash): string {
  const bank = NEARBY_MESSAGES[stash.category ?? 'Other'];
  return pickRandom(bank)(stash.place_name);
}
