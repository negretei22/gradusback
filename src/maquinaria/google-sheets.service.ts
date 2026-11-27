import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { google } from 'googleapis';
import { construirPeticionesSheets, ReporteDrivePayload } from './sheets-reporte';
import type { ArchivoDrive } from './sheets-archivos';

// Escribe cada archivo de maquinaria en su hoja de Google con la cuenta de
// servicio (la llave .json va en el .env, nunca en git). Son 3 archivos
// diferentes, no 3 pestañas: Leasing, Seguros y Servicios.
@Injectable()
export class GoogleSheetsService {
  // Hojas elegidas por Ivo (primera pestaña en blanco en las 3); se pueden
  // cambiar con variables en el .env sin tocar el código.
  private readonly hojas: Record<ArchivoDrive, string> = {
    leasing:
      process.env.MAQUINARIA_SHEET_ID ||
      '1QEDrUmrbDRq-c9rAxVF1TYfJswTa80Xtzu_lsCipWzc',
    seguros:
      process.env.MAQUINARIA_SEGUROS_SHEET_ID ||
      '1dK85qMNpcj2KsJqsYPxD5_JKBZzuo8s8ZkjGx9Y63q0',
    servicios:
      process.env.MAQUINARIA_SERVICIOS_SHEET_ID ||
      '1-opqrab1YpvmbIfYvjTGuJ48ZxIz0f79QZDqoILgE34',
  };

  private cliente() {
    const keyFile = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE;
    if (!keyFile) {
      throw new InternalServerErrorException(
        'Falta GOOGLE_SERVICE_ACCOUNT_KEY_FILE en el .env del back: la ruta del .json de la cuenta de servicio.',
      );
    }
    const auth = new google.auth.GoogleAuth({
      keyFile,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    return google.sheets({ version: 'v4', auth });
  }

  // El nombre de la pestaña en notación A1 (entre comillas simples por si
  // trae espacios, como "Hoja 1").
  private rango(titulo: string): string {
    return `'${titulo.replace(/'/g, "''")}'`;
  }

  async escribirReporte(archivo: ArchivoDrive, payload: ReporteDrivePayload) {
    if (!payload || !Array.isArray(payload.headers) || !Array.isArray(payload.rows)) {
      throw new InternalServerErrorException('El reporte llegó vacío o incompleto.');
    }
    const sheetId = this.hojas[archivo];
    if (!sheetId) {
      throw new InternalServerErrorException(`Archivo de Drive desconocido: ${archivo}.`);
    }
    try {
      const sheets = this.cliente();
      const meta = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
      const primera = meta.data.sheets?.[0]?.properties;
      if (!primera?.title || primera.sheetId === undefined || primera.sheetId === null) {
        throw new InternalServerErrorException('La hoja de Drive no tiene pestañas.');
      }
      const titulo = primera.title;
      const { valores, requests } = construirPeticionesSheets(payload, primera.sheetId);

      // Se escribe solo en la primera pestaña; las demás no se tocan.
      // Limpiar valores viejos y escribir el reporte nuevo (RAW: los textos
      // como "26-jun-26" y "Financiado en letra" se quedan tal cual).
      await sheets.spreadsheets.values.clear({
        spreadsheetId: sheetId,
        range: this.rango(titulo),
      });
      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: `${this.rango(titulo)}!A1`,
        valueInputOption: 'RAW',
        requestBody: { values: valores },
      });
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: sheetId,
        requestBody: { requests },
      });
      return {
        ok: true,
        archivo,
        hoja: titulo,
        filas: payload.rows.length,
        columnas: payload.headers.length,
      };
    } catch (e: any) {
      if (e instanceof InternalServerErrorException) throw e;
      const detalle =
        e?.response?.data?.error?.message || e?.message || 'Error desconocido';
      throw new InternalServerErrorException(
        `No se pudo escribir en la hoja de Drive (${archivo}): ${detalle}. Revisa que la hoja esté compartida con la cuenta de servicio como Editor.`,
      );
    }
  }
}
