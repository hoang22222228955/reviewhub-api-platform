package com.doan.reviewhub.service;

import com.doan.reviewhub.dto.*;
import com.doan.reviewhub.entity.User;
import com.doan.reviewhub.repository.UserRepository;
import com.doan.reviewhub.security.JwtUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;
    private final OtpService otpService;

    public AuthResponse register(RegisterRequest req) {
        if (userRepository.existsByEmail(req.getEmail().trim().toLowerCase())) {
            return new AuthResponse(false, "Email này đã tồn tại.", null, null);
        }

        // Xác minh OTP nếu có số điện thoại
        if (req.getPhone() != null && !req.getPhone().isBlank()) {
            if (req.getOtp() == null || req.getOtp().isBlank()) {
                return new AuthResponse(false, "Vui lòng xác minh số điện thoại bằng mã OTP.", null, null);
            }
            boolean otpOk = otpService.verify(req.getPhone(), req.getOtp());
            if (!otpOk) {
                return new AuthResponse(false, "Mã OTP không đúng hoặc đã hết hạn.", null, null);
            }
        }

        String id = "user-" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);

        String rawKey = UUID.randomUUID().toString().replace("-", "");
        String apiKey = "rh_live_" + rawKey;

        User user = User.builder()
                .id(id)
                .name(req.getName())
                .email(req.getEmail().trim().toLowerCase())
                .password(passwordEncoder.encode(req.getPassword()))
                .phone(req.getPhone())
                .role("member")
                .status("Đang hoạt động")
                .apiKey(apiKey)
                .quotaTotal(0)
                .quotaUsed(0)
                .build();

        userRepository.save(user);
        String token = jwtUtil.generateToken(user.getEmail(), user.getRole());
        return new AuthResponse(true, "Đăng ký thành công.", token, UserDto.from(user));
    }

    public AuthResponse login(LoginRequest req) {
        User user = userRepository.findByEmail(req.getEmail().trim().toLowerCase()).orElse(null);
        if (user == null || !passwordEncoder.matches(req.getPassword(), user.getPassword())) {
            return new AuthResponse(false, "Email hoặc mật khẩu chưa chính xác.", null, null);
        }

        String token = jwtUtil.generateToken(user.getEmail(), user.getRole());
        return new AuthResponse(true, "Đăng nhập thành công.", token, UserDto.from(user));
    }

    public UserDto getProfile(String email) {
        User user = userRepository.findByEmail(email).orElse(null);
        return user != null ? UserDto.from(user) : null;
    }

    public boolean forgotPassword(String phone, String newPassword) {
        User user = userRepository.findByPhone(phone.trim()).orElse(null);
        if (user == null) return false;
        user.setPassword(passwordEncoder.encode(newPassword));
        userRepository.save(user);
        return true;
    }
}
