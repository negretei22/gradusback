import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Marcas } from './marcas.entity';
import { Modelos } from './modelos.entity';
import { ArrendadoresMaquinaria } from './arrendadores_maquinaria.entity';
import { Maquinaria } from './maquinaria.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm/repository/Repository';
import * as fs from 'fs';
import { join } from 'path';



@Injectable()
export class MaquinariaService {
    constructor(
        @InjectRepository(Marcas)
        private marcasRepo: Repository<Marcas>,
        @InjectRepository(Modelos)
        private modelosRepo: Repository<Modelos>,
        @InjectRepository(ArrendadoresMaquinaria)
        private arrendadoresMaquinariaRepo: Repository<ArrendadoresMaquinaria>,
        @InjectRepository(Maquinaria)
        private maquinariaRepo: Repository<Maquinaria>,

    ) { }


    findMaquinaria() {
        return this.maquinariaRepo
            .createQueryBuilder('a')
            .leftJoin('marcas', 'b', 'a.id_marca = b.id_marca')
            .leftJoin('modelos', 'm', 'a.id_modelo = m.id_modelo')

            .select([
                'a.*',
                'b.marca', // cambia nombre por tu campo real
                'm.modelo',

                `CASE 
        WHEN a.id_tipo_de_adquisicion = 1 THEN 'PROPIO'
        WHEN a.id_tipo_de_adquisicion = 2 THEN 'LEASING'
        WHEN a.id_tipo_de_adquisicion = 3 THEN 'ARRENDADA'
        ELSE 'DESCONOCIDO'
      END AS tipo_adquisicion`,

                `IF(a.id_tipo_de_adquisicion < 3, a.valor_compra, a.monto_renta_mensual) AS monto`
            ])
            .getRawMany();
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
