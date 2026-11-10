package com.servicepro.api;

import com.servicepro.api.FsmEntities.AmcContract;
import com.servicepro.api.FsmEntities.Asset;
import com.servicepro.api.FsmEntities.AuditEvent;
import com.servicepro.api.FsmEntities.Branch;
import com.servicepro.api.FsmEntities.Customer;
import com.servicepro.api.FsmEntities.MonthlyServiceCycle;
import com.servicepro.api.FsmEntities.PostponementRequest;
import com.servicepro.api.FsmEntities.ServiceRequest;
import com.servicepro.api.FsmEntities.Technician;
import com.servicepro.api.FsmEntities.WorkOrder;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.persistence.TypedQuery;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1")
@Validated
public class FsmController {
    @PersistenceContext
    private EntityManager entityManager;

    @GetMapping("/dashboard")
    public Map<String, Object> dashboard() {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("customers", count("FsmCustomer"));
        result.put("branches", count("FsmBranch"));
        result.put("assets", count("CustomerAsset"));
        result.put("activeAmcs", entityManager.createQuery(
            "select count(a) from AmcContract a where a.status = 'Active' and a.endsOn >= :today", Long.class)
            .setParameter("today", LocalDate.now()).getSingleResult());
        result.put("newRequests", entityManager.createQuery(
            "select count(r) from ServiceRequest r where r.status = 'New'", Long.class)
            .getSingleResult());
        result.put("inProgress", entityManager.createQuery(
            "select count(w) from WorkOrder w where w.status = 'In progress'", Long.class)
            .getSingleResult());
        result.put("completedWorkOrders", entityManager.createQuery(
            "select count(w) from WorkOrder w where w.status = 'Completed'", Long.class).getSingleResult());
        result.put("upcomingMaintenance", entityManager.createQuery(
            "select count(c) from MonthlyServiceCycle c where c.status in ('Pending', 'In Progress') and (c.serviceYear > :year or (c.serviceYear = :year and c.serviceMonth >= :month))", Long.class)
            .setParameter("year", LocalDate.now().getYear()).setParameter("month", LocalDate.now().getMonthValue()).getSingleResult());
        result.put("recentWorkOrders", page("select w from WorkOrder w order by w.createdAt desc", WorkOrder.class, 0, 6)
            .stream().map(this::workOrderView).toList());
        result.put("upcomingCycles", page("select c from MonthlyServiceCycle c where c.status in ('Pending', 'In Progress') and (c.serviceYear > :year or (c.serviceYear = :year and c.serviceMonth >= :month)) order by c.serviceYear, c.serviceMonth", MonthlyServiceCycle.class, 0, 6,
            LocalDate.now().getYear(), LocalDate.now().getMonthValue())
            .stream().map(this::cycleView).toList());
        return result;
    }

