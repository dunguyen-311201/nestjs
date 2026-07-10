import { Controller, Get, Param } from '@nestjs/common';
import { TrackingService, TrackingResult } from './tracking.service';

@Controller('tracking')
export class TrackingController {
  constructor(private readonly trackingService: TrackingService) {}

  @Get(':trackingId')
  async getTracking(
    @Param('trackingId') trackingId: string,
  ): Promise<TrackingResult> {
    return this.trackingService.getTracking(trackingId);
  }
}
