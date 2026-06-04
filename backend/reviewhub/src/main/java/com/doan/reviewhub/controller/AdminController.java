package com.doan.reviewhub.controller;

import com.doan.reviewhub.dto.UserDto;
import com.doan.reviewhub.entity.BankConfig;
import com.doan.reviewhub.entity.Review;
import com.doan.reviewhub.entity.User;
import com.doan.reviewhub.repository.BankConfigRepository;
import com.doan.reviewhub.repository.ReviewRepository;
import com.doan.reviewhub.repository.TransportOperatorRepository;
import com.doan.reviewhub.repository.UserRepository;
import com.doan.reviewhub.service.ReviewSyncService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
public class AdminController {

    private final UserRepository userRepository;
    private final TransportOperatorRepository operatorRepository;
    private final BankConfigRepository bankConfigRepository;
    private final ReviewRepository reviewRepository;
    private final ReviewSyncService reviewSyncService;

    /** Chỉ admin mới được gọi. Kiểm tra role tại đây. */
    private ResponseEntity<?> forbidNonAdmin(Authentication auth) {
        User caller = (User) auth.getPrincipal();
        if (!"admin".equals(caller.getRole())) {
            return ResponseEntity.status(403).body(Map.of("error", "Chỉ admin mới được thực hiện thao tác này."));
        }
        return null;
    }

    /**
     * Lấy danh sách tất cả partners (role = "partner").
     * GET /api/admin/partners
     */
    @GetMapping("/partners")
    public ResponseEntity<?> listPartners(Authentication auth) {
        ResponseEntity<?> denied = forbidNonAdmin(auth);
        if (denied != null) return denied;

        List<UserDto> partners = userRepository.findAll().stream()
                .filter(u -> "partner".equals(u.getRole()))
                .map(UserDto::from)
                .toList();
        return ResponseEntity.ok(partners);
    }

