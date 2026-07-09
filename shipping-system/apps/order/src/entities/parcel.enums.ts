export enum ParcelType {
  PARCEL = 'parcel',
  PALLET = 'pallet',
}

export enum ParcelDirection {
  FORWARD = 'Forward',
  REVERSE_RTS = 'Reverse_RTS',
}

export enum ParcelState {
  CREATED = 'Created',
  IN_HUB = 'InHub',
  IN_TRANSIT = 'InTransit',
  MISROUTED = 'Misrouted',
  OUT_FOR_DELIVERY = 'OutForDelivery',
  DELIVERED = 'Delivered',
  LOST = 'Lost',
  DAMAGED = 'Damaged',
}
