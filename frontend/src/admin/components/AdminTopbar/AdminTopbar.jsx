import { Link } from 'react-router-dom'
import { House } from 'lucide-react'
import { useAuth } from '../../../auth/context/AuthContext'
import styles from './AdminTopbar.module.css'

function getInitials(name = '') {
  const words = String(name).trim().split(/\s+/).filter(Boolean)

  if (!words.length) return 'U'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()

  return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase()
}

export default function AdminTopbar() {
  const { currentUser } = useAuth()

  const initials = getInitials(
    currentUser?.name ||
    currentUser?.email ||
    'Admin'
  )

  const displayName = currentUser?.name || 'Tài khoản admin'

  return (
    <div className={styles.topbar}>
      <div className={styles.content}>
        <div className={styles.eyebrow}>Admin console</div>

        <h1>Khu quản trị ReviewHub</h1>

        <p>
          Trang admin được tách riêng hoàn toàn khỏi partner và giao diện public,
          giúp cấu trúc rõ ràng và đỡ rối hơn.
        </p>
      </div>

      <div className={styles.actions}>
        <Link to="/" className={styles.homeLink}>
          <House size={15} strokeWidth={1.9} />
          <span>Về trang chủ</span>
        </Link>

        <Link to="/tai-khoan" className={styles.accountCard}>
          <div className={styles.accountAvatar}>{initials}</div>

          <div className={styles.accountInfo}>
            <strong>{displayName}</strong>
            <span>Quản trị</span>
          </div>
        </Link>
      </div>
    </div>
  )
}
