import { Body, Controller, Get, Param, Post, Put, Delete, ParseIntPipe } from '@nestjs/common';
import { MaquinariaService } from './maquinaria.service';
import { Marcas } from './marcas.entity';
import { Modelos } from './modelos.entity';
import { ArrendadoresMaquinaria } from './arrendadores_maquinaria.entity';
import { UseInterceptors, UploadedFiles } from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as fs from 'fs';

const storageMaquinaria = diskStorage({
  destination: (req, file, callback) => {
    // También arregla numero_serie si viene con acentos
    const numeroSerieRaw = req.body?.numero_serie || 'sin-serie';
    const numeroSerie = Buffer.from(numeroSerieRaw, 'latin1').toString('utf8');

    const ruta = `./uploads/activos/${numeroSerie}`;

    if (!fs.existsSync(ruta)) {
      fs.mkdirSync(ruta, { recursive: true });
    }

    callback(null, ruta);
  },
  filename: (req, file, callback) => {
    // 🔧 FIX: Re-decodifica el nombre del archivo de Latin-1 → UTF-8
    const nombreCorrecto = Buffer.from(file.originalname, 'latin1').toString('utf8');
    callback(null, nombreCorrecto);
  }
});


@Controller('maquinaria')
export class MaquinariaController {

  constructor(private readonly maquinariaService: MaquinariaService) { }

  @Get()
  findContratos() {
    return this.maquinariaService.findMaquinaria();
  }

  @Get('marcas')
  getMarcas(): Promise<Marcas[]> {
    return this.maquinariaService.getMarcas();
  }

  @Get('arrendadores')
  getArrendadoresMaquinaria(): Promise<ArrendadoresMaquinaria[]> {
    return this.maquinariaService.getArrendadoresMaquinaria();
  }

  @Get('modelos/:id_marca')
  findMunicipios(@Param('id_marca') id_marca: number): Promise<Modelos[]> {
    return this.maquinariaService.getModelos(id_marca);
  }


  @Post('save')
  @UseInterceptors(FileFieldsInterceptor([
    { name: 'archivo_documento', maxCount: 10 },
    { name: 'archivo_poliza', maxCount: 1 },
  ], { storage: storageMaquinaria }))
  async guardaPartida(
    @UploadedFiles() files: { archivo_documento?: Express.Multer.File[]; archivo_poliza?: Express.Multer.File[] },
    @Body() payload: any
  ) {
    const docs = files?.archivo_documento ?? [];
    payload.documentos = JSON.stringify(docs.map(f => f.filename));
    if (files?.archivo_poliza?.length) {
      payload.documento_poliza = files.archivo_poliza[0].filename;
    }
    console.log(payload);
    return await this.maquinariaService.saveMaquinaria(payload);
  }

  @Put('update')
  @UseInterceptors(FileFieldsInterceptor([
    { name: 'archivo_documento', maxCount: 10 },
    { name: 'archivo_poliza', maxCount: 1 },
  ], { storage: storageMaquinaria }))
  async actualizaPartida(
    @UploadedFiles() files: { archivo_documento?: Express.Multer.File[]; archivo_poliza?: Express.Multer.File[] },
    @Body() payload: any
  ) {
    // payload.documentos llega como JSON string desde el frontend (los que ya existían y no se quitaron)
    let documentosExistentes: string[] = [];
    try {
      documentosExistentes = payload.documentos ? JSON.parse(payload.documentos) : [];
    } catch {
      documentosExistentes = [];
    }

    const nuevos = files?.archivo_documento?.map(f => f.filename) ?? [];

    payload.documentos = JSON.stringify([...documentosExistentes, ...nuevos]);

    // PDF nuevo de póliza: reemplaza al anterior (el servicio borra el viejo)
    if (files?.archivo_poliza?.length) {
      payload.documento_poliza = files.archivo_poliza[0].filename;
    }

    console.log('PAYLOAD FINAL:', payload);
    return await this.maquinariaService.updateMaquinaria(payload);
  }
  @Delete('delete/:id')
  async eliminaPartida(@Param('id', ParseIntPipe) id: number) {
    console.log(id)
    return await this.maquinariaService.deleteMaquinaria(id)
  }
}
