import { Controller, Post, UploadedFile, UseInterceptors, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ConciliacionService } from './conciliacion.service';

@Controller('conciliacion')
export class ConciliacionController {
  constructor(private readonly service: ConciliacionService) { }

  @Post('pdf')
  @UseInterceptors(FileInterceptor('archivo'))
  conciliar(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Falta el archivo');
    return this.service.conciliar(file.buffer);
  }
}