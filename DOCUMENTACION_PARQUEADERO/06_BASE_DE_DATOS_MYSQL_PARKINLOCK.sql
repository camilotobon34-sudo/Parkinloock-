-- =============================================================
-- PARKINLOCK · Parqueadero Systems & Programación
-- BASE DE DATOS PROPUESTA – PENDIENTE DE IMPLEMENTACIÓN
-- MySQL 8. Diseñada a partir del prototipo de Figma (RF-001 a RF-021).
-- =============================================================
CREATE DATABASE IF NOT EXISTS parkinlock_db
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE parkinlock_db;

CREATE TABLE roles (
  id_rol      INT AUTO_INCREMENT PRIMARY KEY,
  nombre      VARCHAR(30)  NOT NULL UNIQUE,
  descripcion VARCHAR(150) NULL
) ENGINE=InnoDB;

CREATE TABLE permisos (
  id_permiso   INT AUTO_INCREMENT PRIMARY KEY,
  id_rol       INT NOT NULL,
  area         ENUM('PANEL','ENTRADAS_SALIDAS','RESERVAS','MENSUALIDADES',
                    'HISTORIAL','TARIFAS_USUARIOS') NOT NULL,
  nivel_acceso VARCHAR(30) NOT NULL,
  CONSTRAINT uq_permiso UNIQUE (id_rol, area),
  CONSTRAINT fk_permisos_rol FOREIGN KEY (id_rol) REFERENCES roles(id_rol)
) ENGINE=InnoDB;

CREATE TABLE usuarios (
  id_usuario      INT AUTO_INCREMENT PRIMARY KEY,
  id_rol          INT          NOT NULL,
  nombre_completo VARCHAR(120) NOT NULL,
  usuario         VARCHAR(50)  NOT NULL UNIQUE,
  correo          VARCHAR(120) NULL UNIQUE,
  contrasena_hash VARCHAR(255) NOT NULL,
  estado          ENUM('ACTIVO','INACTIVO') NOT NULL DEFAULT 'ACTIVO',
  fecha_creacion  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_usuarios_rol FOREIGN KEY (id_rol) REFERENCES roles(id_rol)
) ENGINE=InnoDB;

CREATE TABLE turnos (
  id_turno          INT AUTO_INCREMENT PRIMARY KEY,
  id_usuario        INT NOT NULL,
  caja              VARCHAR(20) NOT NULL,
  inicio_programado DATETIME NOT NULL,
  fin_programado    DATETIME NOT NULL,
  caja_inicial      DECIMAL(12,2) NOT NULL DEFAULT 0,
  estado            ENUM('ABIERTO','CERRADO') NOT NULL DEFAULT 'ABIERTO',
  CONSTRAINT fk_turnos_usuario FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario),
  CONSTRAINT chk_turno_horas CHECK (fin_programado > inicio_programado)
) ENGINE=InnoDB;

CREATE TABLE tipos_vehiculo (
  id_tipo_vehiculo INT AUTO_INCREMENT PRIMARY KEY,
  nombre           VARCHAR(20) NOT NULL UNIQUE
) ENGINE=InnoDB;

CREATE TABLE espacios (
  id_espacio       INT AUTO_INCREMENT PRIMARY KEY,
  codigo           VARCHAR(10) NOT NULL UNIQUE,
  id_tipo_vehiculo INT NOT NULL,
  nivel            VARCHAR(20) NULL,
  estado           ENUM('DISPONIBLE','OCUPADO','RESERVADO') NOT NULL DEFAULT 'DISPONIBLE',
  CONSTRAINT fk_espacios_tipo FOREIGN KEY (id_tipo_vehiculo)
    REFERENCES tipos_vehiculo(id_tipo_vehiculo)
) ENGINE=InnoDB;

CREATE TABLE clientes (
  id_cliente INT AUTO_INCREMENT PRIMARY KEY,
  nombre     VARCHAR(120) NOT NULL,
  telefono   VARCHAR(20)  NULL
) ENGINE=InnoDB;

