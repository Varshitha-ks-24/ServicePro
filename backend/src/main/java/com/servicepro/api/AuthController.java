package com.servicepro.api;

import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {
    private final AuthenticationManager authenticationManager;
    private final boolean configured;

    public AuthController(
        AuthenticationManager authenticationManager,
        @org.springframework.beans.factory.annotation.Value("${app.auth.username:}") String username,
        @org.springframework.beans.factory.annotation.Value("${app.auth.password:}") String password
    ) {
        this.authenticationManager = authenticationManager;
        this.configured = !username.isBlank() && !password.isBlank();
    }

    @PostMapping("/login")
    public Map<String, Object> login(@RequestBody LoginRequest request) {
        try {
            Authentication authentication = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(request.email(), request.password()));
            return Map.of(
                "authenticated", true,
                "email", authentication.getName(),
                "roles", authentication.getAuthorities().stream()
                    .map(authority -> authority.getAuthority().replace("ROLE_", ""))
                    .collect(Collectors.toList())
            );
        } catch (AuthenticationException exception) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Email or password is incorrect");
        }
    }

    @GetMapping("/status")
    public Map<String, Object> status() {
        return Map.of("configured", configured);
    }

    @GetMapping("/me")
    public Map<String, Object> me(org.springframework.security.core.Authentication authentication) {
        return Map.of(
            "email", authentication.getName(),
            "roles", authentication.getAuthorities().stream()
                .map(authority -> authority.getAuthority().replace("ROLE_", ""))
                .collect(Collectors.toList())
        );
    }

    public record LoginRequest(String email, String password) {}
}
