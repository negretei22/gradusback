import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm/dist/common/typeorm.decorators';
import { Contrato } from './contrato.entity';
import { CategoriaContrato } from './categorias_contrato.entity';
import { Estados } from './estados.entity';
import { Municipios } from './municipios.entity';
import { Colonias } from './colonias.entity';
import { EmpresasParticipantes } from './empresas_participantes';
import { Contratantes } from './contratantes.entity';
import { Repository } from 'typeorm/repository/Repository';
import { ConflictException } from '@nestjs/common';


@Injectable()
export class ContratosService {
    constructor(
        @InjectRepository(Contrato)
        private contratoRepo: Repository<Contrato>,
        @InjectRepository(CategoriaContrato)
        private categoriaRepo: Repository<CategoriaContrato>,
        @InjectRepository(Estados)
        private estadosRepo: Repository<Estados>,
        @InjectRepository(Municipios)
        private municipiosRepo: Repository<Municipios>,
        @InjectRepository(Colonias)
        private coloniasRepo: Repository<Colonias>,
        @InjectRepository(EmpresasParticipantes)
        private empresasParticipantesRepo: Repository<EmpresasParticipantes>,
        @InjectRepository(Contratantes)
        private contratantesRepo: Repository<Contratantes>,
    ) { }

    findContratos() {
        return this.contratoRepo.find();
    }

    findCategorias(): Promise<CategoriaContrato[]> {
        console.log('test')
        return this.categoriaRepo.find({
            where: { activo: 1 }
        });
    }

    findEstados(): Promise<Estados[]> {
        return this.estadosRepo.find();
    }

    findContratantes(): Promise<Contratantes[]> {
        return this.contratantesRepo.find();
    }

    findMunicipios(id_estado: any): Promise<Municipios[]> {
        return this.municipiosRepo.find({
            where: { id_estado }
        });
    }

    findInfoContratante(id_contratante: number): Promise<any> {
  return this.contratantesRepo
    .createQueryBuilder('a')
    .select([
      'a.razon_social AS a_razon_social',
      'a.calle AS a_calle',
      'a.codigo_postal AS a_codigo_postal',
      'a.numero_exterior AS a_numero_exterior',
      'a.numero_interior AS a_numero_interior',
      'b.nombre AS estado',
      'c.nombre AS municipio',
      'd.nombre AS colonia'
    ])
    .leftJoin('estados', 'b', 'a.id_estado = b.id')
    .leftJoin('municipios', 'c', 'a.id_municipio = c.id')
    .leftJoin('colonias', 'd', 'a.id_colonia = d.id')
    .where('a.id_contratante = :id', { id: id_contratante })
    .getRawOne(); // <--- devuelve un solo objeto
}


    findColonias(id_municipio: any, codigo_postal: any): Promise<Colonias[]> {
        console.log(id_municipio)
        return this.coloniasRepo.find({
            where: {
                municipio: id_municipio,
                codigo_postal: codigo_postal
            }
        });
    }

    findEmpresasParticipantes(): Promise<EmpresasParticipantes[]> {
        return this.empresasParticipantesRepo.find();
    }

    async saveContrato(payload: any) {

        const existe = await this.contratoRepo.findOne({
            where: { numero_contrato: payload.numero_contrato }
        });

        if (existe) {
            throw new ConflictException({ message: 'Contrato duplicado', numero_contrato: payload.numero_contrato });
        }

        const contrato = this.contratoRepo.create(payload);
        return await this.contratoRepo.save(contrato);
    }
}

