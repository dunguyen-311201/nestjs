import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  createMockPaymentGateway,
  createMockRepository,
  loggerMock,
} from '#test-utils'

import { Product } from '#entities'

import { ProductService } from '../index'

describe('ProductService', () => {
  let productService: ProductService
  let productRepositoryMock: ReturnType<typeof createMockRepository>
  let categoryRepositoryMock: ReturnType<typeof createMockRepository>
  let paymentGatewayProviderMock: ReturnType<typeof createMockPaymentGateway>

  beforeEach(() => {
    vi.clearAllMocks()

    productRepositoryMock = createMockRepository()
    categoryRepositoryMock = createMockRepository()
    paymentGatewayProviderMock = createMockPaymentGateway()

    productService = new ProductService(
      productRepositoryMock as any,
      categoryRepositoryMock as any,
      paymentGatewayProviderMock as any,
      loggerMock,
    )
  })

  describe('getProducts', () => {
    it('should return a list of products and pagination metadata', async () => {
      // Arrange
      const mockProducts: Product[] = [
        {
          id: '1',
          name: 'Product 1',
          description: 'Description 1',
          price: 10,
          stock: 5,
          reservedStock: 0,
          images: [],
          category: {
            id: 1,
            name: 'Category 1',
            description: 'Category description',
          },
          createdAt: new Date(),
          updatedAt: new Date(),
          status: 'published',
        },
      ]
      const totalCount = 1

      productRepositoryMock.getProducts.mockResolvedValueOnce([
        mockProducts,
        totalCount,
      ])

      const params = {
        query: '',
        page: 1,
        pageSize: 10,
        categories: [],
      }

      // Act
      const result = await productService.getProducts(params)

      // Assert
      expect(productRepositoryMock.getProducts).toHaveBeenCalledWith({
        pageSize: 10,
        query: '',
        skip: 0,
        categories: [],
      })
      expect(result.data).toEqual(mockProducts)
      expect(result.meta.pagination).toEqual({
        totalItems: totalCount,
        itemCount: mockProducts.length,
        itemsPerPage: params.pageSize,
        totalPages: 1,
        currentPage: 1,
      })

      expect(loggerMock.info).toHaveBeenCalledWith(
        { totalCount, returnedCount: mockProducts.length, page: params.page },
        'Products fetched successfully',
      )
    })

    it('should filter products by query string', async () => {
      const mockProducts: Product[] = []
      const totalCount = 0
      productRepositoryMock.getProducts.mockResolvedValueOnce([
        mockProducts,
        totalCount,
      ])

      const params = {
        query: 'search term',
        page: 1,
        pageSize: 10,
        categories: [],
      }

      await productService.getProducts(params)

      expect(productRepositoryMock.getProducts).toHaveBeenCalledWith(
        expect.objectContaining({ query: 'search term' }),
      )
    })
  })

  describe('getProductById', () => {
    it('should return product when found', async () => {
      const mockProduct: Product = {
        id: '1',
        name: 'Product 1',
        description: 'Description 1',
        price: 10,
        stock: 5,
        reservedStock: 0,
        images: [],
        category: {
          id: 1,
          name: 'Category 1',
          description: 'Category description',
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        status: 'published',
      }
      productRepositoryMock.getById.mockResolvedValue(mockProduct)

      const result = await productService.getProductById('1')

      expect(result).toEqual(mockProduct)
      expect(productRepositoryMock.getById).toHaveBeenCalledWith('1')
      expect(loggerMock.debug).toHaveBeenCalledWith(
        { productId: '1' },
        'Product found',
      )
    })

    it('should return null when product not found', async () => {
      productRepositoryMock.getById.mockResolvedValue(null)

      const result = await productService.getProductById('999')

      expect(result).toBeNull()
      expect(loggerMock.debug).toHaveBeenCalledWith(
        { productId: '999' },
        'Product not found',
      )
    })
  })

  describe('saveProduct', () => {
    it('should create product with Stripe integration', async () => {
      // Payload matches addProductSchema
      const payload: any = {
        name: 'New Product',
        description: 'New Description',
        price: 100,
        stock: 10,
        category: 'Category', // properties.category is string in schema
        images: ['image1.jpg'],
        status: 'published',
      }

      // Mock Category
      const mockCategory = {
        id: 1,
        name: 'Category',
        description: 'Category description',
      }
      categoryRepositoryMock.findOneBy.mockResolvedValue(mockCategory)

      const stripeProduct = { id: 'stripe_123' }
      paymentGatewayProviderMock.createProduct.mockResolvedValue(stripeProduct)

      const savedProduct = {
        ...payload,
        id: 'stripe_123',
        category: mockCategory,
      }
      productRepositoryMock.save.mockResolvedValue(savedProduct)

      const result = await productService.saveProduct(payload)

      expect(categoryRepositoryMock.findOneBy).toHaveBeenCalledWith({
        name: payload.category,
      })
      expect(paymentGatewayProviderMock.createProduct).toHaveBeenCalledWith({
        name: payload.name,
        description: payload.description,
        images: payload.images,
        active: true,
        default_price_data: {
          currency: 'usd',
          unit_amount: payload.price * 100,
        },
      })
      expect(productRepositoryMock.save).toHaveBeenCalledWith({
        ...payload,
        id: 'stripe_123',
        category: mockCategory,
      })
      expect(result).toEqual(savedProduct)
    })

    it('should handle errors during product creation', async () => {
      const payload: any = {
        name: 'New Product',
        description: 'New Description',
        price: 100,
        stock: 10,
        category: 'Category',
        images: ['image1.jpg'],
        status: 'published',
      }

      // Mock Category to be found (otherwise it throws BadRequest before stripe)
      categoryRepositoryMock.findOneBy.mockResolvedValue({
        id: 1,
        name: 'Category',
      })

      paymentGatewayProviderMock.createProduct.mockRejectedValue(
        new Error('Stripe error'),
      )

      await expect(productService.saveProduct(payload)).rejects.toThrow(
        'Stripe error',
      )
    })

    it('should throw BadRequestError if category not found', async () => {
      const payload: any = {
        name: 'New Product',
        description: 'New Description',
        price: 100,
        stock: 10,
        category: 'Unknown Category',
        images: [],
        status: 'published',
      }

      categoryRepositoryMock.findOneBy.mockResolvedValue(null)

      await expect(productService.saveProduct(payload)).rejects.toThrow(
        'Not found Category by name: Unknown Category',
      )
    })
  })

  describe('updateProduct', () => {
    it('should update product successfully', async () => {
      const existingProduct: Product = {
        id: '1',
        name: 'Old Name',
        description: 'Old Description',
        price: 50,
        stock: 5,
        reservedStock: 0,
        images: [],
        category: {
          id: 1,
          name: 'Category',
          description: 'Category description',
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        status: 'published',
      }

      const updates: any = { name: 'New Name', price: 100 }
      const updatedProduct = { ...existingProduct, ...updates }

      productRepositoryMock.getById.mockResolvedValue(existingProduct)
      productRepositoryMock.save.mockResolvedValue(updatedProduct)

      const result = await productService.updateProduct('1', updates)

      expect(result).toEqual(updatedProduct)
      expect(productRepositoryMock.save).toHaveBeenCalled()
    })

    it('should throw BadRequestError when product does not exist', async () => {
      productRepositoryMock.getById.mockResolvedValue(null)

      await expect(
        productService.updateProduct('999', { name: 'New Name' } as any),
      ).rejects.toThrow('Not found Product by ID: 999')
    })

    it('should throw BadRequestError when stock is less than reserved stock', async () => {
      const existingProduct: Product = {
        id: '1',
        name: 'Product 1',
        description: 'Description 1',
        price: 10,
        stock: 10,
        reservedStock: 5,
        images: [],
        category: {
          id: 1,
          name: 'Category 1',
          description: 'Category description',
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        status: 'published',
      }

      productRepositoryMock.getById.mockResolvedValue(existingProduct)

      await expect(
        productService.updateProduct('1', { stock: 4 } as any),
      ).rejects.toThrow('Stock cannot be less than reserved stock')
    })
  })
})
