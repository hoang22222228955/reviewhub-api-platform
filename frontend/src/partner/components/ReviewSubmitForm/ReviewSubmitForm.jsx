import { useMemo, useState } from "react";
import { postReview } from "../../../services/reviewService";
import api from "../../../services/api";
import styles from "./ReviewSubmitForm.module.css";

const categories = [
  "Nhà xe",
  "Khách sạn",
  "Máy bay",
  "Tàu hỏa",
  "Tour",
  "Dịch vụ khác",
];

const CATEGORY_TO_SERVICE_SLUG = {
  "Nhà xe": "nha-xe",
  "Khách sạn": "khach-san",
  "Máy bay": "may-bay",
  "Tàu hỏa": "tau-hoa",
  "Tour": "tour",
  "Dịch vụ khác": "dich-vu-khac",
};

const CATEGORY_TO_IMAGE_FOLDER = {
  "Nhà xe": "nhaxe",
  "Khách sạn": "khachsan",
  "Máy bay": "maybay",
  "Tàu hỏa": "tauhoa",
  "Tour": "tour",
  "Dịch vụ khác": "dichvukhac",
};

const PUBLIC_REVIEW_STORAGE_KEY = "reviewhub-public-service-reviews";

const OPERATOR_NAME_BY_CODE = {
  "PT-001": "VeXeNhanh",
  "PT-002": "FUTA",
  "PT-003": "An Vui",
  "PT-004": "Thành Bưởi",
  "PT-005": "Phương Trang",
  "PT-006": "Kumho Samco",
  "PT-007": "Mai Linh Express",
  "PT-008": "Hoàng Long",
  "PT-009": "Hải Vân",
  "PT-010": "G8 Sapa Open Tour",
  "PT-011": "Sao Việt",
  "PT-012": "Inter Bus Lines",
  "PT-013": "Sao Việt",
};

function getDefaultTargetNameByCode(code, fallbackName = "") {
  const normalizedCode = normalizeCode(code);
  return OPERATOR_NAME_BY_CODE[normalizedCode] || fallbackName || "";
}

function normalizeCode(value) {
  return String(value || "").trim().toUpperCase();
}

function makeFallbackReviewId(operatorCode) {
  const safeCode = normalizeCode(operatorCode) || "PT-000";
  const randomPart =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()
      : Math.random().toString(16).slice(2, 10).toUpperCase();

  return `${safeCode}-${randomPart}`;
}

function parseReviewId(reviewId, fallbackOperatorCode = "") {
  const value = String(reviewId || "").trim();
  const match = value.match(/^([A-Z]{2}-\d{3})-(.+)$/i);

  if (match) {
    return {
      operatorCode: match[1].toUpperCase(),
      imageCode: match[2],
      imageFileName: `${match[2]}.webp`,
    };
  }

  const operatorCode = normalizeCode(fallbackOperatorCode);
  const imageCode = value || Math.random().toString(16).slice(2, 10).toUpperCase();

  return {
    operatorCode,
    imageCode,
    imageFileName: `${imageCode}.webp`,
  };
}

function fileToImage(file) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Không đọc được ảnh."));
    };

    image.src = objectUrl;
  });
}

async function convertToWebpFile(file, outputName) {
  try {
    const image = await fileToImage(file);

    const maxSize = 1200;
    const ratio = Math.min(1, maxSize / Math.max(image.width, image.height));
    const width = Math.max(1, Math.round(image.width * ratio));
    const height = Math.max(1, Math.round(image.height * ratio));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    ctx.drawImage(image, 0, 0, width, height);

    const blob = await new Promise((resolve) => {
      canvas.toBlob(resolve, "image/webp", 0.82);
    });

    if (!blob) {
      return new File([file], outputName, {
        type: file.type || "application/octet-stream",
      });
    }

    return new File([blob], outputName, {
      type: "image/webp",
      lastModified: Date.now(),
    });
  } catch {
    return new File([file], outputName, {
      type: file.type || "application/octet-stream",
    });
  }
}

