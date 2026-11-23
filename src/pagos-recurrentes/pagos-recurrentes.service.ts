import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PagoRecurrente } from './pago-recurrente.entity';
import { MovimientoFinanciero } from '../finanzas/movimientos_financieros.entity';

// Misma fecha efectiva que FinanzasService.findMovimientos: fecha_factura,
// salvo los valores centinela '1899-11-30' / '0000-00-00' que usan fecha_pago.
const FECHA_EFECTIVA = `
  CASE
    WHEN m.fecha_factura IN ('1899-11-30', '0000-00-00') THEN m.fecha_pago
    ELSE m.fecha_factura
  END
`;

// Normaliza un texto para comparar beneficiario/concepto: minúsculas, trim,
// espacios colapsados y sin acentos.
function normalizar(valor: string | null | undefined): string {
  return (valor ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

// Fecha de hoy en hora local como 'YYYY-MM-DD' (sin new Date(string), para
// no sufrir el desfase de zona horaria de los DATETIME de TypeORM/MySQL).
function hoyLocal(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

interface MovimientoMes {
  id: number;
  concepto: string;
  razon_social: string | null;
  gran_total: number;
  importe_sin_iva: number;
  fecha_pago: string | null; // DATE_FORMAT('%Y-%m-%d') -> string o null
}

@Injectable()
export class PagosRecurrentesService {
  constructor(
    @InjectRepository(PagoRecurrente)
    private readonly pagosRepo: Repository<PagoRecurrente>,
    @InjectRepository(MovimientoFinanciero)
    private readonly movimientosRepo: Repository<MovimientoFinanciero>,
  ) {}

  // ---------- Validación ----------

  private validar(payload: any) {
    const concepto = (payload.concepto ?? '').toString().trim();
    if (!concepto) {
      throw new BadRequestException('El concepto es obligatorio');
    }

    const dia = payload.dia_pago;
    if (dia !== null && dia !== undefined && dia !== '') {
      const n = Number(dia);
      if (!Number.isInteger(n) || n < 1 || n > 31) {
        throw new BadRequestException('El día de pago debe ser entre 1 y 31');
      }
    }

    for (const campo of ['fiscal', 'no_fiscal']) {
      const valor = payload[campo];
      if (valor !== null && valor !== undefined && valor !== '') {
        if (isNaN(Number(valor)) || Number(valor) < 0) {
          throw new BadRequestException(`El monto ${campo} no puede ser negativo`);
        }
      }
    }
  }

  private limpiar(payload: any): Partial<PagoRecurrente> {
    const dia = payload.dia_pago;
    return {
      concepto: (payload.concepto ?? '').toString().trim(),
      beneficiario:
        payload.beneficiario === '' || payload.beneficiario === undefined
          ? null
          : payload.beneficiario,
      fiscal: payload.fiscal === '' || payload.fiscal === undefined ? 0 : Number(payload.fiscal),
      no_fiscal:
        payload.no_fiscal === '' || payload.no_fiscal === undefined
          ? 0
          : Number(payload.no_fiscal),
      dia_pago:
        dia === null || dia === undefined || dia === '' ? null : Number(dia),
      activo:
        payload.activo === false || payload.activo === 0 ? 0 : 1,
      movimiento_id:
        payload.movimiento_id === null ||
        payload.movimiento_id === undefined ||
        payload.movimiento_id === ''
          ? null
          : Number(payload.movimiento_id),
    };
  }

  // ---------- CRUD ----------

  findAll(): Promise<PagoRecurrente[]> {
    return this.pagosRepo.find({
      where: { activo: 1 },
      order: { concepto: 'ASC' },
    });
  }

  async findOne(id: number): Promise<PagoRecurrente> {
    const pago = await this.pagosRepo.findOne({ where: { id, activo: 1 } });
    if (!pago) {
      throw new NotFoundException('Pago recurrente no encontrado');
    }
    return pago;
  }

  async create(payload: any): Promise<PagoRecurrente> {
    this.validar(payload);
    const pago = this.pagosRepo.create(this.limpiar(payload));
    return this.pagosRepo.save(pago);
  }

  async update(id: number, payload: any): Promise<PagoRecurrente> {
    const pago = await this.findOne(id);
    this.validar({ ...pago, ...payload });
    Object.assign(pago, this.limpiar({ ...pago, ...payload }));
    return this.pagosRepo.save(pago);
  }

  // Soft delete: activo = 0.
  async remove(id: number): Promise<{ ok: boolean }> {
    const pago = await this.findOne(id);
    pago.activo = 0;
    await this.pagosRepo.save(pago);
    return { ok: true };
  }

  // ---------- Buscar facturas (alta desde un movimiento) ----------

  buscarFacturas(texto: string) {
    const like = `%${(texto || '').trim()}%`;
    return this.movimientosRepo.query(
      `SELECT m.id, m.concepto, m.razon_social, m.rfc, m.gran_total,
              m.importe_sin_iva,
              DATE_FORMAT(m.fecha_factura, '%Y-%m-%d') AS fecha_factura,
              DATE_FORMAT(m.fecha_pago, '%Y-%m-%d') AS fecha_pago
         FROM movimientos_financieros m
        WHERE m.tipo_movimiento_id = '2'
          AND (m.concepto LIKE ? OR m.razon_social LIKE ? OR m.folio_fiscal LIKE ?)
        ORDER BY m.fecha_factura DESC
        LIMIT 20`,
      [like, like, like],
    );
  }

  // ---------- Reporte mensual ("Programación del Gasto") ----------

  async reporte(anio: number, mes: number) {
    if (!Number.isInteger(anio) || anio < 1900 || anio > 2100) {
      throw new BadRequestException('Año inválido');
    }
    if (!Number.isInteger(mes) || mes < 1 || mes > 12) {
      throw new BadRequestException('Mes inválido (1-12)');
    }

    const hoy = hoyLocal();
    const mesPad = String(mes).padStart(2, '0');

    // Movimientos del mes (egresos, tipo '2') por fecha efectiva, igual que Finanzas.
    // DATE_FORMAT deja fecha_pago como string 'YYYY-MM-DD' o null: la
    // comparación con hoy es lexicográfica y no pasa por new Date().
    const movimientos: MovimientoMes[] = await this.movimientosRepo.query(
      `SELECT m.id, m.concepto, m.razon_social, m.gran_total,
              m.importe_sin_iva,
              DATE_FORMAT(m.fecha_pago, '%Y-%m-%d') AS fecha_pago
         FROM movimientos_financieros m
        WHERE m.tipo_movimiento_id = '2'
          AND YEAR(${FECHA_EFECTIVA}) = ?
          AND MONTH(${FECHA_EFECTIVA}) = ?
        ORDER BY m.fecha_pago ASC, m.concepto ASC`,
      [anio, mes],
    );

    const recurrentes = await this.pagosRepo.find({
      where: { activo: 1 },
      order: { concepto: 'ASC' },
    });

    const consumidos = new Set<number>();
    const filas: any[] = [];

    const casaCon = (rec: PagoRecurrente, mov: MovimientoMes): boolean => {
      if (normalizar(rec.concepto) !== normalizar(mov.concepto)) return false;
      const beneficiario = normalizar(rec.beneficiario);
      if (!beneficiario) return true; // sin beneficiario: solo importa el concepto
      return beneficiario === normalizar(mov.razon_social);
    };

    const estaPagado = (mov: MovimientoMes): boolean =>
      mov.fecha_pago !== null && mov.fecha_pago <= hoy;

    for (const rec of recurrentes) {
      const candidatos = movimientos.filter(
        (m) => !consumidos.has(m.id) && casaCon(rec, m),
      );
      // Se consume UN movimiento por recurrente: preferir el pagado.
      const pagado = candidatos.find(estaPagado);
      const consumido = pagado ?? candidatos[0] ?? null;
      if (consumido) consumidos.add(consumido.id);

      const fechaProgramada =
        rec.dia_pago !== null && rec.dia_pago !== undefined
          ? `${anio}-${mesPad}-${String(rec.dia_pago).padStart(2, '0')}`
          : 'Por definir';

      filas.push({
        origen: 'recurrente',
        id: rec.id,
        concepto: rec.concepto,
        beneficiario: rec.beneficiario,
        fiscal: Number(rec.fiscal) || 0,
        no_fiscal: Number(rec.no_fiscal) || 0,
        fecha_pago: pagado ? pagado.fecha_pago : fechaProgramada,
        pagado: !!pagado,
      });
    }

    // Extras: movimientos del mes que no casaron con ningún recurrente.
    for (const mov of movimientos) {
      if (consumidos.has(mov.id)) continue;
      const pagado = estaPagado(mov);
      filas.push({
        origen: 'factura',
        movimiento_id: mov.id,
        concepto: mov.concepto,
        beneficiario: mov.razon_social,
        fiscal: Number(mov.importe_sin_iva) || 0,
        no_fiscal: 0,
        fecha_pago: mov.fecha_pago ?? 'Por definir',
        pagado,
      });
    }

    // Orden: fechas primero (ascendente), 'Por definir' al final, luego concepto.
    filas.sort((a, b) => {
      const aSinFecha = a.fecha_pago === 'Por definir';
      const bSinFecha = b.fecha_pago === 'Por definir';
      if (aSinFecha && !bSinFecha) return 1;
      if (!aSinFecha && bSinFecha) return -1;
      if (!aSinFecha && !bSinFecha && a.fecha_pago !== b.fecha_pago) {
        return a.fecha_pago < b.fecha_pago ? -1 : 1;
      }
      return (a.concepto || '').localeCompare(b.concepto || '');
    });

    const total_fiscal = filas.reduce((s, f) => s + (Number(f.fiscal) || 0), 0);
    const total_no_fiscal = filas.reduce((s, f) => s + (Number(f.no_fiscal) || 0), 0);

    return { anio, mes, filas, total_fiscal, total_no_fiscal };
  }
}
