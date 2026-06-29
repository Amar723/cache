import {arrivedMessage, nearbyMessage} from '../notificationMessages';
import {CATEGORIES} from '../../types';
import type {Category, Stash} from '../../types';

function stash(id: string, category: Category | null = null): Stash {
  return {id, place_name: `Place ${id}`, category} as unknown as Stash;
}

describe('arrivedMessage / nearbyMessage', () => {
  it('always mentions the place name, for every category and the null fallback', () => {
    for (const category of [...CATEGORIES, null]) {
      const s = stash('s1', category);
      expect(arrivedMessage(s)).toContain('Place s1');
      expect(nearbyMessage(s)).toContain('Place s1');
    }
  });

  it('picks more than one distinct message across many calls', () => {
    const s = stash('s1', 'Food');
    const arrived = new Set(Array.from({length: 50}, () => arrivedMessage(s)));
    const nearby = new Set(Array.from({length: 50}, () => nearbyMessage(s)));
    expect(arrived.size).toBeGreaterThan(1);
    expect(nearby.size).toBeGreaterThan(1);
  });
});
