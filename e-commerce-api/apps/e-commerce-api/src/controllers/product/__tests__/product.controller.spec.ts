import { FastifyRequest } from 'fastify'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { IProductService } from '#services/types'

import { HttpStatus } from '#types'

import { createMockReply, createMockRequest } from '#test-utils'

import { ProductController } from '../index'

type ProductQuery = {
  page: number
  pageSize: number
  query: string
  category: string
  order: 'DESC' | 'ASC'
  orderBy: 'name'
}

// Mock dependencies
const mockProductService = {
  updateProduct: vi.fn(),
  saveProduct: vi.fn(),
  getProducts: vi.fn(),
  getProductById: vi.fn(),
  deleteProduct: vi.fn(),
}

vi.mock('#dtos/product', () => ({
  productToObject: vi.fn((product) => ({ ...product, toObject: true })),
}))

describe('ProductController', () => {
  let productController: ProductController

  beforeEach(() => {
    vi.clearAllMocks()

    productController = new ProductController(
      mockProductService as unknown as IProductService,
    )
  })

  describe('updateProduct', () => {
    it('should update product successfully', async () => {
      const mockRequest = createMockRequest<
        FastifyRequest<{
          Params: { id: string }
          Body: any // Use any to bypass schema strict type check for mock
        }>
      >({
        params: { id: 'p1' },
        body: { name: 'Updated' },
      })
      const mockReply = createMockReply()
      mockProductService.updateProduct.mockResolvedValue({ name: 'Updated' })

      await productController.updateProduct(mockRequest, mockReply)

      expect(mockProductService.updateProduct).toHaveBeenCalledWith('p1', {
        name: 'Updated',
      })
      expect(mockReply.status).toHaveBeenCalledWith(HttpStatus.OK)
      expect(mockReply.send).toHaveBeenCalledWith({
        name: 'Updated',
        toObject: true,
      })
    })
  })

  describe('addNewProduct', () => {
    it('should add new product successfully', async () => {
      const mockRequest = createMockRequest<
        FastifyRequest<{
          Body: any // Use any
        }>
      >({
        body: {
          name: 'New Product',
          description: 'Desc',
          price: 100,
          stock: 10,
          category: 'cat1',
          status: 'published',
          images: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      })
      const mockReply = createMockReply()
      mockProductService.saveProduct.mockResolvedValue({
        id: 'p2',
        name: 'New Product',
      })

      await productController.addNewProduct(mockRequest, mockReply)

      expect(mockProductService.saveProduct).toHaveBeenCalledWith({
        name: 'New Product',
        description: 'Desc',
        price: 100,
        stock: 10,
        category: 'cat1',
        status: 'published',
        images: [],
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      })
      expect(mockReply.status).toHaveBeenCalledWith(HttpStatus.CREATED)
      expect(mockReply.send).toHaveBeenCalledWith({
        id: 'p2',
        name: 'New Product',
        toObject: true,
      })
    })
  })

  describe('getProducts', () => {
    it('should retrieve products successfully', async () => {
      const mockRequest = createMockRequest<
        FastifyRequest<{
          Querystring: ProductQuery
        }>
      >({
        query: {
          page: 1,
          pageSize: 10,
          query: '',
          category: undefined as unknown as string,
          order: 'DESC',
          orderBy: 'name',
        },
      })
      const mockReply = createMockReply()
      const mockResult = {
        data: [{ id: 'p1' }, { id: 'p2' }],
        meta: { total: 2 },
      }
      mockProductService.getProducts.mockResolvedValue(mockResult)

      await productController.getProducts(mockRequest, mockReply)

      expect(mockProductService.getProducts).toHaveBeenCalledWith({
        page: 1,
        pageSize: 10,
        query: '',
        categories: [],
        status: undefined,
        order: 'DESC',
        orderBy: 'name',
      })
      // sendSuccess uses status(200)
      expect(mockReply.status).toHaveBeenCalledWith(HttpStatus.OK)
      expect(mockReply.send).toHaveBeenCalledWith({
        data: [
          { id: 'p1', toObject: true },
          { id: 'p2', toObject: true },
        ],
        meta: { total: 2 },
      })
    })
  })

  describe('getProduct', () => {
    it('should retrieve single product successfully', async () => {
      const mockRequest = createMockRequest<
        FastifyRequest<{
          Params: { id: string }
        }>
      >({ params: { id: 'p1' } })
      const mockReply = createMockReply()
      const mockProduct = { id: 'p1', name: 'P1' }
      mockProductService.getProductById.mockResolvedValue(mockProduct)

      await productController.getProduct(mockRequest, mockReply)

      expect(mockProductService.getProductById).toHaveBeenCalledWith('p1')
      expect(mockReply.status).toHaveBeenCalledWith(HttpStatus.OK)
      expect(mockReply.send).toHaveBeenCalledWith({
        id: 'p1',
        name: 'P1',
        toObject: true,
      })
    })

    it('should return 404 if product not found', async () => {
      const mockRequest = createMockRequest<
        FastifyRequest<{
          Params: { id: string }
        }>
      >({ params: { id: 'p1' } })
      const mockReply = createMockReply()
      mockProductService.getProductById.mockResolvedValue(null)

      await productController.getProduct(mockRequest, mockReply)

      expect(mockReply.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND)
      expect(mockReply.send).toHaveBeenCalledWith({
        message: 'Product not found',
        status: HttpStatus.NOT_FOUND,
      })
    })
  })

  describe('deleteProduct', () => {
    it('should delete product successfully', async () => {
      const mockRequest = createMockRequest<
        FastifyRequest<{
          Params: { id: string }
        }>
      >({ params: { id: 'p1' } })
      const mockReply = createMockReply()
      mockProductService.deleteProduct.mockResolvedValue(undefined)

      await productController.deleteProduct(mockRequest, mockReply)

      expect(mockProductService.deleteProduct).toHaveBeenCalledWith('p1')
      expect(mockReply.status).toHaveBeenCalledWith(HttpStatus.NO_CONTENT)
      expect(mockReply.send).toHaveBeenCalledWith()
    })
  })
})
