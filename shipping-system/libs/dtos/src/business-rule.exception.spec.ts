import { UnprocessableEntityException } from '@nestjs/common';
import { BusinessRuleException } from './business-rule.exception';

describe('BusinessRuleException', () => {
  it('extends UnprocessableEntityException', () => {
    const error = new BusinessRuleException('BR-02', 'test message');
    expect(error).toBeInstanceOf(UnprocessableEntityException);
  });

  it('carries { rule, message } in its response body', () => {
    const error = new BusinessRuleException('BR-02', 'test message');
    expect(error.getResponse()).toEqual({
      rule: 'BR-02',
      message: 'test message',
    });
  });

  it('exposes the rule and message as readonly properties', () => {
    const error = new BusinessRuleException('BR-04', 'another message');
    expect(error.rule).toBe('BR-04');
    expect(error.message).toBe('another message');
  });
});
