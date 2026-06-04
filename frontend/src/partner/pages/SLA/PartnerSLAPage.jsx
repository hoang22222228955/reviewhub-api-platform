import { useEffect, useState } from 'react';
import { useAuth } from '../../../auth/context/AuthContext';
import api from '../../../services/api';
import styles from './PartnerSLAPage.module.css';

function StatCard({ label, value, sub, color }) {
  return (
    <div className={styles.statCard} style={{ '--accent': color }}>
      <div className={styles.statValue}>{value}</div>
      <div className={styles.statLabel}>{label}</div>
      {sub && <div className={styles.statSub}>{sub}</div>}
    </div>
  );
}

function ProgressBar({ label, value, max, color }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className={styles.progressRow}>
      <div className={styles.progressMeta}>
        <span>{label}</span>
        <span className={styles.progressRight}>
          {value} / {max}
          <em>{pct.toFixed(1)}%</em>
        </span>
      </div>
      <div className={styles.progressTrack}>
        <div
          className={styles.progressFill}
          style={{ width: `${pct}%`, '--bar': color }}
        />
      </div>
    </div>
  );
}

export default function PartnerSLAPage() {
  const { currentUser } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    api.get('/api/partner/sla')
      .then((res) => setStats(res.data))
      .catch(() => setError('Không thể tải dữ liệu SLA. Vui lòng thử lại.'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.hero}>
        <div className={styles.heroInner}>
          <h1 className={styles.heroTitle}>Theo dõi SLA</h1>
          <p className={styles.heroSub}>
            Thống kê hiệu suất hoạt động của tài khoản {currentUser?.orgName || currentUser?.name}
          </p>
        </div>
        <span className={styles.heroBadge}>Enterprise</span>
      </div>

      {loading && (
        <div className={styles.emptyState}>
          <div className={styles.spinner} />
          <p>Đang tải dữ liệu…</p>
        </div>
      )}

      {error && (
        <div className={styles.errorBox}>{error}</div>
      )}

      {stats && !loading && (
        <>
          {/* KPI cards */}
          <div className={styles.kpiGrid}>
            <StatCard
              label="Tổng review đã gửi"
              value={stats.totalSubmitted}
              color="#6e5deb"
            />
            <StatCard
              label="Tỷ lệ duyệt"
              value={`${stats.approvalRate}%`}
              sub={`${stats.approved} được duyệt`}
              color="#22c55e"
            />
            <StatCard
              label="AI confidence TB"
              value={`${stats.avgAiConfidence}%`}
              sub="Điểm đánh giá AI"
              color="#2daade"
            />
            <StatCard
              label="Chờ duyệt"
              value={stats.pendingReview}
              sub={`${stats.rejected} bị từ chối`}
              color="#f59e0b"
            />
          </div>

          {/* Progress bars */}
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Quota & trạng thái</h2>
            <div className={styles.progressList}>
              <ProgressBar
                label="Quota sử dụng"
                value={stats.quotaUsed}
                max={stats.quotaTotal}
                color="#6e5deb"
              />
              <ProgressBar
                label="Review được duyệt"
                value={stats.approved}
                max={stats.totalSubmitted || 1}
                color="#22c55e"
              />
              <ProgressBar
                label="Review bị từ chối"
                value={stats.rejected}
                max={stats.totalSubmitted || 1}
                color="#ef4444"
              />
              <ProgressBar
                label="Review chờ duyệt"
                value={stats.pendingReview}
                max={stats.totalSubmitted || 1}
                color="#f59e0b"
              />
            </div>
          </div>

          {/* Breakdown table */}
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Chi tiết trạng thái</h2>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Trạng thái</th>
                  <th>Số lượng</th>
                  <th>Tỷ lệ</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { label: 'Được duyệt', count: stats.approved, color: '#22c55e' },
                  { label: 'Chờ duyệt', count: stats.pendingReview, color: '#f59e0b' },
                  { label: 'Bị từ chối', count: stats.rejected, color: '#ef4444' },
                ].map((row) => (
                  <tr key={row.label}>
                    <td>
                      <span className={styles.dot} style={{ background: row.color }} />
                      {row.label}
                    </td>
                    <td>{row.count}</td>
                    <td>
                      {stats.totalSubmitted > 0
                        ? `${((row.count / stats.totalSubmitted) * 100).toFixed(1)}%`
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
