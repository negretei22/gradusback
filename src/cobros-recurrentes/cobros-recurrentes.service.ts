import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CobroRecurrente } from './cobro-recurrente.entity';
import { CobroRecurrenteFactura } from './cobro-recurrente-factura.entity';
import { CobroRecurrentePago } from './cobro-recurrente-pago.entity';
import { CobroRecurrenteSeleccion } from './cobro-recurrente-seleccion.entity';
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

// Factura ligada a un cobro recurrente (v4), con los datos del movimiento.
export interface FacturaLigada {
  id: number;
  concepto: string;
  razon_social: string | null;
  importe_sin_iva: number;
  folio_fiscal: string | null;
}

@Injectable()
export class CobrosRecurrentesService {
  constructor(
    @InjectRepository(CobroRecurrente)
    private readonly cobrosRepo: Repository<CobroRecurrente>,
    @InjectRepository(CobroRecurrenteFactura)
    private readonly facturasRepo: Repository<CobroRecurrenteFactura>,
    @InjectRepository(CobroRecurrentePago)
    private readonly pagadosRepo: Repository<CobroRecurrentePago>,
    @InjectRepository(CobroRecurrenteSeleccion)
    private readonly seleccionRepo: Repository<CobroRecurrenteSeleccion>,
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
        throw new BadRequestException('El día de cobro debe ser entre 1 y 31');
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

  private limpiar(payload: any): Partial<CobroRecurrente> {
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

  // Reemplaza los links de facturas de un cobro por la lista dada.
  private async guardarFacturas(cobroId: number, ids: number[]): Promise<void> {
    await this.facturasRepo.delete({ cobro_recurrente_id: cobroId });
    if (ids.length === 0) return;
    const links = ids.map((movimiento_id) =>
      this.facturasRepo.create({ cobro_recurrente_id: cobroId, movimiento_id }),
    );
    await this.facturasRepo.save(links);
  }

  // Facturas ligadas de varios cobros: mapa cobroId -> [factura, ...].
  // Solo trae las que aún existen en movimientos_financieros.
  private async cargarFacturas(
    cobroIds: number[],
  ): Promise<Map<number, FacturaLigada[]>> {
    const mapa = new Map<number, FacturaLigada[]>();
    for (const id of cobroIds) mapa.set(id, []);
    if (cobroIds.length === 0) return mapa;

    const marcadores = cobroIds.map(() => '?').join(',');
    const filas: any[] = await this.facturasRepo.query(
      `SELECT f.cobro_recurrente_id, m.id, m.concepto, m.razon_social,
              m.importe_sin_iva, m.folio_fiscal
         FROM cobros_recurrentes_facturas f
         JOIN movimientos_financieros m ON m.id = f.movimiento_id
        WHERE f.cobro_recurrente_id IN (${marcadores})
        ORDER BY f.id ASC`,
      cobroIds,
    );
    for (const fila of filas) {
      mapa.get(fila.cobro_recurrente_id)?.push({
        id: fila.id,
        concepto: fila.concepto,
        razon_social: fila.razon_social,
        importe_sin_iva: Number(fila.importe_sin_iva) || 0,
        folio_fiscal: fila.folio_fiscal ?? null,
      });
    }
    return mapa;
  }

  private async conFacturas(cobro: CobroRecurrente) {
    const mapa = await this.cargarFacturas([cobro.id]);
    return { ...cobro, facturas: mapa.get(cobro.id) ?? [] };
  }

  private async buscarCobro(id: number): Promise<CobroRecurrente> {
    const cobro = await this.cobrosRepo.findOne({ where: { id, activo: 1 } });
    if (!cobro) {
      throw new NotFoundException('Cobro recurrente no encontrado');
    }
    return cobro;
  }

  // ---------- CRUD ----------

  async findAll() {
    const cobros = await this.cobrosRepo.find({
      where: { activo: 1 },
      order: { id: 'ASC' },
    });
    const mapa = await this.cargarFacturas(cobros.map((p) => p.id));
    return cobros.map((p) => ({ ...p, facturas: mapa.get(p.id) ?? [] }));
  }

  async findOne(id: number) {
    return this.conFacturas(await this.buscarCobro(id));
  }

  async create(payload: any) {
    this.validar(payload);
    const datos = this.limpiar(payload);
    const ids = this.facturaIds(payload);
    if (ids !== undefined) {
      // Compatibilidad: movimiento_id guarda el primer id ligado (o null).
      datos.movimiento_id = ids[0] ?? null;
    }
    const cobro = await this.cobrosRepo.save(this.cobrosRepo.create(datos));
    if (ids !== undefined) {
      await this.guardarFacturas(cobro.id, ids);
    }
    return this.conFacturas(cobro);
  }

  async update(id: number, payload: any) {
    const cobro = await this.buscarCobro(id);
    this.validar({ ...cobro, ...payload });
    const datos = this.limpiar({ ...cobro, ...payload });
    const ids = this.facturaIds(payload);
    if (ids !== undefined) {
      datos.movimiento_id = ids[0] ?? null;
    }
    Object.assign(cobro, datos);
    const guardado = await this.cobrosRepo.save(cobro);
    if (ids !== undefined) {
      await this.guardarFacturas(guardado.id, ids);
    }
    return this.conFacturas(guardado);
  }

  // Soft delete: activo = 0.
  async remove(id: number): Promise<{ ok: boolean }> {
    const cobro = await this.buscarCobro(id);
    cobro.activo = 0;
    await this.cobrosRepo.save(cobro);
    return { ok: true };
  }

  // ---------- Pagado manual del reporte (v5) ----------

  // UPSERT del override de pagado para un cobro recurrente en un mes: si
  // existe el renglón (cobro_recurrente_id, anio, mes) lo actualiza, si no
  // lo crea. El override siempre se guarda (true -> 1, false -> 0),
  // nunca se borra: el reporte lo prefiere sobre el pagado derivado.
  async setCobrado(
    id: number,
    payload: any,
  ): Promise<{ ok: boolean; pagado: boolean }> {
    const cobro = await this.buscarCobro(id);
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
      where: { cobro_recurrente_id: cobro.id, anio, mes },
    });
    if (existente) {
      existente.pagado = valor;
      await this.pagadosRepo.save(existente);
    } else {
      await this.pagadosRepo.save(
        this.pagadosRepo.create({
          cobro_recurrente_id: cobro.id,
          anio,
          mes,
          pagado: valor,
        }),
      );
    }
    return { ok: true, pagado: valor === 1 };
  }

