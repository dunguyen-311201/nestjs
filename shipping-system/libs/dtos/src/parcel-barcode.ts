import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

// The parcel barcode format is `PA-XXXX` without a precisely specified
// character class; treating XXXX as a digit sequence (standard
// barcode/tracking-number convention), 4 digits minimum.
const PARCEL_BARCODE_REGEX = /^PA-\d{4,}$/;

export function isValidParcelBarcode(value: string): boolean {
  return typeof value === 'string' && PARCEL_BARCODE_REGEX.test(value);
}

@ValidatorConstraint({ name: 'isParcelBarcode', async: false })
class IsParcelBarcodeConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return typeof value === 'string' && isValidParcelBarcode(value);
  }

  defaultMessage(): string {
    return 'barcode must match the PA-XXXX format';
  }
}

/** class-validator decorator enforcing the Parcel barcode format (PA-XXXX). */
export function IsParcelBarcode(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsParcelBarcodeConstraint,
    });
  };
}
