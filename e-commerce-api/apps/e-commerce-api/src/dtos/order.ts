import { Order, User } from '#entities'

interface ShippingAddress {
  name: string
  address: string
  city: string
  zipCode: string
  country: string
}

const mockShippingAddress = (user?: User): ShippingAddress => ({
  name: user?.name || 'User',
  address: '123 Main St',
  city: 'Anytown',
  zipCode: '12345',
  country: 'USA',
})

export const formatOrderDto = (
  { id, status, paymentSecret, items, totalAmount, updatedAt }: Order,
  user?: User,
) => {
  return {
    id,
    userId: user?.id,
    status: status,
    paymentSecret: paymentSecret,
    items: items?.map(({ id, priceAtPurchase, product, quantity }) => ({
      id,
      productId: product.id,
      quantity: quantity,
      price: priceAtPurchase,
      name: product.name,
      image: product.images[0],
      description: product.description,
    })),
    total: totalAmount,
    date: updatedAt,

    // TODO: get shipping address from user
    shippingAddress: mockShippingAddress(user),
  }
}
