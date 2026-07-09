import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateOrderDto } from './create-order.dto';

function validPayload() {
  return {
    sender: {
      name: 'Alice',
      phone: '0900000000',
      address: '1 Alice St',
      region_code: 'HN01',
    },
    recipient: {
      name: 'Bob',
      phone: '0911111111',
      address: '2 Bob St',
      region_code: 'SG01',
    },
    parcels: [{ declared_weight_grams: 500, type: 'parcel' }],
    payment_type: 'PREPAID_STRIPE',
  };
}

async function validateDto(payload: unknown) {
  const dto = plainToInstance(CreateOrderDto, payload);
  return validate(dto);
}

describe('CreateOrderDto', () => {
  it('passes validation for a valid payload', async () => {
    const errors = await validateDto(validPayload());
    expect(errors).toHaveLength(0);
  });

  it('fails when sender is missing', async () => {
    const payload = validPayload() as Record<string, unknown>;
    delete payload.sender;
    const errors = await validateDto(payload);
    expect(errors.some((e) => e.property === 'sender')).toBe(true);
  });

  it('fails when recipient fields are empty strings', async () => {
    const payload = validPayload();
    payload.recipient.name = '';
    const errors = await validateDto(payload);
    expect(errors.some((e) => e.property === 'recipient')).toBe(true);
  });

  it('fails when parcels array is empty', async () => {
    const payload = validPayload();
    payload.parcels = [];
    const errors = await validateDto(payload);
    expect(errors.some((e) => e.property === 'parcels')).toBe(true);
  });

  it('fails when declared_weight_grams is not > 0', async () => {
    const payload = validPayload();
    payload.parcels[0].declared_weight_grams = 0;
    const errors = await validateDto(payload);
    expect(errors.some((e) => e.property === 'parcels')).toBe(true);
  });

  it('fails when parcel type is invalid', async () => {
    const payload = validPayload();
    (payload.parcels[0] as { type: string }).type = 'envelope';
    const errors = await validateDto(payload);
    expect(errors.some((e) => e.property === 'parcels')).toBe(true);
  });

  it('fails when payment_type is not PREPAID_STRIPE', async () => {
    const payload = { ...validPayload(), payment_type: 'POSTPAID' };
    const errors = await validateDto(payload);
    expect(errors.some((e) => e.property === 'payment_type')).toBe(true);
  });
});
