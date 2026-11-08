package com.servicepro.api;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.MappedSuperclass;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;

public final class FsmEntities {
    private FsmEntities() {}

    @MappedSuperclass
    public abstract static class Record {
        @Id
        @GeneratedValue(strategy = GenerationType.IDENTITY)
        public Long id;

        @Column(nullable = false, updatable = false)
        public Instant createdAt;

        @Column(nullable = false)
        public Instant updatedAt;

        @PrePersist
        protected void onCreate() {
            createdAt = Instant.now();
            updatedAt = createdAt;
        }

        @PreUpdate
        protected void onUpdate() {
            updatedAt = Instant.now();
        }
    }

    @Entity(name = "FsmCustomer")
    @Table(name = "customers", uniqueConstraints = @UniqueConstraint(columnNames = "customer_code"),
        indexes = @Index(columnList = "name"))
    public static class Customer extends Record {
        @Column(name = "customer_code", nullable = false, length = 32)
        public String code;
        @Column(nullable = false, length = 180)
        public String name;
        @Column(length = 20)
        public String gstin;
        @Column(length = 300)
        public String billingAddress;
        @Column(length = 100)
        public String contactName;
        @Column(length = 40)
        public String phone;
        @Column(length = 180)
        public String email;
        @Column(nullable = false)
        public boolean active = true;
    }

    @Entity(name = "FsmBranch")
    @Table(name = "branches", uniqueConstraints = @UniqueConstraint(columnNames = {"customer_id", "branch_code"}),
        indexes = @Index(columnList = "branch_name"))
    public static class Branch extends Record {
        @ManyToOne(fetch = FetchType.EAGER, optional = false)
        @JoinColumn(name = "customer_id", nullable = false)
        public Customer customer;
        @Column(name = "branch_code", nullable = false, length = 32)
        public String code;
        @Column(name = "branch_name", nullable = false, length = 180)
        public String name;
        @Column(nullable = false, length = 400)
        public String address;
        @Column(length = 100)
        public String city;
        @Column(length = 100)
        public String state;
        @Column(length = 12)
        public String postalCode;
        @Column(length = 120)
        public String managerName;
        @Column(length = 40)
        public String phone;
        @Column(length = 180)
        public String email;
        @Column(nullable = false)
        public boolean active = true;
    }

    @Entity(name = "CustomerAsset")
    @Table(name = "customer_assets", uniqueConstraints = @UniqueConstraint(columnNames = "asset_code"),
        indexes = @Index(columnList = "branch_id"))
    public static class Asset extends Record {
        @ManyToOne(fetch = FetchType.EAGER, optional = false)
        @JoinColumn(name = "branch_id", nullable = false)
        public Branch branch;
        @Column(name = "asset_code", nullable = false, length = 40)
        public String code;
        @Column(nullable = false, length = 180)
        public String name;
        @Column(nullable = false, length = 80)
        public String category;
        @Column(length = 100)
        public String serialNumber;
        @Column(length = 120)
        public String manufacturer;
        @Column(length = 120)
        public String model;
        public LocalDate installedOn;
        public LocalDate warrantyUntil;
        @Column(nullable = false, length = 32)
        public String conditionStatus = "Good";
    }

    @Entity(name = "FsmTechnician")
    @Table(name = "technicians", uniqueConstraints = @UniqueConstraint(columnNames = "employee_code"),
        indexes = @Index(columnList = "full_name"))
    public static class Technician extends Record {
        @Column(name = "employee_code", nullable = false, length = 40)
        public String employeeCode;
        @Column(name = "full_name", nullable = false, length = 180)
        public String name;
        @Column(length = 180)
        public String email;
        @Column(length = 40)
        public String phone;
        @Column(nullable = false, length = 24)
        public String status = "Active";
    }

    @Entity(name = "ServiceRequest")
    @Table(name = "service_requests", uniqueConstraints = @UniqueConstraint(columnNames = "request_number"),
        indexes = {@Index(columnList = "status"), @Index(columnList = "created_at")})
    public static class ServiceRequest extends Record {
        @Column(name = "request_number", nullable = false, length = 40)
        public String requestNumber;
        @ManyToOne(fetch = FetchType.EAGER, optional = false)
        @JoinColumn(name = "customer_id", nullable = false)
        public Customer customer;
        @ManyToOne(fetch = FetchType.EAGER, optional = false)
        @JoinColumn(name = "branch_id", nullable = false)
        public Branch branch;
        @ManyToOne(fetch = FetchType.EAGER)
        @JoinColumn(name = "asset_id")
        public Asset asset;
        @Column(nullable = false, length = 240)
        public String summary;
        @Column(nullable = false, length = 3000)
        public String description;
        @Column(nullable = false, length = 20)
        public String priority = "Normal";
        @Column(nullable = false, length = 40)
        public String status = "New";
        @Column(length = 180)
        public String reportedBy;
    }

