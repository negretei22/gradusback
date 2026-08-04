import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm/repository/Repository';
import { InjectRepository } from '@nestjs/typeorm';
import { MovimientoCajaChica } from './movimientos_caja_chica.entity';

@Injectable()
export class CajaChicaService {

  constructor(
    @InjectRepository(MovimientoCajaChica)
    private movimientoCajaChicaRepo: Repository<MovimientoCajaChica>,
  ) { }

  // ===== LISTAR con saldo corrido =====
  // Importante: el saldo se calcula sobre TODO el historial (no solo el mes
  // filtrado), para que se arrastre correctamente igual que en tu Excel.
  // Después de calcularlo, se filtra por año/mes para mostrar solo esas filas.
  findMovimientos(anio?: string, mes?: string) {

    let where = '';

    if (anio && mes) {
      if (mes === '0') {
        where = `WHERE YEAR(t.fecha) = ${anio}`;
      } else {
        where = `WHERE YEAR(t.fecha) = ${anio} AND MONTH(t.fecha) = ${mes}`;
      }
    }

    // Nota: usa variables de sesión (@running) en vez de window functions (OVER),
    // para que funcione también en MySQL 5.7 (Azure Database for MySQL a veces
    // sigue en 5.7). Si tu MySQL es 8.0+, la versión con OVER también funcionaría,
    // pero esta es compatible con ambas.
    return this.movimientoCajaChicaRepo.query(`
      SELECT * FROM (
        SELECT
          id, fecha, UPPER(concepto) AS concepto, gasto, ingreso, capturo, orden,
          @running := @running + (ingreso - gasto) AS saldo_actual
        FROM movimientos_caja_chica, (SELECT @running := 0) r
        ORDER BY fecha ASC, id ASC
      ) t
      ${where}
      ORDER BY t.fecha ASC, t.id ASC
    `);
  }

  // ===== TOTALES para las cards =====
  // total_gasto / total_ingreso: solo del periodo (mes) seleccionado.
  // saldo_actual: saldo real de la caja HOY (todo el historial).
  async getSaldo(anio: number, mes: number) {

    let where = `YEAR(fecha) = ${anio}`;
    if (mes > 0) {
      where += ` AND MONTH(fecha) = ${mes}`;
    }

    const periodo = await this.movimientoCajaChicaRepo.query(`
      SELECT
        SUM(gasto)   AS total_gasto,
        SUM(ingreso) AS total_ingreso
      FROM movimientos_caja_chica
      WHERE ${where}
    `);

    const global = await this.movimientoCajaChicaRepo.query(`
      SELECT SUM(ingreso - gasto) AS saldo_actual
      FROM movimientos_caja_chica
    `);

    return {
      total_gasto: periodo[0].total_gasto || 0,
      total_ingreso: periodo[0].total_ingreso || 0,
      saldo_actual: global[0].saldo_actual || 0
    };
  }

  async guardaMovimiento(payload: any) {
    const movimiento = this.movimientoCajaChicaRepo.create(payload);
    return await this.movimientoCajaChicaRepo.save(movimiento);
  }

  async getMovimiento(id: number) {
    const movimiento = await this.movimientoCajaChicaRepo.findOne({ where: { id } });
    if (movimiento) {
      movimiento.concepto = movimiento.concepto.toUpperCase();
    }
    return movimiento;
  }

  async updateMovimiento(id: number, payload: any) {

    const movimiento = await this.movimientoCajaChicaRepo.findOne({ where: { id } });

    if (!movimiento) {
      throw new Error('Movimiento no encontrado');
    }

    await this.movimientoCajaChicaRepo.update(id, payload);

    return { ok: true };
  }

  async deleteMovimiento(id: number) {
    return await this.movimientoCajaChicaRepo.delete(id);
  }

  async updateOrden(id: number, orden: number): Promise<any> {
    return await this.movimientoCajaChicaRepo.query(`
      UPDATE movimientos_caja_chica
      SET orden = ?
      WHERE id = ?
    `, [orden, id]);
  }
}