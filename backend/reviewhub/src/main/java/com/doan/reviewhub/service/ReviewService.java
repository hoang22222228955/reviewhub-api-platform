package com.doan.reviewhub.service;

import com.doan.reviewhub.agent.ReviewAgentPipeline;
import com.doan.reviewhub.dto.ReviewDto;
import com.doan.reviewhub.entity.Review;
import com.doan.reviewhub.repository.ReviewRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

import java.util.Optional;

@Service
@RequiredArgsConstructor
public class ReviewService {

    private final ReviewRepository reviewRepository;
    private final ReviewAgentPipeline agentPipeline;

    /**
     * Lấy danh sách review cho partner.
     *
     * partnerCode: mã đối tác đang đăng nhập.
     * assignedOperatorCode: mã nhà xe được gán cho đối tác.
     *
     * Nếu có assignedOperatorCode thì query theo assignedOperatorCode.
     * Nếu không có thì fallback về partnerCode.
     */
    public Page<ReviewDto> getReviewsForPartner(
            String partnerCode,
            String assignedOperatorCode,
            String keyword,
            String category,
            String visibility,
            String sourceSystem,
            int page,
            int size
    ) {
        PageRequest pageable = PageRequest.of(
                page,
                size,
                Sort.by("createdAt").descending()
        );

        if (partnerCode == null || partnerCode.isBlank()) {
            return Page.empty(pageable);
        }

        String operatorCodeToQuery =
                assignedOperatorCode != null && !assignedOperatorCode.isBlank()
                        ? assignedOperatorCode
                        : partnerCode;

        return reviewRepository.searchByOperator(
                operatorCodeToQuery,
                keyword,
                category,
                visibility,
                sourceSystem,
                pageable
        ).map(ReviewDto::from);
    }

    /**
     * Lấy chi tiết 1 review theo id.
     */
    public Optional<ReviewDto> getById(String id) {
        return reviewRepository.findById(id).map(ReviewDto::from);
    }

    /**
     * Partner gửi review mới — chạy qua AI Agentic Pipeline:
     * Fetcher → Validator → Moderator → Storer
     */
    public ReviewDto submitReview(
            String partnerCode,
            String callerRole,
            String targetCode,
            String targetName,
            String category,
            String reviewerName,
            Double rating,
            String comment,
            String visibility
    ) {
        return agentPipeline.run(
                partnerCode,
                callerRole,
                targetCode,
                targetName,
                category,
                reviewerName,
                rating,
                comment,
                visibility
        );
    }
}