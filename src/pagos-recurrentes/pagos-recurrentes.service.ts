import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PagoRecurrente } from './pago-recurrente.entity';
import { PagoRecurrenteFactura } from './pago-recurrente-factura.entity';
import { PagoRecurrentePago } from './pago-recurrente-pago.entity';
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

// Factura ligada a un pago recurrente (v4), con los datos del movimiento.
export interface FacturaLigada {
  id: number;
  concepto: string;
  razon_social: string | null;
  importe_sin_iva: number;
}

@Injectable()
export class PagosRecurrentesService {
  constructor(
    @InjectRepository(PagoRecurrente)
    private readonly pagosRepo: Repository<PagoRecurrente>,
    @InjectRepository(PagoRecurrenteFactura)
    private readonly facturasRepo: Repository<PagoRecurrenteFactura>,
    @InjectRepository(PagoRecurrentePago)
    private readonly pagadosRepo: Repository<PagoRecurrentePago>,
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
      monto_factura:
        payload.monto_factura === false || payload.monto_factura === 0 ? 0 : 1,
      movimiento_id:
        payload.movimiento_id === null ||
        payload.movimiento_id === undefined ||
        payload.movimiento_id === ''
          ? null
          : Number(payload.movimiento_id),
    };
  }

  // ---------- Facturas ligadas (v4) ----------

  // factura_ids del payload: lista de ids válidos sin duplicados, o
  // undefined si el payload no trae el campo (no tocar los links).
  private facturaIds(payload: any): number[] | undefined {
    const ids = payload.factura_ids;
    if (ids === undefined || ids === null) return undefined;
    if (!Array.isArray(ids)) return undefined;
    return [
      ...new Set(
        ids.map(Number).filter((n) => Number.isInteger(n) && n > 0),
      ),
    ];
  }

  // Reemplaza los links de facturas de un pago por la lista dada.
  private async guardarFacturas(pagoId: number, ids: number[]): Promise<void> {
    await this.facturasRepo.delete({ pago_recurrente_id: pagoId });
    if (ids.length === 0) return;
    const links = ids.map((movimiento_id) =>
      this.facturasRepo.create({ pago_recurrente_id: pagoId, movimiento_id }),
    );
    await this.facturasRepo.save(links);
  }

  // Facturas ligadas de varios pagos: mapa pagoId -> [factura, ...].
  // Solo trae las que aún existen en movimientos_financieros.
  private async cargarFacturas(
    pagoIds: number[],
  ): Promise<Map<number, FacturaLigada[]>> {
    const mapa = new Map<number, FacturaLigada[]>();
    for (const id of pagoIds) mapa.set(id, []);
    if (pagoIds.length === 0) return mapa;

    const marcadores = pagoIds.map(() => '?').join(',');
    const filas: any[] = await this.facturasRepo.query(
      `SELECT f.pago_recurrente_id, m.id, m.concepto, m.razon_social,
              m.importe_sin_iva
         FROM pagos_recurrentes_facturas f
         JOIN movimientos_financieros m ON m.id = f.movimiento_id
        WHERE f.pago_recurrente_id IN (${marcadores})
        ORDER BY f.id ASC`,
      pagoIds,
    );
    for (const fila of filas) {
      mapa.get(fila.pago_recurrente_id)?.push({
        id: fila.id,
        concepto: fila.concepto,
        razon_social: fila.razon_social,
        importe_sin_iva: Number(fila.importe_sin_iva) || 0,
      });
    }
    return mapa;
  }

  private async conFacturas(pago: PagoRecurrente) {
    const mapa = await this.cargarFacturas([pago.id]);
    return { ...pago, facturas: mapa.get(pago.id) ?? [] };
  }

  private async buscarPago(id: number): Promise<PagoRecurrente> {
    const pago = await this.pagosRepo.findOne({ where: { id, activo: 1 } });
    if (!pago) {
      throw new NotFoundException('Pago recurrente no encontrado');
    }
    return pago;
  }

  // ---------- CRUD ----------

  async findAll() {
    const pagos = await this.pagosRepo.find({
      where: { activo: 1 },
      order: { id: 'ASC' },
    });
    const mapa = await this.cargarFacturas(pagos.map((p) => p.id));
    return pagos.map((p) => ({ ...p, facturas: mapa.get(p.id) ?? [] }));
  }

  async findOne(id: number) {
    return this.conFacturas(await this.buscarPago(id));
  }

  async create(payload: any) {
    this.validar(payload);
    const datos = this.limpiar(payload);
    const ids = this.facturaIds(payload);
    if (ids !== undefined) {
      // Compatibilidad: movimiento_id guarda el primer id ligado (o null).
      datos.movimiento_id = ids[0] ?? null;
    }
    const pago = await this.pagosRepo.save(this.pagosRepo.create(datos));
    if (ids !== undefined) {
      await this.guardarFacturas(pago.id, ids);
    }
    return this.conFacturas(pago);
  }

  async update(id: number, payload: any) {
    const pago = await this.buscarPago(id);
    this.validar({ ...pago, ...payload });
    const datos = this.limpiar({ ...pago, ...payload });
    const ids = this.facturaIds(payload);
    if (ids !== undefined) {
      datos.movimiento_id = ids[0] ?? null;
    }
    Object.assign(pago, datos);
    const guardado = await this.pagosRepo.save(pago);
    if (ids !== undefined) {
      await this.guardarFacturas(guardado.id, ids);
    }
    return this.conFacturas(guardado);
  }

  // Soft delete: activo = 0.
  async remove(id: number): Promise<{ ok: boolean }> {
    const pago = await this.buscarPago(id);
    pago.activo = 0;
    await this.pagosRepo.save(pago);
    return { ok: true };
  }

  // ---------- Pagado manual del reporte (v5) ----------

  // UPSERT del override de pagado para un pago recurrente en un mes: si
  // existe el renglón (pago_recurrente_id, anio, mes) lo actualiza, si no
  // lo crea. El override siempre se guarda (true -> 1, false -> 0),
  // nunca se borra: el reporte lo prefiere sobre el pagado derivado.
  async setPagado(
    id: number,
    payload: any,
  ): Promise<{ ok: boolean; pagado: boolean }> {
    const pago = await this.buscarPago(id);
    const anio = Number(payload.anio);
    const mes = Number(payload.mes);
    if (!Number.isInteger(anio) || anio < 1900 || anio > 2100) {
      throw new BadRequestException('Año inválido');
    }
    if (!Number.isInteger(mes) || mes < 1 || mes > 12) {
      throw new BadRequestException('Mes inválido (1-12)');
    }
    if (
      payload.pagado !== true &&
      payload.pagado !== false &&
      payload.pagado !== 1 &&
      payload.pagado !== 0
    ) {
      throw new BadRequestException('El campo pagado debe ser booleano');
    }
    const valor = payload.pagado ? 1 : 0;
    const existente = await this.pagadosRepo.findOne({
      where: { pago_recurrente_id: pago.id, anio, mes },
    });
    if (existente) {
      existente.pagado = valor;
      await this.pagadosRepo.save(existente);
    } else {
      await this.pagadosRepo.save(
        this.pagadosRepo.create({
          pago_recurrente_id: pago.id,
          anio,
          mes,
          pagado: valor,
        }),
      );
    }
    return { ok: true, pagado: valor === 1 };
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

    // Facturas ligadas a cada recurrente (v4): el matching se hace contra
    // cualquiera de ellas; sin ligadas, se casa por concepto+beneficiario
    // del propio recurrente (comportamiento v3). La regla por monto (v7)
    // compara además contra el fiscal guardado del recurrente o el de
    // cualquiera de sus facturas ligadas (ver casaCon).
    const facturasPorPago = await this.cargarFacturas(
      recurrentes.map((r) => r.id),
    );

    const consumidos = new Set<number>();
    const filas: any[] = [];

    // Overrides manuales de pagado (v5) para este (anio, mes): mapa
    // pago_recurrente_id -> pagado. Si existe, manda sobre el derivado.
    const overrides = new Map<number, boolean>();
    const renglonesPagado: PagoRecurrentePago[] =
      await this.pagadosRepo.find({ where: { anio, mes } });
    for (const r of renglonesPagado) {
      overrides.set(r.pago_recurrente_id, r.pagado === 1);
    }

    const casaCon = (rec: PagoRecurrente, mov: MovimientoMes): boolean => {
      const ligadas = facturasPorPago.get(rec.id) ?? [];

      // (a) Cruce por concepto+beneficiario, como hasta hoy: contra
      // cualquiera de sus facturas ligadas, o contra el propio recurrente
      // cuando no tiene ligadas.
      const casaPorConcepto = (): boolean => {
        if (ligadas.length > 0) {
          return ligadas.some((f) => {
            if (normalizar(f.concepto) !== normalizar(mov.concepto)) return false;
            const razon = normalizar(f.razon_social);
            if (!razon) return true; // factura sin razón social: solo importa el concepto
            return razon === normalizar(mov.razon_social);
          });
        }
        if (normalizar(rec.concepto) !== normalizar(mov.concepto)) return false;
        const beneficiario = normalizar(rec.beneficiario);
        if (!beneficiario) return true; // sin beneficiario: solo importa el concepto
        return beneficiario === normalizar(mov.razon_social);
      };
      if (casaPorConcepto()) return true;

      // (b) Cruce por MONTO (v7): mismo beneficiario normalizado (NO vacío
      // en ninguno de los dos lados) Y mismo importe_sin_iva que el fiscal
      // guardado del recurrente o el de cualquiera de sus facturas ligadas
      // (tolerancia $0.01 por ruido de flotantes). Nunca casa solo por
      // monto: sin beneficiario en algún lado no hay cruce.
      const beneficiario = normalizar(rec.beneficiario);
      const razonMov = normalizar(mov.razon_social);
      if (!beneficiario || !razonMov || beneficiario !== razonMov) return false;
      const importeMov = Number(mov.importe_sin_iva) || 0;
      const montos = [
        Number(rec.fiscal) || 0,
        ...ligadas.map((f) => Number(f.importe_sin_iva) || 0),
      ];
      return montos.some((monto) => Math.abs(importeMov - monto) < 0.01);
    };

    const estaPagado = (mov: MovimientoMes): boolean =>
      mov.fecha_pago !== null && mov.fecha_pago <= hoy;

    for (const rec of recurrentes) {
      // Se consumen TODOS los movimientos casados del mes (v4), para que
      // ninguno aparezca también como extra.
      const casados = movimientos.filter(
        (m) => !consumidos.has(m.id) && casaCon(rec, m),
      );
      for (const m of casados) consumidos.add(m.id);

      const fechaProgramada =
        rec.dia_pago !== null && rec.dia_pago !== undefined
          ? `${anio}-${mesPad}-${String(rec.dia_pago).padStart(2, '0')}`
          : 'Por definir';

      // Pagado derivado: hay al menos un casado Y todos tienen fecha_pago <= hoy.
      const pagadoDerivado =
        casados.length > 0 && casados.every((m) => estaPagado(m));

      // Override manual (v5): si existe renglón para este pago en este
      // (anio, mes), ese valor MANDA sobre el derivado.
      const pagado = overrides.has(rec.id)
        ? overrides.get(rec.id)!
        : pagadoDerivado;

      // Fecha mostrada: la fecha_pago máxima entre los casados cuando está
      // pagado; si no, la programada. Con override en true y sin casados
      // no hay fecha máxima: se muestra la programada.
      const fechaMaxima =
        pagado && casados.length > 0
          ? casados.reduce(
              (max, m) => (m.fecha_pago! > max ? m.fecha_pago! : max),
              casados[0].fecha_pago!,
            )
          : null;

      // Monto de las facturas del mes: con monto_factura=1, la SUMA del
      // importe_sin_iva de los movimientos casados; si aún no hay casados,
      // el guardado es respaldo. Con monto_factura=0, el guardado.
      const fiscal =
        rec.monto_factura === 1
          ? casados.length > 0
            ? casados.reduce((s, m) => s + (Number(m.importe_sin_iva) || 0), 0)
            : Number(rec.fiscal) || 0
          : Number(rec.fiscal) || 0;

      filas.push({
        origen: 'recurrente',
        id: rec.id,
        pago_recurrente_id: rec.id,
        dia_pago: rec.dia_pago ?? null,
        concepto: rec.concepto,
        beneficiario: rec.beneficiario,
        fiscal,
        no_fiscal: Number(rec.no_fiscal) || 0,
        fecha_pago: pagado && fechaMaxima ? fechaMaxima : fechaProgramada,
        pagado,
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

    // Orden (v11): MEZCLA — base de recurrentes por pago_recurrente_id ASC;
    // cada extra se inserta antes del primer recurrente cuya fecha efectiva
    // sea ESTRICTAMENTE MAYOR que la de la extra (en empate va primero el
    // recurrente). 'Por definir' (sin fecha) cuenta como infinito: los
    // recurrentes sin fecha quedan al final de la base y las extras sin
    // fecha al final de todo, en orden de concepto. La fecha efectiva es
    // la misma que se muestra en la columna Fecha (fila.fecha_pago), así
    // que el orden y lo mostrado coinciden en las dos secciones.
    const fechaEfectiva = (f: any): string | null =>
      f.fecha_pago === 'Por definir' || f.fecha_pago == null
        ? null
        : f.fecha_pago;
    const recurrentesOrdenados = filas
      .filter((f) => f.origen === 'recurrente')
      .sort((a, b) => a.pago_recurrente_id - b.pago_recurrente_id);
    const extrasOrdenadas = filas
      .filter((f) => f.origen !== 'recurrente')
      .sort((a, b) => {
        const fa = fechaEfectiva(a);
        const fb = fechaEfectiva(b);
        if (!fa && !fb)
          return (a.concepto || '').localeCompare(b.concepto || '');
        if (!fa) return 1;
        if (!fb) return -1;
        if (fa !== fb) return fa < fb ? -1 : 1;
        return (a.concepto || '').localeCompare(b.concepto || '');
      });
    const mezcladas: any[] = [...recurrentesOrdenados];
    for (const ex of extrasOrdenadas) {
      const fe = fechaEfectiva(ex);
      let idx = mezcladas.length;
      if (fe !== null) {
        const i = mezcladas.findIndex((f) => {
          const fd = fechaEfectiva(f);
          return fd === null || fd > fe;
        });
        if (i !== -1) idx = i;
      }
      mezcladas.splice(idx, 0, ex);
    }
    filas.length = 0;
    filas.push(...mezcladas);

    const total_fiscal = filas.reduce((s, f) => s + (Number(f.fiscal) || 0), 0);
    const total_no_fiscal = filas.reduce((s, f) => s + (Number(f.no_fiscal) || 0), 0);

    return { anio, mes, filas, total_fiscal, total_no_fiscal };
  }
}
