# Progress Report — Shipping System (as of 2026-08-06)
# Báo cáo tiến độ — Hệ thống giao vận (tính đến 2026-08-06)

> Training was paused for over two weeks (last activity: 2026-07-20). This report reviews everything completed before the pause, for the supporter's reference.
> Quá trình học/thực hành bị gián đoạn hơn hai tuần (hoạt động gần nhất: 2026-07-20). Báo cáo này rà lại toàn bộ công việc đã hoàn thành trước khi nghỉ, để supporter tiện theo dõi.

---

## 1. Overall status / Tình trạng tổng quan

**All 10 planned phases (22.0 person-days estimation) are complete**, plus some ad-hoc work done after the plan closed.

**Toàn bộ 10 phase trong bản estimation (22.0 ngày công) đã hoàn thành**, cộng thêm một số việc phát sinh sau khi kế hoạch chính thức đóng lại.

| | |
|---|---|
| Log range / Khoảng thời gian log | 2026-07-07 → 2026-07-20 (10 working days / 10 ngày làm việc) |
| Last commit / Commit gần nhất | `7502bdc` — feat: recipient share-link tracking |
| Test suite (last known) / Bộ test (ghi nhận cuối) | 431/432 green |
| Gap until this report / Khoảng nghỉ đến báo cáo này | ~2.5 weeks / ~2.5 tuần |

---

## 2. Progress by phase / Tiến độ theo Phase

| Phase | Scope / Nội dung | Status / Trạng thái |
|---|---|---|
| 1 — Analysis / Phân tích | Actor mapping, business rules, NFR | ✅ Done / Xong |
| 2 — Design Docs | ERD, cross-service data flow | ✅ Done / Xong |
| 3 — HLD + ADRs | Service boundaries, NATS subject map, ADR-001/002/003 | ✅ Done / Xong |
| 4 — Project Setup | Monorepo scaffold, docker-compose (NATS JetStream + Postgres + Redis), shared libs | ✅ Done / Xong |
| 5 — Core Backend (6.0d) | Order Service, Parcel state machine, terminal/exception states, Pricing, Tracking (append-only event store), status projection + Transactional Outbox, JetStream per-order serialization (ADR-001), Stripe Payment + webhook + BR-08 prepaid guard | ✅ Done / Xong |
| 6 — Operational Services (3.0d) | Courier (pickup/deliver + Outbox retrofit), Hub/Sortation (BR-02 misroute detection), PII field-level encryption (confirmed already satisfied from Phase 4/5.1), Line-haul (trip create/depart/arrive), Dispatcher, Notification consumer (best-effort email, BR-09) | ✅ Done / Xong |
| 7 — Integration & E2E (1.0d) | Full vertical slice wired in docker-compose, end-to-end walkthrough doc, 1 automated happy-path integration test | ✅ Done / Xong |
| 8 — Testing, Demo & Docs (1.0d) | BR-01→09 test audit, `pnpm demo` script (all actors), final README, Artillery load test (0 errors, p99 ~40ms) | ✅ Done / Xong |
| 9 — Auth & RBAC extension (4.0d) | Clerk session JWT at the Gateway, role claim in token, `ROUTE_ACCESS` map (401 vs 403), customer ownership (`created_by_user_id`) | ✅ Done / Xong (16–17/07) |
| 10 — Shipper per-resource ownership (2.0d) | `COURIER.user_id` identity link, `PARCEL.assigned_courier_id`, enforcement in Courier Service, per-actor E2E | ✅ Done / Xong (17/07) |

---

## 3. Work done after the plan closed / Việc phát sinh sau khi kế hoạch đóng

Not yet reflected as a numbered phase in `docs/03-phases.md` — flagged for the supporter's awareness:

Chưa được ghi nhận thành phase/task số hiệu trong `docs/03-phases.md` — nêu ra để supporter nắm:

