import { useEffect, useRef, useState } from 'react';
import api from '../../../services/api';
import styles from './AdminSyncReviewPage.module.css';

export default function AdminSyncReviewPage() {
  const [operators, setOperators] = useState([]);
  const [selectedCode, setSelectedCode] = useState('');
  const [partnerEmail, setPartnerEmail] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [log, setLog] = useState([]); // mảng dòng log
  const [result, setResult] = useState(null); // { ok, inserted, skipped, message }
  const logRef = useRef(null);

  // Load danh sách nhà xe
  useEffect(() => {
    api.get('/api/operators').then(res => {
      setOperators(res.data || []);
      if (res.data?.length) setSelectedCode(res.data[0].operatorCode);
    });
  }, []);

  // Auto-scroll log xuống cuối
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [log]);

  async function handleSync() {
    if (!selectedCode) return;
    setSyncing(true);
    setResult(null);
    setLog([]);

    const op = operators.find(o => o.operatorCode === selectedCode);
    const name = op ? op.operatorName : selectedCode;

    setLog(prev => [...prev,
      `[${now()}] Bắt đầu crawl Google Maps cho nhà xe: ${name} (${selectedCode})`,
      `[${now()}] Đang mở Chrome và tìm kiếm...`,
    ]);

    try {
      // Crawl + import có thể mất 3-5 phút → timeout dài
      let url = `/api/admin/sync-reviews?operatorCode=${encodeURIComponent(selectedCode)}`;
      if (partnerEmail.trim()) url += `&partnerEmail=${encodeURIComponent(partnerEmail.trim())}`;
      const res = await api.post(url, null, { timeout: 600000 });

      const data = res.data;
      const fixMsg = partnerEmail.trim()
        ? `[${now()}] ✓ Đã gán tài khoản ${partnerEmail.trim()} vào nhà xe.`
        : null;
      setLog(prev => [
        ...prev,
        `[${now()}] ✓ Crawl hoàn tất.`,
        `[${now()}] ✓ Import vào database xong.`,
        ...(fixMsg ? [fixMsg] : []),
        `[${now()}] Kết quả: ${data.inserted ?? 0} review mới, ${data.skipped ?? 0} bỏ qua, ${data.failed ?? 0} lỗi.`,
      ]);
      setResult({ ok: true, inserted: data.inserted ?? 0, skipped: data.skipped ?? 0, message: data.message });
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Lỗi không xác định.';
      setLog(prev => [...prev, `[${now()}] ✗ Lỗi: ${msg}`]);
      setResult({ ok: false, message: msg });
    } finally {
      setSyncing(false);
    }
  }

  function now() {
    return new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Lấy Review từ Google Maps</h1>
        <p className={styles.sub}>
          Chọn nhà xe, nhấn <strong>Lấy Review</strong> — hệ thống sẽ crawl Google Maps
          và đưa dữ liệu vào database. Đối tác nhà xe đó sẽ thấy review trong trang của họ.
        </p>
      </div>

      {/* Control panel */}
      <div className={styles.panel}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="emailInput">Email tài khoản partner <span className={styles.optional}>(tuỳ chọn — để gán partner vào nhà xe)</span></label>
          <input
            id="emailInput"
            type="email"
            className={styles.input}
            placeholder="vd: partner@email.com"
            value={partnerEmail}
            onChange={e => setPartnerEmail(e.target.value)}
            disabled={syncing}
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="opSelect">Nhà xe</label>
          <select
            id="opSelect"
            className={styles.select}
            value={selectedCode}
            onChange={e => setSelectedCode(e.target.value)}
            disabled={syncing}
          >
            <option value="">-- Chọn nhà xe --</option>
            {operators.map(op => (
              <option key={op.operatorCode} value={op.operatorCode}>
                {op.operatorCode} — {op.operatorName}
              </option>
            ))}
          </select>
        </div>

        <button
          className={styles.btn}
          onClick={handleSync}
          disabled={syncing || !selectedCode}
        >
          {syncing
            ? <><span className={styles.spinner} /> Đang crawl...</>
            : '⬇ Lấy Review'}
        </button>
      </div>

      {/* Result badge */}
      {result && (
        <div className={result.ok ? styles.resultOk : styles.resultErr}>
          {result.ok
            ? `✓ ${result.message}`
            : `✗ ${result.message}`}
        </div>
      )}

      {/* Log console */}
      {log.length > 0 && (
        <div className={styles.logWrap}>
          <div className={styles.logHeader}>
            <span>📋 Log tiến trình</span>
            {syncing && <span className={styles.liveTag}>● LIVE</span>}
          </div>
          <div className={styles.logBody} ref={logRef}>
            {log.map((line, i) => (
              <div key={i} className={line.includes('✗') ? styles.logErr : line.includes('✓') ? styles.logOk : styles.logLine}>
                {line}
              </div>
            ))}
            {syncing && <div className={styles.logWaiting}>⏳ Selenium đang crawl, vui lòng chờ...</div>}
          </div>
        </div>
      )}

      {/* Info box */}
      <div className={styles.infoBox}>
        <strong>Lưu ý:</strong>
        <ul>
          <li>Quá trình crawl mất khoảng <strong>2–5 phút</strong> (Selenium mở Chrome thật).</li>
          <li>Review mới sẽ ở trạng thái <strong>Chờ duyệt</strong> — cần kiểm duyệt trước khi public.</li>
          <li>Đối tác của nhà xe sẽ thấy review trong trang <em>Lay Review</em> của họ ngay sau khi crawl xong.</li>
        </ul>
      </div>
    </div>
  );
}
