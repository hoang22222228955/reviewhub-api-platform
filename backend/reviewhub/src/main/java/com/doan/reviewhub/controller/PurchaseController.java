package com.doan.reviewhub.controller;

import com.doan.reviewhub.dto.UserDto;
import com.doan.reviewhub.entity.Plan;
import com.doan.reviewhub.entity.PurchaseHistory;
import com.doan.reviewhub.entity.User;
import com.doan.reviewhub.repository.PlanRepository;
import com.doan.reviewhub.repository.PurchaseHistoryRepository;
import com.doan.reviewhub.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

@RestController
@RequiredArgsConstructor
public class PurchaseController {

    private final PlanRepository planRepository;
    private final UserRepository userRepository;
    private final PurchaseHistoryRepository purchaseHistoryRepository;

    private ResponseEntity<?> requireLogin(Authentication auth) {
        if (auth == null || auth.getPrincipal() == null) {
            return ResponseEntity.status(401).body(Map.of(
                    "success", false,
                    "message", "Bạn chưa đăng nhập."
            ));
        }

        return null;
    }

    private ResponseEntity<?> requireAdmin(Authentication auth) {
        ResponseEntity<?> loginCheck = requireLogin(auth);

        if (loginCheck != null) {
            return loginCheck;
        }

        User caller = (User) auth.getPrincipal();

        if (!"admin".equals(caller.getRole())) {
            return ResponseEntity.status(403).body(Map.of(
                    "success", false,
                    "message", "Chỉ admin mới được thực hiện thao tác này."
            ));
        }

        return null;
    }

