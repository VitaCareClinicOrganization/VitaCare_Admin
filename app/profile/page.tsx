import AuthGuard from '@/modules/auth/common/guards/AuthGuard'
import { RolePortal } from '@/modules/portal'

export default function ProfilePage() {
  return <AuthGuard><RolePortal section="profile" /></AuthGuard>
}
