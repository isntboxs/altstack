import { z } from 'zod'

export const ROLES = ['admin', 'user'] as const

export const roleSchema = z.enum(ROLES)
export type Role = z.infer<typeof roleSchema>

export const rolesMapSchema = z.record(z.string(), roleSchema)
export type RolesMap = z.infer<typeof rolesMapSchema>

export const ROLES_MAP: RolesMap = { ADMIN: 'admin', USER: 'user' } as const

export const DEFAULT_ROLE: Role = 'user'
export const ADMIN_ROLES: Array<Role> = ['admin']
