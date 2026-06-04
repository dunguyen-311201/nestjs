import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';

import { MockAuthGuard } from '../common/guards/mock-auth.guard';
import { CreateProductDto } from './dto/create-product.dto';
import { ProductQueryDto } from './dto/product-query.dto';
import { ProductResponseDto } from './dto/product-response.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductsService } from './products.service';

const toDto = (product: unknown) =>
  plainToInstance(ProductResponseDto, product, {
    excludeExtraneousValues: true,
  });

@Controller({ path: 'products', version: '1' })
@UseGuards(MockAuthGuard)
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  async create(@Body() dto: CreateProductDto): Promise<ProductResponseDto> {
    return toDto(await this.productsService.create(dto));
  }

  @Get()
  async findAll(@Query() query: ProductQueryDto) {
    const { data, meta } = await this.productsService.findAll(query);
    return { data: data.map(toDto), meta };
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ProductResponseDto> {
    return toDto(await this.productsService.findOne(id));
  }

  @Put(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProductDto,
  ): Promise<ProductResponseDto> {
    return toDto(await this.productsService.update(id, dto));
  }

  @Delete(':id')
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ProductResponseDto> {
    return toDto(await this.productsService.remove(id));
  }
}
