package com.servicepro;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;

import java.nio.charset.StandardCharsets;
import java.util.Base64;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = {
    "app.auth.username=field.tech@servicepro.test",
    "app.auth.password=technician-test-only-password",
    "app.auth.role=TECHNICIAN"
})
@AutoConfigureMockMvc
class RoleAccessIntegrationTests {
    @Autowired
    private MockMvc mockMvc;

    private String technicianAuthorization() {
        String credentials = "field.tech@servicepro.test:technician-test-only-password";
        return "Basic " + Base64.getEncoder().encodeToString(credentials.getBytes(StandardCharsets.UTF_8));
    }

    @Test
    void technicianRoleIsLimitedToOperationalWork() throws Exception {
        mockMvc.perform(get("/api/v1/customers").header("Authorization", technicianAuthorization()))
            .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/v1/technicians").header("Authorization", technicianAuthorization()))
            .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/v1/work-orders").header("Authorization", technicianAuthorization()))
            .andExpect(status().isOk());
    }
}