function readStoredReviews(key) {
  if (typeof window === "undefined") return [];

  try {
    const value = JSON.parse(window.localStorage.getItem(key) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function writeStoredReviews(key, reviews) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(reviews));
}

function upsertReviewToLocalHub(review) {
  if (typeof window === "undefined" || !review) return;

  const serviceSlug = review.serviceSlug || CATEGORY_TO_SERVICE_SLUG[review.category] || "nha-xe";

  const keys = [
    PUBLIC_REVIEW_STORAGE_KEY,
    `${PUBLIC_REVIEW_STORAGE_KEY}:${serviceSlug}`,
  ];

  keys.forEach((key) => {
    const current = readStoredReviews(key);
    const stableId = String(review.id || "");
    const next = current.filter((item) => String(item.id || item.reviewId || "") !== stableId);

    next.unshift(review);

    writeStoredReviews(key, next);
  });

  window.dispatchEvent(
    new CustomEvent("reviewhub:public-review-created", {
      detail: review,
    })
  );

  window.dispatchEvent(new Event("storage"));
}

async function uploadReviewImage({ createdReview, selectedImage, category, fallbackOperatorCode }) {
  if (!selectedImage || !createdReview?.id) return null;

  const { operatorCode, imageFileName } = parseReviewId(createdReview.id, fallbackOperatorCode);
  const categoryFolder = CATEGORY_TO_IMAGE_FOLDER[category] || "nhaxe";

  if (!operatorCode || !imageFileName) {
    throw new Error("Không tách được mã review để đặt tên ảnh.");
  }

  const webpFile = await convertToWebpFile(selectedImage, imageFileName);

  const formData = new FormData();
  formData.append("file", webpFile, imageFileName);
  formData.append("reviewId", createdReview.id);
  formData.append("operatorCode", operatorCode);
  formData.append("categoryFolder", categoryFolder);
  formData.append("imageFileName", imageFileName);
  formData.append("publicPath", `/anhdanggia/${categoryFolder}/${operatorCode}/${imageFileName}`);

  const uploadCandidates = [
    `/api/reviews/${encodeURIComponent(createdReview.id)}/image`,
    `/api/partner/reviews/${encodeURIComponent(createdReview.id)}/image`,
    `/api/review-images/upload`,
  ];

  let lastError = null;

  for (const url of uploadCandidates) {
    try {
      const response = await api.post(url, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
        timeout: 120000,
      });

      return {
        ...response.data,
        imageUrl:
          response.data?.imageUrl ||
          `/anhdanggia/${categoryFolder}/${operatorCode}/${imageFileName}`,
        imageFileName,
        operatorCode,
        categoryFolder,
        uploadOk: true,
      };
    } catch (error) {
      lastError = error;

      // Nếu không phải 404 thì có thể là lỗi thật như file quá lớn/server lỗi.
      // Vẫn thử endpoint tiếp theo để tránh sai route.
      continue;
    }
  }

  const status = lastError?.response?.status;
  const message =
    status === 404
      ? "Backend chưa có API upload ảnh hoặc chưa restart backend sau khi thêm controller."
      : lastError?.response?.data?.message ||
        lastError?.response?.data?.detail ||
        lastError?.message ||
        "Upload ảnh lỗi.";

  const error = new Error(message);
  error.cause = lastError;
  error.uploadMeta = {
    imageUrl: `/anhdanggia/${categoryFolder}/${operatorCode}/${imageFileName}`,
    imageFileName,
    operatorCode,
    categoryFolder,
  };

  throw error;
}

