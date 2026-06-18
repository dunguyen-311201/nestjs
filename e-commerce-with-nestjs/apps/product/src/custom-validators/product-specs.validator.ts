import {
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

@ValidatorConstraint({ name: 'ProductSpecs', async: false })
export class ProductSpecs implements ValidatorConstraintInterface {
  accepetedSpecs = [
    'ram',
    'processor',
    'ssd',
    'hdd',
    'brand',
    'model',
    'color',
    'weight',
    'dimensions',
    'material',
    'capacity',
    'power',
    'voltage',
    'warranty',
    'condition',
    'chip',
    'year',
    'other_features',
  ];

  validate(specs: Record<string, string>): boolean {
    const keys = Object.keys(specs);
    if (keys.length === 0) return true;
    return keys.every(
      (key) => this.accepetedSpecs.includes(key) && specs[key].trim() !== '',
    );
  }

  defaultMessage(): string {
    return 'Product specs must be a valid object with supported specs';
  }
}
