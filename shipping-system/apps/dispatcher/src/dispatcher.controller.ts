import { Body, Controller, Param, Post } from '@nestjs/common';
import { IdempotencyKey } from '@app/dtos';
import { DispatcherService, AssignmentResult } from './dispatcher.service';
import { AssignTripDto } from './dto/assign-trip.dto';
import { AssignLegDto } from './dto/assign-leg.dto';

@Controller()
export class DispatcherController {
  constructor(private readonly dispatcherService: DispatcherService) {}

  @Post('trips/:id/assign')
  async assignTrip(
    @Param('id') tripId: string,
    @Body() dto: AssignTripDto,
    @IdempotencyKey() idempotencyKey: string,
  ): Promise<AssignmentResult> {
    return this.dispatcherService.assignTrip(tripId, dto, idempotencyKey);
  }

  @Post('legs/:id/assign')
  async assignLeg(
    @Param('id') parcelId: string,
    @Body() dto: AssignLegDto,
    @IdempotencyKey() idempotencyKey: string,
  ): Promise<AssignmentResult> {
    return this.dispatcherService.assignLeg(parcelId, dto, idempotencyKey);
  }
}
