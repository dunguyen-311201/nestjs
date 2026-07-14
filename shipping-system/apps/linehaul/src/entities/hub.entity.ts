import { Entity, PrimaryGeneratedColumn } from 'typeorm';

// Read-only: HUB is owned/written by Hub Service (task 6.2). Line-haul and
// Hub share the shipping_network_db schema by the original architecture
// (ADR-003 + docs/02-HLD.md's data-ownership table) so this is reachable
// via Line-haul's own default connection - no separate named connection
// needed, unlike the cross-schema reads into shipping_order_db elsewhere.
// Used only to validate origin_hub_id/dest_hub_id exist at trip creation.
@Entity({ name: 'hub' })
export class Hub {
  @PrimaryGeneratedColumn('uuid')
  id: string;
}
