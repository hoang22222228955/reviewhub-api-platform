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
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequiredArgsConstructor
public class PurchaseController {

    private final PlanRepository planRepository;
    private final UserRepository userRepository;
    private final PurchaseHistoryRepository purchaseHistoryRepository;

    /**
     * Partner mua gói.
     * POST /api/partner/purchase-plan
     * Body: { "planId": "starter" }
     */
    @PostMapping("/api/partner/purchase-plan")
    public ResponseEntity<?> purchasePlan(
            @RequestBody Map<String, String> body,
            Authentication auth) {

        User caller = (User) auth.getPrincipal();
        String planId = body.get("planId");
        if (planId == null || planId.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Thiếu planId."));
        }

        Plan plan = planRepository.findById(planId).orElse(null);
        if (plan == null) {
            return ResponseEntity.status(404).body(Map.of("error", "Không tìm thấy gói: " + planId));
        }

        // Tải lại user từ DB để có persistent entity
        User user = userRepository.findById(caller.getId()).orElse(caller);

        Instant now = Instant.now();
        Instant expiresAt = now.plus(plan.getDurationDays(), ChronoUnit.DAYS);

        // Cập nhật thông tin gói của user
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

        // Lưu lịch sử mua hàng
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
        User caller = (User) auth.getPrincipal();

        List<PurchaseHistory> list = purchaseHistoryRepository
                .findByUserIdOrderByPurchasedAtDesc(caller.getId());

        List<Map<String, Object>> result = list.stream()
                .map(h -> {
                    Plan p = planRepository.findById(h.getPlanId()).orElse(null);
                    return Map.<String, Object>of(
                            "id", h.getId(),
                            "planId", h.getPlanId(),
                            "planName", p != null ? p.getName() : h.getPlanId(),
                            "amount", h.getAmount(),
                            "purchasedAt", h.getPurchasedAt().toString(),
                            "status", h.getStatus()
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
        User caller = (User) auth.getPrincipal();
        if (!"admin".equals(caller.getRole())) {
            return ResponseEntity.status(403).body(Map.of("error", "Chỉ admin mới được xem."));
        }

        List<PurchaseHistory> all = purchaseHistoryRepository.findAll();

        List<Map<String, Object>> result = all.stream()
                .sorted((a, b) -> b.getPurchasedAt().compareTo(a.getPurchasedAt()))
                .map(h -> {
                    User u = userRepository.findById(h.getUserId()).orElse(null);
                    Plan p = planRepository.findById(h.getPlanId()).orElse(null);
                    return Map.<String, Object>of(
                            "id", h.getId(),
                            "userId", h.getUserId(),
                            "partnerName", u != null ? u.getName() : "—",
                            "partnerCode", u != null && u.getPartnerCode() != null ? u.getPartnerCode() : "—",
                            "orgName", u != null && u.getOrgName() != null ? u.getOrgName() : "—",
                            "planId", h.getPlanId(),
                            "planName", p != null ? p.getName() : h.getPlanId(),
                            "amount", h.getAmount(),
                            "purchasedAt", h.getPurchasedAt().toString(),
                            "status", h.getStatus()
                    );
                })
                .toList();

        return ResponseEntity.ok(result);
    }

    /**
     * Partner gửi yêu cầu thanh toán — chỉ tạo đơn pending, chưa kích hoạt gói.
     * POST /api/partner/submit-payment
     * Body: { "planId": "starter", "qty": 1, "paymentMethod": "banking" }
     */
    @PostMapping("/api/partner/submit-payment")
    public ResponseEntity<?> submitPayment(
            @RequestBody Map<String, Object> body,
            Authentication auth) {

        User caller = (User) auth.getPrincipal();
        String planId = (String) body.get("planId");
        int qty = body.get("qty") instanceof Number n ? n.intValue() : 1;
        String paymentMethod = body.getOrDefault("paymentMethod", "banking").toString();

        if (planId == null || planId.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Thiếu planId."));
        }
        Plan plan = planRepository.findById(planId).orElse(null);
        if (plan == null) {
            return ResponseEntity.status(404).body(Map.of("error", "Không tìm thấy gói: " + planId));
        }

        int amount = plan.getPrice() * qty;

        PurchaseHistory history = PurchaseHistory.builder()
                .id(UUID.randomUUID().toString())
                .userId(caller.getId())
                .planId(planId)
                .amount(amount)
                .purchasedAt(Instant.now())
                .status("pending")
                .build();
        // Lưu paymentMethod vào note nếu entity có field; hiện dùng status prefix
        history.setStatus("pending:" + paymentMethod);
        purchaseHistoryRepository.save(history);

        return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "Đơn đặt hàng đã gửi. Vui lòng chờ admin duyệt.",
                "purchaseId", history.getId()
        ));
    }

    /**
     * Admin duyệt đơn thanh toán → kích hoạt gói cho partner.
     * POST /api/admin/approve-purchase/{purchaseId}
     */
    @PostMapping("/api/admin/approve-purchase/{purchaseId}")
    public ResponseEntity<?> approvePurchase(
            @PathVariable String purchaseId,
            Authentication auth) {

        User caller = (User) auth.getPrincipal();
        if (!"admin".equals(caller.getRole())) {
            return ResponseEntity.status(403).body(Map.of("error", "Chỉ admin mới được duyệt."));
        }

        PurchaseHistory history = purchaseHistoryRepository.findById(purchaseId).orElse(null);
        if (history == null) {
            return ResponseEntity.status(404).body(Map.of("error", "Không tìm thấy đơn."));
        }
        if (!history.getStatus().startsWith("pending")) {
            return ResponseEntity.badRequest().body(Map.of("error", "Đơn này không ở trạng thái chờ duyệt."));
        }

        Plan plan = planRepository.findById(history.getPlanId()).orElse(null);
        if (plan == null) {
            return ResponseEntity.status(404).body(Map.of("error", "Không tìm thấy gói."));
        }

        User user = userRepository.findById(history.getUserId()).orElse(null);
        if (user == null) {
            return ResponseEntity.status(404).body(Map.of("error", "Không tìm thấy user."));
        }

        // Kích hoạt gói
        Instant now = Instant.now();
        int qty = history.getAmount() / plan.getPrice();
        Instant expiresAt = now.plus((long) plan.getDurationDays() * qty, ChronoUnit.DAYS);

        user.setCurrentPlanId(plan.getId());
        user.setPlanActivatedAt(now);
        user.setPlanExpiresAt(expiresAt);
        user.setQuotaTotal(plan.getQuotaLimit() * qty);
        user.setQuotaUsed(0);
        user.setMembershipLabel(plan.getName());
        if (!"admin".equals(user.getRole())) user.setRole("partner");
        userRepository.save(user);

        // Cập nhật trạng thái đơn
        history.setStatus("Đã thanh toán");
        purchaseHistoryRepository.save(history);

        return ResponseEntity.ok(Map.of("success", true, "message", "Đã duyệt và kích hoạt gói."));
    }

    /**
     * Admin từ chối đơn thanh toán.
     * POST /api/admin/reject-purchase/{purchaseId}
     */
    @PostMapping("/api/admin/reject-purchase/{purchaseId}")
    public ResponseEntity<?> rejectPurchase(
            @PathVariable String purchaseId,
            Authentication auth) {

        User caller = (User) auth.getPrincipal();
        if (!"admin".equals(caller.getRole())) {
            return ResponseEntity.status(403).body(Map.of("error", "Chỉ admin mới được từ chối."));
        }

        PurchaseHistory history = purchaseHistoryRepository.findById(purchaseId).orElse(null);
        if (history == null) {
            return ResponseEntity.status(404).body(Map.of("error", "Không tìm thấy đơn."));
        }

        history.setStatus("Từ chối");
        purchaseHistoryRepository.save(history);

        return ResponseEntity.ok(Map.of("success", true, "message", "Đã từ chối đơn."));
    }

    /**
     * Partner hủy gói hiện tại.
     * POST /api/partner/cancel-plan
     */
    @PostMapping("/api/partner/cancel-plan")
    public ResponseEntity<?> cancelPlan(Authentication auth) {
        User caller = (User) auth.getPrincipal();
        User user = userRepository.findById(caller.getId()).orElse(caller);

        if (user.getCurrentPlanId() == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Bạn chưa có gói nào đang kích hoạt."));
        }

        user.setCurrentPlanId(null);
        user.setPlanActivatedAt(null);
        user.setPlanExpiresAt(null);
        user.setQuotaTotal(0);
        user.setQuotaUsed(0);
        user.setMembershipLabel(null);
        userRepository.save(user);

        return ResponseEntity.ok(Map.of("success", true, "user", UserDto.from(user)));
    }

    /**
     * Partner upload logo (base64 data URL).
     * POST /api/partner/upload-logo
     * Body: { "logoBase64": "data:image/png;base64,..." }
     */
    @PostMapping("/api/partner/upload-logo")
    public ResponseEntity<?> uploadLogo(@RequestBody Map<String, String> body, Authentication auth) {
        String logoBase64 = body.get("logoBase64");
        if (logoBase64 == null || logoBase64.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Thiếu dữ liệu logo."));
        }
        // Giới hạn kích thước ~2MB (base64 ~2.7MB string)
        if (logoBase64.length() > 2_800_000) {
            return ResponseEntity.badRequest().body(Map.of("error", "Logo không được vượt quá 2MB."));
        }
        // Chỉ cho phép image data URL
        if (!logoBase64.startsWith("data:image/")) {
            return ResponseEntity.badRequest().body(Map.of("error", "Định dạng không hợp lệ. Chỉ chấp nhận ảnh."));
        }

        User caller = (User) auth.getPrincipal();
        User user = userRepository.findById(caller.getId()).orElse(caller);
        user.setLogoUrl(logoBase64);
        userRepository.save(user);

        return ResponseEntity.ok(Map.of("success", true, "user", UserDto.from(user)));
    }
}
