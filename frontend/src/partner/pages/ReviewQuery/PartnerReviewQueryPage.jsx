import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../../auth/context/AuthContext'
import { fetchReviews } from '../../../services/reviewService'
import { formatDateTime } from '../../../shared/lib/format'
import api from '../../../services/api'
import styles from './PartnerReviewQueryPage.module.css'

const PARTNER_NAME_MAP = {
  'PT-001': 'VeXeNhanh',
  'PT-002': 'FUTA',
  'PT-003': 'An Vui',
}


const VISIBILITY_STORAGE_KEY = 'partner-review-visibility-overrides'
const PUBLIC_REVIEW_STORAGE_KEY = 'reviewhub-public-service-reviews'
const PUBLIC_REVIEW_STORAGE_SLUGS = [
  'nha-xe',
  'khach-san',
  'may-bay',
  'tau-hoa',
  'tour',
  'dich-vu-khac',
]

function readPublicServiceReviews() {
  if (typeof window === 'undefined') return []

  const readKey = (key) => {
    try {
      const parsed = JSON.parse(window.localStorage.getItem(key) || '[]')
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }

  const keys = [
    PUBLIC_REVIEW_STORAGE_KEY,
    ...PUBLIC_REVIEW_STORAGE_SLUGS.map((slug) => `${PUBLIC_REVIEW_STORAGE_KEY}:${slug}`),
  ]

  const map = new Map()

  keys.forEach((key) => {
    readKey(key).forEach((review) => {
      const stableKey = String(
        review.id ||
        review.reviewId ||
        `${review.targetCode || review.operatorCode || review.partnerCode || review.code || 'UNKNOWN'}-${review.targetName || review.operatorName || review.partnerName || review.name || ''}-${review.reviewerName || review.userName || review.authorName || review.customerName || ''}-${review.createdAt || review.created_at || ''}-${review.comment || review.content || review.reviewText || review.text || ''}`
      )
      if (!map.has(stableKey)) map.set(stableKey, review)
    })
  })

  return Array.from(map.values())
}

function normalizePublicServiceReview(review) {
  const targetCode = review.targetCode || review.target_code || review.operatorCode || review.operator_code || review.partnerCode || review.partner_code || review.ownerPartnerCode || review.owner_partner_code || review.code || 'UNKNOWN'
  const targetName = review.targetName || review.target_name || review.operatorName || review.operator_name || review.partnerName || review.partner_name || review.name || 'Không rõ đối tượng'

  return {
    ...review,
    id: review.id || review.reviewId || review.review_id || `PUBLIC-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    serviceSlug: review.serviceSlug || review.service_slug || review.targetSlug || review.target_slug || '',
    targetName,
    targetCode,
    operatorCode: review.operatorCode || review.operator_code || targetCode,
    partnerCode: review.partnerCode || review.partner_code || targetCode,
    partnerName: review.partnerName || review.partner_name || targetName || 'Public',
    sourceSystem: review.sourceSystem || review.source || 'partner-web',
    visibility: review.visibility || 'public',
    moderationStatus: review.moderationStatus || review.status || review.reviewStatus || 'pending',
    category: review.category || review.serviceCategory || review.service_category || 'Nhà xe',
    reviewerName: review.reviewerName || review.userName || review.authorName || review.customerName || 'Hành khách ẩn danh',
    comment: review.comment || review.content || review.reviewText || review.text || '',
    rating: Number(review.rating || review.score || review.stars || 0),
    createdAt: review.createdAt || review.created_at || new Date().toISOString(),
  }
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function reviewMatchesAssignedPartner(review, currentUser) {
  const assignedCode = normalizeText(currentUser?.assignedOperatorCode)
  const assignedName = normalizeText(
    currentUser?.assignedOperatorName ||
    currentUser?.orgName ||
    currentUser?.businessName ||
    currentUser?.name
  )

  if (!assignedCode && !assignedName) return true

  const codes = [
    review.targetCode,
    review.target_code,
    review.operatorCode,
    review.operator_code,
    review.partnerCode,
    review.partner_code,
    review.ownerPartnerCode,
    review.owner_partner_code,
    review.code,
  ].map(normalizeText).filter(Boolean)

  const names = [
    review.targetName,
    review.target_name,
    review.operatorName,
    review.operator_name,
    review.partnerName,
    review.partner_name,
    review.name,
  ].map(normalizeText).filter(Boolean)

  const codeMatches = Boolean(assignedCode && codes.some((code) => code === assignedCode))
  const nameMatches = Boolean(assignedName && names.some((name) => name === assignedName))

  if (assignedCode && assignedName && codes.length && names.length) return codeMatches && nameMatches
  if (assignedCode && codes.length) return codeMatches
  if (assignedName && names.length) return nameMatches

  return false
}

function mergeUniqueReviews(reviews) {
  const map = new Map()
  reviews.forEach((review) => {
    const normalized = applyVisibilityOverride(normalizePublicServiceReview(review))
    const key = normalized.id || `${normalized.targetCode}-${normalized.reviewerName}-${normalized.createdAt}-${normalized.comment}`
    if (!map.has(key)) map.set(key, normalized)
  })
  return Array.from(map.values()).sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
}


function readVisibilityOverrides() {
  if (typeof window === 'undefined') return {}
  try {
    return JSON.parse(window.localStorage.getItem(VISIBILITY_STORAGE_KEY) || '{}') || {}
  } catch {
    return {}
  }
}

function writeVisibilityOverride(reviewId, visibility) {
  if (typeof window === 'undefined') return
  const overrides = readVisibilityOverrides()
  overrides[reviewId] = visibility
  window.localStorage.setItem(VISIBILITY_STORAGE_KEY, JSON.stringify(overrides))
}

function applyVisibilityOverride(review) {
  const overrides = readVisibilityOverrides()
  return {
    ...review,
    visibility: overrides[review.id] || review.visibility || 'public',
  }
}

async function persistVisibilityRemote(reviewId, visibility) {
  const candidates = [
    { method: 'patch', url: `/api/reviews/${reviewId}/visibility`, data: { visibility } },
    { method: 'put', url: `/api/reviews/${reviewId}/visibility`, data: { visibility } },
    { method: 'patch', url: `/api/partner/reviews/${reviewId}/visibility`, data: { visibility } },
    { method: 'put', url: `/api/partner/reviews/${reviewId}/visibility`, data: { visibility } },
    { method: 'patch', url: `/api/reviews/${reviewId}`, data: { visibility } },
  ]

  let lastError = null
  for (const candidate of candidates) {
    try {
      await api[candidate.method](candidate.url, candidate.data)
      return true
    } catch (error) {
      lastError = error
    }
  }

  throw lastError
}

const PAGE_SIZE = 10

function getAverageRating(items) {
  if (!items.length) return 0
  return items.reduce((sum, item) => sum + Number(item.rating || 0), 0) / items.length
}

function getRatingLabel(avg) {
  if (avg >= 4.5) return 'Xuất sắc'
  if (avg >= 4) return 'Rất tốt'
  if (avg >= 3) return 'Ổn định'
  return 'Cần cải thiện'
}

function getTone(status) {
  const value = String(status || '').trim().toLowerCase()
  if (value === 'approved') return 'success'
  if (value === 'flagged' || value === 'pending' || value === 'pending_review') return 'warning'
  return 'danger'
}

function normalizeSource(value) {
  const source = String(value || '').trim().toLowerCase()
  if (source === 'partner' || source === 'partner_web' || source === 'partner-web') return 'partner-web'
  if (source === 'google' || source === 'google_maps' || source === 'google-maps') return 'google-maps'
  if (source === 'vexere') return 'vexere'
  return source || 'unknown'
}

function getSourceLabel(value) {
  const source = normalizeSource(value)
  if (source === 'partner-web') return 'Partner'
  if (source === 'google-maps') return 'Google'
  if (source === 'vexere') return 'Vexere'
  return 'Không rõ'
}

function getSourceIcon(value) {
  const source = normalizeSource(value)
  if (source === 'partner-web') return 'Partner'
  if (source === 'google-maps') return 'Google'
  if (source === 'vexere') return 'Vexere'
  return 'Nguồn'
}

function clampPage(page, totalPages) {
  return Math.max(1, Math.min(page, totalPages))
}

function makeStars(value) {
  const rounded = Math.round(Number(value || 0))
  return Array.from({ length: 5 }, (_, index) => (index < rounded ? '★' : '☆')).join('')
}

function makeInitials(value) {
  return String(value || 'P')
    .trim()
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase()
}

function getAvatarTone(item) {
  const key = String(item.id || item.targetCode || item.partnerName || item.operatorCode || '')
  let hash = 0
  for (let index = 0; index < key.length; index += 1) {
    hash = (hash + key.charCodeAt(index) * (index + 1)) % 6
  }
  return `avatar${hash}`
}

function DashboardIcon({ name }) {
  const common = {
    width: 20,
    height: 20,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.9,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': 'true',
  }

  if (name === 'reviews') {
    return (
      <svg {...common}>
        <path d="M7.5 8.5h9" />
        <path d="M7.5 12h5.5" />
        <path d="M8 19.5 4.8 21V6.2A3.2 3.2 0 0 1 8 3h8a3.2 3.2 0 0 1 3.2 3.2v7.6A3.2 3.2 0 0 1 16 17H9.7L8 19.5Z" />
      </svg>
    )
  }

  if (name === 'visible') {
    return (
      <svg {...common}>
        <path d="M4 19V9" />
        <path d="M10 19V5" />
        <path d="M16 19v-7" />
        <path d="M22 19H2" />
      </svg>
    )
  }

  if (name === 'public') {
    return (
      <svg {...common}>
        <path d="M12 3.5 14.7 9l6.1.9-4.4 4.3 1 6.1L12 17.4l-5.4 2.9 1-6.1L3.2 9.9 9.3 9 12 3.5Z" />
      </svg>
    )
  }

  if (name === 'private') {
    return (
      <svg {...common}>
        <rect x="5" y="10" width="14" height="10" rx="2.5" />
        <path d="M8.5 10V7.6a3.5 3.5 0 0 1 7 0V10" />
        <path d="M12 14.2v2.2" />
      </svg>
    )
  }

  return (
    <svg {...common}>
      <path d="M12 8v5" />
      <path d="M12 17h.01" />
      <path d="M10.3 3.9 2.8 17a2 2 0 0 0 1.7 3h15a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
    </svg>
  )
}

function DetailIcon({ name }) {
  const common = {
    width: 18,
    height: 18,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.9,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': 'true',
  }

  const icons = {
    id: (
      <svg {...common}>
        <rect x="4" y="5" width="16" height="14" rx="3" />
        <path d="M8 9h8M8 13h5" />
      </svg>
    ),
    target: (
      <svg {...common}>
        <path d="M12 21s7-4.4 7-11a7 7 0 1 0-14 0c0 6.6 7 11 7 11Z" />
        <circle cx="12" cy="10" r="2.4" />
      </svg>
    ),
    code: (
      <svg {...common}>
        <path d="m8 8-4 4 4 4" />
        <path d="m16 8 4 4-4 4" />
        <path d="m14 5-4 14" />
      </svg>
    ),
    partner: (
      <svg {...common}>
        <path d="M16 11a4 4 0 1 0-8 0" />
        <path d="M4 20a8 8 0 0 1 16 0" />
        <path d="M18 6.5h3M19.5 5v3" />
      </svg>
    ),
    user: (
      <svg {...common}>
        <circle cx="12" cy="8" r="3.2" />
        <path d="M5.5 20a6.5 6.5 0 0 1 13 0" />
      </svg>
    ),
    rating: (
      <svg {...common} fill="currentColor" stroke="none">
        <path d="M12 3.7 14.5 8.8l5.6.8-4.1 4 1 5.6-5-2.7-5 2.7 1-5.6-4.1-4 5.6-.8L12 3.7Z" />
      </svg>
    ),
    visibility: (
      <svg {...common}>
        <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
        <circle cx="12" cy="12" r="2.7" />
      </svg>
    ),
    moderation: (
      <svg {...common}>
        <path d="M20 7 10 17l-5-5" />
        <path d="M12 22a10 10 0 1 0-9.5-13" />
      </svg>
    ),
    calendar: (
      <svg {...common}>
        <rect x="4" y="5" width="16" height="15" rx="3" />
        <path d="M8 3v4M16 3v4M4 10h16" />
      </svg>
    ),
    refresh: (
      <svg {...common}>
        <path d="M20 12a8 8 0 0 1-13.7 5.7" />
        <path d="M4 12A8 8 0 0 1 17.7 6.3" />
        <path d="M17.7 3.7v2.6h-2.6" />
        <path d="M6.3 20.3v-2.6h2.6" />
      </svg>
    ),
    link: (
      <svg {...common}>
        <path d="M10 13.5a4 4 0 0 0 5.7 0l2.2-2.2a4 4 0 0 0-5.7-5.7L11 6.8" />
        <path d="M14 10.5a4 4 0 0 0-5.7 0l-2.2 2.2a4 4 0 0 0 5.7 5.7L13 17.2" />
      </svg>
    ),
  }

  return icons[name] || icons.id
}

function escapeExcel(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function SparkLine({ tone = 'violet' }) {
  return (
    <svg className={`${styles.sparkLine} ${styles[tone]}`} viewBox="0 0 120 46" aria-hidden="true">
      <path d="M4 34 C15 25 22 31 31 20 C41 8 50 31 61 21 C72 11 79 37 91 20 C101 8 108 20 116 10" />
      <path className={styles.sparkArea} d="M4 34 C15 25 22 31 31 20 C41 8 50 31 61 21 C72 11 79 37 91 20 C101 8 108 20 116 10 L116 46 L4 46 Z" />
    </svg>
  )
}

export default function PartnerReviewQueryPage() {
  const { currentUser } = useAuth()
  const [filters, setFilters] = useState({
    keyword: '',
    category: 'all',
    visibility: 'all',
    sourceSystem: 'all',
  })
  const [selectedReviewId, setSelectedReviewId] = useState(null)
  const [activeTab, setActiveTab] = useState('overview')
  const [currentPage, setCurrentPage] = useState(1)
  const [allowedReviews, setAllowedReviews] = useState([])
  const [loading, setLoading] = useState(true)
  const [openVisibilityId, setOpenVisibilityId] = useState(null)
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState(null)

  useEffect(() => {
    setLoading(true)
    fetchReviews({
      keyword: filters.keyword,
      category: filters.category,
      visibility: filters.visibility,
      sourceSystem: 'all',
      size: 300,
    })
      .then((data) => {
        const apiList = Array.isArray(data)
          ? data
          : Array.isArray(data?.content)
            ? data.content
            : Array.isArray(data?.data)
              ? data.data
              : Array.isArray(data?.reviews)
                ? data.reviews
                : []

        const apiReviews = apiList.map((review) =>
          applyVisibilityOverride({
            ...review,
            partnerName:
              review.partnerName ||
              review.partner_name ||
              PARTNER_NAME_MAP[review.operatorCode || review.operator_code || review.targetCode || review.target_code] ||
              review.operatorName ||
              review.operator_name ||
              review.targetName ||
              review.target_name ||
              currentUser?.orgName ||
              'Đối tác',
          })
        )
        const publicServiceReviews = readPublicServiceReviews().map(normalizePublicServiceReview)
        const merged = mergeUniqueReviews([...publicServiceReviews, ...apiReviews])
          .filter((review) => reviewMatchesAssignedPartner(review, currentUser))
        setAllowedReviews(merged)
      })
      .catch(() => {
        const publicServiceReviews = readPublicServiceReviews().map(normalizePublicServiceReview)
        setAllowedReviews(mergeUniqueReviews(publicServiceReviews).filter((review) => reviewMatchesAssignedPartner(review, currentUser)))
      })
      .finally(() => setLoading(false))
  }, [filters.keyword, filters.category, filters.visibility, currentUser])

  const filtered = useMemo(() => {
    const keyword = filters.keyword.toLowerCase().trim()

    return allowedReviews.filter((item) => {
      const text = [
        item.id,
        item.targetName,
        item.targetCode,
        item.comment,
        item.partnerName,
        item.reviewerName,
        item.category,
        item.sourceSystem,
        getSourceLabel(item.sourceSystem),
        item.visibility,
        item.moderationStatus,
      ]
        .join(' ')
        .toLowerCase()

      const matchesKeyword = !keyword || text.includes(keyword)
      const matchesCategory = filters.category === 'all' || item.category === filters.category
      const matchesVisibility = filters.visibility === 'all' || item.visibility === filters.visibility
      const matchesSource = filters.sourceSystem === 'all' || normalizeSource(item.sourceSystem) === filters.sourceSystem

      return matchesKeyword && matchesCategory && matchesVisibility && matchesSource
    })
  }, [allowedReviews, filters])

  const stats = useMemo(() => {
    const publicShared = allowedReviews.filter((item) => item.visibility === 'public').length
    const privateMine = allowedReviews.filter((item) => item.visibility === 'private').length
    const good = filtered.filter((item) => Number(item.rating) >= 4).length
    const bad = filtered.filter((item) => Number(item.rating) <= 2).length
    const average = getAverageRating(filtered)

    return {
      totalAllowed: allowedReviews.length,
      visibleNow: filtered.length,
      publicShared,
      privateMine,
      good,
      bad,
      average,
      averagePercent: Math.max(0, Math.min(100, (average / 5) * 100)),
      averageLabel: getRatingLabel(average),
    }
  }, [allowedReviews, filtered])

  const ratingBreakdown = useMemo(() => {
    const counts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
    filtered.forEach((item) => {
      const rating = Math.round(Number(item.rating) || 0)
      if (counts[rating] !== undefined) counts[rating] += 1
    })

    const total = Math.max(filtered.length, 1)
    return [5, 4, 3, 2, 1].map((star) => ({
      star,
      count: counts[star],
      percent: (counts[star] / total) * 100,
    }))
  }, [filtered])

  const latestUpdatedAt = useMemo(() => {
    if (!filtered.length) return null
    return filtered.reduce((latest, item) => {
      const currentTime = new Date(item.createdAt).getTime()
      const latestTime = latest ? new Date(latest).getTime() : 0
      return currentTime > latestTime ? item.createdAt : latest
    }, null)
  }, [filtered])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safeCurrentPage = clampPage(currentPage, totalPages)
  const startIndex = filtered.length === 0 ? 0 : (safeCurrentPage - 1) * PAGE_SIZE + 1
  const endIndex = filtered.length === 0 ? 0 : Math.min(safeCurrentPage * PAGE_SIZE, filtered.length)

  const currentItems = useMemo(() => {
    const start = (safeCurrentPage - 1) * PAGE_SIZE
    return filtered.slice(start, start + PAGE_SIZE)
  }, [filtered, safeCurrentPage])

  const selectedReview = filtered.find((item) => item.id === selectedReviewId) || null

  const handleSyncReviews = async () => {
    setSyncing(true)
    setSyncResult(null)
    try {
      const res = await api.post('/api/partner/sync-reviews')
      const { message } = res.data
      setSyncResult({ ok: true, message: message || 'Đồng bộ thành công!' })
      // Làm mới danh sách review sau khi sync
      setFilters((prev) => ({ ...prev }))
    } catch (err) {
      const msg = err?.response?.data?.message || 'Lỗi khi đồng bộ review. Vui lòng thử lại.'
      setSyncResult({ ok: false, message: msg })
    } finally {
      setSyncing(false)
    }
  }

  const handleExportExcel = () => {
    const columns = [
      'Mã review',
      'Đối tượng',
      'Mã đối tượng',
      'Partner gửi',
      'Nguồn',
      'Điểm',
      'Hiển thị',
      'Moderation',
      'Người gửi',
      'Thời gian tạo',
      'Nội dung',
    ]

    const rows = filtered.map((item) => [
      item.id,
      item.targetName || 'Không rõ đối tượng',
      item.targetCode || 'UNKNOWN',
      item.partnerName || '',
      getSourceLabel(item.sourceSystem),
      `${Number(item.rating || 0)}/5`,
      item.visibility || '',
      item.moderationStatus || 'pending',
      item.reviewerName || '',
      item.createdAt ? formatDateTime(item.createdAt) : '',
      item.comment || '',
    ])

    const tableHtml = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
        <head><meta charset="UTF-8" /></head>
        <body>
          <table border="1">
            <thead><tr>${columns.map((column) => `<th>${escapeExcel(column)}</th>`).join('')}</tr></thead>
            <tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeExcel(cell)}</td>`).join('')}</tr>`).join('')}</tbody>
          </table>
        </body>
      </html>
    `

    const blob = new Blob([tableHtml], { type: 'application/vnd.ms-excel;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    const today = new Date().toISOString().slice(0, 10)

    link.href = url
    link.download = `partner-reviews-${today}.xls`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const handleChangeFilter = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
    setCurrentPage(1)
  }

  const handleOpenReview = (reviewId) => {
    setOpenVisibilityId(null)
    setSelectedReviewId(reviewId)
    setActiveTab('overview')
  }

  const toggleVisibility = (reviewId) => {
    setOpenVisibilityId((currentId) => (currentId === reviewId ? null : reviewId))
  }

  const updateVisibility = async (reviewId, nextVisibility) => {
    setAllowedReviews((prev) =>
      prev.map((item) =>
        item.id === reviewId ? { ...item, visibility: nextVisibility } : item
      )
    )
    writeVisibilityOverride(reviewId, nextVisibility)
    setOpenVisibilityId(null)

    try {
      await persistVisibilityRemote(reviewId, nextVisibility)
    } catch (error) {
      // Nếu backend chưa có API cập nhật visibility, localStorage vẫn giữ lựa chọn
      // để khi thoát ra vào lại giao diện không tự nhảy về public.
      setAllowedReviews((prev) =>
        prev.map((item) =>
          item.id === reviewId ? { ...item, visibility: nextVisibility } : item
        )
      )
      console.warn('Không thể đồng bộ visibility lên server, đã lưu tạm trên trình duyệt.', error)
    }
  }

  const handleCloseReview = () => setSelectedReviewId(null)

  useEffect(() => {
    if (!selectedReview) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const onKeyDown = (event) => {
      if (event.key === 'Escape') setSelectedReviewId(null)
    }

    window.addEventListener('keydown', onKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [selectedReview])

  if (loading) {
    return (
      <div className={styles.loadingState}>
        <span />
        Đang tải dữ liệu review...
      </div>
    )
  }

  if (!currentUser?.assignedOperatorCode) {
    return (
      <div className={styles.emptyAccessPage}>
        <div className={styles.emptyAccessCard}>
          <h3>Tài khoản chưa được gán nhà xe</h3>
          <p>Tài khoản của bạn chưa được admin gán nhà xe. Vui lòng liên hệ admin để được phân công trước khi tra cứu review.</p>
        </div>
      </div>
    )
  }

  const kpis = [
    { label: 'Review được phép xem', value: stats.totalAllowed, hint: '+12.5% so với tuần trước', icon: 'reviews', tone: 'violet' },
    { label: 'Đang hiển thị', value: stats.visibleNow, hint: '+8.2% sau bộ lọc', icon: 'visible', tone: 'green' },
    { label: 'Public dùng chung', value: stats.publicShared, hint: '+15.1% trong hub', icon: 'public', tone: 'blue' },
    { label: 'Private của tôi', value: stats.privateMine, hint: stats.privateMine ? 'Dữ liệu riêng đối tác' : 'Không có dữ liệu', icon: 'private', tone: 'orange' },
    { label: 'Cần theo dõi', value: stats.bad, hint: '-4.3% cần xử lý', icon: 'alert', tone: 'red' },
  ]

  return (
    <main className={styles.page}>
      <section className={styles.kpiGrid}>
        {kpis.map((item, index) => (
          <article key={item.label} className={`${styles.kpiCard} ${styles[item.tone]}`} style={{ animationDelay: `${index * 55}ms` }}>
            <div className={styles.kpiTop}>
              <span className={styles.kpiIcon}><DashboardIcon name={item.icon} /></span>
              <div>
                <p>{item.label}</p>
                <strong>{item.value}</strong>
              </div>
            </div>
            <small className={item.tone === 'red' ? styles.downHint : ''}>{item.hint}</small>
            <SparkLine tone={item.tone} />
          </article>
        ))}
      </section>

      <section className={styles.workspaceGrid}>
        <div className={styles.leftColumn}>
          <section className={styles.filterCard}>
            <div className={styles.sectionTitleBlock}>
              <h2>Bộ lọc review</h2>
              <p>Tìm nhanh review theo từ khóa, danh mục, nguồn gửi và trạng thái hiển thị.</p>
            </div>

            <div className={styles.filterGrid}>
              <label className={`${styles.fieldGroup} ${styles.searchField}`}>
                <span>Từ khóa</span>
                <input
                  value={filters.keyword}
                  onChange={(event) => handleChangeFilter('keyword', event.target.value)}
                  placeholder="Tìm kiếm review..."
                />
              </label>

              <label className={styles.fieldGroup}>
                <span>Danh mục</span>
                <select value={filters.category} onChange={(event) => handleChangeFilter('category', event.target.value)}>
                  <option value="all">Tất cả</option>
                  <option value="Nhà xe">Nhà xe</option>
                  <option value="Khách sạn">Khách sạn</option>
                  <option value="Máy bay">Máy bay</option>
                  <option value="Tàu hỏa">Tàu hỏa</option>
                  <option value="Tour">Tour</option>
                </select>
              </label>

              <label className={styles.fieldGroup}>
                <span>Nguồn</span>
                <select value={filters.sourceSystem} onChange={(event) => handleChangeFilter('sourceSystem', event.target.value)}>
                  <option value="all">Tất cả nguồn</option>
                  <option value="vexere">Vexere</option>
                  <option value="partner-web">Partner gửi</option>
                  <option value="google-maps">Google Maps</option>
                </select>
              </label>

              <label className={styles.fieldGroup}>
                <span>Hiển thị</span>
                <select value={filters.visibility} onChange={(event) => handleChangeFilter('visibility', event.target.value)}>
                  <option value="all">Tất cả</option>
                  <option value="public">Public</option>
                  <option value="private">Private</option>
                </select>
              </label>
            </div>
          </section>

          <section className={styles.tableCard}>
            <div className={styles.tableHeader}>
              <div>
                <h2>Danh sách review</h2>
                <p>{filtered.length ? `Tìm thấy ${filtered.length} review phù hợp.` : 'Không có review phù hợp.'}</p>
              </div>
              <button type="button" className={styles.exportBtn} onClick={handleExportExcel}>Xuất Excel</button>
            </div>

            <div className={styles.tableShell}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Mã review</th>
                    <th>Đối tượng</th>
                    <th>Partner gửi</th>
                    <th>Nguồn</th>
                    <th>Điểm</th>
                    <th>Hiển thị</th>
                    <th>Moderation</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>

                <tbody>
                  {currentItems.length ? currentItems.map((item) => {
                    const avatarTone = getAvatarTone(item)
                    const source = normalizeSource(item.sourceSystem)

                    return (
                      <tr key={item.id}>
                        <td><span className={styles.idBadge}>{item.id}</span></td>
                        <td>
                          <div className={styles.targetCell}>
                            <span className={`${styles.reviewAvatar} ${styles[avatarTone]}`}>{makeInitials(item.targetName || item.partnerName)}</span>
                            <div>
                              <strong>{item.targetName || 'Không rõ đối tượng'}</strong>
                              <small>{item.targetCode || 'UNKNOWN'}</small>
                            </div>
                          </div>
                        </td>
                        <td className={styles.partnerCell}>{item.partnerName}</td>
                        <td>
                          <span className={`${styles.sourceBadge} ${styles[source]}`}>
                            <i />{getSourceLabel(item.sourceSystem)}
                          </span>
                        </td>
                        <td>
                          <span className={styles.ratingBadge}>{Number(item.rating || 0).toFixed(0)}/5</span>
                        </td>
                        <td>
                          <div className={styles.visibilitySelectWrap}>
                            <button
                              type="button"
                              className={`${styles.visibilityBadge} ${item.visibility === 'public' ? styles.publicBadge : styles.privateBadge}`}
                              onClick={() => toggleVisibility(item.id)}
                              aria-haspopup="listbox"
                              aria-expanded={openVisibilityId === item.id}
                            >
                              <span>{item.visibility || 'public'}</span>
                              <svg className={styles.visibilityChevron} viewBox="0 0 20 20" aria-hidden="true">
                                <path d="M6 8l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            </button>

                            {openVisibilityId === item.id && (
                              <div className={styles.visibilityDropdown} role="listbox">
                                <button type="button" onClick={() => updateVisibility(item.id, 'public')}>
                                  public
                                </button>
                                <button type="button" onClick={() => updateVisibility(item.id, 'private')}>
                                  private
                                </button>
                              </div>
                            )}
                          </div>
                        </td>
                        <td>
                          <span className={`${styles.statusBadge} ${styles[getTone(item.moderationStatus)]}`}>
                            {item.moderationStatus || 'pending'}
                          </span>
                        </td>
                        <td className={styles.actionCell}>
                          <button type="button" className={styles.detailBtn} onClick={() => handleOpenReview(item.id)}>
                            Chi tiết
                          </button>
                        </td>
                      </tr>
                    )
                  }) : (
                    <tr>
                      <td colSpan="8" className={styles.emptyCell}>Không có review phù hợp.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className={styles.tableFooter}>
              <span>Hiển thị {startIndex}–{endIndex} / trang {safeCurrentPage}</span>

              {totalPages > 1 && (
                <div className={styles.paginationWrap}>
                  <button type="button" disabled={safeCurrentPage === 1} onClick={() => setCurrentPage((prev) => clampPage(prev - 1, totalPages))}>Trước</button>
                  {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
                    <button key={page} type="button" className={safeCurrentPage === page ? styles.pageActive : ''} onClick={() => setCurrentPage(page)}>
                      {page}
                    </button>
                  ))}
                  <button type="button" disabled={safeCurrentPage === totalPages} onClick={() => setCurrentPage((prev) => clampPage(prev + 1, totalPages))}>Sau</button>
                </div>
              )}
            </div>
          </section>
        </div>

        <aside className={styles.rightColumn}>
          <section className={styles.analyticsCard}>
            <div className={styles.sideHeader}>
              <div>
                <h3>Thống kê đánh giá</h3>
                <p>Tổng quan điểm chất lượng</p>
              </div>
              <select value={filters.sourceSystem} onChange={(event) => handleChangeFilter('sourceSystem', event.target.value)}>
                <option value="all">Tất cả nguồn</option>
                <option value="vexere">Vexere</option>
                <option value="partner-web">Partner gửi</option>
                <option value="google-maps">Google Maps</option>
              </select>
            </div>

            <div className={styles.analyticsBody}>
              <div className={styles.donut} style={{ '--score': `${stats.averagePercent}%` }}>
                <div>
                  <strong>{stats.average.toFixed(1)}</strong>
                  <span>/5</span>
                  <small>Điểm trung bình</small>
                </div>
              </div>

              <div className={styles.breakdownList}>
                {ratingBreakdown.map((item) => (
                  <div key={item.star} className={styles.breakdownRow}>
                    <span>{item.star} sao</span>
                    <div><i style={{ width: `${item.percent}%` }} /></div>
                    <b>{item.count}</b>
                  </div>
                ))}
              </div>
            </div>

            <div className={styles.summaryGrid}>
              <div><span>Tổng đánh giá</span><strong>{filtered.length}</strong></div>
              <div className={styles.goodBox}><span>Đánh giá tốt</span><strong>{stats.good}</strong></div>
              <div className={styles.badBox}><span>Cần theo dõi</span><strong>{stats.bad}</strong></div>
            </div>
          </section>

          <section className={styles.trustCard}>
            <div className={styles.trustIcon}>★</div>
            <div>
              <h3>Hệ thống đánh giá minh bạch</h3>
              <p>Dữ liệu được cập nhật theo quyền truy cập của đối tác, tách rõ public/private và hỗ trợ theo dõi chất lượng dịch vụ.</p>
            </div>
            <div className={styles.trustPills}>
              <span>Minh bạch</span>
              <span>Chính xác</span>
              <span>Công bằng</span>
            </div>
          </section>
        </aside>
      </section>

      {selectedReview && (
        <div className={styles.modalOverlay} onClick={handleCloseReview}>
          <div className={styles.modalCard} onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
            <div className={styles.modalHeaderPro}>
              <div className={styles.modalIdentity}>
                <div className={`${styles.modalAvatar} ${styles[getAvatarTone(selectedReview)]}`}>
                  {makeInitials(selectedReview.targetName || selectedReview.partnerName)}
                </div>
                <div className={styles.modalTitleArea}>
                  <span className={styles.modalEyebrow}>Chi tiết review</span>
                  <h3>{selectedReview.targetName || 'Không rõ đối tượng'}</h3>
                  <div className={styles.modalQuickMeta}>
                    <i className={styles.sourcePartner}>{getSourceLabel(selectedReview.sourceSystem)}</i>
                    <i className={getTone(selectedReview.moderationStatus) === 'success' ? styles.statusApproved : styles.statusPending}>
                      {selectedReview.moderationStatus || 'pending'}
                    </i>
                    <i className={styles.visibilityMeta}>{selectedReview.visibility || 'public'}</i>
                  </div>
                  <p>Xem thông tin review theo từng nhóm nội dung để dễ theo dõi hơn.</p>
                </div>
              </div>
              <button type="button" className={styles.modalCloseBtn} onClick={handleCloseReview} aria-label="Đóng popup">×</button>
            </div>

            <div className={styles.modalTabs}>
              <button type="button" className={activeTab === 'overview' ? styles.modalTabActive : ''} onClick={() => setActiveTab('overview')}>Thông tin chung</button>
              <button type="button" className={activeTab === 'content' ? styles.modalTabActive : ''} onClick={() => setActiveTab('content')}>Nội dung đánh giá</button>
              <button type="button" className={activeTab === 'meta' ? styles.modalTabActive : ''} onClick={() => setActiveTab('meta')}>Metadata / API</button>
            </div>

            <div className={styles.modalBody}>
              {activeTab === 'overview' && (
                <div className={styles.overviewTab}>
                  <h4 className={styles.modalSectionTitle}>Thông tin review</h4>
                  <div className={styles.detailGridPro}>
                    <div className={styles.detailCard}><span className={styles.detailIcon}><DetailIcon name="id" /></span><div><small>Mã review</small><strong>{selectedReview.id}</strong></div></div>
                    <div className={styles.detailCard}><span className={styles.detailIcon}><DetailIcon name="target" /></span><div><small>Đối tượng</small><strong>{selectedReview.targetName || 'Không rõ đối tượng'}</strong></div></div>
                    <div className={styles.detailCard}><span className={styles.detailIcon}><DetailIcon name="code" /></span><div><small>Mã đối tượng</small><strong>{selectedReview.targetCode || 'UNKNOWN'}</strong></div></div>
                    <div className={styles.detailCard}><span className={styles.detailIcon}><DetailIcon name="partner" /></span><div><small>Partner gửi</small><strong>{selectedReview.partnerName || 'Đối tác'}</strong></div></div>
                    <div className={styles.detailCard}><span className={styles.detailIcon}><DetailIcon name="user" /></span><div><small>Người gửi</small><strong>{selectedReview.reviewerName || 'Không rõ'}</strong></div></div>
                    <div className={styles.detailCard}><span className={`${styles.detailIcon} ${styles.starIcon}`}><DetailIcon name="rating" /></span><div><small>Điểm</small><strong>{selectedReview.rating || 0}/5</strong></div></div>
                    <div className={styles.detailCard}><span className={styles.detailIcon}><DetailIcon name="visibility" /></span><div><small>Hiển thị</small><strong>{selectedReview.visibility || 'public'}</strong></div></div>
                    <div className={styles.detailCard}><span className={`${styles.detailIcon} ${styles.checkIcon}`}><DetailIcon name="moderation" /></span><div><small>Moderation</small><strong>{selectedReview.moderationStatus || 'pending'}</strong></div></div>
                  </div>

                  <div className={styles.modalInfoStrip}>
                    <div><span><DetailIcon name="calendar" /></span><small>Thời gian tạo</small><strong>{selectedReview.createdAt ? formatDateTime(selectedReview.createdAt) : 'Chưa có'}</strong></div>
                    <div><span><DetailIcon name="refresh" /></span><small>Cập nhật lần cuối</small><strong>{selectedReview.createdAt ? formatDateTime(selectedReview.createdAt) : 'Chưa có'}</strong></div>
                    <div><span><DetailIcon name="link" /></span><small>Nguồn gửi</small><strong>{getSourceLabel(selectedReview.sourceSystem)} System</strong></div>
                  </div>
                </div>
              )}

              {activeTab === 'content' && (
                <div className={styles.contentTabPro}>
                  <div className={styles.reviewHeroCard}>
                    <div className={styles.reviewHeroTop}>
                      <span>Đánh giá tổng thể</span>
                      <b>{Number(selectedReview.rating || 0) >= 4 ? 'Positive Review' : 'Needs Attention'}</b>
                    </div>
                    <div className={styles.reviewScoreLine}>
                      <strong>{selectedReview.rating || 0}</strong>
                      <span>/5 sao</span>
                      <em>{makeStars(selectedReview.rating)}</em>
                    </div>
                    <div className={styles.reviewDivider} />
                    <div className={styles.reviewCommentBlock}>
                      <h4>Nội dung đánh giá</h4>
                      <p>{selectedReview.comment || 'Không có nội dung đánh giá.'}</p>
                    </div>
                  </div>

                  <div className={styles.highlightPanel}>
                    <h4>Điểm mạnh nổi bật</h4>
                    <div className={styles.highlightPills}>
                      <span>Sạch sẽ</span>
                      <span>Đúng giờ</span>
                      <span>Tài xế lịch sự</span>
                      <span>Dịch vụ tốt</span>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'meta' && (
                <div className={styles.metaTabPro}>
                  <section className={styles.metaInfoCard}>
                    <h4>Thông tin hệ thống</h4>
                    <dl>
                      <div><dt>Review ID</dt><dd>{selectedReview.id}</dd></div>
                      <div><dt>Danh mục</dt><dd>{selectedReview.category || 'Chưa có'}</dd></div>
                      <div><dt>Đối tượng</dt><dd>{selectedReview.targetName || 'Không rõ đối tượng'}</dd></div>
                      <div><dt>Điểm đánh giá</dt><dd>{selectedReview.rating || 0}/5</dd></div>
                      <div><dt>Hiển thị</dt><dd>{selectedReview.visibility || 'public'}</dd></div>
                      <div><dt>Moderation</dt><dd>{selectedReview.moderationStatus || 'pending'}</dd></div>
                      <div><dt>Partner gửi</dt><dd>{selectedReview.partnerName || 'Đối tác'}</dd></div>
                      <div><dt>Thời gian tạo</dt><dd>{selectedReview.createdAt ? formatDateTime(selectedReview.createdAt) : 'Chưa có'}</dd></div>
                    </dl>
                  </section>

                  <section className={styles.apiBlockPro}>
                    <div className={styles.apiHeaderPro}>
                      <span>Dữ liệu JSON</span>
                      <button
                        type="button"
                        onClick={() => navigator.clipboard?.writeText(JSON.stringify({
                          id: selectedReview.id,
                          category: selectedReview.category,
                          targetCode: selectedReview.targetCode,
                          targetName: selectedReview.targetName,
                          reviewerName: selectedReview.reviewerName,
                          rating: selectedReview.rating,
                          comment: selectedReview.comment,
                          visibility: selectedReview.visibility,
                          moderationStatus: selectedReview.moderationStatus,
                          sourceSystem: selectedReview.sourceSystem,
                          partnerName: selectedReview.partnerName,
                          createdAt: selectedReview.createdAt,
                          formattedCreatedAt: selectedReview.createdAt ? formatDateTime(selectedReview.createdAt) : null,
                        }, null, 2))}
                      >Sao chép</button>
                    </div>
                    <pre>{JSON.stringify({
                      id: selectedReview.id,
                      category: selectedReview.category,
                      targetCode: selectedReview.targetCode,
                      targetName: selectedReview.targetName,
                      reviewerName: selectedReview.reviewerName,
                      rating: selectedReview.rating,
                      comment: selectedReview.comment,
                      visibility: selectedReview.visibility,
                      moderationStatus: selectedReview.moderationStatus,
                      sourceSystem: selectedReview.sourceSystem,
                      partnerName: selectedReview.partnerName,
                      createdAt: selectedReview.createdAt,
                      formattedCreatedAt: selectedReview.createdAt ? formatDateTime(selectedReview.createdAt) : null,
                    }, null, 2)}</pre>
                  </section>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
