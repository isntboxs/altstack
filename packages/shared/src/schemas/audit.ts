import 'zod/compile'
import { z } from 'zod'

import { AUDIT_ACTIONS } from '@altstack/shared/constants'

export const auditActionSchema = z.enum(AUDIT_ACTIONS)
