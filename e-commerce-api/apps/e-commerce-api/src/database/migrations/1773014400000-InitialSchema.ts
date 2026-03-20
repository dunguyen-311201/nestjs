import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1773014400000 implements MigrationInterface {
    name = 'InitialSchema1773014400000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "users" ("id" character varying NOT NULL, "username" character varying, "first_name" character varying NOT NULL, "last_name" character varying, "age" integer, "email" character varying NOT NULL, "phone" character varying, "avatar" character varying, "password" character varying, "stripe_id" character varying, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "role" character varying, "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_fe0bb3f6520ee0469504521e710" UNIQUE ("username"), CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "UQ_a000cca60bcf04454e727699490" UNIQUE ("phone"), CONSTRAINT "UQ_57c299c1793b1cffc299d5c28c6" UNIQUE ("stripe_id"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "orders" ("id" SERIAL NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "status" character varying NOT NULL, "total_amount" numeric NOT NULL, "invoice_id" character varying, "payment_secret" character varying, "user_id" character varying, CONSTRAINT "PK_710e2d4957aa5878dfe94e4ac2f" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "order_items" ("id" SERIAL NOT NULL, "quantity" integer NOT NULL, "price_at_purchase" numeric NOT NULL, "order_id" integer, "product_id" character varying, CONSTRAINT "PK_005269d8574e6fac0493715c308" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "categories" ("id" SERIAL NOT NULL, "name" character varying NOT NULL, "description" character varying, CONSTRAINT "UQ_8b0be371d28245da6e4f4b61878" UNIQUE ("name"), CONSTRAINT "PK_24dbc6126a28ff948da33e97d3b" PRIMARY KEY ("id"))`);
        await queryRunner.query(`DO $$ BEGIN CREATE TYPE "public"."products_status_enum" AS ENUM('draft', 'published', 'archived', 'deleted'); EXCEPTION WHEN duplicate_object THEN null; END $$`);
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "products" ("created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "id" character varying NOT NULL, "name" character varying NOT NULL, "description" character varying NOT NULL, "price" numeric NOT NULL, "stock" integer NOT NULL, "reservedStock" integer NOT NULL DEFAULT '0', "images" text, "status" "public"."products_status_enum" NOT NULL DEFAULT 'draft', "category" character varying, CONSTRAINT "PK_0806c755e0aca124e67c0cf6d7d" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "cart_items" ("id" SERIAL NOT NULL, "cart_id" integer NOT NULL, "product_id" character varying NOT NULL, "quantity" integer NOT NULL, CONSTRAINT "PK_6fccf5ec03c172d27a28a82928b" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "carts" ("id" SERIAL NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "status" character varying NOT NULL DEFAULT 'active', "user_id" character varying, CONSTRAINT "REL_2ec1c94a977b940d85a4f498ae" UNIQUE ("user_id"), CONSTRAINT "PK_b5f695a59f5ebb50af3c8160816" PRIMARY KEY ("id"))`);
        await queryRunner.query(`DO $$ BEGIN CREATE TYPE "public"."stock_reservation_status_enum" AS ENUM('reserved', 'released', 'converted'); EXCEPTION WHEN duplicate_object THEN null; END $$`);
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "stock_reservation" ("id" SERIAL NOT NULL, "cart_id" integer NOT NULL, "product_id" character varying NOT NULL, "quantity" integer NOT NULL, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "status" "public"."stock_reservation_status_enum" NOT NULL DEFAULT 'reserved', "created_at" TIMESTAMP NOT NULL DEFAULT now(), "invoice_id" character varying, CONSTRAINT "PK_a1f7c9841feb7e5744923efa2d2" PRIMARY KEY ("id"))`);
        await queryRunner.query(`DO $$ BEGIN ALTER TABLE "orders" ADD CONSTRAINT "FK_a922b820eeef29ac1c6800e826a" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION; EXCEPTION WHEN duplicate_object THEN null; END $$`);
        await queryRunner.query(`DO $$ BEGIN ALTER TABLE "order_items" ADD CONSTRAINT "FK_145532db85752b29c57d2b7b1f1" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE NO ACTION ON UPDATE NO ACTION; EXCEPTION WHEN duplicate_object THEN null; END $$`);
        await queryRunner.query(`DO $$ BEGIN ALTER TABLE "order_items" ADD CONSTRAINT "FK_9263386c35b6b242540f9493b00" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE NO ACTION ON UPDATE NO ACTION; EXCEPTION WHEN duplicate_object THEN null; END $$`);
        await queryRunner.query(`DO $$ BEGIN ALTER TABLE "products" ADD CONSTRAINT "FK_c3932231d2385ac248d0888d955" FOREIGN KEY ("category") REFERENCES "categories"("name") ON DELETE NO ACTION ON UPDATE NO ACTION; EXCEPTION WHEN duplicate_object THEN null; END $$`);
        await queryRunner.query(`DO $$ BEGIN ALTER TABLE "cart_items" ADD CONSTRAINT "FK_6385a745d9e12a89b859bb25623" FOREIGN KEY ("cart_id") REFERENCES "carts"("id") ON DELETE NO ACTION ON UPDATE NO ACTION; EXCEPTION WHEN duplicate_object THEN null; END $$`);
        await queryRunner.query(`DO $$ BEGIN ALTER TABLE "cart_items" ADD CONSTRAINT "FK_30e89257a105eab7648a35c7fce" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE NO ACTION ON UPDATE NO ACTION; EXCEPTION WHEN duplicate_object THEN null; END $$`);
        await queryRunner.query(`DO $$ BEGIN ALTER TABLE "carts" ADD CONSTRAINT "FK_2ec1c94a977b940d85a4f498aea" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION; EXCEPTION WHEN duplicate_object THEN null; END $$`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "carts" DROP CONSTRAINT IF EXISTS "FK_2ec1c94a977b940d85a4f498aea"`);
        await queryRunner.query(`ALTER TABLE "cart_items" DROP CONSTRAINT IF EXISTS "FK_30e89257a105eab7648a35c7fce"`);
        await queryRunner.query(`ALTER TABLE "cart_items" DROP CONSTRAINT IF EXISTS "FK_6385a745d9e12a89b859bb25623"`);
        await queryRunner.query(`ALTER TABLE "products" DROP CONSTRAINT IF EXISTS "FK_c3932231d2385ac248d0888d955"`);
        await queryRunner.query(`ALTER TABLE "order_items" DROP CONSTRAINT IF EXISTS "FK_9263386c35b6b242540f9493b00"`);
        await queryRunner.query(`ALTER TABLE "order_items" DROP CONSTRAINT IF EXISTS "FK_145532db85752b29c57d2b7b1f1"`);
        await queryRunner.query(`ALTER TABLE "orders" DROP CONSTRAINT IF EXISTS "FK_a922b820eeef29ac1c6800e826a"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "stock_reservation"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "public"."stock_reservation_status_enum"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "carts"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "cart_items"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "products"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "public"."products_status_enum"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "categories"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "order_items"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "orders"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "users"`);
    }

}
