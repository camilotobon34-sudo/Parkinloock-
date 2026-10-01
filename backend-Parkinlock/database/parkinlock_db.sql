-- =============================================================
-- PARKINLOCK · Parqueadero Systems & Programación
-- Base de datos inicial · MySQL 8.0.16 o superior
-- Modelo: DOCUMENTACION_PARQUEADERO/06_BASE_DE_DATOS_MYSQL_PARKINLOCK.sql
--
-- Se puede ejecutar varias veces: no borra datos, crea solo lo que
-- falta y no duplica los datos de prueba. No aplica cambios de
-- estructura a tablas que ya existen.
-- Importar con: mysql --default-character-set=utf8mb4 -u <usuario> -p < parkinlock_db.sql
-- =============================================================
CREATE DATABASE IF NOT EXISTS parkinlock_db
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE parkinlock_db;

CREATE TABLE IF NOT EXISTS roles (
  id_rol      INT AUTO_INCREMENT PRIMARY KEY,
  nombre      VARCHAR(30)  NOT NULL UNIQUE,
  descripcion VARCHAR(150) NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS permisos (
  id_permiso   INT AUTO_INCREMENT PRIMARY KEY,
  id_rol       INT NOT NULL,
  area         ENUM('PANEL','ENTRADAS_SALIDAS','RESERVAS','MENSUALIDADES',
                    'HISTORIAL','TARIFAS_USUARIOS') NOT NULL,
  nivel_acceso VARCHAR(30) NOT NULL,
  CONSTRAINT uq_permiso UNIQUE (id_rol, area),
  CONSTRAINT fk_permisos_rol FOREIGN KEY (id_rol) REFERENCES roles(id_rol)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS usuarios (
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

CREATE TABLE IF NOT EXISTS turnos (
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

CREATE TABLE IF NOT EXISTS tipos_vehiculo (
  id_tipo_vehiculo INT AUTO_INCREMENT PRIMARY KEY,
  nombre           VARCHAR(20) NOT NULL UNIQUE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS espacios (
  id_espacio       INT AUTO_INCREMENT PRIMARY KEY,
  codigo           VARCHAR(10) NOT NULL UNIQUE,
  id_tipo_vehiculo INT NOT NULL,
  nivel            VARCHAR(20) NULL,
  estado           ENUM('DISPONIBLE','OCUPADO','RESERVADO') NOT NULL DEFAULT 'DISPONIBLE',
  INDEX idx_espacio_estado (estado, id_tipo_vehiculo),
  CONSTRAINT fk_espacios_tipo FOREIGN KEY (id_tipo_vehiculo)
    REFERENCES tipos_vehiculo(id_tipo_vehiculo)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS clientes (
  id_cliente INT AUTO_INCREMENT PRIMARY KEY,
  nombre     VARCHAR(120) NOT NULL,
  telefono   VARCHAR(20)  NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS vehiculos (
  id_vehiculo      INT AUTO_INCREMENT PRIMARY KEY,
  placa            VARCHAR(10) NOT NULL UNIQUE,
  id_tipo_vehiculo INT NOT NULL,
  id_cliente       INT NULL,
  CONSTRAINT fk_vehiculos_tipo FOREIGN KEY (id_tipo_vehiculo)
    REFERENCES tipos_vehiculo(id_tipo_vehiculo),
  CONSTRAINT fk_vehiculos_cliente FOREIGN KEY (id_cliente)
    REFERENCES clientes(id_cliente) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS tarifas (
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

CREATE TABLE IF NOT EXISTS movimientos (
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
  INDEX idx_mov_estado   (estado),
  INDEX idx_mov_entrada  (fecha_hora_entrada),
  INDEX idx_mov_vehiculo (id_vehiculo, estado),
  CONSTRAINT fk_mov_vehiculo FOREIGN KEY (id_vehiculo) REFERENCES vehiculos(id_vehiculo),
  CONSTRAINT fk_mov_espacio  FOREIGN KEY (id_espacio)  REFERENCES espacios(id_espacio),
  CONSTRAINT fk_mov_turno_in  FOREIGN KEY (id_turno_entrada) REFERENCES turnos(id_turno),
  CONSTRAINT fk_mov_turno_out FOREIGN KEY (id_turno_salida)  REFERENCES turnos(id_turno),
  CONSTRAINT chk_mov_fechas CHECK (fecha_hora_salida IS NULL
                                   OR fecha_hora_salida >= fecha_hora_entrada)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS reservas (
  id_reserva  INT AUTO_INCREMENT PRIMARY KEY,
  id_vehiculo INT NOT NULL,
  id_cliente  INT NOT NULL,
  id_espacio  INT NULL,
  id_usuario  INT NOT NULL,
  fecha       DATE NOT NULL,
  hora_inicio TIME NOT NULL,
  hora_fin    TIME NOT NULL,
  estado      ENUM('PENDIENTE','CONFIRMADA') NOT NULL DEFAULT 'PENDIENTE',
  INDEX idx_res_fecha (fecha, estado),
  CONSTRAINT fk_res_vehiculo FOREIGN KEY (id_vehiculo) REFERENCES vehiculos(id_vehiculo),
  CONSTRAINT fk_res_cliente  FOREIGN KEY (id_cliente)  REFERENCES clientes(id_cliente),
  CONSTRAINT fk_res_espacio  FOREIGN KEY (id_espacio)  REFERENCES espacios(id_espacio),
  CONSTRAINT fk_res_usuario  FOREIGN KEY (id_usuario)  REFERENCES usuarios(id_usuario),
  CONSTRAINT chk_res_horas CHECK (hora_fin > hora_inicio)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS mensualidades (
  id_mensualidad INT AUTO_INCREMENT PRIMARY KEY,
  id_vehiculo    INT NOT NULL,
  id_cliente     INT NOT NULL,
  fecha_inicio   DATE NOT NULL,
  fecha_fin      DATE NOT NULL,
  valor          DECIMAL(12,2) NOT NULL,
  estado         ENUM('ACTIVA','VENCIDA') NOT NULL DEFAULT 'ACTIVA',
  INDEX idx_men_fin (fecha_fin, estado),
  CONSTRAINT fk_men_vehiculo FOREIGN KEY (id_vehiculo) REFERENCES vehiculos(id_vehiculo),
  CONSTRAINT fk_men_cliente  FOREIGN KEY (id_cliente)  REFERENCES clientes(id_cliente),
  CONSTRAINT chk_men_fechas CHECK (fecha_fin >= fecha_inicio)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS pagos (
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
  INDEX idx_pag_fecha (fecha_hora),
  CONSTRAINT fk_pag_mov   FOREIGN KEY (id_movimiento)  REFERENCES movimientos(id_movimiento),
  CONSTRAINT fk_pag_res   FOREIGN KEY (id_reserva)     REFERENCES reservas(id_reserva),
  CONSTRAINT fk_pag_men   FOREIGN KEY (id_mensualidad) REFERENCES mensualidades(id_mensualidad),
  CONSTRAINT fk_pag_turno FOREIGN KEY (id_turno)       REFERENCES turnos(id_turno),
  CONSTRAINT chk_pag_efectivo CHECK (efectivo_recibido >= valor),
  CONSTRAINT chk_pag_cambio   CHECK (cambio = efectivo_recibido - valor),
  CONSTRAINT chk_pag_origen CHECK ((id_movimiento IS NOT NULL) + (id_reserva IS NOT NULL)
                                   + (id_mensualidad IS NOT NULL) = 1)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS alertas (
  id_alerta  INT AUTO_INCREMENT PRIMARY KEY,
  tipo       ENUM('RESERVA_POR_VENCER','SENSOR') NOT NULL,
  mensaje    VARCHAR(200) NOT NULL,
  id_reserva INT NULL,
  fecha_hora DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  estado     ENUM('ACTIVA','ATENDIDA') NOT NULL DEFAULT 'ACTIVA',
  CONSTRAINT fk_alerta_reserva FOREIGN KEY (id_reserva) REFERENCES reservas(id_reserva)
) ENGINE=InnoDB;

-- -------------------------------------------------------------
-- Datos mínimos de prueba (FICTICIOS). Las tarifas y permisos
-- corresponden a los valores mostrados en el prototipo de Figma.
-- Los ids se buscan por nombre; si un registro ya existe, se conserva.
-- contrasena_hash: reemplazar por hashes generados por el backend.
-- -------------------------------------------------------------
INSERT INTO roles (nombre, descripcion) VALUES
  ('ADMINISTRADOR', 'Configura tarifas, usuarios y permisos'),
  ('TRABAJADOR',    'Opera entradas, salidas y cobros')
ON DUPLICATE KEY UPDATE nombre = nombre;

INSERT INTO permisos (id_rol, area, nivel_acceso)
SELECT r.id_rol, p.area, p.nivel_acceso
FROM (
  SELECT 'ADMINISTRADOR' AS rol, 'PANEL' AS area, 'Ver y editar' AS nivel_acceso
  UNION ALL SELECT 'TRABAJADOR',    'PANEL',            'Ver'
  UNION ALL SELECT 'ADMINISTRADOR', 'ENTRADAS_SALIDAS', 'Gestionar'
  UNION ALL SELECT 'TRABAJADOR',    'ENTRADAS_SALIDAS', 'Gestionar'
  UNION ALL SELECT 'ADMINISTRADOR', 'RESERVAS',         'Gestionar'
  UNION ALL SELECT 'TRABAJADOR',    'RESERVAS',         'Crear y ver'
  UNION ALL SELECT 'ADMINISTRADOR', 'MENSUALIDADES',    'Gestionar'
  UNION ALL SELECT 'TRABAJADOR',    'MENSUALIDADES',    'Solo ver'
  UNION ALL SELECT 'ADMINISTRADOR', 'HISTORIAL',        'Ver y exportar'
  UNION ALL SELECT 'TRABAJADOR',    'HISTORIAL',        'Ver turno propio'
  UNION ALL SELECT 'ADMINISTRADOR', 'TARIFAS_USUARIOS', 'Configurar'
  UNION ALL SELECT 'TRABAJADOR',    'TARIFAS_USUARIOS', 'Sin acceso'
) AS p
JOIN roles r ON r.nombre = p.rol
ON DUPLICATE KEY UPDATE area = permisos.area;

INSERT INTO tipos_vehiculo (nombre) VALUES ('CARRO'), ('MOTO')
ON DUPLICATE KEY UPDATE nombre = nombre;

INSERT INTO tarifas (id_tipo_vehiculo, concepto, valor, vigente_desde)
SELECT t.id_tipo_vehiculo, x.concepto, x.valor, '2026-10-01'
FROM (
  SELECT 'CARRO' AS tipo, 'HORA' AS concepto, 5000 AS valor
  UNION ALL SELECT 'MOTO',  'HORA',        3000
  UNION ALL SELECT 'CARRO', 'FRACCION',    5000
  UNION ALL SELECT 'MOTO',  'FRACCION',    3000
  UNION ALL SELECT 'CARRO', 'NOCHE',       25000
  UNION ALL SELECT 'MOTO',  'NOCHE',       15000
  UNION ALL SELECT 'CARRO', 'DIA',         35000
  UNION ALL SELECT 'MOTO',  'DIA',         22000
  UNION ALL SELECT 'CARRO', 'RESERVA',     8000
  UNION ALL SELECT 'MOTO',  'RESERVA',     5000
  UNION ALL SELECT 'CARRO', 'MENSUALIDAD', 180000
  UNION ALL SELECT 'MOTO',  'MENSUALIDAD', 95000
) AS x
JOIN tipos_vehiculo t ON t.nombre = x.tipo
ON DUPLICATE KEY UPDATE valor = tarifas.valor;

INSERT INTO espacios (codigo, id_tipo_vehiculo)
SELECT e.codigo, t.id_tipo_vehiculo
FROM (
  SELECT 'C-01' AS codigo, 'CARRO' AS tipo
  UNION ALL SELECT 'C-02', 'CARRO'
  UNION ALL SELECT 'C-12', 'CARRO'
  UNION ALL SELECT 'M-01', 'MOTO'
  UNION ALL SELECT 'M-02', 'MOTO'
) AS e
JOIN tipos_vehiculo t ON t.nombre = e.tipo
ON DUPLICATE KEY UPDATE codigo = espacios.codigo;

INSERT INTO usuarios (id_rol, nombre_completo, usuario, contrasena_hash)
SELECT r.id_rol, u.nombre_completo, u.usuario, '<hash>'
FROM (
  SELECT 'ADMINISTRADOR' AS rol, 'Administrador de prueba' AS nombre_completo, 'admin' AS usuario
  UNION ALL SELECT 'TRABAJADOR', 'Trabajador de prueba', 'trabajador'
) AS u
JOIN roles r ON r.nombre = u.rol
ON DUPLICATE KEY UPDATE usuario = usuarios.usuario;
