import { useEffect, useMemo, useState } from 'react'
import Card from '../../../shared/ui/Card/Card'
import Badge from '../../../shared/ui/Badge/Badge'
import api from '../../../services/api'
import { formatCurrency } from '../../../shared/lib/format'
import styles from './AdminPurchasesPage.module.css'

const ITEMS_PER_PAGE = 15
const PLAN_TONE = { starter: 'neutral', growth: 'success', enterprise: 'warning' }

function formatDate(isoStr) {
  if (!isoStr) return '—'
  return new Date(isoStr).toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
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

function shortCode(code) {
  if (!code) return '—'
  return code.length > 10 ? `${code.slice(0, 7)}…` : code
}

function firstLetter(name) {
  return String(name || 'P').trim().charAt(0).toUpperCase()
}

export default function AdminPurchasesPage() {
  const [purchases, setPurchases] = useState([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(null)
  const [keyword, setKeyword] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [page, setPage] = useState(1)

  const fetchPurchases = () => {
    setLoading(true)
    api.get('/api/admin/purchases')
      .then(r => setPurchases(r.data || []))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchPurchases()
  }, [])

  useEffect(() => {
    setPage(1)
  }, [keyword, statusFilter])

  const handleApprove = async (id) => {
    setActionLoading(`${id}_approve`)
    try {
      await api.post(`/api/admin/approve-purchase/${id}`)
      fetchPurchases()
    } catch (e) {
      alert(e.response?.data?.error || 'Lỗi khi duyệt.')
    } finally {
      setActionLoading(null)
    }
  }

  const handleReject = async (id) => {
    setActionLoading(`${id}_reject`)
    try {
      await api.post(`/api/admin/reject-purchase/${id}`)
      fetchPurchases()
    } catch (e) {
      alert(e.response?.data?.error || 'Lỗi khi từ chối.')
    } finally {
      setActionLoading(null)
    }
  }

  const stats = useMemo(() => {
    const total = purchases.length
    const paid = purchases.filter(p => p.status === 'Đã thanh toán').length
    const pending = purchases.filter(p => p.status?.startsWith('pending')).length
    const rejected = purchases.filter(p => p.status === 'Từ chối').length
    const revenue = purchases
      .filter(p => p.status === 'Đã thanh toán')
      .reduce((sum, p) => sum + Number(p.amount || 0), 0)

    return { total, paid, pending, rejected, revenue }
  }, [purchases])

  const filteredPurchases = useMemo(() => {
    const q = keyword.trim().toLowerCase()

    return purchases.filter(p => {
      const text = [p.partnerName, p.partnerCode, p.orgName, p.planName, p.status]
        .map(v => String(v || '').toLowerCase())
        .join(' ')

      const matchesKeyword = !q || text.includes(q)
      const matchesStatus = statusFilter === 'all'
        || (statusFilter === 'paid' && p.status === 'Đã thanh toán')
        || (statusFilter === 'pending' && p.status?.startsWith('pending'))
        || (statusFilter === 'rejected' && p.status === 'Từ chối')

      return matchesKeyword && matchesStatus
    })
  }, [purchases, keyword, statusFilter])

  const totalPages = Math.max(1, Math.ceil(filteredPurchases.length / ITEMS_PER_PAGE))
  const currentPage = Math.min(page, totalPages)
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
  const paginatedPurchases = filteredPurchases.slice(startIndex, startIndex + ITEMS_PER_PAGE)

  const visiblePages = useMemo(() => {
    const pages = []
    const max = 5
    let start = Math.max(1, currentPage - 2)
    let end = Math.min(totalPages, start + max - 1)
    start = Math.max(1, end - max + 1)
    for (let i = start; i <= end; i += 1) pages.push(i)
    return pages
  }, [currentPage, totalPages])

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.skeletonHero} />
        <div className={styles.skeletonKpis} />
        <div className={styles.skeletonTable} />
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <section className={styles.heroCard}>
        <div className={styles.heroContent}>
          <span className={styles.eyebrow}>Admin billing center</span>
          <h1>Quản lý mua gói</h1>
          <p>Theo dõi giao dịch, duyệt thanh toán và kiểm soát doanh thu trong một giao diện gọn gàng.</p>
        </div>
        <button className={styles.refreshBtn} onClick={fetchPurchases}>↻ Làm mới</button>
      </section>

      <section className={styles.kpiGrid}>
        <div className={`${styles.kpiCard} ${styles.kpiGreen}`}>
          <span>Doanh thu đã duyệt</span>
          <strong>{formatCurrency(stats.revenue)}</strong>
          <small>Tổng từ giao dịch đã thanh toán</small>
        </div>
        <div className={`${styles.kpiCard} ${styles.kpiBlue}`}>
          <span>Đã thanh toán</span>
          <strong>{stats.paid}</strong>
          <small>Giao dịch hợp lệ</small>
        </div>
        <div className={`${styles.kpiCard} ${styles.kpiYellow}`}>
          <span>Chờ duyệt</span>
          <strong>{stats.pending}</strong>
          <small>Cần kiểm tra thủ công</small>
        </div>
        <div className={`${styles.kpiCard} ${styles.kpiRose}`}>
          <span>Từ chối</span>
          <strong>{stats.rejected}</strong>
          <small>Giao dịch không hợp lệ</small>
        </div>
      </section>

      <Card
        title="Lịch sử mua gói"
        description={`${filteredPurchases.length} kết quả · ${ITEMS_PER_PAGE} giao dịch mỗi trang`}
      >
        <div className={styles.toolbar}>
          <label className={styles.searchBox}>
            <span className={styles.searchIcon}>⌕</span>
            <input
              value={keyword}
              onChange={e => setKeyword(e.target.value)}
              placeholder="Tìm partner, mã, đơn vị, gói..."
            />
          </label>

          <select
            className={styles.filterSelect}
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="paid">Đã thanh toán</option>
            <option value="pending">Chờ duyệt</option>
            <option value="rejected">Từ chối</option>
          </select>
        </div>

        <div className={styles.tableShell}>
          <table className={styles.purchaseTable}>
            <thead>
              <tr>
                <th>Thời gian</th>
                <th>Partner</th>
                <th>Đơn vị</th>
                <th>Gói đã mua</th>
                <th>Số tiền</th>
                <th>Trạng thái</th>
                <th>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {paginatedPurchases.length === 0 && (
                <tr>
                  <td colSpan={7} className={styles.emptyCell}>Không tìm thấy giao dịch phù hợp.</td>
                </tr>
              )}

              {paginatedPurchases.map((p, index) => (
                <tr key={p.id} className={index === 0 ? styles.firstRow : undefined}>
                  <td className={styles.timeCell}>{formatDate(p.purchasedAt)}</td>
                  <td>
                    <div className={styles.partnerCell}>
                      <span className={styles.avatar}>{firstLetter(p.partnerName)}</span>
                      <div>
                        <strong>{p.partnerName || '—'}</strong>
                        <small>{shortCode(p.partnerCode)}</small>
                      </div>
                    </div>
                  </td>
                  <td className={styles.orgCell}>{p.orgName || '—'}</td>
                  <td><Badge tone={PLAN_TONE[p.planId] || 'neutral'}>{p.planName || '—'}</Badge></td>
                  <td className={styles.amountCell}>{formatCurrency(p.amount)}</td>
                  <td><Badge tone={statusTone(p.status)}>{statusLabel(p.status)}</Badge></td>
                  <td>
                    {p.status?.startsWith('pending') ? (
                      <div className={styles.actionGroup}>
                        <button
                          className={styles.approveBtn}
                          disabled={!!actionLoading}
                          onClick={() => handleApprove(p.id)}
                        >
                          {actionLoading === `${p.id}_approve` ? '...' : 'Duyệt'}
                        </button>
                        <button
                          className={styles.rejectBtn}
                          disabled={!!actionLoading}
                          onClick={() => handleReject(p.id)}
                        >
                          {actionLoading === `${p.id}_reject` ? '...' : 'Từ chối'}
                        </button>
                      </div>
                    ) : <span className={styles.noAction}>—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className={styles.paginationBar}>
          <span>
            Trang {currentPage}/{totalPages} · Hiển thị {paginatedPurchases.length}/{filteredPurchases.length}
          </span>
          <div className={styles.pagination}>
            <button disabled={currentPage === 1} onClick={() => setPage(1)}>«</button>
            <button disabled={currentPage === 1} onClick={() => setPage(p => Math.max(1, p - 1))}>‹</button>
            {visiblePages.map(item => (
              <button
                key={item}
                className={currentPage === item ? styles.activePage : ''}
                onClick={() => setPage(item)}
              >
                {item}
              </button>
            ))}
            <button disabled={currentPage === totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>›</button>
            <button disabled={currentPage === totalPages} onClick={() => setPage(totalPages)}>»</button>
          </div>
        </div>
      </Card>
    </div>
  )
}
