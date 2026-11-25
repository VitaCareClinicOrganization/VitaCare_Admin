import AuthGuard from '@/modules/auth/common/guards/AuthGuard'
import { RolePortal } from '@/modules/portal'

export default function RefundsPage() {
  return <AuthGuard allowedRoles={['branch_manager', 'receptionist']}><RolePortal section="refunds" /></AuthGuard>
}
