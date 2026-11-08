-- ServicePro initial schema. Keep in sync with FsmEntities.java.
-- MySQL 8.0+

CREATE TABLE customers (
    id BIGINT NOT NULL AUTO_INCREMENT,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    customer_code VARCHAR(32) NOT NULL,
    name VARCHAR(180) NOT NULL,
    gstin VARCHAR(20),
    billing_address VARCHAR(300),
    contact_name VARCHAR(100),
    phone VARCHAR(40),
    email VARCHAR(180),
    active BIT(1) NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uk_customers_customer_code UNIQUE (customer_code),
    INDEX idx_customers_name (name)
) ENGINE=InnoDB;

CREATE TABLE branches (
    id BIGINT NOT NULL AUTO_INCREMENT,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    customer_id BIGINT NOT NULL,
    branch_code VARCHAR(32) NOT NULL,
    branch_name VARCHAR(180) NOT NULL,
    address VARCHAR(400) NOT NULL,
    city VARCHAR(100),
    state VARCHAR(100),
    postal_code VARCHAR(12),
    manager_name VARCHAR(120),
    phone VARCHAR(40),
    email VARCHAR(180),
    active BIT(1) NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uk_branches_customer_branch_code UNIQUE (customer_id, branch_code),
    INDEX idx_branches_branch_name (branch_name),
    CONSTRAINT fk_branches_customer FOREIGN KEY (customer_id) REFERENCES customers(id)
) ENGINE=InnoDB;

CREATE TABLE customer_assets (
    id BIGINT NOT NULL AUTO_INCREMENT,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    branch_id BIGINT NOT NULL,
    asset_code VARCHAR(40) NOT NULL,
    name VARCHAR(180) NOT NULL,
    category VARCHAR(80) NOT NULL,
    serial_number VARCHAR(100),
    manufacturer VARCHAR(120),
    model VARCHAR(120),
    installed_on DATE,
    warranty_until DATE,
    condition_status VARCHAR(32) NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uk_customer_assets_asset_code UNIQUE (asset_code),
    INDEX idx_customer_assets_branch_id (branch_id),
    CONSTRAINT fk_customer_assets_branch FOREIGN KEY (branch_id) REFERENCES branches(id)
) ENGINE=InnoDB;

CREATE TABLE technicians (
    id BIGINT NOT NULL AUTO_INCREMENT,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    employee_code VARCHAR(40) NOT NULL,
    full_name VARCHAR(180) NOT NULL,
    email VARCHAR(180),
    phone VARCHAR(40),
    status VARCHAR(24) NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uk_technicians_employee_code UNIQUE (employee_code),
    INDEX idx_technicians_full_name (full_name)
) ENGINE=InnoDB;

CREATE TABLE service_requests (
    id BIGINT NOT NULL AUTO_INCREMENT,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    request_number VARCHAR(40) NOT NULL,
    customer_id BIGINT NOT NULL,
    branch_id BIGINT NOT NULL,
    asset_id BIGINT,
    summary VARCHAR(240) NOT NULL,
    description VARCHAR(3000) NOT NULL,
    priority VARCHAR(20) NOT NULL,
    status VARCHAR(40) NOT NULL,
    reported_by VARCHAR(180),
    PRIMARY KEY (id),
    CONSTRAINT uk_service_requests_request_number UNIQUE (request_number),
    INDEX idx_service_requests_status (status),
    INDEX idx_service_requests_created_at (created_at),
    CONSTRAINT fk_service_requests_customer FOREIGN KEY (customer_id) REFERENCES customers(id),
    CONSTRAINT fk_service_requests_branch FOREIGN KEY (branch_id) REFERENCES branches(id),
    CONSTRAINT fk_service_requests_asset FOREIGN KEY (asset_id) REFERENCES customer_assets(id)
) ENGINE=InnoDB;

