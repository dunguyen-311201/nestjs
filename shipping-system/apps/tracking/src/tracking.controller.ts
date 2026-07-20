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

  // Public, unauthenticated recipient share link - see PUBLIC_ROUTES in the
  // gateway's ClerkAuthGuard. The token itself is the authorization; there
  // is no session/role check downstream of it.
  @Get('share/:token')
  async getTrackingByShareToken(
    @Param('token') token: string,
  ): Promise<TrackingResult> {
    return this.trackingService.getTrackingByShareToken(token);
  }
}
