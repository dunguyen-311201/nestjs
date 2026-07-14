import { Body, Controller, Param, Post } from '@nestjs/common';
import { IdempotencyKey } from '@app/dtos';
import {
  CreateTripResult,
  LinehaulService,
  TripActionResult,
} from './linehaul.service';
import { CreateTripDto } from './dto/create-trip.dto';

@Controller('trips')
export class LinehaulController {
  constructor(private readonly linehaulService: LinehaulService) {}

  @Post()
  async create(
    @Body() dto: CreateTripDto,
    @IdempotencyKey() idempotencyKey: string,
  ): Promise<CreateTripResult> {
    return this.linehaulService.createTrip(dto, idempotencyKey);
  }

  @Post(':id/depart')
  async depart(
    @Param('id') tripId: string,
    @IdempotencyKey() idempotencyKey: string,
  ): Promise<TripActionResult> {
    return this.linehaulService.depart(tripId, idempotencyKey);
  }

  @Post(':id/arrive')
  async arrive(
    @Param('id') tripId: string,
    @IdempotencyKey() idempotencyKey: string,
  ): Promise<TripActionResult> {
    return this.linehaulService.arrive(tripId, idempotencyKey);
  }
}
