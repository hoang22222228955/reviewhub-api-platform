import { Outlet } from 'react-router-dom';
import PartnerSidebar from '../components/PartnerSidebar/PartnerSidebar';
import PartnerTopbar from '../components/PartnerTopbar/PartnerTopbar';
import ChatWidget from '../../shared/ui/Chat/ChatWidget';
import styles from './PartnerLayout.module.css';

export default function PartnerLayout() {
  return (
    <div className={styles.shell}>
      <PartnerSidebar />
      <div className={styles.body}>
        <PartnerTopbar />
        <Outlet />
      </div>
      <ChatWidget />
    </div>
  );
}
