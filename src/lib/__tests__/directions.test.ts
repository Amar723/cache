import {appleMapsDirectionsUrl, googleMapsDirectionsUrl} from '../directions';

describe('appleMapsDirectionsUrl', () => {
  it('builds a daddr link with no origin, defaulting to current location', () => {
    expect(
      appleMapsDirectionsUrl({
        lat: 40.7307,
        lng: -74.0023,
        label: "Joe's Pizza",
      }),
    ).toBe(
      "https://maps.apple.com/?daddr=40.7307,-74.0023&q=Joe's%20Pizza&dirflg=d",
    );
  });
});

describe('googleMapsDirectionsUrl', () => {
  it('builds a destination link with no origin, defaulting to current location', () => {
    expect(
      googleMapsDirectionsUrl({lat: 40.7307, lng: -74.0023, label: 'x'}),
    ).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=40.7307,-74.0023&travelmode=driving',
    );
  });
});
