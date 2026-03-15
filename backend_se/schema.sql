-- SQL Server schema for backend_se
-- Create tables for BE 기능 (User, RefreshToken, PasswordResetToken)

IF OBJECT_ID('dbo.PasswordResetToken', 'U') IS NOT NULL DROP TABLE dbo.PasswordResetToken;
IF OBJECT_ID('dbo.RefreshToken', 'U') IS NOT NULL DROP TABLE dbo.RefreshToken;
IF OBJECT_ID('dbo.[User]', 'U') IS NOT NULL DROP TABLE dbo.[User];

CREATE TABLE dbo.[User] (
  id INT IDENTITY(1,1) PRIMARY KEY,
  cccd NVARCHAR(20) NOT NULL UNIQUE,
  full_name NVARCHAR(200) NOT NULL,
  phone NVARCHAR(30) NOT NULL,
  address NVARCHAR(500) NOT NULL,
  password_hash NVARCHAR(255) NOT NULL,
  is_active BIT NOT NULL DEFAULT 1,
  avatar_data VARBINARY(MAX) NULL,
  avatar_mimetype NVARCHAR(100) NULL,
  created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  updated_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);

CREATE INDEX IX_User_phone ON dbo.[User](phone);

CREATE TABLE dbo.RefreshToken (
  id INT IDENTITY(1,1) PRIMARY KEY,
  user_id INT NOT NULL,
  token_hash NVARCHAR(255) NOT NULL,
  expires_at DATETIME2 NOT NULL,
  revoked_at DATETIME2 NULL,
  created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_RefreshToken_User FOREIGN KEY (user_id) REFERENCES dbo.[User](id) ON DELETE CASCADE
);

CREATE INDEX IX_RefreshToken_user_id ON dbo.RefreshToken(user_id);
CREATE INDEX IX_RefreshToken_token_hash ON dbo.RefreshToken(token_hash);

CREATE TABLE dbo.PasswordResetToken (
  id INT IDENTITY(1,1) PRIMARY KEY,
  user_id INT NOT NULL,
  token NVARCHAR(255) NOT NULL UNIQUE,
  expires_at DATETIME2 NOT NULL,
  is_used BIT NOT NULL DEFAULT 0,
  created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_PasswordResetToken_User FOREIGN KEY (user_id) REFERENCES dbo.[User](id) ON DELETE CASCADE
);

CREATE INDEX IX_PasswordResetToken_user_id ON dbo.PasswordResetToken(user_id);

-- Sample data
INSERT INTO dbo.[User] (cccd, full_name, phone, address, password_hash, is_active)
VALUES
  (N'123456789', N'Nguyen Van A', N'0123456789', N'Can Tho', N'$2a$10$7EqJtq98hPqEX7fNZaFWoOa1cG58F3RDeo63eFUsVTNff7kwh28jK', 1),
  (N'123456780', N'Le Thi B', N'0123456780', N'Ho Chi Minh', N'$2a$10$7EqJtq98hPqEX7fNZaFWoOa1cG58F3RDeo63eFUsVTNff7kwh28jK', 1),
  (N'123456781', N'Tran Van C', N'0123456781', N'Ha Noi', N'$2a$10$7EqJtq98hPqEX7fNZaFWoOa1cG58F3RDeo63eFUsVTNff7kwh28jK', 1),
  (N'123456782', N'Pham Thi D', N'0123456782', N'Da Nang', N'$2a$10$7EqJtq98hPqEX7fNZaFWoOa1cG58F3RDeo63eFUsVTNff7kwh28jK', 1),
  (N'123456783', N'Hoang Van E', N'0123456783', N'Hai Phong', N'$2a$10$7EqJtq98hPqEX7fNZaFWoOa1cG58F3RDeo63eFUsVTNff7kwh28jK', 1),
  (N'123456784', N'Vo Thi F', N'0123456784', N'Can Tho', N'$2a$10$7EqJtq98hPqEX7fNZaFWoOa1cG58F3RDeo63eFUsVTNff7kwh28jK', 1),
  (N'123456785', N'Nguyen Van G', N'0123456785', N'Binh Duong', N'$2a$10$7EqJtq98hPqEX7fNZaFWoOa1cG58F3RDeo63eFUsVTNff7kwh28jK', 1),
  (N'123456786', N'Do Thi H', N'0123456786', N'Dong Nai', N'$2a$10$7EqJtq98hPqEX7fNZaFWoOa1cG58F3RDeo63eFUsVTNff7kwh28jK', 1),
  (N'123456787', N'Bui Van I', N'0123456787', N'Nghe An', N'$2a$10$7EqJtq98hPqEX7fNZaFWoOa1cG58F3RDeo63eFUsVTNff7kwh28jK', 1),
  (N'123456788', N'Phan Thi K', N'0123456788', N'Khanh Hoa', N'$2a$10$7EqJtq98hPqEX7fNZaFWoOa1cG58F3RDeo63eFUsVTNff7kwh28jK', 1);
