import {
  INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { DataSource } from 'typeorm';
import { HttpExceptionFilter, LoggingInterceptor } from '@app/common';
import { AppModule } from '../src/app.module';

describe('Product App (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const authHeader = { Authorization: 'Bearer mock-token' };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalInterceptors(new LoggingInterceptor());
    app.enableVersioning({ type: VersioningType.URI });
    await app.init();

    dataSource = moduleFixture.get(DataSource);
  });

  afterAll(async () => {
    await dataSource.dropDatabase();
    await app.close();
  });

  describe('Categories', () => {
    let categoryId: string;

    it('POST /v1/categories — creates a category', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/categories')
        .set(authHeader)
        .send({ name: 'Electronics', description: 'Electronic devices' })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.name).toBe('Electronics');
      categoryId = res.body.id;
    });

    it('GET /v1/categories — lists categories', async () => {
      const res = await request(app.getHttpServer())
        .get('/v1/categories')
        .set(authHeader)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].name).toBe('Electronics');
    });

    it('GET /v1/categories/:id — returns a category', async () => {
      const res = await request(app.getHttpServer())
        .get(`/v1/categories/${categoryId}`)
        .set(authHeader)
        .expect(200);

      expect(res.body.id).toBe(categoryId);
    });

    it('PUT /v1/categories/:id — updates a category', async () => {
      const res = await request(app.getHttpServer())
        .put(`/v1/categories/${categoryId}`)
        .set(authHeader)
        .send({ description: 'Updated description' })
        .expect(200);

      expect(res.body.description).toBe('Updated description');
    });

    it('GET /v1/categories/:id — returns 404 for unknown id', async () => {
      await request(app.getHttpServer())
        .get('/v1/categories/00000000-0000-0000-0000-000000000000')
        .set(authHeader)
        .expect(404);
    });

    describe('Products', () => {
      let productId: string;

      it('POST /v1/products — creates a product', async () => {
        const res = await request(app.getHttpServer())
          .post('/v1/products')
          .set(authHeader)
          .send({ name: 'Laptop', price: 999.99, stock: 50, categoryId })
          .expect(201);

        expect(res.body.id).toBeDefined();
        expect(res.body.name).toBe('Laptop');
        expect(res.body.categoryId).toBe(categoryId);
        expect(res.body.categoryName).toBe('Electronics');
        productId = res.body.id;
      });

      it('GET /v1/products — lists products', async () => {
        const res = await request(app.getHttpServer())
          .get('/v1/products')
          .set(authHeader)
          .expect(200);

        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body).toHaveLength(1);
      });

      it('GET /v1/products?categoryId= — filters by category', async () => {
        const res = await request(app.getHttpServer())
          .get(`/v1/products?categoryId=${categoryId}`)
          .set(authHeader)
          .expect(200);

        expect(res.body).toHaveLength(1);
        expect(res.body[0].categoryId).toBe(categoryId);
      });

      it('GET /v1/products/:id — returns a product', async () => {
        const res = await request(app.getHttpServer())
          .get(`/v1/products/${productId}`)
          .set(authHeader)
          .expect(200);

        expect(res.body.id).toBe(productId);
      });

      it('PUT /v1/products/:id — updates a product', async () => {
        const res = await request(app.getHttpServer())
          .put(`/v1/products/${productId}`)
          .set(authHeader)
          .send({ price: 899.99 })
          .expect(200);

        expect(Number(res.body.price)).toBe(899.99);
      });

      it('DELETE /v1/products/:id — removes a product', async () => {
        await request(app.getHttpServer())
          .delete(`/v1/products/${productId}`)
          .set(authHeader)
          .expect(204);
      });

      it('GET /v1/products/:id — returns 404 after deletion', async () => {
        await request(app.getHttpServer())
          .get(`/v1/products/${productId}`)
          .set(authHeader)
          .expect(404);
      });
    });

    it('DELETE /v1/categories/:id — removes the category', async () => {
      await request(app.getHttpServer())
        .delete(`/v1/categories/${categoryId}`)
        .set(authHeader)
        .expect(204);
    });
  });

  it('GET /v1/products — requires auth', async () => {
    await request(app.getHttpServer()).get('/v1/products').expect(401);
  });
});
