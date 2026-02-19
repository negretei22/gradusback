import { ConflictException, Injectable } from '@nestjs/common';
import { Marcas } from './marcas.entity';
import { Modelos } from './modelos.entity';
import { ArrendadoresMaquinaria } from './arrendadores_maquinaria.entity';
import { Maquinaria } from './maquinaria.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm/repository/Repository';

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
        return this.marcasRepo.find();
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

}
