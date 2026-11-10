package com.servicepro;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.nio.charset.StandardCharsets;
import java.util.Base64;

import static org.hamcrest.Matchers.greaterThanOrEqualTo;
import static org.hamcrest.Matchers.is;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = {
    "app.auth.username=mvp-admin@servicepro.test",
    "app.auth.password=integration-test-only-password",
    "app.auth.role=SUPER_ADMIN"
})
@AutoConfigureMockMvc
class FsmApiIntegrationTests {
    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    private String adminAuthorization() {
        String credentials = "mvp-admin@servicepro.test:integration-test-only-password";
        return "Basic " + Base64.getEncoder().encodeToString(credentials.getBytes(StandardCharsets.UTF_8));
    }

    private com.fasterxml.jackson.databind.JsonNode postJson(String path, String content) throws Exception {
        MvcResult result = mockMvc.perform(post(path)
                .header("Authorization", adminAuthorization())
                .contentType(MediaType.APPLICATION_JSON)
                .content(content))
            .andExpect(status().isOk())
            .andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString());
    }

    private com.fasterxml.jackson.databind.JsonNode putJson(String path, String content) throws Exception {
        MvcResult result = mockMvc.perform(put(path)
                .header("Authorization", adminAuthorization())
                .contentType(MediaType.APPLICATION_JSON)
                .content(content))
            .andExpect(status().isOk())
            .andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString());
    }

    @Test
    void fsmApiRequiresAuthentication() throws Exception {
        mockMvc.perform(get("/api/v1/customers"))
            .andExpect(status().isUnauthorized());
    }

    @Test
    void loginValidatesConfiguredCredentialsAndReturnsServerRole() throws Exception {
        mockMvc.perform(get("/api/v1/auth/status"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.configured", is(true)));

        mockMvc.perform(post("/api/v1/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"email":"mvp-admin@servicepro.test","password":"integration-test-only-password"}
                    """))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.authenticated", is(true)))
            .andExpect(jsonPath("$.roles[0]", is("SUPER_ADMIN")));

        mockMvc.perform(post("/api/v1/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"email":"mvp-admin@servicepro.test","password":"wrong-password"}
                    """))
            .andExpect(status().isUnauthorized());
    }

    @Test
    void createsCustomerAndBranchAndReflectsThemInDashboard() throws Exception {
        String authorization = adminAuthorization();
        MvcResult customerResult = mockMvc.perform(post("/api/v1/customers")
                .header("Authorization", authorization)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"code":"BANK-INT-01","name":"Integration Bank","gstin":"29ABCDE1234F1Z5","billingAddress":"1 Test Street","contactName":"Operations Desk","phone":"0800000000","email":"ops@example.test","active":true}
                    """))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.id").exists())
            .andExpect(jsonPath("$.code", is("BANK-INT-01")))
            .andReturn();

        long customerId = objectMapper.readTree(customerResult.getResponse().getContentAsString()).get("id").asLong();
        mockMvc.perform(post("/api/v1/branches")
                .header("Authorization", authorization)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"customerId":%d,"code":"BR-001","name":"Central Branch","address":"2 Test Road","city":"Bengaluru","state":"Karnataka","postalCode":"560001","managerName":"Branch Manager","phone":"0801111111","email":"branch@example.test","active":true}
                    """.formatted(customerId)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.customerName", is("Integration Bank")))
            .andExpect(jsonPath("$.code", is("BR-001")));

        mockMvc.perform(get("/api/v1/branches")
                .header("Authorization", authorization)
                .param("search", "Central Branch"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.total", is(1)))
            .andExpect(jsonPath("$.items[0].name", is("Central Branch")))
            .andExpect(jsonPath("$.items[0].customerName", is("Integration Bank")));

        mockMvc.perform(get("/api/v1/customers")
                .header("Authorization", authorization)
                .param("search", "Integration Bank"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.total", is(1)))
            .andExpect(jsonPath("$.items[0].name", is("Integration Bank")));

        mockMvc.perform(get("/api/v1/customers")
                .header("Authorization", authorization)
                .param("search", "Integration Bank"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.items[0].id").exists());

        mockMvc.perform(get("/api/v1/dashboard").header("Authorization", authorization))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.customers", greaterThanOrEqualTo(1)))
            .andExpect(jsonPath("$.branches", greaterThanOrEqualTo(1)));
    }

    @Test
    void completesRequestWithManagerApprovedAppointmentAndWorkOrderFlow() throws Exception {
        var customer = postJson("/api/v1/customers", """
            {"code":"BANK-FLOW-02","name":"Workflow Bank","active":true}
            """);
        long customerId = customer.path("id").asLong();
        var branch = postJson("/api/v1/branches", """
            {"customerId":%d,"code":"FLOW-BR-01","name":"Workflow Branch","address":"10 Test Avenue","active":true}
            """.formatted(customerId));
        long branchId = branch.path("id").asLong();
        var asset = postJson("/api/v1/assets", """
            {"branchId":%d,"code":"FLOW-ASSET-01","name":"Main AC","category":"Air conditioner","conditionStatus":"Good"}
            """.formatted(branchId));
        long assetId = asset.path("id").asLong();
        var technician = postJson("/api/v1/technicians", """
            {"employeeCode":"FLOW-TECH-01","name":"Workflow Technician","email":"flow.tech@example.test","status":"Active"}
            """);
        var request = postJson("/api/v1/service-requests", """
            {"customerId":%d,"branchId":%d,"assetId":%d,"summary":"AC not cooling","description":"Reported by branch manager","priority":"High","reportedBy":"Branch Manager"}
            """.formatted(customerId, branchId, assetId));
        var workOrder = postJson("/api/v1/service-requests/%d/work-order".formatted(request.path("id").asLong()), """
            {"technicianId":%d,"scheduledStart":"2026-11-09T10:00:00"}
            """.formatted(technician.path("id").asLong()));
        long workOrderId = workOrder.path("id").asLong();

        var postponement = postJson("/api/v1/work-orders/%d/postponement-requests".formatted(workOrderId), """
            {"proposedStart":"2026-11-10T11:00:00","reason":"Technician is attending an urgent branch call"}
            """);
        postJson("/api/v1/postponement-requests/%d/decision".formatted(postponement.path("id").asLong()), """
            {"decision":"Decline","reason":"Keep the agreed visit window"}
            """);
        mockMvc.perform(get("/api/v1/work-orders").header("Authorization", adminAuthorization()).param("search", workOrder.path("workOrderNumber").asText()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.items[0].scheduledStart", is("2026-11-09T10:00:00")));

        var approvedRequest = postJson("/api/v1/work-orders/%d/postponement-requests".formatted(workOrderId), """
            {"proposedStart":"2026-11-11T12:00:00","reason":"Customer confirmed a later access window"}
            """);
        var approval = postJson("/api/v1/postponement-requests/%d/decision".formatted(approvedRequest.path("id").asLong()), """
            {"decision":"Approve","reason":"Approved by service manager"}
            """);
        org.junit.jupiter.api.Assertions.assertEquals("2026-11-09T10:00:00", approval.path("originalStart").asText());
        mockMvc.perform(get("/api/v1/work-orders").header("Authorization", adminAuthorization()).param("search", workOrder.path("workOrderNumber").asText()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.items[0].scheduledStart", is("2026-11-11T12:00:00")));

        putJson("/api/v1/work-orders/%d/status".formatted(workOrderId), """
            {"status":"In progress"}
            """);
        var submission = putJson("/api/v1/work-orders/%d/status".formatted(workOrderId), """
            {"status":"Completion submitted","billableClass":"Non-billable","workPerformed":"Cleaned filters and tested the unit","completionNotes":"Unit operating normally"}
            """);
        org.junit.jupiter.api.Assertions.assertEquals(false, submission.path("completionApproved").asBoolean());
        var completed = postJson("/api/v1/work-orders/%d/completion-decision".formatted(workOrderId), """
            {"decision":"Approve","reason":"Service evidence reviewed"}
            """);
        org.junit.jupiter.api.Assertions.assertEquals("Completed", completed.path("status").asText());
        org.junit.jupiter.api.Assertions.assertEquals(true, completed.path("completionApproved").asBoolean());

        var contract = postJson("/api/v1/amcs", """
            {"contractNumber":"AMC-FLOW-02","customerId":%d,"branchId":%d,"startsOn":"2026-01-01","endsOn":"2026-12-31","status":"Active","monthlyService":true}
            """.formatted(customerId, branchId));
        MvcResult cycleResult = mockMvc.perform(post("/api/v1/amcs/%d/cycles".formatted(contract.path("id").asLong()))
                .header("Authorization", adminAuthorization())
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"serviceMonth":11,"serviceYear":2026,"assetIds":[%d]}
                    """.formatted(assetId)))
            .andExpect(status().isOk())
            .andReturn();
        long cycleId = objectMapper.readTree(cycleResult.getResponse().getContentAsString()).get(0).path("id").asLong();
        var completedCycle = putJson("/api/v1/amc-cycles/%d/status".formatted(cycleId), """
            {"status":"Completed","actualServiceDate":"2026-11-08","workOrderId":%d,"serviceReport":"Monthly maintenance completed at the branch"}
            """.formatted(workOrderId));
        org.junit.jupiter.api.Assertions.assertEquals("Completed", completedCycle.path("status").asText());
    }

    @Test
    void dashboardUsesStoredDatabaseCounts() throws Exception {
        mockMvc.perform(get("/api/v1/dashboard").header("Authorization", adminAuthorization()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.customers").isNumber())
            .andExpect(jsonPath("$.branches").isNumber())
            .andExpect(jsonPath("$.activeAmcs").isNumber())
            .andExpect(jsonPath("$.recentWorkOrders").isArray());
    }
}
