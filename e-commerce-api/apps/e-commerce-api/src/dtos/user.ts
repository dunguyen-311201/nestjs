import { FromSchema } from 'json-schema-to-ts'

import { USER_ROLES } from '#types'

import { registerBodySchema } from '#schemas/auth'

import { User } from '#entities'

export const transformatFromClerk = ({
  data,
}: FromSchema<typeof registerBodySchema>) => {
  const {
    email_addresses,
    first_name: firstName,
    id,
    image_url,
    last_name: lastName,
    username,
    created_at: createdAt,
    updated_at: updatedAt,
    phone_numbers,
    role,
  } = data

  const newUser = new User({
    avatar: image_url,
    lastName,
    id,
    username,
    firstName,
    email: email_addresses[0]?.email_address || '',
    createdAt: new Date(createdAt),
    updatedAt: new Date(updatedAt),
    phone: phone_numbers[0]?.phone_number,
    role: role as USER_ROLES,
  } as User)

  return newUser
}
