import { useState } from "react";
import styles from "./FloatingAIChat.module.css";

export default function FloatingAIChat() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([
    {
      role: "ai",
      text: "Xin chào! Tôi là AI tư vấn của ReviewHub. Bạn cần tư vấn gói, API, thanh toán hay AI moderation?",
    },
  ]);
  const [loading, setLoading] = useState(false);

  async function sendMessage() {
    const text = message.trim();
    if (!text || loading) return;

    setMessages((prev) => [...prev, { role: "user", text }]);
    setMessage("");
    setLoading(true);

    try {
      const res = await fetch("http://localhost:8080/api/ai/advisor", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message: text }),
      });

      const raw = await res.text();

      if (!res.ok) {
        throw new Error(raw || "Backend lỗi");
      }

      let aiText = raw;

      try {
        const data = JSON.parse(raw);
        aiText = data?.output?.[0]?.content?.[0]?.text || raw;
      } catch {
        aiText = raw;
      }

      setMessages((prev) => [...prev, { role: "ai", text: aiText }]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "ai",
          text: "Hiện AI chưa kết nối được. Bạn kiểm tra backend có đang chạy ở port 8080 không nhé.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  return (
    <>
      {!open && (
        <button className={styles.floatingButton} onClick={() => setOpen(true)}>
          <span className={styles.botIcon}>AI</span>
          <span className={styles.pulse}></span>
        </button>
      )}

      {open && (
        <div className={styles.chatPanel}>
          <div className={styles.chatHeader}>
            <div className={styles.headerLeft}>
              <div className={styles.avatar}>AI</div>
              <div>
                <h3>BLU Review AI</h3>
                <p>Online · Tư vấn gói, API, thanh toán</p>
              </div>
            </div>

            <button className={styles.closeBtn} onClick={() => setOpen(false)}>
              ×
            </button>
          </div>

          <div className={styles.chatBody}>
            {messages.map((m, index) => (
              <div
                key={index}
                className={`${styles.messageRow} ${
                  m.role === "user" ? styles.userRow : styles.aiRow
                }`}
              >
                {m.role === "ai" && <div className={styles.smallAvatar}>AI</div>}

                <div
                  className={`${styles.bubble} ${
                    m.role === "user" ? styles.userBubble : styles.aiBubble
                  }`}
                >
                  {m.text}
                </div>
              </div>
            ))}

            {loading && (
              <div className={`${styles.messageRow} ${styles.aiRow}`}>
                <div className={styles.smallAvatar}>AI</div>
                <div className={`${styles.bubble} ${styles.aiBubble}`}>
                  Đang trả lời...
                </div>
              </div>
            )}
          </div>

          <div className={styles.quickReplies}>
            <button onClick={() => setMessage("Tôi cần AI moderation cho app review")}>
              AI moderation
            </button>
            <button onClick={() => setMessage("So sánh ưu nhược điểm các gói")}>
              So sánh gói
            </button>
            <button onClick={() => setMessage("Tôi thanh toán rồi nhưng chưa thấy gói")}>
              Lỗi thanh toán
            </button>
          </div>

          <div className={styles.inputArea}>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Nhập tin nhắn..."
              rows={1}
            />

            <button onClick={sendMessage} disabled={loading || !message.trim()}>
              Gửi
            </button>
          </div>
        </div>
      )}
    </>
  );
}