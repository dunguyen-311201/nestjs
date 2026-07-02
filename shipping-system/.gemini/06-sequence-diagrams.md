# Workflow Sequence Diagrams (Shipping System)

This document contains Mermaid-based sequence diagrams detailing the Stripe payment checkout, event propagation via NATS JetStream, and Email notifications.

---

## 1. Stripe Prepaid Checkout & Order Confirmation Workflow
Shows how an order is created, payment is processed via Stripe, and email confirmations are triggered.

```mermaid
sequenceDiagram
    autonumber
    actor Sender
    participant OS as Order Service (db_order)
    participant PS as Payment Service (db_payment)
    participant Stripe as Stripe API
    participant NATS as NATS JetStream
    participant NS as Notification Service
    actor Recipient

    %% Order Creation
    Sender->>OS: Create Order & Parcels (HTTP POST /orders)
    activate OS
    Note over OS: Calculate Cước Phí & Locked Price & ETA
    OS->>OS: DB Transaction: Save Order + Outbox (PENDING)
    OS-->>Sender: Return Order Info & Locked Price
    deactivate OS

    Note over OS: Outbox Worker Poller
    OS->>NATS: Publish order.created
    OS->>OS: Mark Outbox as PUBLISHED

    %% Stripe Checkout
    NATS->>PS: Consume order.created
    activate PS
    PS->>Stripe: Create PaymentIntent (amount = price_cents)
    Stripe-->>PS: Return client_secret & intent_id
    PS->>PS: Save PaymentRecord (status = Unpaid)
    deactivate PS

    %% Email confirmation of order creation
    NATS->>NS: Consume order.created
    NS->>Sender: Send Email: Order Created & Payment Required link

    %% Payment Action
    Sender->>Stripe: Complete payment via Credit Card
    Stripe->>PS: HTTP POST /payments/webhook (payment_intent.succeeded)
    activate PS
    PS->>PS: Update PaymentRecord (status = Paid)
    PS->>NATS: Publish payment.succeeded
    PS-->>Stripe: 200 OK
    deactivate PS

    NATS->>OS: Consume payment.succeeded
    OS->>OS: Update ORDER.status to Confirmed (Ready for Pickup)

    NATS->>NS: Consume payment.succeeded
    NS->>Sender: Send Email: Payment Successful & Invoice
    NS->>Recipient: Send Email: Incoming shipment notification
```

---

## 2. Last-Mile Scan and Delivery Alert Workflow
Shows the email notifications sent to the recipient when the parcel is out for delivery, and the proof-of-delivery signature capture.

```mermaid
sequenceDiagram
    autonumber
    actor Courier
    participant TS as Tracking Service (db_tracking)
    participant NATS as NATS JetStream
    participant NS as Notification Service
    actor Recipient
    actor Sender

    %% Out for delivery
    Courier->>TS: Out for Delivery Scan (HTTP POST /scans)
    TS->>TS: Save OUT_FOR_DELIVERY ScanEvent
    TS->>NATS: Publish parcels.events.scanned (status=Out_for_Delivery)

    NATS->>NS: Consume scanned (Out_for_Delivery)
    NS->>Recipient: Send Email: Package is out for delivery today with Courier phone #

    %% Delivered
    Courier->>TS: Deliver & Upload Proof (HTTP POST /scans/deliver)
    activate TS
    TS->>TS: Save DELIVERED ScanEvent + DELIVERYPROOF
    TS->>NATS: Publish parcels.events.scanned (status=Delivered)
    TS-->>Courier: Success
    deactivate TS

    NATS->>NS: Consume scanned (Delivered)
    NS->>Sender: Send Email: Package delivered successfully & proof image link
```