export default function ReviewSubmitForm({
  partnerName = "Đối tác",
  operatorCode = "",
  targetCode = "",
  targetName = "",
  serviceSlug = "nha-xe",
  onSubmitSuccess,
}) {
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState("");

  const defaultCode = normalizeCode(targetCode || operatorCode || "PT-013");
  const defaultName = getDefaultTargetNameByCode(defaultCode, targetName || partnerName || "");

  const [form, setForm] = useState({
    category: "Nhà xe",
    targetCode: defaultCode,
    targetName: defaultName,
    reviewerName: "Nguyễn Văn A",
    rating: 5,
    comment: "Xe sạch, tài xế lịch sự và khởi hành đúng giờ.",
    visibility: "public",
  });

  const normalizedTargetCode = normalizeCode(form.targetCode || targetCode || operatorCode);
  const normalizedServiceSlug = CATEGORY_TO_SERVICE_SLUG[form.category] || serviceSlug || "nha-xe";

  const payload = useMemo(() => {
    const safeCode = normalizedTargetCode || "PT-000";
    const safeName = form.targetName || targetName || partnerName || "Không rõ đối tượng";

    return {
      ...form,

      id: undefined,

      category: form.category,
      serviceSlug: normalizedServiceSlug,
      service_slug: normalizedServiceSlug,

      targetCode: safeCode,
      target_code: safeCode,
      operatorCode: safeCode,
      operator_code: safeCode,
      partnerCode: safeCode,
      partner_code: safeCode,
      ownerPartnerCode: safeCode,
      owner_partner_code: safeCode,
      code: safeCode,

      targetName: safeName,
      target_name: safeName,
      operatorName: safeName,
      operator_name: safeName,
      partnerName: safeName,
      partner_name: safeName,
      name: safeName,

      reviewerName: form.reviewerName,
      userName: form.reviewerName,
      authorName: form.reviewerName,
      customerName: form.reviewerName,

      rating: Number(form.rating || 0),
      score: Number(form.rating || 0),
      stars: Number(form.rating || 0),

      comment: form.comment,
      content: form.comment,
      reviewText: form.comment,
      text: form.comment,

      sourceSystem: "partner-web",
      source: "partner-web",
      visibility: form.visibility || "public",
      moderationStatus: "pending_review",
      status: "pending_review",
      reviewStatus: "pending_review",

      partnerName,
      createdAt: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };
  }, [form, normalizedTargetCode, normalizedServiceSlug, targetName, partnerName]);

  function handleChange(field, value) {
    setForm((prev) => {
      const next = {
        ...prev,
        [field]: value,
      };

      if (field === "targetCode") {
        const normalizedCode = normalizeCode(value);
        const mappedName = getDefaultTargetNameByCode(normalizedCode);

        const previousMappedName = getDefaultTargetNameByCode(prev.targetCode);
        const shouldAutoFillName =
          mappedName &&
          (
            !prev.targetName ||
            prev.targetName === previousMappedName ||
            prev.targetName === "FUTA Limousine Premium" ||
            prev.targetName === partnerName ||
            prev.targetName === targetName
          );

        if (shouldAutoFillName) {
          next.targetName = mappedName;
        }
      }

      return next;
    });
  }

  function handleImageChange(event) {
    const file = event.target.files?.[0];

    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl);
    }

    if (!file) {
      setSelectedImage(null);
      setImagePreviewUrl("");
      return;
    }

    if (!file.type.startsWith("image/")) {
      setMessage("File được chọn không phải ảnh.");
      event.target.value = "";
      setSelectedImage(null);
      setImagePreviewUrl("");
      return;
    }

    const maxSizeMb = 8;
    if (file.size > maxSizeMb * 1024 * 1024) {
      setMessage(`Ảnh không được vượt quá ${maxSizeMb}MB.`);
      event.target.value = "";
      setSelectedImage(null);
      setImagePreviewUrl("");
      return;
    }

    setMessage("");
    setSelectedImage(file);
    setImagePreviewUrl(URL.createObjectURL(file));
  }

  function handleRemoveImage() {
    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl);
    }

    setSelectedImage(null);
    setImagePreviewUrl("");
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (submitting) return;

    setSubmitting(true);
    setMessage("");

    try {
      let created = await postReview(payload);

      if (!created || typeof created !== "object") {
        created = {};
      }

      const finalId = created.id || created.reviewId || makeFallbackReviewId(payload.targetCode);

      created = {
        ...payload,
        ...created,
        id: finalId,
        reviewId: finalId,

        targetCode: created.targetCode || created.target_code || payload.targetCode,
        target_code: created.target_code || created.targetCode || payload.targetCode,
        operatorCode: created.operatorCode || created.operator_code || payload.operatorCode,
        operator_code: created.operator_code || created.operatorCode || payload.operatorCode,
        partnerCode: created.partnerCode || created.partner_code || payload.partnerCode,
        partner_code: created.partner_code || created.partnerCode || payload.partnerCode,
        ownerPartnerCode: created.ownerPartnerCode || created.owner_partner_code || payload.ownerPartnerCode,
        owner_partner_code: created.owner_partner_code || created.ownerPartnerCode || payload.ownerPartnerCode,

        targetName: created.targetName || created.target_name || payload.targetName,
        target_name: created.target_name || created.targetName || payload.targetName,
        operatorName: created.operatorName || created.operator_name || payload.operatorName,
        operator_name: created.operator_name || created.operatorName || payload.operatorName,
        partnerName: created.partnerName || created.partner_name || payload.partnerName,
        partner_name: created.partner_name || created.partnerName || payload.partnerName,

        sourceSystem: created.sourceSystem || created.source || "partner-web",
        source: created.source || created.sourceSystem || "partner-web",
        serviceSlug: created.serviceSlug || created.service_slug || normalizedServiceSlug,
        service_slug: created.service_slug || created.serviceSlug || normalizedServiceSlug,
        visibility: created.visibility || payload.visibility || "public",
        moderationStatus: created.moderationStatus || created.status || "pending_review",
        status: created.status || created.moderationStatus || "pending_review",
        createdAt: created.createdAt || created.created_at || payload.createdAt,
        created_at: created.created_at || created.createdAt || payload.createdAt,
      };

      let uploadedImage = null;
      let imageUploadWarning = "";

      if (selectedImage) {
        try {
          uploadedImage = await uploadReviewImage({
            createdReview: created,
            selectedImage,
            category: form.category,
            fallbackOperatorCode: created.targetCode,
          });
        } catch (uploadError) {
          // Không cho upload ảnh làm hỏng việc gửi review.
          // Review vẫn phải hiện bên trang lấy review, ảnh preview vẫn giữ tạm ở local.
          imageUploadWarning =
            uploadError?.message ||
            "Review đã gửi nhưng upload ảnh chưa thành công.";

          uploadedImage = {
            ...(uploadError?.uploadMeta || {}),
            imageUrl: "",
            uploadOk: false,
          };
        }
      }

      const finalReview = {
        ...created,
        imageUrl: uploadedImage?.uploadOk ? uploadedImage?.imageUrl : created.imageUrl || "",
        reviewImage: uploadedImage?.uploadOk ? uploadedImage?.imageUrl : created.reviewImage || "",
        imageFileName: uploadedImage?.imageFileName || "",
        hasImage: Boolean(uploadedImage?.uploadOk && uploadedImage?.imageUrl),
        localImagePreviewUrl: imagePreviewUrl || "",
      };

      upsertReviewToLocalHub(finalReview);

      setMessage(
        selectedImage
          ? imageUploadWarning
            ? `Đã gửi review ${finalReview.id || ""} vào hub thành công, nhưng ảnh chưa lưu được: ${imageUploadWarning}`
            : `Đã gửi review ${finalReview.id || ""} vào hub thành công. Ảnh đã lưu tên ${finalReview.imageFileName || ""}.`
          : `Đã gửi review ${finalReview.id || ""} vào hub thành công.`
      );

      onSubmitSuccess?.(finalReview);

      setSelectedImage(null);
      setImagePreviewUrl("");
    } catch (error) {
      const detail =
        error?.response?.data?.message ||
        error?.response?.data?.detail ||
        error?.message ||
        "";

      setMessage(
        detail
          ? `Gửi review thất bại hoặc upload ảnh lỗi: ${detail}`
          : "Gửi review thất bại."
      );
    } finally {
      setSubmitting(false);
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

              <p>Danh mục, mã nhà xe và trạng thái hiển thị.</p>
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

          <label className={styles.field}>
            <span>Mã đối tượng / nhà xe</span>

            <input
              value={form.targetCode}
              onChange={(e) =>
                handleChange("targetCode", e.target.value.toUpperCase())
              }
              placeholder="PT-013"
            />

            {getDefaultTargetNameByCode(form.targetCode) && (
              <small className={styles.fieldHint}>
                Tên đối tượng tự động: {getDefaultTargetNameByCode(form.targetCode)}
              </small>
            )}
          </label>
        </div>

        <div className={styles.section}>
          <div className={styles.sectionTitle}>
            <span>02</span>

            <div>
              <h3>Thông tin review</h3>

              <p>Thông tin đánh giá từ khách hàng.</p>
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

        <div className={styles.section}>
          <div className={styles.sectionTitle}>
            <span>03</span>

            <div>
              <h3>Ảnh đánh giá</h3>

              <p>Chọn 1 ảnh. Sau khi gửi, ảnh sẽ được lưu theo mã review.</p>
            </div>
          </div>

          <label className={styles.uploadBox}>
            <input
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp"
              onChange={handleImageChange}
            />

            {imagePreviewUrl ? (
              <div className={styles.uploadPreview}>
                <img src={imagePreviewUrl} alt="Ảnh review đã chọn" />

                <div>
                  <strong>{selectedImage?.name}</strong>
                  <span>
                    Ví dụ review PT-013-1F9021D0 thì ảnh sẽ lưu là
                    {" "}1F9021D0.webp trong folder PT-013.
                  </span>
                </div>
              </div>
            ) : (
              <div className={styles.uploadEmpty}>
                <span>+</span>
                <div>
                  <strong>Chọn ảnh đánh giá</strong>
                  <small>JPG, PNG, WEBP · tối đa 8MB · tự convert sang .webp</small>
                </div>
              </div>
            )}
          </label>

          {imagePreviewUrl && (
            <button
              type="button"
              className={styles.removeImageBtn}
              onClick={handleRemoveImage}
            >
              Xóa ảnh đã chọn
            </button>
          )}
        </div>

        <div className={styles.footer}>
          <button type="submit" className={styles.primaryBtn} disabled={submitting}>
            {submitting ? "Đang gửi..." : "Gửi review"}
          </button>

          <button
            type="button"
            className={styles.secondaryBtn}
            onClick={() => console.log(payload)}
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
