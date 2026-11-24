import { ConflictException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { Marcas } from './marcas.entity';
import { Modelos } from './modelos.entity';
import { ArrendadoresMaquinaria } from './arrendadores_maquinaria.entity';
import { Maquinaria } from './maquinaria.entity';
import { TiposMaquinaria } from './tipos-maquinaria.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm/repository/Repository';
import * as fs from 'fs';
import { join } from 'path';



@Injectable()
export class MaquinariaService implements OnModuleInit {
    // Catálogo de tipos de maquinaria (orden pedido por Ivo)
    private static readonly TIPOS_MAQUINARIA_SEMILLA = [
        'AUTOTANQUE',
        'EXCAVADORA',
        'MOTOCONFORMADORA',
        'PIPA',
        'TRACTOCAMION',
        'PICKUP',
        'VIBROCOMPACTADOR',
    ];

    constructor(
        @InjectRepository(Marcas)
        private marcasRepo: Repository<Marcas>,
        @InjectRepository(Modelos)
        private modelosRepo: Repository<Modelos>,
        @InjectRepository(ArrendadoresMaquinaria)
        private arrendadoresMaquinariaRepo: Repository<ArrendadoresMaquinaria>,
        @InjectRepository(Maquinaria)
        private maquinariaRepo: Repository<Maquinaria>,
        @InjectRepository(TiposMaquinaria)
        private tiposMaquinariaRepo: Repository<TiposMaquinaria>,

    ) { }

    // Siembra el catálogo de tipos de maquinaria la primera vez que arranca el back
    async onModuleInit() {
        const conteo = await this.tiposMaquinariaRepo.count();
        if (conteo === 0) {
            await this.tiposMaquinariaRepo.save(
                MaquinariaService.TIPOS_MAQUINARIA_SEMILLA.map((nombre) => ({ nombre })),
            );
        }
    }

    getTiposMaquinaria(): Promise<TiposMaquinaria[]> {
        return this.tiposMaquinariaRepo.find({
            order: {
                id_tipo_maquinaria: 'ASC'
            }
        });
    }


    async findMaquinaria() {
        const lista = await this.maquinariaRepo
            .createQueryBuilder('a')
            .leftJoin('marcas', 'b', 'a.id_marca = b.id_marca')
            .leftJoin('modelos', 'm', 'a.id_modelo = m.id_modelo')
            .leftJoin('tipos_maquinaria', 't', 'a.tipo_maquinaria_id = t.id_tipo_maquinaria')

            .select([
                'a.*',
                'b.marca', // cambia nombre por tu campo real
                'm.modelo',
                't.nombre AS tipo_maquinaria',

                `CASE 
        WHEN a.id_tipo_de_adquisicion = 1 THEN 'PROPIO'
        WHEN a.id_tipo_de_adquisicion = 2 THEN 'LEASING'
        WHEN a.id_tipo_de_adquisicion = 3 THEN 'ARRENDADA'
        ELSE 'DESCONOCIDO'
      END AS tipo_adquisicion`,

                `IF(a.id_tipo_de_adquisicion < 3, a.valor_compra, a.monto_renta_mensual) AS monto`
            ])
            .getRawMany();

        // ===== ÚLTIMO SERVICIO POR ACTIVO (el más reciente por fecha; desempate: id mayor) =====
        // Una sola consulta: por cada activo, el servicio con la fecha máxima y, entre esos, el id mayor.
        const ultimos: any[] = await this.maquinariaRepo.query(`
            SELECT s.id_activo, s.fecha_servicio, s.responsable, s.unidad_servicio,
                   s.horometro_servicio, s.kilometraje, s.servicio_programado, s.comentarios
            FROM servicio s
            WHERE s.id_servicio IN (
                SELECT MAX(s2.id_servicio)
                FROM servicio s2
                WHERE s2.fecha_servicio = (
                    SELECT MAX(s3.fecha_servicio) FROM servicio s3 WHERE s3.id_activo = s2.id_activo
                )
                GROUP BY s2.id_activo
            )
        `);
        const porActivo = new Map<number, any>();
        for (const u of ultimos) porActivo.set(Number(u.id_activo), u);

        return lista.map((c: any) => {
            const u = porActivo.get(Number(c.id_maquinaria));
            return {
                ...c,
                ultimo_servicio_programado: u?.servicio_programado ?? null,
                ultimo_comentarios: u?.comentarios ?? null,
                ultimo_fecha_servicio: u?.fecha_servicio ?? null,
                ultimo_unidad_servicio: u?.unidad_servicio ?? null,
                ultimo_horometro_servicio: u?.horometro_servicio ?? null,
                ultimo_kilometraje: u?.kilometraje ?? null,
                ultimo_responsable: u?.responsable ?? null,
            };
        });
    }

    getMarcas(): Promise<Marcas[]> {
        console.log('test')
        return this.marcasRepo.find({
            order: {
                marca: 'ASC'
            }
        });
    }

    getArrendadoresMaquinaria(): Promise<ArrendadoresMaquinaria[]> {
        console.log('test2')
        return this.arrendadoresMaquinariaRepo.find();
    }

    getModelos(id_marca: any): Promise<Modelos[]> {
        return this.modelosRepo.find({
            where: { id_marca }
        });
    }

    async saveMaquinaria(payload: any) {
        payload.numero_de_contrato = (payload.numero_de_contrato || '').trim() || null;
        if (payload.fecha_inicio_poliza === '') payload.fecha_inicio_poliza = null;
        if (payload.fecha_fin_poliza === '') payload.fecha_fin_poliza = null;
        if (payload.documento_poliza === '') payload.documento_poliza = null;
        this.normalizarTipoMaquinaria(payload);
        //  console.log(payload)
        const existe = await this.maquinariaRepo.findOne({
            where: { numero_serie: payload.numero_serie }
        });

        if (existe) {
            throw new ConflictException({ message: 'Número de serie duplicado', numero_serie: payload.numero_serie });
        }

        const contrato = this.maquinariaRepo.create(payload);
        return await this.maquinariaRepo.save(contrato);
    }

    async updateMaquinaria(payload: any) {
        console.log(payload);

        const { id_maquinaria, ...data } = payload;

        if ('numero_de_contrato' in data) {
            data.numero_de_contrato = (data.numero_de_contrato || '').trim() || null;
        }

        if (data.fecha_inicio_poliza === '') data.fecha_inicio_poliza = null;
        if (data.fecha_fin_poliza === '') data.fecha_fin_poliza = null;
        if (data.documento_poliza === '') data.documento_poliza = null;
        this.normalizarTipoMaquinaria(data);

        const maquinaria = await this.maquinariaRepo.findOne({
            where: { id_maquinaria }
        });

        if (!maquinaria) {
            throw new NotFoundException({ message: 'Maquinaria no encontrada' });
        }

        // ===== ELIMINAR PDF DE PÓLIZA VIEJO SI SE REEMPLAZÓ O SE QUITÓ =====
        if ('documento_poliza' in data && maquinaria.documento_poliza && data.documento_poliza !== maquinaria.documento_poliza) {
            // El PDF viejo vive en la carpeta del número de serie anterior
            const rutaPolizaVieja = join(process.cwd(), 'uploads', 'activos', maquinaria.numero_serie, maquinaria.documento_poliza);
            try {
                if (fs.existsSync(rutaPolizaVieja)) {
                    fs.unlinkSync(rutaPolizaVieja);
                    console.log('PDF de póliza viejo eliminado:', rutaPolizaVieja);
                }
            } catch (err) {
                console.error(`Error eliminando PDF de póliza ${maquinaria.documento_poliza}:`, err);
            }
        }

        if (data.numero_serie && data.numero_serie !== maquinaria.numero_serie) {
            const existe = await this.maquinariaRepo.findOne({
                where: { numero_serie: data.numero_serie }
            });

            if (existe) {
                throw new ConflictException({ message: 'Número de serie duplicado', numero_serie: data.numero_serie });
            }
        }

        // ===== LIMPIEZA DE ARCHIVOS HUÉRFANOS =====
        const documentosViejos: string[] = this.parseDocumentos(maquinaria.documentos);
        const documentosNuevos: string[] = this.parseDocumentos(data.documentos);

        const documentosEliminados = documentosViejos.filter(d => !documentosNuevos.includes(d));

        for (const nombre of documentosEliminados) {
            const rutaArchivo = join(process.cwd(), 'uploads', 'activos', data.numero_serie, nombre);
            try {
                if (fs.existsSync(rutaArchivo)) {
                    fs.unlinkSync(rutaArchivo);
                    console.log('Archivo huérfano eliminado:', rutaArchivo);
                }
            } catch (err) {
                console.error(`Error eliminando archivo huérfano ${nombre}:`, err);
            }
        }

        this.maquinariaRepo.merge(maquinaria, data);
        return await this.maquinariaRepo.save(maquinaria);
    }

    // ===== PÓLIZA DE SEGURO (solo actualiza los datos de la póliza) =====
    async updatePoliza(payload: any) {
        const { id_maquinaria, ...data } = payload;

        if (data.fecha_inicio_poliza === '') data.fecha_inicio_poliza = null;
        if (data.fecha_fin_poliza === '') data.fecha_fin_poliza = null;
        if (data.documento_poliza === '') data.documento_poliza = null;

        const maquinaria = await this.maquinariaRepo.findOne({
            where: { id_maquinaria }
        });

        if (!maquinaria) {
            throw new NotFoundException({ message: 'Maquinaria no encontrada' });
        }

        // ===== ELIMINAR PDF DE PÓLIZA VIEJO SI SE REEMPLAZÓ O SE QUITÓ =====
        if ('documento_poliza' in data && maquinaria.documento_poliza && data.documento_poliza !== maquinaria.documento_poliza) {
            const rutaPolizaVieja = join(process.cwd(), 'uploads', 'activos', maquinaria.numero_serie, maquinaria.documento_poliza);
            try {
                if (fs.existsSync(rutaPolizaVieja)) {
                    fs.unlinkSync(rutaPolizaVieja);
                    console.log('PDF de póliza viejo eliminado:', rutaPolizaVieja);
                }
            } catch (err) {
                console.error(`Error eliminando PDF de póliza ${maquinaria.documento_poliza}:`, err);
            }
        }

        // Solo se tocan los campos de la póliza; el resto del activo no se modifica
        const cambios: any = {};
        if ('aseguradora' in data) cambios.aseguradora = (data.aseguradora || '').trim().toUpperCase() || null;
        if ('numero_poliza' in data) cambios.numero_poliza = (data.numero_poliza || '').trim().toUpperCase() || null;
        if ('fecha_inicio_poliza' in data) cambios.fecha_inicio_poliza = data.fecha_inicio_poliza;
        if ('fecha_fin_poliza' in data) cambios.fecha_fin_poliza = data.fecha_fin_poliza;
        if ('documento_poliza' in data) cambios.documento_poliza = data.documento_poliza;
        if ('costo_poliza' in data) cambios.costo_poliza = (data.costo_poliza || '').trim() || null;

        this.maquinariaRepo.merge(maquinaria, cambios);
        return await this.maquinariaRepo.save(maquinaria);
    }

    async deleteMaquinaria(id_maquinaria: number) {
        console.log(id_maquinaria);

        const maquinaria = await this.maquinariaRepo.findOne({
            where: { id_maquinaria }
        });

        if (!maquinaria) {
            throw new NotFoundException({ message: 'Maquinaria no encontrada' });
        }

        const nombresArchivos = this.parseDocumentos(maquinaria.documentos);

        if (maquinaria.documento_poliza) {
            const rutaPoliza = join(process.cwd(), 'uploads', 'activos', maquinaria.numero_serie, maquinaria.documento_poliza);
            try {
                if (fs.existsSync(rutaPoliza)) {
                    fs.unlinkSync(rutaPoliza);
                    console.log('PDF de póliza eliminado:', rutaPoliza);
                }
            } catch (err) {
                console.error(`Error eliminando PDF de póliza ${maquinaria.documento_poliza}:`, err);
            }
        }

        for (const nombre of nombresArchivos) {
            const rutaArchivo = join(process.cwd(), 'uploads', 'activos', maquinaria.numero_serie, nombre);

            try {
                if (fs.existsSync(rutaArchivo)) {
                    fs.unlinkSync(rutaArchivo);
                    console.log('Archivo eliminado:', rutaArchivo);
                }
            } catch (err) {
                console.error(`Error eliminando archivo ${nombre}:`, err);
            }
        }

        return await this.maquinariaRepo.remove(maquinaria);
    }

    // ===== Normaliza los campos nuevos de tipo de maquinaria (llegan como strings del FormData) =====
    private normalizarTipoMaquinaria(data: any) {
        if ('tipo_maquinaria_id' in data) {
            const v = data.tipo_maquinaria_id;
            data.tipo_maquinaria_id = (v === '' || v === null || v === undefined) ? null : Number(v);
        }
        if ('placas' in data) {
            data.placas = String(data.placas ?? '').trim().toUpperCase() || null;
        }
        if ('especificacion' in data) {
            data.especificacion = String(data.especificacion ?? '').trim().toUpperCase() || null;
        }
        // Ubicación: texto libre, se conserva como se escribió (solo trim; vacío → null)
        if ('ubicacion' in data) {
            data.ubicacion = String(data.ubicacion ?? '').trim() || null;
        }
    }

    // ===== Helper: parsea documentos de forma segura, soporta JSON nuevo y string viejo por comas =====
    private parseDocumentos(valor: any): string[] {
        if (!valor) return [];
        if (Array.isArray(valor)) return valor;

        try {
            const parsed = JSON.parse(valor);
            if (Array.isArray(parsed)) return parsed;
        } catch {
            // no era JSON válido, cae al formato viejo (comas)
        }

        // compatibilidad con registros viejos que aún tienen comas
        return valor.split(',').map((d: string) => d.trim()).filter(Boolean);
    }

}
