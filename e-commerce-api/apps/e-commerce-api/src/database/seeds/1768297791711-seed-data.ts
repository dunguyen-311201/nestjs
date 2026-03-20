import { clerkClient } from '@clerk/fastify'
import { MigrationInterface, QueryRunner } from 'typeorm'

import { StripePaymentAdapter } from '#adapters'
import { faker } from '@faker-js/faker'
import Stripe from 'stripe'

import env from '#env'

import { IProduct, USER_ROLES } from '#types'

const mockLogger = {
  info: () => {},
  error: () => {},
  warn: () => {},
  debug: () => {},
  trace: () => {},
  fatal: () => {},
  child: () => mockLogger,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any

const sync = true

export class SeedData1768297791711 implements MigrationInterface {
  stripe = new StripePaymentAdapter(
    new Stripe(env.stripe.secretKey),
    mockLogger,
  )

  public async up(queryRunner: QueryRunner): Promise<void> {
    const seedUser = async () => {
      const { data } = await clerkClient.users.getUserList({})

      if (data.length > 0) {
        await Promise.all(
          data.map(async (user) => {
            const {
              firstName,
              lastName,
              emailAddresses,
              imageUrl,
              id: userId,
            } = user
            const email = emailAddresses[0]?.emailAddress
            const customer = await this.stripe.findOrCreateCustomer({
              email,
              name: [firstName, lastName].filter(Boolean).join(' '),
            })
            await queryRunner.query(
              `INSERT INTO users (id, first_name, last_name, email, avatar, role, stripe_id ) 
            VALUES ($1, $2, $3, $4, $5, $6, $7)`,
              [
                userId,
                firstName,
                lastName,
                email,
                imageUrl,
                USER_ROLES.USER,
                customer.id,
              ],
            )
          }),
        )
      }
    }

    const ecommerceCategories = [
      'fashion',
      'clothing',
      'shoes',
      'watch',
      'electronics',
      'food',
    ]

    // ecommerce categories
    const categories = [
      'Computer',
      'Clothes',
      'Games',
      'Food',
      'Shoes',
      'Furniture',
      'Office',
      'Mobile',
      'Camera',
      'Sport',
    ]

    const randomCategory = () =>
      categories[
        faker.number.int({ max: categories.length - 1, min: 0 })
      ] as string

    const seedCategory = async () => {
      await Promise.all(
        categories.map((category) =>
          queryRunner.query(
            `INSERT INTO categories (name, description) 
          VALUES ($1, $2) ON CONFLICT (name) DO NOTHING`,
            [
              category,
              `${faker.commerce.productMaterial()} ${faker.commerce.productAdjective()}`,
            ],
          ),
        ),
      )
    }

    const seedProduct = async () => {
      const MAX_PRODUCTS = 20

      faker.seed(MAX_PRODUCTS * 1000)

      await seedCategory()

      // const categories = faker.helpers.uniqueArray(
      //   faker.commerce.department,
      //   CATEGORIES_COUNT,
      // )

      await Promise.all(
        Array(MAX_PRODUCTS)
          .fill(0)
          .map(async () => {
            const name = faker.commerce.productName().replaceAll("'", '`')
            const description = faker.commerce
              .productDescription()
              .replaceAll("'", '`')
            const price = faker.commerce.price({ max: 500, min: 10 })
            const stock = faker.number.int({ min: 50, max: 500 })
            // const imageUrl = faker.image.urlPicsumPhotos({
            //   width: 640,
            //   height: 480,
            //   grayscale: false,
            //   blur: 0,
            // })

            const category = randomCategory()
            const imageUrl = faker.image.urlLoremFlickr({
              width: 640,
              height: 480,
              // Randomly picks one ecommerce category from the list above
              category: faker.helpers.arrayElement(ecommerceCategories),
            })
            const { id: productId } = await this.stripe.createProduct({
              name,
              description,
              default_price_data: {
                currency: 'usd',
                unit_amount: Math.round(parseFloat(price) * 100),
              },
              active: true,
              images: [imageUrl],
            })

            await queryRunner.query(
              `INSERT INTO products (id, name, description, price, stock, category, images, status) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            `,
              [
                productId,
                name,
                description,
                price,
                stock,
                category,
                imageUrl,
                'published',
              ],
            )
          }),
      )
    }

    const syncProduct = async () => {
      let response = await this.stripe.getProducts({ limit: 10 })

      let products: IProduct[] = []

      while (response.has_more) {
        products = [...products, ...response.data]
        response = await this.stripe.getProducts({
          limit: 10,
          starting_after: response.data[response.data.length - 1]?.id,
        })

        if (!response.has_more) break
      }

      const promies = products.map((product) =>
        queryRunner.query(
          `INSERT INTO products (id, name, description, price, stock, category, images, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT (id) DO NOTHING;
            `,
          [
            product.id,
            product.name,
            product.description,
            (product.default_price.unit_amount ?? 0) / 100,
            faker.number.int({ min: 50, max: 500 }),
            randomCategory(),
            product.images[0],
            'published',
          ],
        ),
      )

      await Promise.all(promies)
    }

    if (sync) {
      await seedCategory()
      await Promise.all([seedUser(), syncProduct()])
    } else {
      await Promise.all([seedUser(), seedProduct()])
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM stock_reservation`)
    await queryRunner.query(`DELETE FROM order_items`)
    await queryRunner.query(`DELETE FROM cart_items`)
    await queryRunner.query(`DELETE FROM orders`)
    await queryRunner.query(`DELETE FROM carts`)
    await queryRunner.query(`DELETE FROM products`)
    await queryRunner.query(`DELETE FROM categories`)
    await queryRunner.query(`DELETE FROM users`)
  }
}
