import { NavLink } from 'react-router-dom';
import { useAuth } from '../../../auth/context/AuthContext';
import { ROUTE_PRIVILEGE } from '../../../shared/lib/privileges';
import styles from './PartnerSidebar.module.css';

const ALL_ITEMS = [
  { to: '/doi-tac',              label: 'Tổng quan',            icon: 'grid',    privilege: null },
  { to: '/doi-tac/khoa-api',     label: 'Khóa API',             icon: 'key',     privilege: ROUTE_PRIVILEGE['khoa-api'] },
  { to: '/doi-tac/gui-review',   label: 'Gửi review',           icon: 'send',    privilege: ROUTE_PRIVILEGE['gui-review'] },
  { to: '/doi-tac/lay-review',   label: 'Lấy review',           icon: 'inbox',   privilege: ROUTE_PRIVILEGE['lay-review'] },
  { to: '/doi-tac/theo-doi-sla', label: 'Theo dõi SLA',         icon: 'sla',     privilege: ROUTE_PRIVILEGE['theo-doi-sla'] },
  { to: '/doi-tac/domain',       label: 'Mở rộng Domain',       icon: 'domain',  privilege: ROUTE_PRIVILEGE['domain'] },
  { to: '/doi-tac/dac-quyen',    label: 'Đặc quyền đối tác',   icon: 'diamond', privilege: ROUTE_PRIVILEGE['dac-quyen'] },
  { to: '/doi-tac/lich-su-mua',  label: 'Lịch sử mua gói',     icon: 'history', privilege: ROUTE_PRIVILEGE['lich-su-mua'] },
];

function Icon({ name }) {
  const props = {
    viewBox: '0 0 24 24',
    fill: 'none',
    xmlns: 'http://www.w3.org/2000/svg',
    'aria-hidden': true,
  };

  switch (name) {
    case 'grid':
      return (
        <svg {...props}>
          <rect x="4" y="4" width="6" height="6" rx="2" />
          <rect x="14" y="4" width="6" height="6" rx="2" />
          <rect x="4" y="14" width="6" height="6" rx="2" />
          <rect x="14" y="14" width="6" height="6" rx="2" />
        </svg>
      );
    case 'key':
      return (
        <svg {...props}>
          <circle cx="8.5" cy="12.5" r="3.5" />
          <path d="M12 12.5h7m-3 0v2.7m-3-2.7v2" />
        </svg>
      );
    case 'send':
      return (
        <svg {...props}>
          <path d="M4.5 12.1 19 5.5l-5.2 13-2.9-5.3-6.4-1.1Z" />
          <path d="m10.9 13.2 3.3-3.5" />
        </svg>
      );
    case 'inbox':
      return (
        <svg {...props}>
          <path d="M5 8.5 7.1 5h9.8L19 8.5V18H5V8.5Z" />
          <path d="M5.4 12.5h4.1c.4 1.3 1.3 2 2.5 2s2.1-.7 2.5-2h4.1" />
        </svg>
      );
    case 'sla':
      return (
        <svg {...props}>
          <path d="M12 19.25a7.25 7.25 0 1 0-7.25-7.25" />
          <path d="M12 7.75V12l3 2" />
          <path d="M4.75 19.25h4.5" />
        </svg>
      );
    case 'domain':
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="7.25" />
          <path d="M12 4.75c-2 2-3.25 4.5-3.25 7.25s1.25 5.25 3.25 7.25M12 4.75c2 2 3.25 4.5 3.25 7.25S14 17.25 12 19.25M4.75 12h14.5" />
        </svg>
      );
    case 'diamond':
      return (
        <svg {...props}>
          <path d="M7.5 4.8h9L21 10l-9 9.2L3 10l4.5-5.2Z" />
          <path d="M7.5 4.8 12 19.2l4.5-14.4M3 10h18" />
        </svg>
      );
    default:
      return (
        <svg {...props}>
          <path d="M5 12a7 7 0 1 0 2.1-5" />
          <path d="M5 5.5v5h5" />
          <path d="M12 8v4l2.7 1.7" />
        </svg>
      );
  }
}

export default function PartnerSidebar() {
  const { hasPrivilege } = useAuth();

  // Lọc: nếu item yêu cầu privilege và user không có → ẩn
  const items = ALL_ITEMS.filter(
    item => item.privilege === null || hasPrivilege(item.privilege)
  );

  return (
    <aside className={styles.sidebar}>
      <div className={styles.brand}>
        <div className={styles.logo}>RH</div>
        <div>
          <div className={styles.title}>Cổng đối tác</div>
          <p className={styles.text}>Quản lý API, review và quyền lợi nhà xe.</p>
        </div>
      </div>

      <nav className={styles.nav}>
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/doi-tac'}
            className={({ isActive }) => `${styles.link} ${isActive ? styles.active : ''}`}
          >
            <span className={styles.iconWrap}>
              <Icon name={item.icon} />
            </span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