CREATE TABLE work_orders (
    id BIGINT NOT NULL AUTO_INCREMENT,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    work_order_number VARCHAR(40) NOT NULL,
    request_id BIGINT NOT NULL,
    technician_id BIGINT,
    status VARCHAR(40) NOT NULL,
    billable_class VARCHAR(20),
    scheduled_start DATETIME(6),
    work_performed VARCHAR(2000),
    completion_notes VARCHAR(2000),
    completion_approved BIT(1) NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uk_work_orders_work_order_number UNIQUE (work_order_number),
    CONSTRAINT uk_work_orders_request_id UNIQUE (request_id),
    INDEX idx_work_orders_status (status),
    INDEX idx_work_orders_scheduled_start (scheduled_start),
    CONSTRAINT fk_work_orders_request FOREIGN KEY (request_id) REFERENCES service_requests(id),
    CONSTRAINT fk_work_orders_technician FOREIGN KEY (technician_id) REFERENCES technicians(id)
) ENGINE=InnoDB;

CREATE TABLE amc_contracts (
    id BIGINT NOT NULL AUTO_INCREMENT,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    contract_number VARCHAR(48) NOT NULL,
    customer_id BIGINT NOT NULL,
    branch_id BIGINT,
    starts_on DATE NOT NULL,
    ends_on DATE NOT NULL,
    status VARCHAR(24) NOT NULL,
    monthly_service BIT(1) NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uk_amc_contracts_contract_number UNIQUE (contract_number),
    INDEX idx_amc_contracts_customer_id (customer_id),
    CONSTRAINT fk_amc_contracts_customer FOREIGN KEY (customer_id) REFERENCES customers(id),
    CONSTRAINT fk_amc_contracts_branch FOREIGN KEY (branch_id) REFERENCES branches(id)
) ENGINE=InnoDB;

CREATE TABLE monthly_service_cycles (
    id BIGINT NOT NULL AUTO_INCREMENT,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    contract_id BIGINT NOT NULL,
    asset_id BIGINT NOT NULL,
    service_month INT NOT NULL,
    service_year INT NOT NULL,
    status VARCHAR(24) NOT NULL,
    actual_service_date DATE,
    work_order_id BIGINT,
    service_report VARCHAR(2000),
    PRIMARY KEY (id),
    CONSTRAINT uk_monthly_service_cycles_asset_month_year UNIQUE (asset_id, service_month, service_year),
    INDEX idx_monthly_service_cycles_year_month (service_year, service_month),
    CONSTRAINT fk_monthly_service_cycles_contract FOREIGN KEY (contract_id) REFERENCES amc_contracts(id),
    CONSTRAINT fk_monthly_service_cycles_asset FOREIGN KEY (asset_id) REFERENCES customer_assets(id),
    CONSTRAINT fk_monthly_service_cycles_work_order FOREIGN KEY (work_order_id) REFERENCES work_orders(id)
) ENGINE=InnoDB;

CREATE TABLE postponement_requests (
    id BIGINT NOT NULL AUTO_INCREMENT,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    work_order_id BIGINT NOT NULL,
    original_start DATETIME(6) NOT NULL,
    proposed_start DATETIME(6) NOT NULL,
    reason VARCHAR(1000) NOT NULL,
    requested_by VARCHAR(180) NOT NULL,
    status VARCHAR(40) NOT NULL,
    decision_reason VARCHAR(1000),
    decided_by VARCHAR(180),
    decided_at DATETIME(6),
    PRIMARY KEY (id),
    INDEX idx_postponement_requests_status (status),
    CONSTRAINT fk_postponement_requests_work_order FOREIGN KEY (work_order_id) REFERENCES work_orders(id)
) ENGINE=InnoDB;

CREATE TABLE audit_events (
    id BIGINT NOT NULL AUTO_INCREMENT,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    actor VARCHAR(180) NOT NULL,
    entity_type VARCHAR(60) NOT NULL,
    entity_id VARCHAR(80) NOT NULL,
    action VARCHAR(40) NOT NULL,
    reason VARCHAR(1000),
    occurred_at DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    INDEX idx_audit_events_entity (entity_type, entity_id),
    INDEX idx_audit_events_occurred_at (occurred_at)
) ENGINE=InnoDB;
