import {
  classifyTier,
  haversineMeters,
  TIER_1_RADIUS_M,
  TIER_2_RADIUS_M,
} from '../distance';

describe('haversineMeters', () => {
  it('is zero for identical points', () => {
    expect(
      haversineMeters({lat: 37.77, lng: -122.41}, {lat: 37.77, lng: -122.41}),
    ).toBe(0);
  });

  it('measures ~111 km for one degree of latitude', () => {
    const d = haversineMeters({lat: 0, lng: 0}, {lat: 1, lng: 0});
    expect(d).toBeGreaterThan(111_000);
    expect(d).toBeLessThan(111_400);
  });

  it('is symmetric', () => {
    const a = {lat: 40.7128, lng: -74.006};
    const b = {lat: 34.0522, lng: -118.2437};
    expect(haversineMeters(a, b)).toBeCloseTo(haversineMeters(b, a), 6);
  });

  it('measures a short city block within a sane range', () => {
    // ~150 m apart in SF.
    const d = haversineMeters(
      {lat: 37.7749, lng: -122.4194},
      {lat: 37.7762, lng: -122.4194},
    );
    expect(d).toBeGreaterThan(120);
    expect(d).toBeLessThan(180);
  });
});

describe('classifyTier', () => {
  it('classifies inside the arrival radius as "arrived"', () => {
    expect(classifyTier(0)).toBe('arrived');
    expect(classifyTier(50)).toBe('arrived');
    expect(classifyTier(TIER_1_RADIUS_M)).toBe('arrived');
  });

  it('classifies between the two radii as "nearby"', () => {
    expect(classifyTier(TIER_1_RADIUS_M + 1)).toBe('nearby');
    expect(classifyTier(500)).toBe('nearby');
    expect(classifyTier(TIER_2_RADIUS_M)).toBe('nearby');
  });

  it('classifies beyond the outer radius as "far"', () => {
    expect(classifyTier(TIER_2_RADIUS_M + 1)).toBe('far');
    expect(classifyTier(5_000)).toBe('far');
  });
});