    @Entity(name = "WorkOrder")
    @Table(name = "work_orders", uniqueConstraints = @UniqueConstraint(columnNames = "work_order_number"),
        indexes = {@Index(columnList = "status"), @Index(columnList = "scheduled_start")})
    public static class WorkOrder extends Record {
        @Column(name = "work_order_number", nullable = false, length = 40)
        public String workOrderNumber;
        @ManyToOne(fetch = FetchType.EAGER, optional = false)
        @JoinColumn(name = "request_id", nullable = false, unique = true)
        public ServiceRequest request;
        @ManyToOne(fetch = FetchType.EAGER)
        @JoinColumn(name = "technician_id")
        public Technician technician;
        @Column(nullable = false, length = 40)
        public String status = "Open";
        @Column(length = 20)
        public String billableClass;
        public LocalDateTime scheduledStart;
        @Column(length = 2000)
        public String workPerformed;
        @Column(length = 2000)
        public String completionNotes;
        @Column(nullable = false)
        public boolean completionApproved;
    }

    @Entity(name = "AmcContract")
    @Table(name = "amc_contracts", uniqueConstraints = @UniqueConstraint(columnNames = "contract_number"),
        indexes = @Index(columnList = "customer_id"))
    public static class AmcContract extends Record {
        @Column(name = "contract_number", nullable = false, length = 48)
        public String contractNumber;
        @ManyToOne(fetch = FetchType.EAGER, optional = false)
        @JoinColumn(name = "customer_id", nullable = false)
        public Customer customer;
        @ManyToOne(fetch = FetchType.EAGER)
        @JoinColumn(name = "branch_id")
        public Branch branch;
        @Column(nullable = false)
        public LocalDate startsOn;
        @Column(nullable = false)
        public LocalDate endsOn;
        @Column(nullable = false, length = 24)
        public String status = "Active";
        @Column(nullable = false)
        public boolean monthlyService;
    }

    @Entity(name = "MonthlyServiceCycle")
    @Table(name = "monthly_service_cycles", uniqueConstraints = @UniqueConstraint(
        columnNames = {"asset_id", "service_month", "service_year"}), indexes = @Index(columnList = "service_year, service_month"))
    public static class MonthlyServiceCycle extends Record {
        @ManyToOne(fetch = FetchType.EAGER, optional = false)
        @JoinColumn(name = "contract_id", nullable = false)
        public AmcContract contract;
        @ManyToOne(fetch = FetchType.EAGER, optional = false)
        @JoinColumn(name = "asset_id", nullable = false)
        public Asset asset;
        @Column(name = "service_month", nullable = false)
        public int serviceMonth;
        @Column(name = "service_year", nullable = false)
        public int serviceYear;
        @Column(nullable = false, length = 24)
        public String status = "Pending";
        public LocalDate actualServiceDate;
        @ManyToOne(fetch = FetchType.EAGER)
        @JoinColumn(name = "work_order_id")
        public WorkOrder workOrder;
        @Column(length = 2000)
        public String serviceReport;
    }

    @Entity(name = "PostponementRequest")
    @Table(name = "postponement_requests", indexes = @Index(columnList = "status"))
    public static class PostponementRequest extends Record {
        @ManyToOne(fetch = FetchType.EAGER, optional = false)
        @JoinColumn(name = "work_order_id", nullable = false)
        public WorkOrder workOrder;
        @Column(name = "original_start", nullable = false)
        public LocalDateTime originalStart;
        @Column(nullable = false)
        public LocalDateTime proposedStart;
        @Column(nullable = false, length = 1000)
        public String reason;
        @Column(nullable = false, length = 180)
        public String requestedBy;
        @Column(nullable = false, length = 40)
        public String status = "Pending manager approval";
        @Column(length = 1000)
        public String decisionReason;
        @Column(length = 180)
        public String decidedBy;
        public Instant decidedAt;
    }

    @Entity(name = "AuditEvent")
    @Table(name = "audit_events", indexes = {@Index(columnList = "entity_type, entity_id"), @Index(columnList = "occurred_at")})
    public static class AuditEvent extends Record {
        @Column(name = "actor", nullable = false, length = 180)
        public String actor;
        @Column(name = "entity_type", nullable = false, length = 60)
        public String entityType;
        @Column(name = "entity_id", nullable = false, length = 80)
        public String entityId;
        @Column(nullable = false, length = 40)
        public String action;
        @Column(length = 1000)
        public String reason;
        @Column(name = "occurred_at", nullable = false)
        public Instant occurredAt;

        @PrePersist
        @Override
        protected void onCreate() {
            super.onCreate();
            occurredAt = createdAt;
        }
    }
}
