import { useEffect, useMemo, useState } from 'react';
import PlanEditor from '../../components/PlanEditor/PlanEditor';
import { fetchPlans, savePlan, updatePlan } from '../../../services/planService';
import styles from './AdminPlansPage.module.css';

const PLAN_ORDER = ['starter', 'growth', 'enterprise'];

const PLAN_META = {
  starter: {
    label: 'Khởi đầu',
    tone: 'blue',
    note: 'Phù hợp partner mới bắt đầu triển khai',
  },
  growth: {
    label: 'Tăng trưởng',
    tone: 'violet',
    note: 'Gói cân bằng giữa quota và chi phí',
  },
  enterprise: {
    label: 'Doanh nghiệp',
    tone: 'amber',
    note: 'Dành cho hệ thống vận hành quy mô lớn',
  },
};

function formatNumber(value) {
  const number = Number(value || 0);
  return number.toLocaleString('vi-VN');
}

function formatMoney(value) {
  const number = Number(value || 0);
  return `${number.toLocaleString('vi-VN')} đ`;
}

export default function AdminPlansPage() {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    fetchPlans()
      .then(setPlans)
      .finally(() => setLoading(false));
  }, []);

  async function handleSave(planId, payload) {
    setSavingId(planId);
    try {
      await savePlan(planId, payload);
      const next = updatePlan(planId, payload);
      setPlans(next);
    } catch {
      setPlans(prev => prev.map(p => (p.id === planId ? { ...p, ...payload } : p)));
    } finally {
      setSavingId(null);
    }
  }

  const orderedPlans = useMemo(() => {
    const ordered = PLAN_ORDER.map(id => plans.find(p => p.id === id)).filter(Boolean);
    const rest = plans.filter(p => !PLAN_ORDER.includes(p.id));
    return [...ordered, ...rest];
  }, [plans]);

  const filteredPlans = useMemo(() => {
    const q = keyword.trim().toLowerCase();

    return orderedPlans.filter(plan => {
      const status = String(plan.status || plan.isActive || '').toLowerCase();
      const activeText = plan.isActive === false || status === 'inactive' ? 'inactive' : 'active';

      const matchKeyword = !q || [
        plan.id,
        plan.name,
        plan.title,
        plan.description,
        PLAN_META[plan.id]?.label,
      ]
        .filter(Boolean)
        .some(value => String(value).toLowerCase().includes(q));

      const matchStatus = statusFilter === 'all' || activeText === statusFilter;

      return matchKeyword && matchStatus;
    });
  }, [orderedPlans, keyword, statusFilter]);

  const stats = useMemo(() => {
    const total = plans.length;
    const active = plans.filter(p => p.isActive !== false && String(p.status || '').toLowerCase() !== 'inactive').length;
    const totalQuota = plans.reduce((sum, p) => sum + Number(p.quota || p.quotaTotal || 0), 0);
    const highestPrice = plans.reduce((max, p) => Math.max(max, Number(p.price || p.amount || 0)), 0);

    return { total, active, totalQuota, highestPrice };
  }, [plans]);

  if (loading) {
    return (
      <div className={styles.page}>
        <section className={styles.heroSkeleton} />
        <div className={styles.skeletonGrid}>
          <span />
          <span />
          <span />
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <section className={styles.heroPanel}>
        <div className={styles.heroContent}>
          <span className={styles.consoleBadge}>ADMIN PACKAGE CENTER</span>
          <h1>Quản lý gói dịch vụ</h1>
          <p>
            Tinh chỉnh giá, quota, trạng thái và nội dung hiển thị của từng gói trong một giao diện
            gọn, sáng, hiện đại và dễ thao tác.
          </p>
        </div>

        <div className={styles.heroActions}>
          <button className={styles.secondaryButton} type="button">Xem báo cáo</button>
          <button className={styles.primaryButton} type="button">Đồng bộ gói</button>
        </div>
      </section>

      <section className={styles.metricGrid} aria-label="Tổng quan gói dịch vụ">
        <article className={`${styles.metricCard} ${styles.metricBlue}`}>
          <span>Tổng số gói</span>
          <strong>{stats.total}</strong>
          <small>Đang cấu hình trên hệ thống</small>
        </article>
        <article className={`${styles.metricCard} ${styles.metricGreen}`}>
          <span>Gói đang bật</span>
          <strong>{stats.active}</strong>
          <small>Sẵn sàng hiển thị cho partner</small>
        </article>
        <article className={`${styles.metricCard} ${styles.metricViolet}`}>
          <span>Tổng quota</span>
          <strong>{formatNumber(stats.totalQuota)}</strong>
          <small>Cộng dồn toàn bộ gói</small>
        </article>
        <article className={`${styles.metricCard} ${styles.metricAmber}`}>
          <span>Giá cao nhất</span>
          <strong>{formatMoney(stats.highestPrice)}</strong>
          <small>Gói cao cấp nhất hiện tại</small>
        </article>
      </section>

      <section className={styles.controlPanel}>
        <div>
          <span className={styles.panelBadge}>PLAN CONFIGURATION</span>
          <h2>Danh sách gói</h2>
          <p>Chỉnh sửa trực tiếp từng gói. Font nhỏ vừa phải, khoảng trắng thoáng và hiệu ứng nhẹ.</p>
        </div>

        <div className={styles.toolbar}>
          <label className={styles.searchBox}>
            <span aria-hidden="true">⌕</span>
            <input
              value={keyword}
              onChange={event => setKeyword(event.target.value)}
              placeholder="Tìm gói, mô tả, mã gói..."
            />
          </label>

          <select
            className={styles.filterSelect}
            value={statusFilter}
            onChange={event => setStatusFilter(event.target.value)}
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="active">Đang bật</option>
            <option value="inactive">Đang tắt</option>
          </select>
        </div>
      </section>

      <div className={styles.cardsRow}>
        {filteredPlans.length === 0 && (
          <div className={styles.emptyState}>
            <strong>Không tìm thấy gói phù hợp</strong>
            <span>Thử đổi từ khóa tìm kiếm hoặc bộ lọc trạng thái.</span>
          </div>
        )}

        {filteredPlans.map(plan => {
          const meta = PLAN_META[plan.id] || {
            label: plan.name || plan.id,
            tone: 'blue',
            note: 'Gói dịch vụ tùy chỉnh',
          };

          return (
            <div
              key={plan.id}
              className={`${styles.planShell} ${styles[`tone_${meta.tone}`] || styles.tone_blue}`}
            >
              <div className={styles.planTop}>
                <div>
                  <span className={styles.planLabel}>{meta.label}</span>
                  <h3>{plan.name || plan.title || plan.id}</h3>
                  <p>{meta.note}</p>
                </div>
                <span className={styles.planCode}>{plan.id}</span>
              </div>

              <PlanEditor
                plan={plan}
                onSave={(planId, payload) => handleSave(planId, payload)}
              />

              {savingId === plan.id && (
                <div className={styles.savingOverlay}>
                  <span />
                  Đang lưu thay đổi...
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