    /**
     * Partner mua gói và kích hoạt ngay.
     * POST /api/partner/purchase-plan
     * Body: { "planId": "starter" }
     */
    @PostMapping("/api/partner/purchase-plan")
    public ResponseEntity<?> purchasePlan(
            @RequestBody Map<String, String> body,
            Authentication auth
    ) {
        ResponseEntity<?> loginCheck = requireLogin(auth);

        if (loginCheck != null) {
            return loginCheck;
        }

        User caller = (User) auth.getPrincipal();

        String planId = body.get("planId");

        if (planId == null || planId.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "message", "Thiếu planId."
            ));
        }

        Plan plan = planRepository.findById(planId).orElse(null);

        if (plan == null) {
            return ResponseEntity.status(404).body(Map.of(
                    "success", false,
                    "message", "Không tìm thấy gói: " + planId
            ));
        }

        User user = userRepository.findById(caller.getId()).orElse(caller);

        Instant now = Instant.now();
        Instant expiresAt = now.plus(plan.getDurationDays(), ChronoUnit.DAYS);

        user.setCurrentPlanId(planId);
        user.setPlanActivatedAt(now);
        user.setPlanExpiresAt(expiresAt);
        user.setQuotaTotal(plan.getQuotaLimit());
        user.setQuotaUsed(0);
        user.setMembershipLabel(plan.getName());

        if (!"admin".equals(user.getRole())) {
            user.setRole("partner");
        }

        userRepository.save(user);

        PurchaseHistory history = PurchaseHistory.builder()
                .id(UUID.randomUUID().toString())
                .userId(user.getId())
                .planId(planId)
                .amount(plan.getPrice())
                .purchasedAt(now)
                .status("Đã thanh toán")
                .build();

        purchaseHistoryRepository.save(history);

        return ResponseEntity.ok(Map.of(
                "success", true,
                "user", UserDto.from(user)
        ));
    }

    /**
     * Partner xem lịch sử mua hàng của chính mình.
     * GET /api/partner/my-purchases
     */
    @GetMapping("/api/partner/my-purchases")
    public ResponseEntity<?> myPurchases(Authentication auth) {
        ResponseEntity<?> loginCheck = requireLogin(auth);

        if (loginCheck != null) {
            return loginCheck;
        }

        User caller = (User) auth.getPrincipal();

        List<PurchaseHistory> list =
                purchaseHistoryRepository.findByUserIdOrderByPurchasedAtDesc(caller.getId());

        Map<String, Plan> planMap = planRepository.findAll()
                .stream()
                .collect(Collectors.toMap(
                        Plan::getId,
                        Function.identity(),
                        (a, b) -> a
                ));

        List<Map<String, Object>> result = list.stream()
                .map(h -> {
                    Plan p = planMap.get(h.getPlanId());

                    return Map.<String, Object>of(
                            "id", h.getId(),
                            "planId", h.getPlanId(),
                            "planName", p != null ? p.getName() : h.getPlanId(),
                            "amount", h.getAmount(),
                            "purchasedAt", h.getPurchasedAt() != null ? h.getPurchasedAt().toString() : "",
                            "status", h.getStatus() != null ? h.getStatus() : ""
                    );
                })
                .toList();

        return ResponseEntity.ok(result);
    }

    /**
     * Admin xem lịch sử mua hàng của tất cả partners.
     * GET /api/admin/purchases
     */
    @GetMapping("/api/admin/purchases")
    public ResponseEntity<?> listPurchases(Authentication auth) {
        try {
            ResponseEntity<?> adminCheck = requireAdmin(auth);

            if (adminCheck != null) {
                return adminCheck;
            }

            List<PurchaseHistory> all = purchaseHistoryRepository.findAll();

            Map<String, User> userMap = userRepository.findAll()
                    .stream()
                    .collect(Collectors.toMap(
                            User::getId,
                            Function.identity(),
                            (a, b) -> a
                    ));

            Map<String, Plan> planMap = planRepository.findAll()
                    .stream()
                    .collect(Collectors.toMap(
                            Plan::getId,
                            Function.identity(),
                            (a, b) -> a
                    ));

            List<Map<String, Object>> result = all.stream()
                    .sorted(
                            Comparator.comparing(
                                            PurchaseHistory::getPurchasedAt,
                                            Comparator.nullsLast(Comparator.naturalOrder())
                                    )
                                    .reversed()
                    )
                    .map(h -> {
                        User u = userMap.get(h.getUserId());
                        Plan p = planMap.get(h.getPlanId());

                        return Map.<String, Object>of(
                                "id", h.getId(),
                                "userId", h.getUserId() != null ? h.getUserId() : "",
                                "partnerName", u != null && u.getName() != null ? u.getName() : "—",
                                "partnerCode", u != null && u.getPartnerCode() != null ? u.getPartnerCode() : "—",
                                "orgName", u != null && u.getOrgName() != null ? u.getOrgName() : "—",
                                "planId", h.getPlanId() != null ? h.getPlanId() : "",
                                "planName", p != null && p.getName() != null ? p.getName() : h.getPlanId(),
                                "amount", h.getAmount(),
                                "purchasedAt", h.getPurchasedAt() != null ? h.getPurchasedAt().toString() : "",
                                "status", h.getStatus() != null ? h.getStatus() : ""
                        );
                    })
                    .toList();

            return ResponseEntity.ok(result);
        } catch (Exception e) {
            e.printStackTrace();

            return ResponseEntity.internalServerError().body(Map.of(
                    "success", false,
                    "message", "Lỗi khi tải lịch sử mua gói.",
                    "error", e.getClass().getName(),
                    "detail", e.getMessage() == null ? "" : e.getMessage()
            ));
        }
    }

    /**
     * Partner gửi yêu cầu thanh toán — chỉ tạo đơn pending.
     * POST /api/partner/submit-payment
     * Body: { "planId": "starter", "qty": 1, "paymentMethod": "banking" }
     */
    @PostMapping("/api/partner/submit-payment")
    public ResponseEntity<?> submitPayment(
            @RequestBody Map<String, Object> body,
            Authentication auth
    ) {
        ResponseEntity<?> loginCheck = requireLogin(auth);

        if (loginCheck != null) {
            return loginCheck;
        }

        User caller = (User) auth.getPrincipal();

        String planId = body.get("planId") == null ? "" : body.get("planId").toString();

        int qty = body.get("qty") instanceof Number n ? n.intValue() : 1;

        if (qty <= 0) {
            qty = 1;
        }

        String paymentMethod = body.getOrDefault("paymentMethod", "banking").toString();

        if (planId.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "message", "Thiếu planId."
            ));
        }

        Plan plan = planRepository.findById(planId).orElse(null);

        if (plan == null) {
            return ResponseEntity.status(404).body(Map.of(
                    "success", false,
                    "message", "Không tìm thấy gói: " + planId
            ));
        }

        int amount = plan.getPrice() * qty;

        PurchaseHistory history = PurchaseHistory.builder()
                .id(UUID.randomUUID().toString())
                .userId(caller.getId())
                .planId(planId)
                .amount(amount)
                .purchasedAt(Instant.now())
                .status("pending:" + paymentMethod)
                .build();

        purchaseHistoryRepository.save(history);

        return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "Đơn đặt hàng đã gửi. Vui lòng chờ admin duyệt.",
                "purchaseId", history.getId()
        ));
    }

    /**
     * Admin duyệt đơn thanh toán.
     * POST /api/admin/approve-purchase/{purchaseId}
     */
    @PostMapping("/api/admin/approve-purchase/{purchaseId}")
    public ResponseEntity<?> approvePurchase(
            @PathVariable String purchaseId,
            Authentication auth
    ) {
        ResponseEntity<?> adminCheck = requireAdmin(auth);

        if (adminCheck != null) {
            return adminCheck;
        }

        PurchaseHistory history = purchaseHistoryRepository.findById(purchaseId).orElse(null);

        if (history == null) {
            return ResponseEntity.status(404).body(Map.of(
                    "success", false,
                    "message", "Không tìm thấy đơn."
            ));
        }

        if (history.getStatus() == null || !history.getStatus().startsWith("pending")) {
            return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "message", "Đơn này không ở trạng thái chờ duyệt."
            ));
        }

        Plan plan = planRepository.findById(history.getPlanId()).orElse(null);

        if (plan == null) {
            return ResponseEntity.status(404).body(Map.of(
                    "success", false,
                    "message", "Không tìm thấy gói."
            ));
        }

        User user = userRepository.findById(history.getUserId()).orElse(null);

        if (user == null) {
            return ResponseEntity.status(404).body(Map.of(
                    "success", false,
                    "message", "Không tìm thấy user."
            ));
        }

        Instant now = Instant.now();

        int qty = 1;

        if (plan.getPrice() > 0) {
            qty = Math.max(1, history.getAmount() / plan.getPrice());
        }

        Instant expiresAt = now.plus((long) plan.getDurationDays() * qty, ChronoUnit.DAYS);

        user.setCurrentPlanId(plan.getId());
        user.setPlanActivatedAt(now);
        user.setPlanExpiresAt(expiresAt);
        user.setQuotaTotal(plan.getQuotaLimit() * qty);
        user.setQuotaUsed(0);
        user.setMembershipLabel(plan.getName());

        if (!"admin".equals(user.getRole())) {
            user.setRole("partner");
        }

        userRepository.save(user);

        history.setStatus("Đã thanh toán");
        purchaseHistoryRepository.save(history);

        return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "Đã duyệt và kích hoạt gói."
        ));
    }

    /**
     * Admin từ chối đơn thanh toán.
     * POST /api/admin/reject-purchase/{purchaseId}
     */
    @PostMapping("/api/admin/reject-purchase/{purchaseId}")
    public ResponseEntity<?> rejectPurchase(
            @PathVariable String purchaseId,
            Authentication auth
    ) {
        ResponseEntity<?> adminCheck = requireAdmin(auth);

        if (adminCheck != null) {
            return adminCheck;
        }

        PurchaseHistory history = purchaseHistoryRepository.findById(purchaseId).orElse(null);

        if (history == null) {
            return ResponseEntity.status(404).body(Map.of(
                    "success", false,
                    "message", "Không tìm thấy đơn."
            ));
        }

        history.setStatus("Từ chối");
        purchaseHistoryRepository.save(history);

        return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "Đã từ chối đơn."
        ));
    }

    /**
     * Partner hủy gói hiện tại.
     * POST /api/partner/cancel-plan
     */
    @PostMapping("/api/partner/cancel-plan")
    public ResponseEntity<?> cancelPlan(Authentication auth) {
        ResponseEntity<?> loginCheck = requireLogin(auth);

        if (loginCheck != null) {
            return loginCheck;
        }

        User caller = (User) auth.getPrincipal();
        User user = userRepository.findById(caller.getId()).orElse(caller);

        if (user.getCurrentPlanId() == null) {
            return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "message", "Bạn chưa có gói nào đang kích hoạt."
            ));
        }

        user.setCurrentPlanId(null);
        user.setPlanActivatedAt(null);
        user.setPlanExpiresAt(null);
        user.setQuotaTotal(0);
        user.setQuotaUsed(0);
        user.setMembershipLabel(null);

        userRepository.save(user);

        return ResponseEntity.ok(Map.of(
                "success", true,
                "user", UserDto.from(user)
        ));
    }

    /**
     * Partner upload logo base64.
     * POST /api/partner/upload-logo
     * Body: { "logoBase64": "data:image/png;base64,..." }
     */
    @PostMapping("/api/partner/upload-logo")
    public ResponseEntity<?> uploadLogo(
            @RequestBody Map<String, String> body,
            Authentication auth
    ) {
        ResponseEntity<?> loginCheck = requireLogin(auth);

        if (loginCheck != null) {
            return loginCheck;
        }

        String logoBase64 = body.get("logoBase64");

        if (logoBase64 == null || logoBase64.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "message", "Thiếu dữ liệu logo."
            ));
        }

        if (logoBase64.length() > 2_800_000) {
            return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "message", "Logo không được vượt quá 2MB."
            ));
        }

        if (!logoBase64.startsWith("data:image/")) {
            return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "message", "Định dạng không hợp lệ. Chỉ chấp nhận ảnh."
            ));
        }

        User caller = (User) auth.getPrincipal();
        User user = userRepository.findById(caller.getId()).orElse(caller);

        user.setLogoUrl(logoBase64);
        userRepository.save(user);

        return ResponseEntity.ok(Map.of(
                "success", true,
                "user", UserDto.from(user)
        ));
    }
}