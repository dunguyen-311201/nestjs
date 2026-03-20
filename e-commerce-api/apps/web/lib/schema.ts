import { z } from 'zod'

export const checkoutSchema = z.object({
  email: z.string().email({ message: 'Invalid email address' }),
  firstName: z.string().min(2, { message: 'First name is required' }),
  lastName: z.string().min(2, { message: 'Last name is required' }),
  address: z.string().min(5, { message: 'Address is required' }),
  city: z.string().min(2, { message: 'City is required' }),
  zipCode: z.string().min(4, { message: 'Zip code is required' }),
  country: z.string().min(2, { message: 'Country is required' }),
  cardNumber: z
    .string()
    .regex(/^\d{16}$/, { message: 'Card number must be 16 digits' }),
  expiryDate: z.string().regex(/^(0[1-9]|1[0-2])\/\d{2}$/, {
    message: 'Expiry date must be MM/YY',
  }),
  cvv: z.string().regex(/^\d{3,4}$/, { message: 'CVV must be 3 or 4 digits' }),
})

export type CheckoutFormData = z.infer<typeof checkoutSchema>

export const productSchema = z.object({
  name: z.string().min(2, { message: 'Name is required' }),
  description: z
    .string()
    .min(10, { message: 'Description must be at least 10 characters' }),
  price: z.coerce.number().min(0, 'Price must be positive'),
  stock: z.coerce.number().int().min(0, 'Stock must be non-negative'),
  category: z.string().min(1, 'Category is required'),
  image: z.string().default('/file-text.svg'),
  isPublic: z.boolean().default(false),
})

// Input type (before coercion) - form inputs are strings
export type ProductFormInput = z.input<typeof productSchema>
// Output type (after coercion) - validated data has numbers
export type ProductFormData = z.output<typeof productSchema>

export const categorySchema = z.object({
  name: z.string().min(1, 'Name is required'),
})

export type CategoryFormInput = z.input<typeof categorySchema>
export type CategoryFormData = z.output<typeof categorySchema>
