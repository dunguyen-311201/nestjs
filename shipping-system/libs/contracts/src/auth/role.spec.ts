import { isRole, ROLES } from './role';

describe('Role contract', () => {
  it('defines exactly the five system roles', () => {
    expect(ROLES).toEqual([
      'customer',
      'shipper',
      'hub_staff',
      'dispatcher',
      'admin',
    ]);
  });

  it.each(ROLES)('isRole accepts "%s"', (role) => {
    expect(isRole(role)).toBe(true);
  });

  it.each(['superuser', '', 'ADMIN', 42, null, undefined, {}])(
    'isRole rejects %p',
    (value) => {
      expect(isRole(value)).toBe(false);
    },
  );
});
