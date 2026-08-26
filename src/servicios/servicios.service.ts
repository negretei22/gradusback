import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { Servicio } from './servicio.entity';
import * as fs from 'fs';
import * as path from 'path';

interface FotoInfo {
  nombreOriginal: string;
  nombreArchivo: string;
}

@Injectable()
export class ServicioService {
  constructor(
    @InjectRepository(Servicio)
    private servicioRepo: Repository<Servicio>,
  ) { }

  async create(body: any, files: Express.Multer.File[]) {
    const codigo = await this.generarCodigo();
    const fotosNuevas = files?.length ? this.moverArchivos(files, codigo) : [];

    const servicio = this.servicioRepo.create({
      codigo,
      id_activo: body.id_activo,
      fecha_servicio: body.fecha_servicio,
      total: body.total ?? 0,
      comentarios: body.comentarios ?? 0,
      fotos: fotosNuevas,
    });

    return this.servicioRepo.save(servicio);
  }

  async update(body: any, files: Express.Multer.File[]) {
    const id = Number(body.id_servicio);
    const servicio = await this.findOne(id);

    const fotosNuevas = files?.length ? this.moverArchivos(files, servicio.codigo) : [];

    // fotos_existentes ahora debe venir como JSON string desde el frontend
    let existentes: FotoInfo[] = [];
    if (body.fotos_existentes) {
      try {
        existentes = JSON.parse(body.fotos_existentes);
      } catch {
        existentes = [];
      }
    }

    servicio.fotos = [...existentes, ...fotosNuevas];
    servicio.id_activo = body.id_activo;
    servicio.fecha_servicio = body.fecha_servicio;
    servicio.total = body.total ?? 0;
    servicio.comentarios = body.comentarios ?? 0;

    return this.servicioRepo.save(servicio);
  }

  async remove(id: number) {
    const s = await this.findOne(id);
    if (s.fotos?.length) {
      const dir = path.join('./uploads/servicios', s.codigo);
      if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true });
    }
    return this.servicioRepo.remove(s);
  }

  async findAll() {
    return this.servicioRepo
      .createQueryBuilder('servicio')
      .leftJoinAndSelect('servicio.activo', 'activo')
      .orderBy('servicio.fecha_servicio', 'ASC')
      .getMany();
  }

  async findOne(id: number) {
    const s = await this.servicioRepo
      .createQueryBuilder('servicio')
      .leftJoinAndSelect('servicio.activo', 'activo')
      .where('servicio.id_servicio = :id', { id })
      .getOne();

    if (!s) throw new NotFoundException('Servicio no encontrado');
    return s;
  }

  private async generarCodigo(): Promise<string> {
    const ultimo = await this.servicioRepo.findOne({
      where: { codigo: Like('SERV%') },
      order: { id_servicio: 'DESC' },
    });

    let numero = 1;
    if (ultimo?.codigo) {
      const match = ultimo.codigo.match(/SERV(\d+)/);
      if (match) numero = parseInt(match[1], 10) + 1;
    }
    return `SERV${numero.toString().padStart(3, '0')}`;
  }

  private moverArchivos(files: Express.Multer.File[], codigo: string): FotoInfo[] {
    const destinoDir = path.join('./uploads/servicios', codigo);
    if (!fs.existsSync(destinoDir)) {
      fs.mkdirSync(destinoDir, { recursive: true });
    }

    return files.map(f => {
      const nombreFinal = this.resolverNombreDisponible(destinoDir, f.originalname);
      const destino = path.join(destinoDir, nombreFinal);
      fs.renameSync(f.path, destino);
      return {
        nombreOriginal: f.originalname,
        nombreArchivo: nombreFinal,
      };
    });
  }

  private resolverNombreDisponible(dir: string, nombreOriginal: string): string {
    let nombreFinal = nombreOriginal;
    let contador = 1;
    const ext = path.extname(nombreOriginal);
    const base = path.basename(nombreOriginal, ext);

    while (fs.existsSync(path.join(dir, nombreFinal))) {
      nombreFinal = `${base} (${contador})${ext}`;
      contador++;
    }

    return nombreFinal;
  }
}