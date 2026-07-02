# Low-Level Design (LLD) & Class Design

This document details the code-level structure, TypeORM entity mappings, state machine validation, Stripe integration, and Mailer configurations for the microservices.

---

## 1. Monorepo File Structure

We follow a unified monorepo structure managed by `pnpm`:

```
shipping-system/
├── apps/
│   ├── order-service/             # NestJS Application (Port 3001)
│   │   ├── src/
│   │   │   ├── order/
│   │   │   │   ├── entities/      # TypeORM Entities (Order, Parcel, Payment)
│   │   │   │   ├── order.controller.ts
│   │   │   │   ├── order.service.ts
│   │   │   │   └── order.module.ts
│   │   │   └── main.ts
│   ├── tracking-service/          # NestJS Application (Port 3002)
│   │   ├── src/
│   │   │   ├── tracking/
│   │   │   │   ├── entities/      # TypeORM Entities (ScanEvent, DeliveryAttempt)
│   │   │   │   ├── state/         # State Machine Logic
│   │   │   │   ├── tracking.controller.ts
│   │   │   │   ├── tracking.service.ts
│   │   │   │   └── tracking.module.ts
│   │   │   └── main.ts
│   ├── payment-service/           # NestJS Application (Port 3003)
│   │   ├── src/
│   │   │   ├── payment/
│   │   │   │   ├── payment.controller.ts
│   │   │   │   ├── payment.service.ts
│   │   │   │   └── payment.module.ts
│   │   │   └── main.ts
│   └── notification-service/      # NestJS Application (Port 3004)
│       ├── src/
│       │   ├── notification/
│       │   │   ├── notification.service.ts
│       │   │   └── notification.module.ts
│       │   └── main.ts
├── libs/
│   └── shared/                    # Shared library package
│       └── src/
│           ├── dtos/              # Shared DTOs & Validation
│           ├── contracts/         # TypeScript NATS Event interfaces
│           └── crypto/            # PII Encrypt/Decrypt helpers
├── docker-compose.yml
└── pnpm-workspace.yaml
```

---

## 2. TypeORM Entity Class Mappings

### 2.1 Order & Payment Entities

```typescript
// apps/order-service/src/order/entities/order.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { ParcelEntity } from './parcel.entity';

export enum OrderStatus {
  DRAFT = 'Draft',
  CREATED = 'Created',
  CONFIRMED = 'Confirmed',
  AWAITING_PICKUP = 'Awaiting_Pickup',
  PICKED_UP = 'Picked_Up',
  IN_TRANSIT = 'In_Transit',
  DELIVERED = 'Delivered',
  PARTIALLY_DELIVERED = 'Partially_Delivered',
  LOST = 'Lost',
  DAMAGED = 'Damaged',
  CANCELLED = 'Cancelled',
}

@Entity('orders')
export class OrderEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  sender_id: string;

  @Column('uuid')
  recipient_id: string;

  @Column('int')
  price_cents: number;

  @Column('timestamp')
  expected_delivery_at: Date;

  @Column({
    type: 'enum',
    enum: OrderStatus,
    default: OrderStatus.CREATED,
  })
  status: OrderStatus;

  @OneToMany(() => ParcelEntity, (parcel) => parcel.order, { cascade: true })
  parcels: ParcelEntity[];
}
```

```typescript
// apps/order-service/src/order/entities/payment.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, OneToOne, JoinColumn } from 'typeorm';
import { OrderEntity } from './order.entity';

export enum PaymentType {
  PREPAID_STRIPE = 'Prepaid_Stripe',
  COD = 'COD',
  POSTPAID = 'Postpaid',
}

export enum PaymentStatus {
  UNPAID = 'Unpaid',
  PAID = 'Paid',
  AWAITING_SETTLEMENT = 'Awaiting_Settlement',
}

@Entity('payments')
export class PaymentEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => OrderEntity)
  @JoinColumn()
  order: OrderEntity;

  @Column({
    type: 'enum',
    enum: PaymentType,
  })
  type: PaymentType;

  @Column('int')
  amount_cents: number;

  @Column({
    type: 'enum',
    enum: PaymentStatus,
    default: PaymentStatus.UNPAID,
  })
  status: PaymentStatus;
}
```

---

## 3. Stripe Checkout Integration (Payment Service)

```typescript
// apps/payment-service/src/payment/payment.service.ts
import { Injectable } from '@nestjs/common';
import Stripe from 'stripe';

@Injectable()
export class PaymentService {
  private stripe: Stripe;

  constructor() {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2023-10-16' as any,
    });
  }

  async createCheckoutSession(orderId: string, amountCents: number): Promise<Stripe.Checkout.Session> {
    return this.stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `Shipping Fee for Order ${orderId}`,
            },
            unit_amount: amountCents,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${process.env.FRONTEND_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/cancel`,
      client_reference_id: orderId,
    });
  }
}
```

---

## 4. Email Notification Configuration

We use NestJS Mailer module powered by NodeMailer:

```typescript
// apps/notification-service/src/notification/notification.module.ts
import { Module } from '@nestjs/common';
import { MailerModule } from '@nestjs-modules/mailer';
import { NotificationService } from './notification.service';

@Module({
  imports: [
    MailerModule.forRoot({
      transport: {
        host: process.env.SMTP_HOST || 'smtp.mailtrap.io',
        port: parseInt(process.env.SMTP_PORT) || 2525,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      },
      defaults: {
        from: '"Shipping System" <noreply@shippingsystem.com>',
      },
    }),
  ],
  providers: [NotificationService],
})
export class NotificationModule {}
```
