import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, UseInterceptors, UploadedFiles } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { ServicioService } from './servicios.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { UserRole } from 'src/shared/enums/user-role.enum';

@Controller('servicio')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPERADMIN)
export class ServicioController {
  constructor(private readonly servicioService: ServicioService) {}

  @Get()
  getAll() {
    return this.servicioService.findAll();
  }

  @Get(':id')
  getOne(@Param('id') id: number) {
    return this.servicioService.findOne(id);
  }

  @Post('save')
  @UseInterceptors(FilesInterceptor('fotos', 10, {
    storage: diskStorage({
      destination: (req, file, cb) => {
        const dir = './uploads/servicios/temp';
        require('fs').mkdirSync(dir, { recursive: true });
        cb(null, dir);
      },
      filename: (req, file, cb) => {
        const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, unique + extname(file.originalname));
      },
    }),
  }))
  create(@Body() body: any, @UploadedFiles() files: Express.Multer.File[]) {
    return this.servicioService.create(body, files);
  }

  @Put('update')
  @UseInterceptors(FilesInterceptor('fotos', 10, {
    storage: diskStorage({
      destination: (req, file, cb) => {
        const dir = './uploads/servicios/temp';
        require('fs').mkdirSync(dir, { recursive: true });
        cb(null, dir);
      },
      filename: (req, file, cb) => {
        const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, unique + extname(file.originalname));
      },
    }),
  }))
  update(@Body() body: any, @UploadedFiles() files: Express.Multer.File[]) {
    return this.servicioService.update(body, files);
  }

  @Delete('delete/:id')
  delete(@Param('id') id: number) {
    return this.servicioService.remove(id);
  }
}