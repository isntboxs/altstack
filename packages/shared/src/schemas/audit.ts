import 'zod/compile'
import { z } from 'zod'

export const auditActionSchema = z.enum(['project_removed'])

export type AuditActionType = z.infer<typeof auditActionSchema>