- **QA test-case doc correction / Sửa doc test-case QA** (20/07): found and fixed ~10 fabricated or incorrect routes/fields in `docs/12-test-cases-specification.md` versus the real implementation (e.g. `/payments/checkout` never existed — the real route is `POST /orders/:id/checkout`).
- **Route rename / Đổi tên route** (20/07): `couriers/legs` → `couriers/parcels`, `/legs/:id/assign` → `/parcels/:id/assign-courier`. The old `legs` naming referenced a `LEG` entity that had been cut from scope early on; the parameter was always a `parcel_id`. Live-verified old routes now 404, new routes registered correctly.
- **Recipient share-link tracking / Theo dõi qua link chia sẻ cho người nhận** (20/07): a brand-new, unplanned feature — `SHIPMENT_ORDER.share_token` (public UUID) and a new unauthenticated endpoint `GET /tracking/share/:token`, so a recipient can track a parcel without a Clerk login. Fully TDD'd and live-verified.

---

## 4. Quality highlights / Điểm nổi bật về chất lượng

- **Strict TDD throughout** — every task written red-first before implementation. / **TDD nghiêm ngặt xuyên suốt** — mọi task đều viết test fail trước khi code.
- **Test suite grew to 431/432 passing** by the end of the log. / **Bộ test tăng dần lên 431/432** tính đến cuối log.
- **Real live verification on the dockerized stack**, not just mocked tests — this caught several real bugs invisible to unit tests alone, e.g.:
  **Live-verify thực tế trên docker stack**, không chỉ tin vào test giả lập — nhờ đó phát hiện một số bug thật mà unit test không thấy được, ví dụ:
  - Entity missing from TypeORM's `entities[]` array → runtime `EntityMetadataNotFoundError` (happened twice, in Payment and Courier tasks).
  - A column typed as `Pick<IOrderRepository, ...>` erased NestJS DI metadata at runtime.
  - A `created_at` column missing `DEFAULT NOW()` broke the very first real insert.
- **Every architectural gap or schema fix was confirmed with the user before implementing** — logged explicitly in each day's "Decisions / open questions" section.
  **Mọi gap kiến trúc hay sửa schema đều được xác nhận với người dùng trước khi làm** — ghi lại rõ ràng trong mục "Decisions / open questions" mỗi ngày.
- Circuit breaker added to all 5 Outbox pollers (Order, Hub, Line-haul, Dispatcher, Courier) to avoid hammering a downed NATS. / Đã thêm circuit breaker cho cả 5 Outbox poller để tránh dồn dập gọi khi NATS bị down.
- Load-tested with Artillery: 60 concurrent virtual users, 120 requests, **0 errors**, mean latency 10ms, p99 40ms (well under the 300ms SLA target). / Đã load test bằng Artillery: 60 virtual user đồng thời, 120 request, **0 lỗi**, độ trễ trung bình 10ms, p99 40ms (thấp hơn nhiều so với SLA 300ms).

---

## 5. Open items / Việc còn mở (chưa đóng)

Worth flagging to the supporter as known, deliberately-scoped gaps — none are silent bugs, all were reviewed and consciously deferred:

Nên nêu với supporter như các khoảng trống đã biết, có chủ đích — không phải bug âm thầm, tất cả đều đã được rà soát và cố ý hoãn lại:

