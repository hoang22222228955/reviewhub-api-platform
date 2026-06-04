import { useMemo, useState } from "react";
import { postReview } from "../../../services/reviewService";
import styles from "./ReviewSubmitForm.module.css";

const categories = [
  "Nhà xe",
  "Khách sạn",
  "Máy bay",
  "Tàu hỏa",
];

export default function ReviewSubmitForm({
  partnerName = "Đối tác",
  onSubmitSuccess,
}) {
  const [message, setMessage] = useState("");

  const [form, setForm] = useState({
    category: "Nhà xe",
    targetName: "FUTA Limousine Premium",
    reviewerName: "Nguyễn Văn A",
    rating: 5,
    comment: "Xe sạch, tài xế lịch sự và khởi hành đúng giờ.",
    visibility: "public",
  });

  const payload = useMemo(
    () => ({
      ...form,
      partnerName,
    }),
    [form, partnerName]
  );

  function handleChange(field, value) {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();

    try {
      const created = await postReview(payload);

      setMessage(
        `Đã gửi review ${created.id || ""} vào hub thành công.`
      );

      onSubmitSuccess?.(created);
    } catch (error) {
      setMessage("Gửi review thất bại.");
    }
  }

  return (
    <section className={styles.surface}>
      <header className={styles.header}>
        <div>
          <p className={styles.kicker}>Partner review</p>

          <h2>Gửi review mới</h2>

          <p className={styles.description}>
            Biểu mẫu tối giản theo phong cách enterprise SaaS.
          </p>
        </div>
      </header>

      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.section}>
          <div className={styles.sectionTitle}>
            <span>01</span>

            <div>
              <h3>Thông tin phân loại</h3>

              <p>Danh mục và nguồn dữ liệu.</p>
            </div>
          </div>

          <div className={styles.grid2}>
            <label className={styles.field}>
              <span>Danh mục</span>

              <select
                value={form.category}
                onChange={(e) =>
                  handleChange("category", e.target.value)
                }
              >
                {categories.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>

            <label className={styles.field}>
              <span>Visibility</span>

              <select
                value={form.visibility}
                onChange={(e) =>
                  handleChange("visibility", e.target.value)
                }
              >
                <option value="public">Public</option>
                <option value="private">Private</option>
              </select>
            </label>
          </div>
        </div>

        <div className={styles.section}>
          <div className={styles.sectionTitle}>
            <span>02</span>

            <div>
              <h3>Thông tin review</h3>

              <p>Thông tin đánh giá từ partner.</p>
            </div>
          </div>

          <div className={styles.grid2}>
            <label className={styles.field}>
              <span>Tên đối tượng</span>

              <input
                value={form.targetName}
                onChange={(e) =>
                  handleChange("targetName", e.target.value)
                }
                placeholder="FUTA Limousine Premium"
              />
            </label>

            <label className={styles.field}>
              <span>Người review</span>

              <input
                value={form.reviewerName}
                onChange={(e) =>
                  handleChange("reviewerName", e.target.value)
                }
                placeholder="Nguyễn Văn A"
              />
            </label>
          </div>

          <div className={styles.grid2}>
            <label className={styles.field}>
              <span>Rating</span>

              <select
                value={form.rating}
                onChange={(e) =>
                  handleChange("rating", e.target.value)
                }
              >
                {[5, 4, 3, 2, 1].map((value) => (
                  <option key={value} value={value}>
                    {value} sao
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className={styles.field}>
            <span>Nội dung review</span>

            <textarea
              rows={5}
              value={form.comment}
              onChange={(e) =>
                handleChange("comment", e.target.value)
              }
              placeholder="Nhập nội dung review..."
            />
          </label>
        </div>

        <div className={styles.footer}>
          <button type="submit" className={styles.primaryBtn}>
            Gửi review
          </button>

          <button
            type="button"
            className={styles.secondaryBtn}
          >
            Xem JSON
          </button>
        </div>

        {message && (
          <div className={styles.notice}>{message}</div>
        )}
      </form>
    </section>
  );
}