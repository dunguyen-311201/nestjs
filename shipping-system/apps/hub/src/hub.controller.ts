import { Body, Controller, Param, Post } from '@nestjs/common';
import { IdempotencyKey } from '@app/dtos';
import { HubService, ReceiveResult } from './hub.service';
import { ReceiveDto } from './dto/receive.dto';

@Controller('hubs')
export class HubController {
  constructor(private readonly hubService: HubService) {}

  @Post(':id/receive')
  async receive(
    @Param('id') hubId: string,
    @Body() dto: ReceiveDto,
    @IdempotencyKey() idempotencyKey: string,
  ): Promise<ReceiveResult> {
    return this.hubService.receive(hubId, dto, idempotencyKey);
  }
}