1. ~~**RateCard versioning** (append-only?)~~ — resolved 2026-08-06: the schema already implements it (`RATECARD.effective_from`/`effective_to` + unique constraint), `CLAUDE.md` updated from "Open decisions" to "Decided". / Đã chốt ngày 2026-08-06: schema đã hiện thực sẵn (cột `effective_from`/`effective_to` + unique constraint), đã cập nhật `CLAUDE.md` từ mục "Open decisions" sang "Decided".
2. ~~**Abandoned prepaid payment**~~ — resolved 2026-08-06: `checkout.session.expired` now auto-cancels the order (`SHIPMENT_ORDER.status = Cancelled`) via `OrderRepository.cancelIfPending` (atomic conditional update, race-safe against a concurrently completing webhook); `checkout()` rejects retries on a cancelled order. / Đã xử lý ngày 2026-08-06: sự kiện `checkout.session.expired` giờ tự động hủy đơn hàng qua `cancelIfPending` (update có điều kiện, an toàn trước race với webhook hoàn tất đồng thời); `checkout()` từ chối thử lại trên đơn đã hủy.
3. ~~**UC-15 — passive lost-parcel detection**~~ — resolved 2026-08-06: `LostParcelSweepService` (`@nestjs/schedule` `@Cron`, hourly) in Tracking now sweeps non-terminal parcels whose order breached `expected_delivery_at` with no scan past `DEPARTED_LINEHAUL`/`OUT_FOR_DELIVERY`, publishing `parcel.lost_suspected` (already consumed by Order + Notification). / Đã xử lý ngày 2026-08-06: `LostParcelSweepService` (dùng `@nestjs/schedule` `@Cron`, chạy mỗi giờ) trong Tracking giờ quét các kiện chưa ở trạng thái cuối mà đơn hàng đã quá hạn `expected_delivery_at` và chưa có quét nào sau `DEPARTED_LINEHAUL`/`OUT_FOR_DELIVERY`, phát sự kiện `parcel.lost_suspected` (đã được Order và Notification tiêu thụ sẵn).
4. ~~**`Damaged` terminal state**~~ — resolved 2026-08-06: the trigger genuinely didn't exist (not just undocumented) — `markDamaged()` was a dead method, called only by its own test. Added `damaged: true` to `POST /hubs/:id/receive` as the sole trigger (hub staff reports physical damage during a scan, in place of the normal receive/arrival), publishing a new `parcel.damaged` event consumed by Order and Tracking. / Đã xử lý ngày 2026-08-06: trigger thực sự chưa tồn tại (không chỉ là thiếu tài liệu) — `markDamaged()` là hàm chết, chỉ được gọi từ test của chính nó. Đã thêm cờ `damaged: true` vào `POST /hubs/:id/receive` làm trigger duy nhất (nhân viên hub báo cáo hư hỏng vật lý khi quét, thay cho lượt quét nhận/đến bình thường), phát sự kiện mới `parcel.damaged` được Order và Tracking tiêu thụ.
5. **`docs/03-phases.md` is now slightly behind reality** — the share-link feature (§3 above) shipped without a phase/task entry. / `docs/03-phases.md` hiện chưa cập nhật kịp thực tế — tính năng share-link (mục 3) đã code xong nhưng chưa có mục phase/task tương ứng.

---

## 6. Suggested next steps / Đề xuất bước tiếp theo

- Resume from `docs/PROGRESS.md`'s resume pointer to confirm nothing else drifted during the break.
  Tiếp tục từ điểm đánh dấu trong `docs/PROGRESS.md` để xác nhận không có gì khác bị lệch trong thời gian nghỉ.
- Add a short Phase 11 entry (or equivalent) documenting the share-link feature, to keep the estimation doc in sync with the code.
  Thêm một mục Phase 11 (hoặc tương đương) ghi nhận tính năng share-link, để đồng bộ tài liệu estimation với code thực tế.
- Decide and close out the RateCard versioning open decision (item 1 above) before it blocks any pricing-related work.
  Chốt quyết định về versioning cho RateCard (mục 1) trước khi việc này cản trở các task liên quan đến pricing.

---

*Source material for this report: `TASKS.md` (daily log, 2026-07-07 → 2026-07-20) and `docs/03-phases.md` (estimation doc).*
*Nguồn tổng hợp báo cáo: `TASKS.md` (nhật ký hằng ngày, 2026-07-07 → 2026-07-20) và `docs/03-phases.md` (tài liệu estimation).*
