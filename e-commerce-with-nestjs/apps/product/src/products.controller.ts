import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';
import { CurrentUser, JwtAuthGuard, Roles, RolesGuard } from '@app/common';
import type { JwtPayload } from '@app/common';
import { UserRole } from '@app/shared';
import { CACHE_TTL_MS } from './cache.constants';
import { ProductQueryDto } from './dto/product-query.dto';
import { ProductResponseDto } from './dto/product-response.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductsService } from './products.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({ path: 'products', version: '1' })
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.MERCHANT)
  create(
    @Body() dto: CreateProductDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<ProductResponseDto> {
    return this.productsService.create(dto, user);
  }

  @Get()
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(CACHE_TTL_MS)
  findAll(@Query() query: ProductQueryDto): Promise<ProductResponseDto[]> {
    return this.productsService.findAll(query);
  }

  @Get(':id')
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(CACHE_TTL_MS)
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<ProductResponseDto> {
    return this.productsService.findOne(id);
  }

  @Put(':id')
  @Roles(UserRole.ADMIN, UserRole.MERCHANT)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProductDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<ProductResponseDto> {
    return this.productsService.update(id, dto, user);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.MERCHANT)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<void> {
    return this.productsService.remove(id, user);
  }
}
