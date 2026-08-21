import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { Servicio } from './servicio.entity';
import { ServicioDetalle } from './servicio-detalle.entity';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class ServicioService {
  constructor(
    @InjectRepository(Servicio)
    private servicioRepo: Repository<Servicio>,
    @InjectRepository(ServicioDetalle)
    private detalleRepo: Repository<ServicioDetalle>,
  ) { }

  async findAll() {
    return this.servicioRepo
      .createQueryBuilder('servicio')
      .leftJoinAndSelect('servicio.tipoServicio', 'tipoServicio')
      .leftJoinAndSelect('servicio.detalles', 'detalles')
      .leftJoinAndSelect('servicio.activo', 'activo')
      .orderBy('servicio.id_servicio', 'DESC')
      .getMany();
  }

  async findOne(id: number) {
    const s = await this.servicioRepo
      .createQueryBuilder('servicio')
      .leftJoinAndSelect('servicio.tipoServicio', 'tipoServicio')
      .leftJoinAndSelect('servicio.detalles', 'detalles')
      .leftJoinAndSelect('servicio.activo', 'activo')
      .where('servicio.id_servicio = :id', { id })
      .getOne();

    if (!s) throw new NotFoundException('Servicio no encontrado');
    return s;
  }

  async create(body: any, files: Express.Multer.File[]) {
    const codigo = await this.generarCodigo();
    const fotosNombres = files?.length ? this.moverArchivos(files, codigo) : [];

    const servicio = this.servicioRepo.create({
      codigo,
      id_tipo_servicio: body.id_tipo_servicio,
      id_activo: body.id_activo,
      fecha_servicio: body.fecha_servicio,
      total: body.total ?? 0,
      iva: body.iva ?? 0,
      fotos: fotosNombres.join(','),
      detalles: this.parsearDetalles(body.detalles),
    });

    return this.servicioRepo.save(servicio);
  }

  async update(body: any, files: Express.Multer.File[]) {
    const id = Number(body.id_servicio);
    const servicio = await this.findOne(id);

    // Mover archivos nuevos a la carpeta del código existente
    const nuevasFotos = files?.length ? this.moverArchivos(files, servicio.codigo) : [];

    // fotos existentes que no se quitaron
    const existentes = body.fotos_existentes ? body.fotos_existentes.split(',').filter((x: string) => x) : [];
    servicio.fotos = [...existentes, ...nuevasFotos].join(',');

    servicio.id_tipo_servicio = body.id_tipo_servicio;
    servicio.id_activo = body.id_activo;
    servicio.fecha_servicio = body.fecha_servicio;
    servicio.total = body.total ?? 0;
    servicio.iva = body.iva ?? 0;

    // reemplazar detalles
    await this.detalleRepo.delete({ id_servicio: id });
    servicio.detalles = this.parsearDetalles(body.detalles, id);

    return this.servicioRepo.save(servicio);
  }

  async remove(id: number) {
    const s = await this.findOne(id);
    if (s.fotos) {
      const dir = path.join('./uploads/servicios', s.codigo);
      if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true });
    }
    return this.servicioRepo.remove(s);
  }

  // ===== AUXILIARES =====

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

  private moverArchivos(files: Express.Multer.File[], codigo: string): string[] {
    const destinoDir = path.join('./uploads/servicios', codigo);
    if (!fs.existsSync(destinoDir)) {
      fs.mkdirSync(destinoDir, { recursive: true });
    }

    return files.map(f => {
      const destino = path.join(destinoDir, f.filename);
      fs.renameSync(f.path, destino);
      return f.filename;
    });
  }

  private parsearDetalles(detallesRaw: any, idServicio?: number): ServicioDetalle[] {
    let arr: any[] = [];
    try {
      arr = typeof detallesRaw === 'string' ? JSON.parse(detallesRaw) : (detallesRaw ?? []);
    } catch { arr = []; }

    return arr
      .filter((d: any) => d?.descripcion?.trim?.())
      .map((d: any) => this.detalleRepo.create({
        id_servicio: idServicio,
        descripcion: d.descripcion.trim(),
      }));
  }
}