    /**
     * Gán nhà xe cho partner.
     * PUT /api/admin/users/{userId}/operator
     * Body: { "operatorCode": "PT-004" }
     */
    @PutMapping("/users/{userId}/operator")
    public ResponseEntity<?> assignOperator(
            @PathVariable String userId,
            @RequestBody Map<String, String> body,
            Authentication auth) {

        ResponseEntity<?> denied = forbidNonAdmin(auth);
        if (denied != null) return denied;

        String operatorCode = body.get("operatorCode");

        // Validate partner exists
        User partner = userRepository.findById(userId).orElse(null);
        if (partner == null) {
            return ResponseEntity.status(404).body(Map.of("error", "Không tìm thấy user."));
        }

        // Validate operator exists (or allow null to unassign)
        if (operatorCode != null && !operatorCode.isBlank()) {
            boolean exists = operatorRepository.findByOperatorCode(operatorCode).isPresent();
            if (!exists) {
                return ResponseEntity.status(400).body(Map.of("error", "Mã nhà xe không tồn tại: " + operatorCode));
            }
            partner.setAssignedOperatorCode(operatorCode);
        } else {
            // null / empty → bỏ gán
            partner.setAssignedOperatorCode(null);
        }

        userRepository.save(partner);
        return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "Đã cập nhật nhà xe cho partner.",
                "user", UserDto.from(partner)
        ));
    }

    /**
     * Lấy thông tin ngân hàng admin (mọi user đã đăng nhập đều đọc được).
     * GET /api/admin/bank-config
     */
    @GetMapping("/bank-config")
    public ResponseEntity<?> getBankConfig() {
        BankConfig cfg = bankConfigRepository.findById(1L).orElse(
                BankConfig.builder()
                        .id(1L)
                        .bankId("MB")
                        .accountNo("0859693664")
                        .accountName("PHAM QUOC NHAT")
                        .bankName("MB Bank")
                        .build()
        );
        return ResponseEntity.ok(Map.of(
                "bankId",      cfg.getBankId(),
                "accountNo",   cfg.getAccountNo(),
                "accountName", cfg.getAccountName(),
                "bankName",    cfg.getBankName()
        ));
    }

    /**
     * Admin cập nhật thông tin ngân hàng.
     * PUT /api/admin/bank-config
     * Body: { bankId, accountNo, accountName, bankName }
     */
    @PutMapping("/bank-config")
    public ResponseEntity<?> updateBankConfig(
            @RequestBody Map<String, String> body,
            Authentication auth) {

        ResponseEntity<?> denied = forbidNonAdmin(auth);
        if (denied != null) return denied;

        String bankId      = body.get("bankId");
        String accountNo   = body.get("accountNo");
        String accountName = body.get("accountName");
        String bankName    = body.get("bankName");

        if (bankId == null || accountNo == null || accountName == null || bankName == null
                || bankId.isBlank() || accountNo.isBlank() || accountName.isBlank() || bankName.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Vui lòng nhập đầy đủ thông tin ngân hàng."));
        }

        BankConfig cfg = bankConfigRepository.findById(1L).orElse(
                BankConfig.builder().id(1L).build()
        );
        cfg.setBankId(bankId.trim());
        cfg.setAccountNo(accountNo.trim());
        cfg.setAccountName(accountName.trim().toUpperCase());
        cfg.setBankName(bankName.trim());
        bankConfigRepository.save(cfg);

        return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "Đã cập nhật thông tin ngân hàng."
        ));
    }

    // ──────────────────────────────────────────────────────────────────────────
    //  AI Moderation endpoints
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * Lấy danh sách review đang chờ AI moderation (pending_review).
     * GET /api/admin/reviews/pending
     */
    @GetMapping("/reviews/pending")
    public ResponseEntity<?> listPendingReviews(Authentication auth) {
        ResponseEntity<?> check = forbidNonAdmin(auth);
        if (check != null) return check;

        List<Map<String, Object>> result = reviewRepository
                .findByModerationStatus("pending_review")
                .stream()
                .map(r -> {
                    double confidence = 0.0;
                    String aiReason = "";
                    if (r.getRawPayload() != null) {
                        Object c = r.getRawPayload().get("ai_confidence");
                        Object reason = r.getRawPayload().get("ai_reason");
                        if (c instanceof Number n) confidence = n.doubleValue();
                        if (reason != null) aiReason = reason.toString();
                    }
                    return Map.<String, Object>of(
                            "id", r.getId(),
                            "targetName", r.getTargetName(),
                            "targetCode", r.getTargetCode(),
                            "reviewerName", r.getReviewerName() != null ? r.getReviewerName() : "Ẩn danh",
                            "rating", r.getRating(),
                            "comment", r.getComment(),
                            "partnerCode", r.getOwnerPartnerCode() != null ? r.getOwnerPartnerCode() : "",
                            "createdAt", r.getCreatedAt().toString(),
                            "aiConfidence", confidence,
                            "aiReason", aiReason
                    );
                })
                .toList();

        return ResponseEntity.ok(result);
    }

    /**
     * Admin duyệt review (pending → approved).
     * POST /api/admin/reviews/{id}/approve
     */
    @PostMapping("/reviews/{id}/approve")
    public ResponseEntity<?> approveReview(@PathVariable String id, Authentication auth) {
        ResponseEntity<?> check = forbidNonAdmin(auth);
        if (check != null) return check;

        Review review = reviewRepository.findById(id).orElse(null);
        if (review == null) return ResponseEntity.status(404).body(Map.of("error", "Không tìm thấy review."));

        review.setModerationStatus("approved");
        reviewRepository.save(review);
        return ResponseEntity.ok(Map.of("success", true, "message", "Review đã được duyệt."));
    }

    /**
     * Admin từ chối review (pending → rejected).
     * POST /api/admin/reviews/{id}/reject
     */
    @PostMapping("/reviews/{id}/reject")
    public ResponseEntity<?> rejectReview(@PathVariable String id, Authentication auth) {
        ResponseEntity<?> check = forbidNonAdmin(auth);
        if (check != null) return check;

        Review review = reviewRepository.findById(id).orElse(null);
        if (review == null) return ResponseEntity.status(404).body(Map.of("error", "Không tìm thấy review."));

        review.setModerationStatus("rejected");
        reviewRepository.save(review);
        return ResponseEntity.ok(Map.of("success", true, "message", "Review đã bị từ chối."));
    }

    /**
     * Admin kích hoạt crawl Google Maps cho một nhà xe cụ thể.
     * POST /api/admin/sync-reviews?operatorCode=PT-040
     */
    @PostMapping("/sync-reviews")
    public ResponseEntity<?> adminSyncReviews(
            @RequestParam String operatorCode,
            @RequestParam(required = false) String partnerEmail,
            Authentication auth) {

        ResponseEntity<?> check = forbidNonAdmin(auth);
        if (check != null) return check;

        if (operatorCode == null || operatorCode.isBlank()) {
            return ResponseEntity.badRequest().body(
                    Map.of("success", false, "message", "Vui lòng chọn nhà xe cần lấy review.")
            );
        }

        ReviewSyncService.SyncResult result = reviewSyncService.syncReviewsForOperator(operatorCode, "admin", partnerEmail);

        if (!result.success()) {
            return ResponseEntity.internalServerError().body(
                    Map.of("success", false, "message", result.message())
            );
        }

        return ResponseEntity.ok(Map.of(
                "success", true,
                "inserted", result.inserted(),
                "skipped", result.skipped(),
                "failed", result.failed(),
                "message", result.message()
        ));
    }
}
