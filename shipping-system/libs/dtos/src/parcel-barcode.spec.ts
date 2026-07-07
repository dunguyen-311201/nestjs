import { isValidParcelBarcode } from './parcel-barcode';

describe('isValidParcelBarcode', () => {
  it('accepts the documented PA-XXXX format (PA- followed by digits)', () => {
    expect(isValidParcelBarcode('PA-1234')).toBe(true);
    expect(isValidParcelBarcode('PA-000123456')).toBe(true);
  });

  it('rejects wrong prefix', () => {
    expect(isValidParcelBarcode('MN-1234')).toBe(false);
  });

  it('rejects missing digits after the prefix', () => {
    expect(isValidParcelBarcode('PA-')).toBe(false);
    expect(isValidParcelBarcode('PA-ABCD')).toBe(false);
  });

  it('rejects lowercase prefix', () => {
    expect(isValidParcelBarcode('pa-1234')).toBe(false);
  });

  it('rejects non-string input', () => {
    expect(isValidParcelBarcode(undefined as unknown as string)).toBe(false);
  });
});