  // ---------- Selección guardada de extras (v13) ----------

  private validarAnioMes(anio: any, mes: any): { anio: number; mes: number } {
    const a = Number(anio);
    const m = Number(mes);
    if (!Number.isInteger(a) || a < 1900 || a > 2100) {
      throw new BadRequestException('Año inválido');
    }
    if (!Number.isInteger(m) || m < 1 || m > 12) {
      throw new BadRequestException('Mes inválido (1-12)');
    }
    return { anio: a, mes: m };
  }

  private validarIncluido(payload: any): number {
    if (
      payload.incluido !== true &&
      payload.incluido !== false &&
      payload.incluido !== 1 &&
      payload.incluido !== 0
    ) {
      throw new BadRequestException('El campo incluido debe ser booleano');
    }
    return payload.incluido ? 1 : 0;
  }

  // UPSERT de la selección de una extra del mes: si existe el renglón
  // (anio, mes, movimiento_id) lo actualiza, si no lo crea. Sin renglón,
  // la extra se considera incluida (default true, ver reporte()).
  async setSeleccion(
    payload: any,
  ): Promise<{ ok: boolean; incluido: boolean }> {
    const { anio, mes } = this.validarAnioMes(payload.anio, payload.mes);
    const movimiento_id = Number(payload.movimiento_id);
    if (!Number.isInteger(movimiento_id) || movimiento_id <= 0) {
      throw new BadRequestException('movimiento_id inválido');
    }
    const valor = this.validarIncluido(payload);
    const existente = await this.seleccionRepo.findOne({
      where: { anio, mes, movimiento_id },
    });
    if (existente) {
      existente.incluido = valor;
      await this.seleccionRepo.save(existente);
    } else {
      await this.seleccionRepo.save(
        this.seleccionRepo.create({ anio, mes, movimiento_id, incluido: valor }),
      );
    }
    return { ok: true, incluido: valor === 1 };
  }

