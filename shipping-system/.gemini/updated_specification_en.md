# Technical Specification (Shipping System) - User Experience (UX) Flow

This document specifies the domestic shipping system based on the end-user (Sender & Recipient) experience, integrated with the **Stripe** online payment gateway and automated **Email** notifications.

---

## 1. End-to-End User Experience (UX) Flow

The system abstracts all physical routing and consolidation complexities from the user, presenting a clean and simple interface:

```mermaid
graph TD
    A[Customer Creates Order] -->|HTTP POST /orders| B[Lock Price & Calculate ETA]
    B --> C{Select Payment Method}
    C -->|Prepaid Online| D[Process via Stripe]
    C -->|Pay on Delivery| E[Cash on Delivery (COD)]
    D --> F[Order Status: Confirmed]
    E --> F
    F --> G[Physical Courier Pickup & Logistics Chain]
    G --> H[Real-Time Tracking & Email Updates]
```

### A. Order Creation & Price Locking
*   The Sender creates a shipping order specifying the recipient details, address, and parcel weight.
*   The system dynamically calculates a flat shipping fee based on Active RateCards and estimates the **ETA** (Estimated Time of Arrival, e.g., 2 days). Both the fee (`price_cents`) and ETA are locked at creation and remain unchanged throughout the journey.

### B. Payment Options
Customers can choose from 3 payment types:
1.  **Online Prepaid (Stripe)**: Integrated with the **Stripe** checkout API. The order transitions to `Confirmed` and goes into the courier pickup queue only after Stripe confirms successful payment.
2.  **Cash on Delivery (COD)**: The recipient pays cash directly to the last-mile courier upon successful delivery.
3.  **Postpaid**: Available for registered business clients who settle shipping fees on monthly invoices.

### C. Real-Time Tracking Link
Both Sender and Recipient can track the parcel journey using a tracking timeline showing clean operational states:
*   `Awaiting_Pickup` (Courier is on the way to collect the parcel).
*   `Picked_Up` (Courier has taken custody of the parcel).
*   `At Origin Hub` (Inbounded at the sorting center).
*   `In Transit` (Moving between inter-provincial hubs).
*   `At Destination Hub` (Arrived at the local delivery center).
*   `Out For Delivery` (Last-mile courier is out delivering).
*   `Delivered` (Successfully delivered).

### D. Automated Email Notifications
Automated emails are sent to the participants at key milestones:
1.  **Order Created**: Sent to the Sender with the tracking ID and checkout link (if Stripe is selected).
2.  **Picked Up**: Sent to the Recipient confirming collection and the estimated delivery date (ETA).
3.  **Out for Delivery**: Sent to the Recipient containing the courier's phone number.
4.  **Delivered**: Sent to the Sender with delivery confirmation and the Proof-of-Delivery link.
5.  **Failed / RTS**: Sent to the Sender if delivery fails, warning of return-to-sender procedures.

### E. Automated Return-to-Sender (Auto-RTS)
*   If the recipient actively rejects the package (`Customer_Rejected`) OR if delivery fails 3 times (recorded via `DeliveryAttempt`).
*   The system automatically triggers the `RTS` process, sets `direction = Reverse` to route the package back to the origin, and emails the Sender.

---

## 2. Core Business Rules (BR-01 to BR-04)

*   **BR-01 (Price & ETA Locking)**: Fees and ETA are calculated and locked at creation. No modification is allowed post-confirmation, unless weight discrepancies are audited at origin hub.
*   **BR-02 (Stripe Integration)**: For online orders, payments must be verified via Stripe webhooks before the pickup task is dispatched.
*   **BR-03 (Auto-RTS)**: Reaching 3 delivery failures or recipient rejection triggers immediate reverse routing using the same tracking ID.
*   **BR-04 (POD Capture)**: Successful delivery requires capturing a recipient signature/photo and recording cash details for final finance settlement.
