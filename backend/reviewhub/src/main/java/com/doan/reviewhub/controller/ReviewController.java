package com.doan.reviewhub.controller;

import com.doan.reviewhub.dto.ReviewDto;
import com.doan.reviewhub.entity.User;
import com.doan.reviewhub.service.ReviewService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/reviews")
@RequiredArgsConstructor
public class ReviewController {

    private final ReviewService reviewService;

    /**
     * GET /api/reviews?keyword=&category=all&visibility=all&page=0&size=10
     * Trả về danh sách review được phép xem cho partner đang đăng nhập.
     */
    @GetMapping
    public ResponseEntity<Page<ReviewDto>> getReviews(
            Authentication authentication,
            @RequestParam(defaultValue = "") String keyword,
            @RequestParam(defaultValue = "all") String category,
            @RequestParam(defaultValue = "all") String visibility,
            @RequestParam(defaultValue = "all") String sourceSystem,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size
    ) {
        User currentUser = (User) authentication.getPrincipal();
        Page<ReviewDto> result = reviewService.getReviewsForPartner(
                currentUser.getPartnerCode(),
                currentUser.getAssignedOperatorCode(),
                keyword, category, visibility, sourceSystem, page, size
        );
        return ResponseEntity.ok(result);
    }

    /**
     * GET /api/reviews/{id}
     * Lấy chi tiết 1 review.
     */
    @GetMapping("/{id}")
    public ResponseEntity<ReviewDto> getById(@PathVariable String id) {
        return reviewService.getById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    /**
     * POST /api/reviews
     * Partner gửi review mới.
     * Body: { targetCode, targetName, category, reviewerName, rating, comment, visibility }
     */
    @PostMapping
    public ResponseEntity<ReviewDto> submitReview(
            Authentication authentication,
            @RequestBody Map<String, Object> body
    ) {
        User currentUser = (User) authentication.getPrincipal();
        String partnerCode = currentUser.getPartnerCode();
        ReviewDto created = reviewService.submitReview(
                partnerCode,
                currentUser.getRole(),
                (String) body.get("targetCode"),
                (String) body.get("targetName"),
                (String) body.get("category"),
                (String) body.get("reviewerName"),
                body.get("rating") != null ? Double.parseDouble(body.get("rating").toString()) : 0.0,
                (String) body.get("comment"),
                (String) body.get("visibility")
        );
        return ResponseEntity.ok(created);
    }
}