    @GetMapping("/customers")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','SERVICE_MANAGER','MANAGER','ACCOUNTANT','FINANCE_MANAGER','AUDITOR')")
    public PageResult<Map<String, Object>> customers(@RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "20") int size, @RequestParam(defaultValue = "") String search) {
        String filter = search.trim().toLowerCase();
        TypedQuery<Customer> query = entityManager.createQuery(
            "select c from FsmCustomer c where :search = '' or lower(c.name) like :pattern or lower(c.code) like :pattern order by c.name", Customer.class)
            .setParameter("search", filter).setParameter("pattern", "%" + filter + "%");
        return result(query, "select count(c) from FsmCustomer c where :search = '' or lower(c.name) like :pattern or lower(c.code) like :pattern", page, size, this::customerView, filter);
    }

    @PostMapping("/customers")
    @Transactional
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','SERVICE_MANAGER','MANAGER')")
    public Map<String, Object> createCustomer(@Valid @RequestBody CustomerBody body) {
        if (exists("select count(c) from FsmCustomer c where lower(c.code) = :value", body.code().trim().toLowerCase())) conflict("Customer code already exists");
        Customer customer = new Customer();
        customer.code = body.code().trim(); customer.name = body.name().trim(); customer.gstin = body.gstin();
        customer.billingAddress = body.billingAddress(); customer.contactName = body.contactName();
        customer.phone = body.phone(); customer.email = body.email(); customer.active = body.active();
        entityManager.persist(customer);
        audit("Customer", customer.id, "CREATE", null);
        return customerView(customer);
    }

    @PutMapping("/customers/{id}")
    @Transactional
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','SERVICE_MANAGER','MANAGER')")
    public Map<String, Object> updateCustomer(@PathVariable long id, @Valid @RequestBody CustomerBody body) {
        Customer customer = require(Customer.class, id);
        if (existsExcept("select count(c) from FsmCustomer c where lower(c.code) = :value and c.id <> :id", body.code().trim().toLowerCase(), id)) conflict("Customer code already exists");
        customer.code = body.code().trim(); customer.name = body.name().trim(); customer.gstin = body.gstin();
        customer.billingAddress = body.billingAddress(); customer.contactName = body.contactName();
        customer.phone = body.phone(); customer.email = body.email(); customer.active = body.active();
        audit("Customer", id, "UPDATE", null);
        return customerView(customer);
    }

    @GetMapping("/branches")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','SERVICE_MANAGER','MANAGER')")
    public PageResult<Map<String, Object>> branches(@RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "20") int size, @RequestParam(defaultValue = "") String search,
        @RequestParam(required = false) Long customerId) {
        String filter = search.trim().toLowerCase();
        String where = "(:search = '' or lower(b.name) like :pattern or lower(b.code) like :pattern or lower(b.customer.name) like :pattern) and (:customerId is null or b.customer.id = :customerId)";
        TypedQuery<Branch> query = entityManager.createQuery("select b from FsmBranch b where " + where + " order by b.name", Branch.class)
            .setParameter("search", filter).setParameter("pattern", "%" + filter + "%").setParameter("customerId", customerId);
        return result(query, "select count(b) from FsmBranch b where " + where, page, size, this::branchView, filter, customerId);
    }

    @PostMapping("/branches")
    @Transactional
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','SERVICE_MANAGER','MANAGER')")
    public Map<String, Object> createBranch(@Valid @RequestBody BranchBody body) {
        Customer customer = require(Customer.class, body.customerId());
        if (existsForCustomer("select count(b) from FsmBranch b where b.customer.id = :customerId and lower(b.code) = :value", customer.id, body.code().trim().toLowerCase())) conflict("Branch code already exists for this bank");
        Branch branch = new Branch(); branch.customer = customer; branch.code = body.code().trim(); branch.name = body.name().trim();
        branch.address = body.address().trim(); branch.city = body.city(); branch.state = body.state(); branch.postalCode = body.postalCode();
        branch.managerName = body.managerName(); branch.phone = body.phone(); branch.email = body.email(); branch.active = body.active();
        entityManager.persist(branch); audit("Branch", branch.id, "CREATE", null); return branchView(branch);
    }

    @PutMapping("/branches/{id}")
    @Transactional
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','SERVICE_MANAGER','MANAGER')")
    public Map<String, Object> updateBranch(@PathVariable long id, @Valid @RequestBody BranchBody body) {
        Branch branch = require(Branch.class, id); Customer customer = require(Customer.class, body.customerId());
        if (existsForCustomerExcept("select count(b) from FsmBranch b where b.customer.id = :customerId and lower(b.code) = :value and b.id <> :id", customer.id, body.code().trim().toLowerCase(), id)) conflict("Branch code already exists for this bank");
        branch.customer = customer; branch.code = body.code().trim(); branch.name = body.name().trim(); branch.address = body.address().trim();
        branch.city = body.city(); branch.state = body.state(); branch.postalCode = body.postalCode(); branch.managerName = body.managerName();
        branch.phone = body.phone(); branch.email = body.email(); branch.active = body.active(); audit("Branch", id, "UPDATE", null); return branchView(branch);
    }

    @GetMapping("/assets")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','SERVICE_MANAGER','MANAGER')")
    public PageResult<Map<String, Object>> assets(@RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "20") int size, @RequestParam(defaultValue = "") String search,
        @RequestParam(required = false) Long branchId) {
        String filter = search.trim().toLowerCase();
        String where = "(:search = '' or lower(a.name) like :pattern or lower(a.code) like :pattern or lower(a.serialNumber) like :pattern) and (:branchId is null or a.branch.id = :branchId)";
        TypedQuery<Asset> query = entityManager.createQuery("select a from CustomerAsset a where " + where + " order by a.name", Asset.class)
            .setParameter("search", filter).setParameter("pattern", "%" + filter + "%").setParameter("branchId", branchId);
        return result(query, "select count(a) from CustomerAsset a where " + where, page, size, this::assetView, filter, branchId);
    }

    @PostMapping("/assets")
    @Transactional
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','SERVICE_MANAGER','MANAGER')")
    public Map<String, Object> createAsset(@Valid @RequestBody AssetBody body) {
        Branch branch = require(Branch.class, body.branchId());
        if (exists("select count(a) from CustomerAsset a where lower(a.code) = :value", body.code().trim().toLowerCase())) conflict("Asset ID already exists");
        Asset asset = new Asset(); asset.branch = branch; asset.code = body.code().trim(); asset.name = body.name().trim();
        asset.category = body.category().trim(); asset.serialNumber = body.serialNumber(); asset.manufacturer = body.manufacturer();
        asset.model = body.model(); asset.installedOn = body.installedOn(); asset.warrantyUntil = body.warrantyUntil();
        asset.conditionStatus = body.conditionStatus(); entityManager.persist(asset); audit("CustomerAsset", asset.id, "CREATE", null); return assetView(asset);
    }

    @PutMapping("/assets/{id}")
    @Transactional
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','SERVICE_MANAGER','MANAGER')")
    public Map<String, Object> updateAsset(@PathVariable long id, @Valid @RequestBody AssetBody body) {
        Asset asset = require(Asset.class, id);
        Branch branch = require(Branch.class, body.branchId());
        if (existsExcept("select count(a) from CustomerAsset a where lower(a.code) = :value and a.id <> :id",
            body.code().trim().toLowerCase(), id)) conflict("Asset ID already exists");
        asset.branch = branch;
        asset.code = body.code().trim();
        asset.name = body.name().trim();
        asset.category = body.category().trim();
        asset.serialNumber = body.serialNumber();
        asset.manufacturer = body.manufacturer();
        asset.model = body.model();
        asset.installedOn = body.installedOn();
        asset.warrantyUntil = body.warrantyUntil();
        asset.conditionStatus = body.conditionStatus();
        audit("CustomerAsset", id, "UPDATE", null);
        return assetView(asset);
    }

    @GetMapping("/technicians")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','SERVICE_MANAGER','MANAGER')")
    public PageResult<Map<String, Object>> technicians(@RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "20") int size, @RequestParam(defaultValue = "") String search) {
        String filter = search.trim().toLowerCase();
        TypedQuery<Technician> query = entityManager.createQuery("select t from FsmTechnician t where :search = '' or lower(t.name) like :pattern or lower(t.employeeCode) like :pattern order by t.name", Technician.class)
            .setParameter("search", filter).setParameter("pattern", "%" + filter + "%");
        return result(query, "select count(t) from FsmTechnician t where :search = '' or lower(t.name) like :pattern or lower(t.employeeCode) like :pattern", page, size, this::technicianView, filter);
    }

    @PostMapping("/technicians")
    @Transactional
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','SERVICE_MANAGER','MANAGER')")
    public Map<String, Object> createTechnician(@Valid @RequestBody TechnicianBody body) {
        if (exists("select count(t) from FsmTechnician t where lower(t.employeeCode) = :value", body.employeeCode().trim().toLowerCase())) conflict("Employee ID already exists");
        Technician technician = new Technician(); technician.employeeCode = body.employeeCode().trim(); technician.name = body.name().trim();
        technician.email = body.email(); technician.phone = body.phone(); technician.status = body.status();
        entityManager.persist(technician); audit("Technician", technician.id, "CREATE", null); return technicianView(technician);
    }

    @PutMapping("/technicians/{id}")
    @Transactional
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','SERVICE_MANAGER','MANAGER')")
    public Map<String, Object> updateTechnician(@PathVariable long id, @Valid @RequestBody TechnicianBody body) {
        Technician technician = require(Technician.class, id);
        if (existsExcept("select count(t) from FsmTechnician t where lower(t.employeeCode) = :value and t.id <> :id",
            body.employeeCode().trim().toLowerCase(), id)) conflict("Employee ID already exists");
        technician.employeeCode = body.employeeCode().trim();
        technician.name = body.name().trim();
        technician.email = body.email();
        technician.phone = body.phone();
        technician.status = body.status();
        audit("Technician", id, "UPDATE", null);
        return technicianView(technician);
    }

    @GetMapping("/service-requests")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','SERVICE_MANAGER','MANAGER')")
    public PageResult<Map<String, Object>> requests(@RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "20") int size, @RequestParam(defaultValue = "") String search,
        @RequestParam(defaultValue = "") String status) {
        String filter = search.trim().toLowerCase(); String state = status.trim();
        String where = "(:search = '' or lower(r.requestNumber) like :pattern or lower(r.summary) like :pattern or lower(r.customer.name) like :pattern or lower(r.branch.name) like :pattern) and (:status = '' or r.status = :status)";
        TypedQuery<ServiceRequest> query = entityManager.createQuery("select r from ServiceRequest r where " + where + " order by r.createdAt desc", ServiceRequest.class)
            .setParameter("search", filter).setParameter("pattern", "%" + filter + "%").setParameter("status", state);
        return result(query, "select count(r) from ServiceRequest r where " + where, page, size, this::requestView, filter, state);
    }

    @PostMapping("/service-requests")
    @Transactional
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','SERVICE_MANAGER','MANAGER')")
    public Map<String, Object> createRequest(@Valid @RequestBody ServiceRequestBody body) {
        Customer customer = require(Customer.class, body.customerId()); Branch branch = require(Branch.class, body.branchId());
        if (!branch.customer.id.equals(customer.id)) invalid("Selected branch does not belong to selected bank");
        Asset asset = body.assetId() == null ? null : require(Asset.class, body.assetId());
        if (asset != null && !asset.branch.id.equals(branch.id)) invalid("Selected asset does not belong to selected branch");
        ServiceRequest request = new ServiceRequest(); request.requestNumber = nextNumber("SR", ServiceRequest.class, "requestNumber");
        request.customer = customer; request.branch = branch; request.asset = asset; request.summary = body.summary().trim();
        request.description = body.description().trim(); request.priority = body.priority(); request.reportedBy = body.reportedBy();
        entityManager.persist(request); audit("ServiceRequest", request.id, "CREATE", null); return requestView(request);
    }

    @PostMapping("/service-requests/{id}/work-order")
    @Transactional
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','SERVICE_MANAGER','MANAGER')")
    public Map<String, Object> createWorkOrder(@PathVariable long id, @RequestBody(required = false) WorkOrderBody body) {
        ServiceRequest request = require(ServiceRequest.class, id);
        if (!"New".equals(request.status) && !"Under review".equals(request.status) && !"Approved".equals(request.status)) conflict("Request is not eligible for work order conversion");
        if (entityManager.createQuery("select count(w) from WorkOrder w where w.request.id = :id", Long.class).setParameter("id", id).getSingleResult() > 0) conflict("A work order already exists for this request");
        WorkOrder workOrder = new WorkOrder(); workOrder.workOrderNumber = nextNumber("WO", WorkOrder.class, "workOrderNumber");
        workOrder.request = request; workOrder.status = "Open";
        if (body != null && body.technicianId() != null) { workOrder.technician = require(Technician.class, body.technicianId()); workOrder.status = "Assigned"; }
        if (body != null) workOrder.scheduledStart = body.scheduledStart();
        request.status = "Converted to work order"; entityManager.persist(workOrder); audit("WorkOrder", workOrder.id, "CREATE", null); return workOrderView(workOrder);
    }

    @GetMapping("/work-orders")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','SERVICE_MANAGER','MANAGER','TECHNICIAN')")
    public PageResult<Map<String, Object>> workOrders(@RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "20") int size, @RequestParam(defaultValue = "") String search,
        @RequestParam(defaultValue = "") String status) {
        String filter = search.trim().toLowerCase(); String state = status.trim();
        String technicianEmail = isServiceManager() ? "" : currentActor().toLowerCase();
        String where = "(:search = '' or lower(w.workOrderNumber) like :pattern or lower(w.request.summary) like :pattern or lower(w.request.customer.name) like :pattern or lower(w.request.branch.name) like :pattern or lower(t.name) like :pattern) and (:status = '' or w.status = :status) and (:technicianEmail = '' or lower(t.email) = :technicianEmail)";
        TypedQuery<WorkOrder> query = entityManager.createQuery("select w from WorkOrder w left join w.technician t where " + where + " order by w.createdAt desc", WorkOrder.class)
            .setParameter("search", filter).setParameter("pattern", "%" + filter + "%").setParameter("status", state)
            .setParameter("technicianEmail", technicianEmail);
        return result(query, "select count(w) from WorkOrder w left join w.technician t where " + where, page, size, this::workOrderView, filter, state, technicianEmail);
    }

    @PutMapping("/work-orders/{id}/assignment")
    @Transactional
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','SERVICE_MANAGER','MANAGER')")
    public Map<String, Object> assignWorkOrder(@PathVariable long id, @Valid @RequestBody AssignmentBody body) {
        WorkOrder workOrder = require(WorkOrder.class, id); Technician technician = require(Technician.class, body.technicianId());
        if (!"Active".equals(technician.status)) invalid("Only active technicians can be assigned");
        workOrder.technician = technician;
        if ("Open".equals(workOrder.status)) workOrder.status = "Assigned";
        audit("WorkOrder", id, "ASSIGN", null); return workOrderView(workOrder);
    }

    @PutMapping("/work-orders/{id}/status")
    @Transactional
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','SERVICE_MANAGER','MANAGER','TECHNICIAN')")
    public Map<String, Object> updateWorkOrderStatus(@PathVariable long id, @Valid @RequestBody WorkOrderStatusBody body) {
        WorkOrder workOrder = require(WorkOrder.class, id);
        if (List.of("Completed", "Cancelled").contains(workOrder.status)) conflict("A closed work order cannot be changed");
        boolean manager = isServiceManager();
        if (!manager && (workOrder.technician == null || workOrder.technician.email == null
            || !workOrder.technician.email.equalsIgnoreCase(currentActor()))) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only the assigned technician can update this work order");
        }
        if ("Completion submitted".equals(body.status())) {
            if (!"In progress".equals(workOrder.status)) conflict("Only in-progress work can submit completion");
            if (body.billableClass() == null || !List.of("Billable", "Non-billable").contains(body.billableClass())) invalid("Completed work must be classified Billable or Non-billable");
            if (body.workPerformed() == null || body.workPerformed().isBlank()) invalid("Work performed is required before completion");
            workOrder.billableClass = body.billableClass(); workOrder.workPerformed = body.workPerformed();
            workOrder.completionNotes = body.completionNotes(); workOrder.completionApproved = false;
        } else if ("In progress".equals(body.status())) {
            if (!List.of("Assigned", "On hold").contains(workOrder.status)) conflict("Only assigned or on-hold work can be started");
            if (workOrder.technician == null) invalid("Assign a technician before starting work");
        } else if ("On hold".equals(body.status())) {
            if (!"In progress".equals(workOrder.status)) conflict("Only in-progress work can be put on hold");
        } else if ("Cancelled".equals(body.status())) {
            if (!manager) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only a manager can cancel a work order");
            if (body.reason() == null || body.reason().isBlank()) invalid("A cancellation reason is required");
        } else if ("Assigned".equals(body.status())) {
            if (!manager) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only a manager can assign a work order");
            if (workOrder.technician == null) invalid("Assign a technician before changing the work order to Assigned");
            if (!"Open".equals(workOrder.status)) conflict("Only open work can be assigned");
        } else {
            invalid("Unsupported work order status");
        }
        workOrder.status = body.status(); audit("WorkOrder", id, "STATUS_" + body.status().toUpperCase().replace(' ', '_'), body.reason());
        return workOrderView(workOrder);
    }

    @PostMapping("/work-orders/{id}/completion-decision")
    @Transactional
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','SERVICE_MANAGER','MANAGER')")
    public Map<String, Object> decideCompletion(@PathVariable long id, @Valid @RequestBody CompletionDecisionBody body) {
        WorkOrder workOrder = require(WorkOrder.class, id);
        if (!"Completion submitted".equals(workOrder.status)) conflict("Work order has no submitted completion awaiting review");
        if (!List.of("Approve", "Return").contains(body.decision())) invalid("Decision must be Approve or Return");
        if ("Approve".equals(body.decision())) {
            workOrder.status = "Completed";
            workOrder.completionApproved = true;
        } else {
            workOrder.status = "In progress";
            workOrder.completionApproved = false;
        }
        audit("WorkOrder", id, "COMPLETION_" + body.decision().toUpperCase(), body.reason());
        return workOrderView(workOrder);
    }

    @PostMapping("/work-orders/{id}/postponement-requests")
    @Transactional
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','SERVICE_MANAGER','MANAGER','TECHNICIAN')")
    public Map<String, Object> requestPostponement(@PathVariable long id, @Valid @RequestBody PostponementBody body) {
        WorkOrder workOrder = require(WorkOrder.class, id);
        if (workOrder.scheduledStart == null) invalid("Work order has no scheduled appointment");
        boolean manager = SecurityContextHolder.getContext().getAuthentication().getAuthorities().stream()
            .anyMatch(authority -> List.of("ROLE_SUPER_ADMIN", "ROLE_SERVICE_MANAGER", "ROLE_MANAGER").contains(authority.getAuthority()));
        if (!manager && (workOrder.technician == null || workOrder.technician.email == null
            || !workOrder.technician.email.equalsIgnoreCase(currentActor()))) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only the assigned technician can request this postponement");
        }
        if (entityManager.createQuery("select count(p) from PostponementRequest p where p.workOrder.id = :id and p.status = 'Pending manager approval'", Long.class)
            .setParameter("id", id).getSingleResult() > 0) conflict("A postponement request is already awaiting manager approval");
        PostponementRequest request = new PostponementRequest(); request.workOrder = workOrder;
        request.originalStart = workOrder.scheduledStart;
        request.proposedStart = body.proposedStart(); request.reason = body.reason().trim();
        request.requestedBy = currentActor();
        entityManager.persist(request); audit("PostponementRequest", request.id, "REQUEST", request.reason);
        return postponementView(request);
    }

    @PostMapping("/postponement-requests/{id}/decision")
    @Transactional
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','SERVICE_MANAGER','MANAGER')")
    public Map<String, Object> decidePostponement(@PathVariable long id, @Valid @RequestBody PostponementDecisionBody body) {
        PostponementRequest request = require(PostponementRequest.class, id);
        if (!"Pending manager approval".equals(request.status)) conflict("Postponement request has already been decided");
        if (!List.of("Approve", "Decline").contains(body.decision())) invalid("Decision must be Approve or Decline");
        request.status = "Approve".equals(body.decision()) ? "Approved" : "Declined";
        request.decisionReason = body.reason().trim(); request.decidedBy = currentActor(); request.decidedAt = Instant.now();
        if ("Approved".equals(request.status)) request.workOrder.scheduledStart = request.proposedStart;
        audit("PostponementRequest", id, "DECISION_" + request.status.toUpperCase(), request.decisionReason);
        return postponementView(request);
    }

    @GetMapping("/amcs")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','SERVICE_MANAGER','MANAGER')")
    public PageResult<Map<String, Object>> amcs(@RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "20") int size, @RequestParam(defaultValue = "") String search) {
        String filter = search.trim().toLowerCase();
        TypedQuery<AmcContract> query = entityManager.createQuery("select a from AmcContract a where :search = '' or lower(a.contractNumber) like :pattern or lower(a.customer.name) like :pattern order by a.endsOn", AmcContract.class)
            .setParameter("search", filter).setParameter("pattern", "%" + filter + "%");
        return result(query, "select count(a) from AmcContract a where :search = '' or lower(a.contractNumber) like :pattern or lower(a.customer.name) like :pattern", page, size, this::amcView, filter);
    }

    @PostMapping("/amcs")
    @Transactional
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','SERVICE_MANAGER','MANAGER')")
    public Map<String, Object> createAmc(@Valid @RequestBody AmcBody body) {
        Customer customer = require(Customer.class, body.customerId()); Branch branch = body.branchId() == null ? null : require(Branch.class, body.branchId());
        if (branch != null && !branch.customer.id.equals(customer.id)) invalid("Selected branch does not belong to selected bank");
        if (!body.endsOn().isAfter(body.startsOn())) invalid("Contract end date must be after start date");
        if (exists("select count(a) from AmcContract a where lower(a.contractNumber) = :value", body.contractNumber().trim().toLowerCase())) conflict("Contract number already exists");
        AmcContract contract = new AmcContract(); contract.contractNumber = body.contractNumber().trim(); contract.customer = customer;
        contract.branch = branch; contract.startsOn = body.startsOn(); contract.endsOn = body.endsOn();
        contract.status = body.status(); contract.monthlyService = body.monthlyService(); entityManager.persist(contract);
        audit("AmcContract", contract.id, "CREATE", null); return amcView(contract);
    }

    @PostMapping("/amcs/{id}/cycles")
    @Transactional
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','SERVICE_MANAGER','MANAGER')")
    public List<Map<String, Object>> createMonthlyCycles(@PathVariable long id, @Valid @RequestBody CycleBody body) {
        AmcContract contract = require(AmcContract.class, id);
        if (body.serviceMonth() < 1 || body.serviceMonth() > 12) invalid("Service month must be between 1 and 12");
        YearMonth serviceMonth = YearMonth.of(body.serviceYear(), body.serviceMonth());
        if (!contract.monthlyService) invalid("This AMC is not configured for monthly service");
        if (!"Active".equals(contract.status)) invalid("Only active contracts can create service cycles");
        if (serviceMonth.atEndOfMonth().isBefore(contract.startsOn) || serviceMonth.atDay(1).isAfter(contract.endsOn)) invalid("Service month is outside the contract term");
        List<Long> assetIds = body.assetIds();
        if (assetIds == null || assetIds.isEmpty()) invalid("Select at least one customer asset");
        List<Map<String, Object>> result = new ArrayList<>();
        for (Long assetId : assetIds) {
            Asset asset = require(Asset.class, assetId);
            if (contract.branch != null && !contract.branch.id.equals(asset.branch.id)) invalid("Asset is outside the contract branch");
            if (!asset.branch.customer.id.equals(contract.customer.id)) invalid("Asset does not belong to the contract bank");
            if (entityManager.createQuery("select count(c) from MonthlyServiceCycle c where c.asset.id = :asset and c.serviceMonth = :month and c.serviceYear = :year", Long.class)
                .setParameter("asset", assetId).setParameter("month", body.serviceMonth()).setParameter("year", body.serviceYear()).getSingleResult() > 0) conflict("A service cycle already exists for asset " + asset.code + " in this month");
            MonthlyServiceCycle cycle = new MonthlyServiceCycle(); cycle.contract = contract; cycle.asset = asset;
            cycle.serviceMonth = body.serviceMonth(); cycle.serviceYear = body.serviceYear(); cycle.status = "Pending";
            entityManager.persist(cycle); audit("MonthlyServiceCycle", cycle.id, "CREATE", null); result.add(cycleView(cycle));
        }
        return result;
    }

    @GetMapping("/amcs/{id}/cycles")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','SERVICE_MANAGER','MANAGER')")
    public List<Map<String, Object>> cycles(@PathVariable long id,
        @RequestParam(required = false) Integer year, @RequestParam(required = false) Integer month) {
        require(AmcContract.class, id);
        String where = "c.contract.id = :id and (:year is null or c.serviceYear = :year) and (:month is null or c.serviceMonth = :month)";
        return entityManager.createQuery("select c from MonthlyServiceCycle c where " + where + " order by c.serviceYear desc, c.serviceMonth desc", MonthlyServiceCycle.class)
            .setParameter("id", id).setParameter("year", year).setParameter("month", month).getResultList().stream().map(this::cycleView).toList();
    }

    @GetMapping("/postponement-requests")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','SERVICE_MANAGER','MANAGER')")
    public PageResult<Map<String, Object>> postponementRequests(@RequestParam(defaultValue = "Pending manager approval") String status,
        @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size) {
        int safePage = Math.max(page, 0); int safeSize = Math.clamp(size, 1, 100);
        List<Map<String, Object>> items = entityManager.createQuery("select p from PostponementRequest p where (:status = '' or p.status = :status) order by p.createdAt desc", PostponementRequest.class)
            .setParameter("status", status).setFirstResult(safePage * safeSize).setMaxResults(safeSize).getResultList().stream().map(this::postponementView).toList();
        long total = entityManager.createQuery("select count(p) from PostponementRequest p where (:status = '' or p.status = :status)", Long.class)
            .setParameter("status", status).getSingleResult();
        return new PageResult<>(items, safePage, safeSize, total);
    }

    @GetMapping("/audit-events")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','SERVICE_MANAGER','MANAGER','AUDITOR')")
    public PageResult<Map<String, Object>> auditEvents(@RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "20") int size) {
        int safePage = Math.max(page, 0); int safeSize = Math.clamp(size, 1, 100);
        TypedQuery<AuditEvent> query = entityManager.createQuery("select a from AuditEvent a order by a.occurredAt desc", AuditEvent.class);
        List<Map<String, Object>> items = query.setFirstResult(safePage * safeSize).setMaxResults(safeSize).getResultList().stream().map(this::auditView).toList();
        long total = entityManager.createQuery("select count(a) from AuditEvent a", Long.class).getSingleResult();
        return new PageResult<>(items, safePage, safeSize, total);
    }

    @PutMapping("/amc-cycles/{id}/status")
    @Transactional
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','SERVICE_MANAGER','MANAGER')")
    public Map<String, Object> updateCycle(@PathVariable long id, @Valid @RequestBody CycleStatusBody body) {
        MonthlyServiceCycle cycle = require(MonthlyServiceCycle.class, id);
        if (!List.of("Pending", "In Progress", "Completed", "Overdue").contains(body.status())) {
            invalid("Unsupported monthly service status");
        }
        if ("Completed".equals(body.status())) {
            if (body.actualServiceDate() == null || body.serviceReport() == null || body.serviceReport().isBlank() || body.workOrderId() == null) {
                invalid("Completion requires the actual service date, report and linked work order");
            }
            YearMonth actualMonth = YearMonth.from(body.actualServiceDate());
            if (actualMonth.getYear() != cycle.serviceYear || actualMonth.getMonthValue() != cycle.serviceMonth) {
                invalid("Actual service date must fall within the scheduled service month");
            }
            WorkOrder workOrder = require(WorkOrder.class, body.workOrderId());
            if (!"Completed".equals(workOrder.status)) invalid("Linked work order must be completed first");
            if (workOrder.request.asset == null || !workOrder.request.asset.id.equals(cycle.asset.id)) {
                invalid("Linked work order must reference this customer asset");
            }
            cycle.workOrder = workOrder;
            cycle.actualServiceDate = body.actualServiceDate();
            cycle.serviceReport = body.serviceReport().trim();
        }
        cycle.status = body.status();
        audit("MonthlyServiceCycle", id, "STATUS_" + body.status().toUpperCase().replace(' ', '_'), null);
        return cycleView(cycle);
    }

   private <T> PageResult<Map<String, Object>> result(TypedQuery<T> query, String countJpql, int page, int size,
    java.util.function.Function<T, Map<String, Object>> mapper, Object... params) {

    int safePage = Math.max(page, 0);
    int safeSize = Math.clamp(size, 1, 100);

    query.setFirstResult(safePage * safeSize).setMaxResults(safeSize);

    TypedQuery<Long> countQuery = entityManager.createQuery(countJpql, Long.class);

    countQuery.setParameter("search", params[0]);
    countQuery.setParameter("pattern", "%" + params[0] + "%");

    if (countJpql.contains(":customerId")) {
        countQuery.setParameter("customerId", params[1]);
    }
    if (countJpql.contains(":branchId")) {
        countQuery.setParameter("branchId", params[1]);
    }
    if (countJpql.contains(":status")) {
        countQuery.setParameter("status", params[1]);
    }
    if (countJpql.contains(":technicianEmail")) {
        countQuery.setParameter("technicianEmail", params[2]);
    }

    return new PageResult<>(
        query.getResultList().stream().map(mapper).toList(),
        safePage,
        safeSize,
        countQuery.getSingleResult()
    );
}

    private <T> List<T> page(String jpql, Class<T> type, int page, int size, Object... parameters) {
        TypedQuery<T> query = entityManager.createQuery(jpql, type).setFirstResult(page * size).setMaxResults(size);
        if (parameters.length > 0) query.setParameter("year", parameters[0]);
        if (parameters.length > 1) query.setParameter("month", parameters[1]);
        return query.getResultList();
    }

    private long count(String entity) {
        return entityManager.createQuery("select count(e) from " + entity + " e", Long.class).getSingleResult();
    }

    private boolean exists(String jpql, String value) {
        return entityManager.createQuery(jpql, Long.class).setParameter("value", value).getSingleResult() > 0;
    }

    private boolean existsExcept(String jpql, String value, long id) {
        return entityManager.createQuery(jpql, Long.class).setParameter("value", value).setParameter("id", id).getSingleResult() > 0;
    }

    private boolean existsForCustomer(String jpql, long customerId, String value) {
        return entityManager.createQuery(jpql, Long.class).setParameter("customerId", customerId).setParameter("value", value).getSingleResult() > 0;
    }

    private boolean existsForCustomerExcept(String jpql, long customerId, String value, long id) {
        return entityManager.createQuery(jpql, Long.class).setParameter("customerId", customerId).setParameter("value", value).setParameter("id", id).getSingleResult() > 0;
    }

    private <T> T require(Class<T> type, long id) {
        T entity = entityManager.find(type, id);
        if (entity == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Record not found");
        return entity;
    }

    private String nextNumber(String prefix, Class<?> type, String field) {
        Long count = entityManager.createQuery("select count(e) from " + entityName(type) + " e", Long.class).getSingleResult();
        return prefix + "-" + String.format("%06d", count + 1);
    }

    private String entityName(Class<?> type) {
        if (type == ServiceRequest.class) return "ServiceRequest";
        return "WorkOrder";
    }

    private void audit(String type, long id, String action, String reason) {
        AuditEvent event = new AuditEvent(); event.actor = currentActor(); event.entityType = type;
        event.entityId = Long.toString(id); event.action = action; event.reason = reason; entityManager.persist(event);
    }

    private String currentActor() {
        return SecurityContextHolder.getContext().getAuthentication().getName();
    }

    private boolean isServiceManager() {
        return SecurityContextHolder.getContext().getAuthentication().getAuthorities().stream()
            .anyMatch(authority -> List.of("ROLE_SUPER_ADMIN", "ROLE_SERVICE_MANAGER", "ROLE_MANAGER").contains(authority.getAuthority()));
    }

    private void conflict(String message) { throw new ResponseStatusException(HttpStatus.CONFLICT, message); }
    private void invalid(String message) { throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, message); }

    private Map<String, Object> view(Object... pairs) {
        Map<String, Object> values = new LinkedHashMap<>();
        for (int i = 0; i < pairs.length; i += 2) values.put((String) pairs[i], pairs[i + 1]);
        return values;
    }

    private Map<String, Object> customerView(Customer c) { return view("id", c.id, "code", c.code, "name", c.name, "gstin", c.gstin, "billingAddress", c.billingAddress, "contactName", c.contactName, "phone", c.phone, "email", c.email, "active", c.active, "createdAt", c.createdAt); }
    private Map<String, Object> branchView(Branch b) { return view("id", b.id, "customerId", b.customer.id, "customerName", b.customer.name, "code", b.code, "name", b.name, "address", b.address, "city", b.city, "state", b.state, "postalCode", b.postalCode, "managerName", b.managerName, "phone", b.phone, "email", b.email, "active", b.active); }
    private Map<String, Object> assetView(Asset a) { return view("id", a.id, "branchId", a.branch.id, "branchName", a.branch.name, "customerName", a.branch.customer.name, "code", a.code, "name", a.name, "category", a.category, "serialNumber", a.serialNumber, "manufacturer", a.manufacturer, "model", a.model, "installedOn", a.installedOn, "warrantyUntil", a.warrantyUntil, "conditionStatus", a.conditionStatus); }
    private Map<String, Object> technicianView(Technician t) { return view("id", t.id, "employeeCode", t.employeeCode, "name", t.name, "email", t.email, "phone", t.phone, "status", t.status); }
    private Map<String, Object> requestView(ServiceRequest r) { return view("id", r.id, "requestNumber", r.requestNumber, "customerId", r.customer.id, "customerName", r.customer.name, "branchId", r.branch.id, "branchName", r.branch.name, "assetId", r.asset == null ? null : r.asset.id, "assetName", r.asset == null ? null : r.asset.name, "summary", r.summary, "description", r.description, "priority", r.priority, "status", r.status, "reportedBy", r.reportedBy, "createdAt", r.createdAt); }
    private Map<String, Object> workOrderView(WorkOrder w) { return view("id", w.id, "workOrderNumber", w.workOrderNumber, "requestId", w.request.id, "requestNumber", w.request.requestNumber, "customerName", w.request.customer.name, "branchName", w.request.branch.name, "assetName", w.request.asset == null ? null : w.request.asset.name, "summary", w.request.summary, "description", w.request.description, "priority", w.request.priority, "technicianId", w.technician == null ? null : w.technician.id, "technicianName", w.technician == null ? null : w.technician.name, "technicianEmail", w.technician == null ? null : w.technician.email, "status", w.status, "billableClass", w.billableClass, "scheduledStart", w.scheduledStart, "completionApproved", w.completionApproved, "createdAt", w.createdAt); }
    private Map<String, Object> amcView(AmcContract a) { return view("id", a.id, "contractNumber", a.contractNumber, "customerId", a.customer.id, "customerName", a.customer.name, "branchId", a.branch == null ? null : a.branch.id, "branchName", a.branch == null ? "All branches" : a.branch.name, "startsOn", a.startsOn, "endsOn", a.endsOn, "status", a.status, "monthlyService", a.monthlyService); }
    private Map<String, Object> cycleView(MonthlyServiceCycle c) { return view("id", c.id, "contractId", c.contract.id, "contractNumber", c.contract.contractNumber, "customerName", c.contract.customer.name, "branchName", c.asset.branch.name, "assetId", c.asset.id, "assetCode", c.asset.code, "assetName", c.asset.name, "serviceMonth", c.serviceMonth, "serviceYear", c.serviceYear, "status", c.status, "actualServiceDate", c.actualServiceDate, "workOrderId", c.workOrder == null ? null : c.workOrder.id, "serviceReport", c.serviceReport); }
    private Map<String, Object> postponementView(PostponementRequest p) { return view("id", p.id, "workOrderId", p.workOrder.id, "workOrderNumber", p.workOrder.workOrderNumber, "originalStart", p.originalStart, "proposedStart", p.proposedStart, "reason", p.reason, "requestedBy", p.requestedBy, "status", p.status, "decisionReason", p.decisionReason, "decidedBy", p.decidedBy, "decidedAt", p.decidedAt); }
    private Map<String, Object> auditView(AuditEvent a) { return view("id", a.id, "actor", a.actor, "entityType", a.entityType, "entityId", a.entityId, "action", a.action, "reason", a.reason, "occurredAt", a.occurredAt); }

    public record PageResult<T>(List<T> items, int page, int size, long total) {}
    public record CustomerBody(@NotBlank String code, @NotBlank String name, String gstin, String billingAddress, String contactName, String phone, @Email String email, boolean active) {}
    public record BranchBody(@NotNull Long customerId, @NotBlank String code, @NotBlank String name, @NotBlank String address, String city, String state, String postalCode, String managerName, String phone, @Email String email, boolean active) {}
    public record AssetBody(@NotNull Long branchId, @NotBlank String code, @NotBlank String name, @NotBlank String category, String serialNumber, String manufacturer, String model, LocalDate installedOn, LocalDate warrantyUntil, @NotBlank String conditionStatus) {}
    public record TechnicianBody(@NotBlank String employeeCode, @NotBlank String name, @Email String email, String phone, @NotBlank String status) {}
    public record ServiceRequestBody(@NotNull Long customerId, @NotNull Long branchId, Long assetId, @NotBlank String summary, @NotBlank String description, @NotBlank String priority, String reportedBy) {}
    public record WorkOrderBody(Long technicianId, LocalDateTime scheduledStart) {}
    public record AssignmentBody(@NotNull Long technicianId) {}
    public record WorkOrderStatusBody(@NotBlank String status, String billableClass, String workPerformed, String completionNotes, String reason) {}
    public record CompletionDecisionBody(@NotBlank String decision, @NotBlank String reason) {}
    public record PostponementBody(@NotNull LocalDateTime proposedStart, @NotBlank String reason) {}
    public record PostponementDecisionBody(@NotBlank String decision, @NotBlank String reason) {}
    public record AmcBody(@NotBlank String contractNumber, @NotNull Long customerId, Long branchId, @NotNull LocalDate startsOn, @NotNull LocalDate endsOn, @NotBlank String status, boolean monthlyService) {}
    public record CycleBody(@NotNull Integer serviceMonth, @NotNull Integer serviceYear, List<Long> assetIds) {}
    public record CycleStatusBody(@NotBlank String status, LocalDate actualServiceDate, Long workOrderId, String serviceReport) {}
}
