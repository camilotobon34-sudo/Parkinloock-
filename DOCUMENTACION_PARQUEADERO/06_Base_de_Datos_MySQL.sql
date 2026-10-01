-- =========================================================
-- PARQUEADERO - Systems & Programación
-- Script MySQL 8 (DISEÑO PROPUESTO)
-- =========================================================
CREATE DATABASE IF NOT EXISTS parqueadero_db
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE parqueadero_db;

CREATE TABLE roles (
  id_rol       INT AUTO_INCREMENT PRIMARY KEY,
  nombre       VARCHAR(30)  NOT NULL UNIQUE,
  descripcion  VARCHAR(150) NULL
) ENGINE=InnoDB;

CREATE TABLE usuarios (
  id_usuario      INT AUTO_INCREMENT PRIMARY KEY,
  id_rol          INT          NOT NULL,
  documento       VARCHAR(20)  NOT NULL UNIQUE,
  nombres         VARCHAR(80)  NOT NULL,
  apellidos       VARCHAR(80)  NOT NULL,
  correo          VARCHAR(120) NOT NULL UNIQUE,
  telefono        VARCHAR(20)  NULL,
  tipo_usuario    ENUM('ESTUDIANTE','PROFESOR','PERSONAL') NOT NULL,
  contrasena_hash VARCHAR(255) NOT NULL,
  estado          ENUM('ACTIVO','INACTIVO') NOT NULL DEFAULT 'ACTIVO',
  fecha_creacion  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_usuarios_rol FOREIGN KEY (id_rol)
    REFERENCES roles(id_rol) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE tipos_vehiculo (
  id_tipo_vehiculo INT AUTO_INCREMENT PRIMARY KEY,
  nombre           VARCHAR(30) NOT NULL UNIQUE
) ENGINE=InnoDB;

CREATE TABLE vehiculos (
  id_vehiculo      INT AUTO_INCREMENT PRIMARY KEY,
  id_usuario       INT         NOT NULL,
  id_tipo_vehiculo INT         NOT NULL,
  placa            VARCHAR(10) NOT NULL UNIQUE,
  marca            VARCHAR(40) NULL,
  modelo           VARCHAR(40) NULL,
  color            VARCHAR(30) NULL,
  estado           ENUM('ACTIVO','INACTIVO') NOT NULL DEFAULT 'ACTIVO',
  fecha_registro   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_vehiculos_usuario FOREIGN KEY (id_usuario)
    REFERENCES usuarios(id_usuario) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_vehiculos_tipo FOREIGN KEY (id_tipo_vehiculo)
    REFERENCES tipos_vehiculo(id_tipo_vehiculo) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE zonas (
  id_zona     INT AUTO_INCREMENT PRIMARY KEY,
  nombre      VARCHAR(50)  NOT NULL UNIQUE,
  descripcion VARCHAR(150) NULL
) ENGINE=InnoDB;

CREATE TABLE espacios (
  id_espacio       INT AUTO_INCREMENT PRIMARY KEY,
  id_zona          INT         NOT NULL,
  id_tipo_vehiculo INT         NOT NULL,
  codigo           VARCHAR(10) NOT NULL UNIQUE,
  estado           ENUM('DISPONIBLE','OCUPADO','INHABILITADO') NOT NULL DEFAULT 'DISPONIBLE',
  CONSTRAINT fk_espacios_zona FOREIGN KEY (id_zona)
    REFERENCES zonas(id_zona) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_espacios_tipo FOREIGN KEY (id_tipo_vehiculo)
    REFERENCES tipos_vehiculo(id_tipo_vehiculo) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE registros (
  id_registro          INT AUTO_INCREMENT PRIMARY KEY,
  id_vehiculo          INT      NOT NULL,
  id_espacio           INT      NOT NULL,
  id_vigilante_ingreso INT      NOT NULL,
  id_vigilante_salida  INT      NULL,
  fecha_hora_ingreso   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_hora_salida    DATETIME NULL,
  observaciones        VARCHAR(255) NULL,
  CONSTRAINT fk_registros_vehiculo FOREIGN KEY (id_vehiculo)
    REFERENCES vehiculos(id_vehiculo) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_registros_espacio FOREIGN KEY (id_espacio)
    REFERENCES espacios(id_espacio) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_registros_vig_ingreso FOREIGN KEY (id_vigilante_ingreso)
    REFERENCES usuarios(id_usuario) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_registros_vig_salida FOREIGN KEY (id_vigilante_salida)
    REFERENCES usuarios(id_usuario) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT chk_registros_fechas
    CHECK (fecha_hora_salida IS NULL OR fecha_hora_salida >= fecha_hora_ingreso)
) ENGINE=InnoDB;

CREATE INDEX idx_registros_abiertos ON registros (id_vehiculo, fecha_hora_salida);
CREATE INDEX idx_registros_ingreso  ON registros (fecha_hora_ingreso);

-- ---------------------------------------------------------
-- Datos de prueba (FICTICIOS, solo para pruebas)
-- contrasena_hash: reemplazar por hashes bcrypt generados por el backend
-- ---------------------------------------------------------
INSERT INTO roles (nombre, descripcion) VALUES
  ('ADMINISTRADOR', 'Gestiona usuarios, vehículos, zonas y espacios'),
  ('VIGILANTE',     'Registra ingresos y salidas en portería'),
  ('USUARIO',       'Miembro de la institución con vehículos registrados');

INSERT INTO tipos_vehiculo (nombre) VALUES ('CARRO'), ('MOTO'), ('BICICLETA');

INSERT INTO zonas (nombre, descripcion) VALUES
  ('Zona A', 'Carros - entrada principal'),
  ('Zona B', 'Motos'),
  ('Zona C', 'Bicicletas');

INSERT INTO espacios (id_zona, id_tipo_vehiculo, codigo) VALUES
  (1, 1, 'A-01'), (1, 1, 'A-02'), (1, 1, 'A-03'),
  (2, 2, 'B-01'), (2, 2, 'B-02'),
  (3, 3, 'C-01');

INSERT INTO usuarios (id_rol, documento, nombres, apellidos, correo, tipo_usuario, contrasena_hash) VALUES
  (1, '1000000001', 'Admin',    'Prueba', 'admin@institucion.edu.co',     'PERSONAL',   '<hash>'),
  (2, '1000000002', 'Vigilante','Prueba', 'vigilante@institucion.edu.co', 'PERSONAL',   '<hash>'),
  (3, '1000000003', 'Usuario',  'Uno',    'usuario1@institucion.edu.co',  'ESTUDIANTE', '<hash>'),
  (3, '1000000004', 'Usuario',  'Dos',    'usuario2@institucion.edu.co',  'PROFESOR',   '<hash>');

INSERT INTO vehiculos (id_usuario, id_tipo_vehiculo, placa, marca, modelo, color) VALUES
  (3, 2, 'ABC12D', 'Marca X', '2022', 'Negro'),
  (4, 1, 'XYZ123', 'Marca Y', '2020', 'Gris');
