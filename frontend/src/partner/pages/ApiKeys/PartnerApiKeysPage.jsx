import { useState } from 'react';
import { useAuth } from '../../../auth/context/AuthContext';
import ApiKeyCard from '../../components/ApiKeyCard/ApiKeyCard';
import api from '../../../services/api';
import styles from './PartnerApiKeysPage.module.css';

export default function PartnerApiKeysPage() {
  const { currentUser, setUser } = useAuth();
  const [regenerating, setRegenerating] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState(null);

  const liveKey    = currentUser?.apiKey || null;
  const sandboxKey = liveKey ? liveKey.replace('rh_live_', 'rh_sandbox_') : null;

  async function doRegenerate() {
    setShowConfirm(false);
    setRegenerating(true);
    setError(null);
    try {
      const res = await api.post('/api/partner/regenerate-key');
      setUser(res.data);
    } catch {
      setError('Không thể tạo lại key. Vui lòng thử lại.');
    } finally {
      setRegenerating(false);
    }
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.grid}>
        <ApiKeyCard
          title="Khóa sandbox"
          value={sandboxKey}
          helper="Dùng để thử nghiệm trước khi đưa lên môi trường thật. Key sandbox không gọi API thật."
        />
        <ApiKeyCard
          title="Khóa live"
          value={liveKey}
          helper="Dùng cho môi trường production. Mỗi lần gọi sẽ trừ 1 quota."
          onRegenerate={() => setShowConfirm(true)}
          regenerating={regenerating}
        />
      </div>

      {error && (
        <div className={styles.errorBanner}>
          <svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.7"/><path d="M12 8v4m0 4h.01" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"/></svg>
          {error}
          <button type="button" onClick={() => setError(null)} aria-label="Đóng">×</button>
        </div>
      )}

      {showConfirm && (
        <div className={styles.overlay} onClick={() => setShowConfirm(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalIcon}>
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M4.75 12A7.25 7.25 0 0 1 17.3 6.5M19.25 12A7.25 7.25 0 0 1 6.7 17.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                <path d="M16.75 4.75v3.5h3.5M3.75 15.75v3.5h3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h3>Tạo lại API key?</h3>
            <p>
              Key cũ sẽ bị <strong>vô hiệu hóa ngay lập tức</strong> và mọi tích hợp đang dùng key đó sẽ ngừng hoạt động.
              Bạn sẽ cần cập nhật key mới trong hệ thống của mình.
            </p>
            <div className={styles.modalActions}>
              <button type="button" className={styles.cancelBtn} onClick={() => setShowConfirm(false)}>
                Hủy
              </button>
              <button type="button" className={styles.confirmBtn} onClick={doRegenerate}>
                Tạo key mới
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

