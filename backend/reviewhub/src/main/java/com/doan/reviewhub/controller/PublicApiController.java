package com.doan.reviewhub.controller;

import com.doan.reviewhub.dto.ReviewDto;
import com.doan.reviewhub.entity.ApiUsageLog;
import com.doan.reviewhub.entity.User;
import com.doan.reviewhub.repository.ApiUsageLogRepository;
import com.doan.reviewhub.repository.ReviewRepository;
import com.doan.reviewhub.repository.UserRepository;
import com.doan.reviewhub.service.ReviewService;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.List;
import java.util.Map;

/**
 * Endpoint công khai – xác thực bằng X-Api-Key header thay vì JWT.
 * Mỗi lần gọi thành công sẽ trừ 1 quota của partner.
 *
 * Ví dụ:
 *   GET /api/v1/reviews?page=0&size=10&category=all&visibility=all&keyword=
 *   Header: X-Api-Key: rh_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
 */
@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
public class PublicApiController {

    private final UserRepository        userRepository;
    private final ReviewRepository      reviewRepository;
    private final ReviewService         reviewService;
    private final ApiUsageLogRepository apiUsageLogRepository;

    /* ─────────────────────────────────────────── helpers */

    private ResponseEntity<?> resolvePartner(String rawKey) {
        if (rawKey == null || rawKey.isBlank()) {
            return ResponseEntity.status(401).body(Map.of("error", "Thiếu X-Api-Key header."));
        }
        User partner = userRepository.findByApiKey(rawKey.trim()).orElse(null);
        if (partner == null) {
            return ResponseEntity.status(401).body(Map.of("error", "X-Api-Key không hợp lệ."));
        }
        if (!"partner".equals(partner.getRole()) && !"admin".equals(partner.getRole())) {
            return ResponseEntity.status(403).body(Map.of("error", "Tài khoản không phải partner."));
        }
        if (!"Đang hoạt động".equals(partner.getStatus())) {
            return ResponseEntity.status(403).body(Map.of("error", "Tài khoản đang bị khoá."));
        }
        return ResponseEntity.ok(partner); // trả partner object để caller dùng
    }

    /* ─────────────────────────────────────────── GET /api/v1/reviews */

    @GetMapping("/reviews")
    @Transactional
    public ResponseEntity<?> getReviews(
            @RequestHeader(value = "X-Api-Key", required = false) String apiKey,
            @RequestParam(defaultValue = "")    String keyword,
            @RequestParam(defaultValue = "all") String category,
            @RequestParam(defaultValue = "all") String visibility,
            @RequestParam(defaultValue = "all") String sourceSystem,
            @RequestParam(defaultValue = "0")   int    page,
            @RequestParam(defaultValue = "10")  int    size
    ) {
        // 1. Xác thực API key
        ResponseEntity<?> check = resolvePartner(apiKey);
        if (!check.getStatusCode().is2xxSuccessful()) return check;
        User partner = (User) check.getBody();

        // 2. Kiểm tra quota
        int total = partner.getQuotaTotal() != null ? partner.getQuotaTotal() : 0;
        int used  = partner.getQuotaUsed()  != null ? partner.getQuotaUsed()  : 0;
        if (used >= total) {
            return ResponseEntity.status(429).body(Map.of(
                "error",      "Đã hết quota tháng này.",
                "quotaUsed",  used,
                "quotaTotal", total
            ));
        }

        // 3. Lấy dữ liệu
        Page<ReviewDto> result = reviewService.getReviewsForPartner(
                partner.getPartnerCode(),
                partner.getAssignedOperatorCode(),
                keyword, category, visibility, sourceSystem, page, size
        );

        // 4. Trừ 1 quota
        partner.setQuotaUsed(used + 1);
        partner.setUpdatedAt(Instant.now());
        userRepository.save(partner);

        // 4b. Lưu log
        apiUsageLogRepository.save(ApiUsageLog.builder()
                .partnerId(partner.getId())
                .partnerEmail(partner.getEmail())
                .endpoint("GET /api/v1/reviews")
                .status(200)
                .resultCount(result.getTotalElements())
                .calledAt(Instant.now())
                .build());

        // 5. Trả response kèm thông tin quota còn lại
        return ResponseEntity.ok(Map.of(
            "data",           result.getContent(),
            "totalElements",  result.getTotalElements(),
            "totalPages",     result.getTotalPages(),
            "page",           result.getNumber(),
            "size",           result.getSize(),
            "quotaUsed",      used + 1,
            "quotaTotal",     total,
            "quotaRemaining", total - used - 1
        ));
    }

    /* ───────────────────────────────────────────── GET /api/v1/usage-logs */

    @GetMapping("/usage-logs")
    public ResponseEntity<?> getUsageLogs(
            @RequestHeader(value = "X-Api-Key", required = false) String apiKey,
            @RequestParam(defaultValue = "20") int limit
    ) {
        ResponseEntity<?> check = resolvePartner(apiKey);
        if (!check.getStatusCode().is2xxSuccessful()) return check;
        User partner = (User) check.getBody();

        List<ApiUsageLog> logs = apiUsageLogRepository
                .findByPartnerIdOrderByCalledAtDesc(partner.getId(), PageRequest.of(0, Math.min(limit, 100)));

        List<Map<String, Object>> data = logs.stream().map(l -> Map.<String, Object>of(
                "id",          l.getId(),
                "calledAt",    l.getCalledAt().toString(),
                "endpoint",    l.getEndpoint(),
                "status",      l.getStatus(),
                "resultCount", l.getResultCount() != null ? l.getResultCount() : 0
        )).toList();

        return ResponseEntity.ok(Map.of("data", data, "total", data.size()));
    }
}
