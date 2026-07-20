import { TrackingController } from './tracking.controller';

describe('TrackingController', () => {
  let trackingService: {
    getTracking: jest.Mock;
    getTrackingByShareToken: jest.Mock;
  };
  let controller: TrackingController;

  beforeEach(() => {
    trackingService = {
      getTracking: jest.fn(),
      getTrackingByShareToken: jest.fn(),
    };
    controller = new TrackingController(trackingService as never);
  });

  it('delegates to TrackingService.getTracking with the path param', async () => {
    const expected = {
      shipment_order_id: 'order-1',
      status: null,
      parcels: [],
    };
    trackingService.getTracking.mockResolvedValue(expected);

    const result = await controller.getTracking('order-1');

    expect(trackingService.getTracking).toHaveBeenCalledWith('order-1');
    expect(result).toBe(expected);
  });

  it('delegates to TrackingService.getTrackingByShareToken with the token param', async () => {
    const expected = {
      shipment_order_id: 'order-1',
      status: null,
      parcels: [],
    };
    trackingService.getTrackingByShareToken.mockResolvedValue(expected);

    const result = await controller.getTrackingByShareToken('token-1');

    expect(trackingService.getTrackingByShareToken).toHaveBeenCalledWith(
      'token-1',
    );
    expect(result).toBe(expected);
  });
});
