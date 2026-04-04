-- BarCode Management System - SQL Server Schema

-- 1. Create Database (Optional)
-- CREATE DATABASE BarcodeDB;
-- GO
-- USE BarcodeDB;
-- GO

-- 2. Create Agencies Table
CREATE TABLE Agencies
(
    id INT PRIMARY KEY IDENTITY(1,1),
    name NVARCHAR(255) NOT NULL,
    contact NVARCHAR(255),
    createdAt DATETIME2 DEFAULT GETDATE()
);

-- 3. Create Campaigns Table
CREATE TABLE Campaigns
(
    id INT PRIMARY KEY IDENTITY(1,1),
    name NVARCHAR(100) NOT NULL,
    agencyId INT NOT NULL,
    startDate DATETIME2 NOT NULL,
    endDate DATETIME2 NOT NULL,
    isActive BIT DEFAULT 1,
    createdAt DATETIME2 DEFAULT GETDATE(),
    CONSTRAINT FK_Campaigns_Agencies FOREIGN KEY (agencyId) REFERENCES Agencies(id) ON DELETE CASCADE
);

-- 4. Create Codes Table
CREATE TABLE Codes
(
    id INT PRIMARY KEY IDENTITY(1,1),
    code NVARCHAR(50) UNIQUE NOT NULL,
    agencyId INT NOT NULL,
    campaignId INT,
    expirationDate DATETIME2 NOT NULL,
    usedAt DATETIME2 NULL,
    createdAt DATETIME2 DEFAULT GETDATE(),
    status NVARCHAR(20) DEFAULT 'active',
    -- 'active', 'used', 'expired'
    CONSTRAINT FK_Codes_Agencies FOREIGN KEY (agencyId) REFERENCES Agencies(id),
    CONSTRAINT FK_Codes_Campaigns FOREIGN KEY (campaignId) REFERENCES Campaigns(id) ON DELETE CASCADE
);

-- 5. Create Users Table
CREATE TABLE Users
(
    id INT PRIMARY KEY IDENTITY(1,1),
    username NVARCHAR(50) UNIQUE NOT NULL,
    password NVARCHAR(255) NOT NULL,
    -- Bcrypt hashed password
    role NVARCHAR(20) DEFAULT 'admin',
    -- 'admin', 'sales'
    createdAt DATETIME2 DEFAULT GETDATE()
);

-- 6. Insert Initial Admin User (Username: admin, Password: admin123)
-- The password below is the bcrypt hash of 'admin123'
INSERT INTO Users
    (username, password, role)
VALUES
    ('admin', '$2b$10$vI8A7ugYEpfGVC16ayIFu.7IDG86ReBaGgGukwmSKfySgM6mJLXuy', 'admin'),
    ('Satis', '$2a$10$0SAGZ3FOUbRl5D9PbspwAeAZ9pLJ/z8XZjld3314zX6kWWFxRMEcS', 'Satis');
-- 7. Create Indexes for performance
CREATE INDEX IX_Codes_Code ON Codes(code);
CREATE INDEX IX_Codes_AgencyId ON Codes(agencyId);
CREATE INDEX IX_Codes_CampaignId ON Codes(campaignId);
CREATE INDEX IX_Codes_Status ON Codes(status);
CREATE INDEX IX_Campaigns_AgencyId ON Campaigns(agencyId);
CREATE INDEX IX_Users_Username ON Users(username);