  // Selección masiva del mes (Todas/Ninguna): aplica el valor a TODAS las
  // extras del mes — las que reporte() devuelve con origen 'factura' — con
  // un upsert por cada movimiento_id. Las recurrentes no se tocan.
  async setSeleccionMes(
    payload: any,
  ): Promise<{ ok: boolean; incluido: boolean; total: number }> {
    const { anio, mes } = this.validarAnioMes(payload.anio, payload.mes);
    const valor = this.validarIncluido(payload);
    const rep = await this.reporte(anio, mes);
    const extras = rep.filas.filter((f: any) => f.origen === 'factura');
    for (const ex of extras) {
      const movimiento_id = ex.movimiento_id as number;
      const existente = await this.seleccionRepo.findOne({
        where: { anio, mes, movimiento_id },
      });
      if (existente) {
        existente.incluido = valor;
        await this.seleccionRepo.save(existente);
      } else {
        await this.seleccionRepo.save(
          this.seleccionRepo.create({ anio, mes, movimiento_id, incluido: valor }),
        );
      }
    }
    return { ok: true, incluido: valor === 1, total: extras.length };
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
        WHERE m.tipo_movimiento_id = '1'
          AND (m.concepto LIKE ? OR m.razon_social LIKE ? OR m.folio_fiscal LIKE ?)
        ORDER BY m.fecha_factura DESC
        LIMIT 20`,
      [like, like, like],
    );
  }

  // ---------- Reporte mensual ("Programación del Ingreso") ----------

  async reporte(anio: number, mes: number) {
    if (!Number.isInteger(anio) || anio < 1900 || anio > 2100) {
      throw new BadRequestException('Año inválido');
    }
    if (!Number.isInteger(mes) || mes < 1 || mes > 12) {
      throw new BadRequestException('Mes inválido (1-12)');
    }

    const hoy = hoyLocal();
    const mesPad = String(mes).padStart(2, '0');

    // Movimientos del mes (ingresos, tipo '1') por fecha efectiva, igual que Finanzas.
    // DATE_FORMAT deja fecha_pago como string 'YYYY-MM-DD' o null: la
    // comparación con hoy es lexicográfica y no pasa por new Date().
    const movimientos: MovimientoMes[] = await this.movimientosRepo.query(
      `SELECT m.id, m.concepto, m.razon_social, m.gran_total,
              m.importe_sin_iva,
              DATE_FORMAT(m.fecha_pago, '%Y-%m-%d') AS fecha_pago
         FROM movimientos_financieros m
        WHERE m.tipo_movimiento_id = '1'
          AND YEAR(${FECHA_EFECTIVA}) = ?
          AND MONTH(${FECHA_EFECTIVA}) = ?
        ORDER BY m.fecha_pago ASC, m.concepto ASC`,
      [anio, mes],
    );

    const recurrentes = await this.cobrosRepo.find({
      where: { activo: 1 },
      order: { concepto: 'ASC' },
    });

    // Facturas ligadas a cada recurrente (v4): el matching se hace contra
    // cualquiera de ellas; sin ligadas, se casa por concepto+beneficiario
    // del propio recurrente (comportamiento v3). La regla por monto (v7)
    // compara además contra el fiscal guardado del recurrente o el de
    // cualquiera de sus facturas ligadas (ver casaCon).
    const facturasPorCobro = await this.cargarFacturas(
      recurrentes.map((r) => r.id),
    );

    const consumidos = new Set<number>();
    const filas: any[] = [];

    // Overrides manuales de pagado (v5) para este (anio, mes): mapa
    // cobro_recurrente_id -> pagado. Si existe, manda sobre el derivado.
    const overrides = new Map<number, boolean>();
    const renglonesPagado: CobroRecurrentePago[] =
      await this.pagadosRepo.find({ where: { anio, mes } });
    for (const r of renglonesPagado) {
      overrides.set(r.cobro_recurrente_id, r.pagado === 1);
    }

    // Selección guardada de extras (v13) para este (anio, mes): mapa
    // movimiento_id -> incluido. Sin renglón, la extra va incluida.
    const seleccion = new Map<number, boolean>();
    const renglonesSeleccion: CobroRecurrenteSeleccion[] =
      await this.seleccionRepo.find({ where: { anio, mes } });
    for (const r of renglonesSeleccion) {
      seleccion.set(r.movimiento_id, r.incluido === 1);
    }

    const casaCon = (rec: CobroRecurrente, mov: MovimientoMes): boolean => {
      const ligadas = facturasPorCobro.get(rec.id) ?? [];

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

      // Override manual (v5): si existe renglón para este cobro en este
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
        cobro_recurrente_id: rec.id,
        dia_pago: rec.dia_pago ?? null,
        concepto: rec.concepto,
        beneficiario: rec.beneficiario,
        fiscal,
        no_fiscal: Number(rec.no_fiscal) || 0,
        fecha_pago: pagado && fechaMaxima ? fechaMaxima : fechaProgramada,
        pagado,
        // Facturas ligadas con folio_fiscal (v13): el front arma el FOLIO
        // del Excel combinado uniendo los folio_fiscal con " y ".
        facturas: facturasPorCobro.get(rec.id) ?? [],
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
        incluido: seleccion.has(mov.id) ? seleccion.get(mov.id)! : true,
      });
    }

    // Orden (v11): MEZCLA — base de recurrentes por cobro_recurrente_id ASC;
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
      .sort((a, b) => a.cobro_recurrente_id - b.cobro_recurrente_id);
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
