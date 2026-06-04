import { useEffect, useMemo, useState } from 'react'
import Card from '../../../shared/ui/Card/Card'
import Badge from '../../../shared/ui/Badge/Badge'
import api from '../../../services/api'
import { formatCurrency } from '../../../shared/lib/format'
import styles from './PartnerPurchasesPage.module.css'

function formatDate(isoStr) {
  if (!isoStr) return '—'

  return new Date(isoStr).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function statusTone(status) {
  if (!status) return 'neutral'
  if (status.startsWith('pending')) return 'warning'
  if (status === 'Đã thanh toán') return 'success'
  if (status === 'Từ chối') return 'danger'
  return 'neutral'
}

function statusLabel(status) {
  if (!status) return '—'
  if (status.startsWith('pending:')) return `Chờ duyệt (${status.slice('pending:'.length)})`
  if (status === 'pending') return 'Chờ duyệt'
  return status
}

function planClass(planId) {
  if (planId === 'growth') return styles.planGrowth
  if (planId === 'enterprise') return styles.planEnterprise
  return styles.planStarter
}

function getInitials(name) {
  return String(name || 'Gói')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('')
}

const PLAN_TONE = {
  starter: 'neutral',
  growth: 'success',
  enterprise: 'warning',
}

const iconMap = {
  receipt: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7.25 4.75h9.5a1.5 1.5 0 0 1 1.5 1.5v13l-2.15-1.15-2.05 1.15-2.05-1.15-2.05 1.15-2.05-1.15-2.15 1.15v-13a1.5 1.5 0 0 1 1.5-1.5Z" />
      <path d="M9 9h6M9 12h6M9 15h3.5" />
    </svg>
  ),
  money: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4.75 7.25h14.5v9.5H4.75v-9.5Z" />
      <path d="M8 12h.01M16 12h.01M12 14.25a2.25 2.25 0 1 0 0-4.5 2.25 2.25 0 0 0 0 4.5Z" />
    </svg>
  ),
  pending: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 19.25a7.25 7.25 0 1 0-7.25-7.25" />
      <path d="M12 8v4.2l2.8 1.8" />
    </svg>
  ),
  check: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m6.75 12.25 3.3 3.3 7.2-7.2" />
    </svg>
  ),
  empty: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6.75 5.25h10.5a2 2 0 0 1 2 2v9.5a2 2 0 0 1-2 2H6.75a2 2 0 0 1-2-2v-9.5a2 2 0 0 1 2-2Z" />
      <path d="M8.75 9.25h6.5M8.75 12h4.5" />
    </svg>
  ),
}

export default function PartnerPurchasesPage() {
  const [purchases, setPurchases] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/api/partner/my-purchases')
      .then(r => setPurchases(Array.isArray(r.data) ? r.data : []))
      .catch(() => setPurchases([]))
      .finally(() => setLoading(false))
  }, [])

  const stats = useMemo(() => {
    const pending = purchases.filter(p => p.status?.startsWith('pending')).length
    const paid = purchases.filter(p => p.status === 'Đã thanh toán').length
    const totalAmount = purchases.reduce((sum, item) => sum + Number(item.amount || 0), 0)
    const latest = purchases[0]?.purchasedAt || null

    return {
      total: purchases.length,
      pending,
      paid,
      totalAmount,
      latest,
    }
  }, [purchases])

  if (loading) {
    return (
      <div className={styles.loadingState}>
        <div className={styles.loadingIcon}>{iconMap.receipt}</div>
        <span>Đang tải lịch sử mua gói...</span>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <section className={styles.statsGrid}>
        <article className={`${styles.statCard} ${styles.statPrimary}`}>
          <div className={styles.statIcon}>{iconMap.receipt}</div>
          <div>
            <span>Tổng giao dịch</span>
            <strong>{stats.total}</strong>
            <small>Toàn bộ lịch sử mua gói</small>
          </div>
        </article>

        <article className={`${styles.statCard} ${styles.statSuccess}`}>
          <div className={styles.statIcon}>{iconMap.check}</div>
          <div>
            <span>Đã thanh toán</span>
            <strong>{stats.paid}</strong>
            <small>Giao dịch đã được xác nhận</small>
          </div>
        </article>

        <article className={`${styles.statCard} ${styles.statWarning}`}>
          <div className={styles.statIcon}>{iconMap.pending}</div>
          <div>
            <span>Chờ duyệt</span>
            <strong>{stats.pending}</strong>
            <small>Đơn đang chờ admin xử lý</small>
          </div>
        </article>

        <article className={`${styles.statCard} ${styles.statMoney}`}>
          <div className={styles.statIcon}>{iconMap.money}</div>
          <div>
            <span>Tổng chi tiêu</span>
            <strong>{formatCurrency(stats.totalAmount)}</strong>
            <small>{stats.latest ? `Gần nhất: ${formatDate(stats.latest)}` : 'Chưa có giao dịch'}</small>
          </div>
        </article>
      </section>

      <Card
        className={styles.card}
        title="Lịch sử mua gói"
        description={
          stats.pending > 0
            ? `${stats.total} giao dịch — ${stats.pending} đơn đang chờ admin duyệt`
            : `${stats.total} giao dịch`
        }
      >
        {purchases.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>{iconMap.empty}</div>
            <strong>Bạn chưa có giao dịch nào.</strong>
            <span>Khi mua hoặc nâng cấp gói, lịch sử giao dịch sẽ hiển thị tại đây.</span>
          </div>
        ) : (
          <div className={styles.tableShell}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Thời gian</th>
                  <th>Gói</th>
                  <th>Số tiền</th>
                  <th>Trạng thái</th>
                </tr>
              </thead>

              <tbody>
                {purchases.map((p, index) => (
                  <tr key={p.id || `${p.planId}-${p.purchasedAt}-${index}`}>
                    <td>
                      <div className={styles.dateCell}>
                        <span>{formatDate(p.purchasedAt)}</span>
                        <small>Mã giao dịch: {p.id || '—'}</small>
                      </div>
                    </td>

                    <td>
                      <div className={styles.planCell}>
                        <div className={`${styles.planAvatar} ${planClass(p.planId)}`}>
                          {getInitials(p.planName)}
                        </div>

                        <div>
                          <strong>{p.planName || '—'}</strong>
                          <Badge tone={PLAN_TONE[p.planId] || 'neutral'}>
                            {p.planId || 'custom'}
                          </Badge>
                        </div>
                      </div>
                    </td>

                    <td>
                      <span className={styles.amountText}>{formatCurrency(p.amount)}</span>
                    </td>

                    <td>
                      <Badge tone={statusTone(p.status)}>
                        {statusLabel(p.status)}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
