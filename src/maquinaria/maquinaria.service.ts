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

            .select([
                'a.*',
                'b.marca', // cambia nombre por tu campo real

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
        console.log(payload)
        const existe = await this.maquinariaRepo.findOne({
            where: { numero_serie: payload.numero_serie }
        });

        if (existe) {
            throw new ConflictException({ message: 'Contrato duplicado', numero_contrato: payload.numero_contrato });
        }

        const contrato = this.maquinariaRepo.create(payload);
        return await this.maquinariaRepo.save(contrato);
    }

    async updateMaquinaria(payload: any) {
        console.log(payload);

        const { id_maquinaria, ...data } = payload;

        const maquinaria = await this.maquinariaRepo.findOne({
            where: { id_maquinaria }
        });

        if (!maquinaria) {
            throw new NotFoundException({ message: 'Maquinaria no encontrada' });
        }

        if (data.numero_serie && data.numero_serie !== maquinaria.numero_serie) {
            const existe = await this.maquinariaRepo.findOne({
                where: { numero_serie: data.numero_serie }
            });

            if (existe) {
                throw new ConflictException({ message: 'Número de serie duplicado', numero_serie: data.numero_serie });
            }
        }

        // ===== LIMPIEZA DE PDFs HUÉRFANOS =====
        const documentosViejos = maquinaria.documentos
            ? maquinaria.documentos.split(',').map(d => d.trim()).filter(Boolean)
            : [];

        const documentosNuevos = data.documentos
            ? data.documentos.split(',').map((d: string) => d.trim()).filter(Boolean)
            : [];

        const documentosEliminados = documentosViejos.filter(d => !documentosNuevos.includes(d));

        for (const nombre of documentosEliminados) {
            const rutaArchivo = join(process.cwd(), 'uploads', 'activos',data.numero_serie, nombre);
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

    async deleteMaquinaria(id_maquinaria: number) {
        console.log(id_maquinaria);

        const maquinaria = await this.maquinariaRepo.findOne({
            where: { id_maquinaria }
        });

        if (!maquinaria) {
            throw new NotFoundException({ message: 'Maquinaria no encontrada' });
        }

        // Borra los PDFs físicos asociados, si tiene
        if (maquinaria.documentos) {
            const nombresArchivos = maquinaria.documentos.split(',').filter(n => n.trim());

            for (const nombre of nombresArchivos) {
                const rutaArchivo = join(process.cwd(), 'uploads', 'activos', nombre.trim());

                try {
                    if (fs.existsSync(rutaArchivo)) {
                        fs.unlinkSync(rutaArchivo);
                        console.log('Archivo eliminado:', rutaArchivo);
                    }
                } catch (err) {
                    // no tronamos el borrado del registro si un archivo falla al eliminarse
                    console.error(`Error eliminando archivo ${nombre}:`, err);
                }
            }
        }

        return await this.maquinariaRepo.remove(maquinaria);
    }

}