CREATE TABLE vehiculos (
  id_vehiculo      INT AUTO_INCREMENT PRIMARY KEY,
  placa            VARCHAR(10) NOT NULL UNIQUE,
  id_tipo_vehiculo INT NOT NULL,
  id_cliente       INT NULL,
  CONSTRAINT fk_vehiculos_tipo FOREIGN KEY (id_tipo_vehiculo)
    REFERENCES tipos_vehiculo(id_tipo_vehiculo),
  CONSTRAINT fk_vehiculos_cliente FOREIGN KEY (id_cliente)
    REFERENCES clientes(id_cliente) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE tarifas (
  id_tarifa        INT AUTO_INCREMENT PRIMARY KEY,
  id_tipo_vehiculo INT NOT NULL,
  concepto         ENUM('HORA','FRACCION','NOCHE','DIA','RESERVA','MENSUALIDAD') NOT NULL,
  valor            DECIMAL(12,2) NOT NULL,
  vigente_desde    DATE NOT NULL,
  CONSTRAINT uq_tarifa UNIQUE (id_tipo_vehiculo, concepto, vigente_desde),
  CONSTRAINT chk_tarifa_valor CHECK (valor >= 0),
  CONSTRAINT fk_tarifas_tipo FOREIGN KEY (id_tipo_vehiculo)
    REFERENCES tipos_vehiculo(id_tipo_vehiculo)
) ENGINE=InnoDB;

CREATE TABLE movimientos (
  id_movimiento      INT AUTO_INCREMENT PRIMARY KEY,
  id_vehiculo        INT NOT NULL,
  id_espacio         INT NOT NULL,
  id_turno_entrada   INT NOT NULL,
  id_turno_salida    INT NULL,
  fecha_hora_entrada DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_hora_salida  DATETIME NULL,
  minutos            INT NULL,
  valor_total        DECIMAL(12,2) NULL,
  estado             ENUM('EN_PARQUEADERO','FINALIZADO') NOT NULL DEFAULT 'EN_PARQUEADERO',
  CONSTRAINT fk_mov_vehiculo FOREIGN KEY (id_vehiculo) REFERENCES vehiculos(id_vehiculo),
  CONSTRAINT fk_mov_espacio  FOREIGN KEY (id_espacio)  REFERENCES espacios(id_espacio),
  CONSTRAINT fk_mov_turno_in  FOREIGN KEY (id_turno_entrada) REFERENCES turnos(id_turno),
  CONSTRAINT fk_mov_turno_out FOREIGN KEY (id_turno_salida)  REFERENCES turnos(id_turno),
  CONSTRAINT chk_mov_fechas CHECK (fecha_hora_salida IS NULL
                                   OR fecha_hora_salida >= fecha_hora_entrada)
) ENGINE=InnoDB;

CREATE TABLE reservas (
  id_reserva  INT AUTO_INCREMENT PRIMARY KEY,
  id_vehiculo INT NOT NULL,
  id_cliente  INT NOT NULL,
  id_espacio  INT NULL,
  id_usuario  INT NOT NULL,
  fecha       DATE NOT NULL,
  hora_inicio TIME NOT NULL,
  hora_fin    TIME NOT NULL,
  estado      ENUM('PENDIENTE','CONFIRMADA') NOT NULL DEFAULT 'PENDIENTE',
  CONSTRAINT fk_res_vehiculo FOREIGN KEY (id_vehiculo) REFERENCES vehiculos(id_vehiculo),
  CONSTRAINT fk_res_cliente  FOREIGN KEY (id_cliente)  REFERENCES clientes(id_cliente),
  CONSTRAINT fk_res_espacio  FOREIGN KEY (id_espacio)  REFERENCES espacios(id_espacio),
  CONSTRAINT fk_res_usuario  FOREIGN KEY (id_usuario)  REFERENCES usuarios(id_usuario),
  CONSTRAINT chk_res_horas CHECK (hora_fin > hora_inicio)
) ENGINE=InnoDB;

CREATE TABLE mensualidades (
  id_mensualidad INT AUTO_INCREMENT PRIMARY KEY,
  id_vehiculo    INT NOT NULL,
  id_cliente     INT NOT NULL,
  fecha_inicio   DATE NOT NULL,
  fecha_fin      DATE NOT NULL,
  valor          DECIMAL(12,2) NOT NULL,
  estado         ENUM('ACTIVA','VENCIDA') NOT NULL DEFAULT 'ACTIVA',
  CONSTRAINT fk_men_vehiculo FOREIGN KEY (id_vehiculo) REFERENCES vehiculos(id_vehiculo),
  CONSTRAINT fk_men_cliente  FOREIGN KEY (id_cliente)  REFERENCES clientes(id_cliente),
  CONSTRAINT chk_men_fechas CHECK (fecha_fin >= fecha_inicio)
) ENGINE=InnoDB;

CREATE TABLE pagos (
  id_pago           INT AUTO_INCREMENT PRIMARY KEY,
  id_movimiento     INT NULL UNIQUE,
  id_reserva        INT NULL UNIQUE,
  id_mensualidad    INT NULL,
  id_turno          INT NOT NULL,
  metodo            ENUM('EFECTIVO') NOT NULL DEFAULT 'EFECTIVO',
  valor             DECIMAL(12,2) NOT NULL,
  efectivo_recibido DECIMAL(12,2) NOT NULL,
  cambio            DECIMAL(12,2) NOT NULL,
  fecha_hora        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_pag_mov   FOREIGN KEY (id_movimiento)  REFERENCES movimientos(id_movimiento),
  CONSTRAINT fk_pag_res   FOREIGN KEY (id_reserva)     REFERENCES reservas(id_reserva),
  CONSTRAINT fk_pag_men   FOREIGN KEY (id_mensualidad) REFERENCES mensualidades(id_mensualidad),
  CONSTRAINT fk_pag_turno FOREIGN KEY (id_turno)       REFERENCES turnos(id_turno),
  CONSTRAINT chk_pag_efectivo CHECK (efectivo_recibido >= valor),
  CONSTRAINT chk_pag_cambio   CHECK (cambio = efectivo_recibido - valor),
  CONSTRAINT chk_pag_origen CHECK ((id_movimiento IS NOT NULL) + (id_reserva IS NOT NULL)
                                   + (id_mensualidad IS NOT NULL) = 1)
) ENGINE=InnoDB;

CREATE TABLE alertas (
  id_alerta  INT AUTO_INCREMENT PRIMARY KEY,
  tipo       ENUM('RESERVA_POR_VENCER','SENSOR') NOT NULL,
  mensaje    VARCHAR(200) NOT NULL,
  id_reserva INT NULL,
  fecha_hora DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  estado     ENUM('ACTIVA','ATENDIDA') NOT NULL DEFAULT 'ACTIVA',
  CONSTRAINT fk_alerta_reserva FOREIGN KEY (id_reserva) REFERENCES reservas(id_reserva)
) ENGINE=InnoDB;

-- Índices para las consultas principales
CREATE INDEX idx_mov_estado     ON movimientos (estado);
CREATE INDEX idx_mov_entrada    ON movimientos (fecha_hora_entrada);
CREATE INDEX idx_mov_vehiculo   ON movimientos (id_vehiculo, estado);
CREATE INDEX idx_res_fecha      ON reservas (fecha, estado);
CREATE INDEX idx_men_fin        ON mensualidades (fecha_fin, estado);
CREATE INDEX idx_pag_fecha      ON pagos (fecha_hora);
CREATE INDEX idx_espacio_estado ON espacios (estado, id_tipo_vehiculo);

-- -------------------------------------------------------------
-- Datos mínimos de prueba (FICTICIOS). Las tarifas y permisos
-- corresponden a los valores mostrados en el prototipo de Figma.
-- contrasena_hash: reemplazar por hashes generados por el backend.
-- -------------------------------------------------------------
INSERT INTO roles (nombre, descripcion) VALUES
  ('ADMINISTRADOR', 'Configura tarifas, usuarios y permisos'),
  ('TRABAJADOR',    'Opera entradas, salidas y cobros');

INSERT INTO permisos (id_rol, area, nivel_acceso) VALUES
  (1,'PANEL','Ver y editar'),        (2,'PANEL','Ver'),
  (1,'ENTRADAS_SALIDAS','Gestionar'),(2,'ENTRADAS_SALIDAS','Gestionar'),
  (1,'RESERVAS','Gestionar'),        (2,'RESERVAS','Crear y ver'),
  (1,'MENSUALIDADES','Gestionar'),   (2,'MENSUALIDADES','Solo ver'),
  (1,'HISTORIAL','Ver y exportar'),  (2,'HISTORIAL','Ver turno propio'),
  (1,'TARIFAS_USUARIOS','Configurar'),(2,'TARIFAS_USUARIOS','Sin acceso');

INSERT INTO tipos_vehiculo (nombre) VALUES ('CARRO'), ('MOTO');

INSERT INTO tarifas (id_tipo_vehiculo, concepto, valor, vigente_desde) VALUES
  (1,'HORA',5000,'2026-10-01'),   (2,'HORA',3000,'2026-10-01'),
  (1,'FRACCION',5000,'2026-10-01'),(2,'FRACCION',3000,'2026-10-01'),
  (1,'NOCHE',25000,'2026-10-01'), (2,'NOCHE',15000,'2026-10-01'),
  (1,'DIA',35000,'2026-10-01'),   (2,'DIA',22000,'2026-10-01'),
  (1,'RESERVA',8000,'2026-10-01'),(2,'RESERVA',5000,'2026-10-01'),
  (1,'MENSUALIDAD',180000,'2026-10-01'),(2,'MENSUALIDAD',95000,'2026-10-01');

INSERT INTO espacios (codigo, id_tipo_vehiculo) VALUES
  ('C-01',1),('C-02',1),('C-12',1),('M-01',2),('M-02',2);

INSERT INTO usuarios (id_rol, nombre_completo, usuario, contrasena_hash) VALUES
  (1, 'Administrador de prueba', 'admin',      '<hash>'),
  (2, 'Trabajador de prueba',    'trabajador', '<hash>');
