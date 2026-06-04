import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { formatCurrency, formatNumber } from '../../../shared/lib/format'
import { fetchPlans } from '../../../services/planService'
import { useAuth } from '../../../auth/context/AuthContext'
import { PRIVILEGE_META, PRIVILEGE_ORDER } from '../../../shared/lib/privileges'
import styles from './PricingPage.module.css'

// Các hàng cố định (không dựa vào privilege key)
const STATIC_ROWS = [
  { label: 'Request / tháng', key: 'quota', format: (v) => formatNumber(v) },
  { label: 'Thời hạn sử dụng', key: 'durationDays', format: (v) => `${v} ngày` },
  { label: 'Khóa sandbox + live', values: ['✓', '✓', '✓'] },
  { label: 'Bộ lọc dữ liệu', values: ['Cơ bản', 'Nâng cao', 'Toàn bộ'] },
]

const PLAN_EYEBROW = {
  starter: 'Gói cơ bản',
  growth: 'Phổ biến nhất',
  enterprise: 'Doanh nghiệp lớn',
}

export default function PricingPage() {
  const [plans, setPlans] = useState([])
  const [qty, setQty] = useState({})
  const { currentUser } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    fetchPlans().then((data) => {
      setPlans(data)
      const init = {}
      data.forEach((p) => {
        init[p.id] = 1
      })
      setQty(init)
    })
  }, [])

  function changeQty(planId, delta) {
    setQty((prev) => ({
      ...prev,
      [planId]: Math.max(1, Math.min(12, (prev[planId] || 1) + delta)),
    }))
  }

  function handleBuy(plan) {
    if (!currentUser) {
      navigate('/dang-nhap')
      return
    }

    navigate(`/tai-khoan?tab=plan&planId=${plan.id}&qty=${qty[plan.id] || 1}`)
  }

  const planOrder = ['starter', 'growth', 'enterprise']
  const ordered = planOrder
    .map((id) => plans.find((p) => p.id === id))
    .filter(Boolean)

  // Hàng privilege: tạo động từ PRIVILEGE_ORDER + privileges của từng plan
  const privilegeRows = PRIVILEGE_ORDER.map(key => ({
    label: PRIVILEGE_META[key].label,
    privilegeKey: key,
    values: ordered.map(p => (Array.isArray(p.privileges) && p.privileges.includes(key) ? '✓' : '—')),
  }))

  const COMPARE_ROWS = [...STATIC_ROWS, ...privilegeRows]

  return (
    <div className={styles.page}>
      <div className={styles.sectionHeader}>
        <div className={styles.eyebrowLine}>
          <span className={styles.eyebrowDash} />
          <span className={styles.eyebrowText}>BẢNG GIÁ</span>
        </div>
        <h2 className={styles.sectionTitle}>Chọn gói phù hợp</h2>
        <p className={styles.sectionSub}>
          Truy cập trọn đời · Gói càng cao, quota càng lớn và tính năng càng mạnh
        </p>
      </div>

      <div className={styles.cardsRow}>
        {ordered.map((plan) => {
          const q = qty[plan.id] || 1
          const total = plan.price * q
          const isOut = plan.status !== 'Đang bán'
          const isFeatured = !!plan.featured

          return (
            <div
              key={plan.id}
              className={`${styles.card} ${isFeatured ? styles.cardFeatured : ''} ${isOut ? styles.cardOut : ''}`}
            >
              {isOut && (
                <div className={styles.outBanner}>
                  {plan.status}
                </div>
              )}

              <div className={styles.cardBadgeRow}>
                <span className={`${styles.tierBadge} ${isFeatured ? styles.tierFeatured : styles.tierStandard}`}>
                  {PLAN_EYEBROW[plan.id] || 'Gói đối tác'}
                </span>

                {isFeatured && (
                  <span className={styles.stockBadge}>
                    <span className={styles.stockDot} /> Đang bán
                  </span>
                )}

                {isOut && <span className={styles.outBadge}>Hết hàng</span>}
              </div>

              <div className={styles.cardName}>{plan.name}</div>

              <div className={styles.cardDesc}>
                {isFeatured
                  ? 'Đầy đủ tính năng'
                  : plan.id === 'starter'
                    ? 'Gói 1 — Cơ bản'
                    : 'Gói doanh nghiệp'}
              </div>

              <div className={styles.tierDots}>
                <span className={`${styles.dot} ${styles.dotGreen}`} title="Gói cơ bản" />
                <span
                  className={`${styles.dot} ${plan.id !== 'starter' ? styles.dotAmber : styles.dotDim}`}
                  title="Tăng trưởng"
                />
                <span
                  className={`${styles.dot} ${plan.id === 'enterprise' ? styles.dotBlue : styles.dotDim}`}
                  title="Doanh nghiệp"
                />
                <span className={styles.tierLabel}>
                  {plan.id === 'starter' ? '1/3 gói' : plan.id === 'growth' ? '2/3 gói' : '3/3 gói'}
                </span>
              </div>

              <div className={styles.priceBlock}>
                <div className={styles.priceRow}>
                  <span className={styles.priceMain}>{formatCurrency(total)}</span>
                  <span className={styles.priceCycle}>/ {plan.cycle}</span>
                </div>

                {q > 1 && (
                  <div className={styles.priceSub}>
                    {formatCurrency(plan.price)} × {q} tháng
                  </div>
                )}
              </div>

              <div className={styles.qtyRow}>
                <div className={styles.qtyLeft}>
                  <div className={styles.qtyLabel}>Số tháng</div>
                  <div className={styles.qtyDesc}>
                    ≈ {formatNumber(plan.quota * q)} request
                  </div>
                </div>

                <div className={styles.qtyStepper}>
                  <button
                    className={styles.qtyBtn}
                    onClick={() => changeQty(plan.id, -1)}
                    disabled={q <= 1}
                  >
                    −
                  </button>

                  <span className={`${styles.qtyNum} ${q > 1 ? styles.qtyNumActive : ''}`}>
                    {q}
                  </span>

                  <button
                    className={styles.qtyBtn}
                    onClick={() => changeQty(plan.id, 1)}
                    disabled={q >= 12}
                  >
                    +
                  </button>
                </div>
              </div>

              <button
                className={`${styles.btnPrimary} ${isOut ? styles.btnDisabled : ''}`}
                onClick={() => !isOut && handleBuy(plan)}
                disabled={isOut}
              >
                {currentUser ? `Mua ${plan.name}${q > 1 ? ` ×${q}` : ''}` : 'Đăng nhập để mua'}
              </button>

              <button
                className={styles.btnSecondary}
                onClick={() => navigate('/tai-khoan')}
              >
                ☰ Xem tài khoản
              </button>

              <div className={styles.featureSection}>
                <div className={styles.featureSectionLabel}>
                  <span
                    className={styles.featureDot}
                    style={{
                      background:
                        plan.id === 'enterprise'
                          ? '#6366f1'
                          : plan.id === 'growth'
                            ? '#f59e0b'
                            : '#22c55e',
                    }}
                  />
                  {plan.name.toUpperCase()} · TÍNH NĂNG
                </div>

                <ul className={styles.featureList}>
                  {(Array.isArray(plan.privileges) ? plan.privileges : []).map((key) => {
                    const meta = PRIVILEGE_META[key];
                    const label = meta ? meta.label : key;
                    return (
                      <li key={key} className={styles.featureItem}>
                        <span className={styles.featureCheck}>✓</span>
                        {label}
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          )
        })}
      </div>

      <div className={styles.compareSection}>
        <div className={styles.eyebrowLine}>
          <span className={styles.eyebrowDash} />
          <span className={styles.eyebrowText}>SO SÁNH</span>
        </div>

        <h2 className={styles.sectionTitle}>So sánh các gói</h2>

        <div className={styles.tableWrap}>
          <table className={styles.compareTable}>
            <thead>
              <tr>
                <th className={styles.thFeature}>TÍNH NĂNG</th>
                <th>
                  <span className={styles.thBadge} style={{ background: 'rgba(34,197,94,.15)', color: '#22c55e' }}>
                    KHỞI ĐẦU
                  </span>
                </th>
                <th>
                  <span className={styles.thBadge} style={{ background: 'rgba(245,158,11,.15)', color: '#f59e0b' }}>
                    TĂNG TRƯỞNG
                  </span>
                </th>
                <th>
                  <span className={styles.thBadge} style={{ background: 'rgba(99,102,241,.18)', color: '#818cf8' }}>
                    DOANH NGHIỆP
                  </span>
                </th>
              </tr>
            </thead>

            <tbody>
              {COMPARE_ROWS.map((row, i) => {
                const cells = row.key
                  ? ordered.map((p) => (row.format ? row.format(p[row.key]) : p[row.key]))
                  : row.values

                return (
                  <tr key={i} className={i % 2 === 0 ? styles.trEven : ''}>
                    <td className={styles.tdFeature}>{row.label}</td>

                    {cells.map((val, j) => (
                      <td key={j} className={styles.tdVal}>
                        {val === '✓' ? (
                          <span
                            className={styles.checkMark}
                            style={{
                              background:
                                j === 0
                                  ? 'rgba(34,197,94,.15)'
                                  : j === 1
                                    ? 'rgba(245,158,11,.15)'
                                    : 'rgba(99,102,241,.18)',
                            }}
                          >
                            <span
                              style={{
                                color:
                                  j === 0
                                    ? '#22c55e'
                                    : j === 1
                                      ? '#f59e0b'
                                      : '#818cf8',
                              }}
                            >
                              ✓
                            </span>
                          </span>
                        ) : val === '—' ? (
                          <span className={styles.dashMark}>—</span>
                        ) : (
                          val
                        )}
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      

      <div className={styles.bottomNote}>
        <p>
          Sau khi mua gói, hãy vào <strong>Thông tin cá nhân</strong> để xem gói hiện tại, thời gian còn lại,
          quota đã dùng, lịch sử mua hàng và lịch sử thanh toán.
        </p>
        <Link to="/tai-khoan">Đi tới trang thông tin cá nhân →</Link>
      </div>
    </div>
  )
}