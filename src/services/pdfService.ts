import { PDFDocument, rgb, PDFImage } from 'pdf-lib';
import bwipjs from 'bwip-js';
import axios from 'axios';
import { Root } from '../types';
import { logger } from '../config/logger';

const logSvc = logger.child({ comp: 'svc' });

export class PdfService {
    async generateCouponsPdf(data: Root): Promise<Buffer> {
        const doc = await PDFDocument.create();
        let page = doc.addPage();
        const { width, height } = page.getSize();
        
        const margin = 50;
        const colGap = 20;
        const colWidth = (width - margin * 2 - colGap) / 2;
        let x = margin;
        let y = height - margin;
        
        let colIndex = 0;

        if (data.promovars) {
            for (const p of data.promovars) {
                if (!p.cupones || p.cupones.length === 0) continue;

                let pdfImage: PDFImage | undefined;

                // Optimization: Fetch and embed image once per Promovar section
                try {
                    const imgUrl = p.urL_IMAGEN;
                    if (imgUrl) {
                        const imgResp = await axios.get(imgUrl, { responseType: 'arraybuffer' });
                        const imgExt = imgUrl.split('.').pop()?.toLowerCase();
                        
                            pdfImage = await doc.embedJpg(imgResp.data);
                    }
                } catch (e) {
                    logSvc.warn({ err: e, promovar: p.id }, 'No se pudo incrustar la imagen del promovar');
                }

                for (const coupon of p.cupones) {
                     const itemHeight = 220; 
                     
                     if (y - itemHeight < margin) {
                         if (colIndex === 0) {
                             colIndex = 1;
                             x = margin + colWidth + colGap;
                             y = height - margin;
                         } else {
                             page = doc.addPage();
                             colIndex = 0;
                             x = margin;
                             y = height - margin;
                         }
                     }

                     const currentX = x;
                     let currentY = y;

                     // 1. Image
                     if (pdfImage) {
                         const imgDims = pdfImage.scaleToFit(colWidth, 80);
                         page.drawImage(pdfImage, {
                             x: currentX + (colWidth - imgDims.width) / 2,
                             y: currentY - imgDims.height,
                             width: imgDims.width,
                             height: imgDims.height,
                         });
                         currentY -= (imgDims.height + 10);
                     }

                     // 2. Barcode
                     try {
                        const bcText = String(coupon.cuP_NUM_CUPON);
                        const pngBuffer = await bwipjs.toBuffer({
                            bcid: 'code128',       
                            text: bcText,    
                            scale: 2,               
                            height: 5,              
                            includetext: false,            
                        });
                        
                        const barcodeImg = await doc.embedPng(pngBuffer);
                        const bcDims = barcodeImg.scaleToFit(colWidth, 50);
                         
                         page.drawImage(barcodeImg, {
                             x: currentX + (colWidth - bcDims.width) / 2,
                             y: currentY - bcDims.height,
                             width: bcDims.width,
                             height: bcDims.height,
                         });
                         currentY -= (bcDims.height + 5);
                     } catch (e) {
                          logSvc.warn({ err: e }, 'No se pudo generar el codigo de barras');
                          currentY -= 20; 
                     }

                     // 3. Text Code
                     const text = `${coupon.cuP_NUM_CUPON}`;
                     const textSize = 12;
                     const textWidth = 6 * text.length; 
                     page.drawText(text, {
                         x: currentX + (colWidth - textWidth) / 2,
                         y: currentY - textSize,
                         size: textSize,
                         color: rgb(0, 0, 0),
                     });
                     currentY -= (textSize + 15);
                     
                     y = currentY - 20; 
                }
            }
        }

        const pdfBytes = await doc.save();
        return Buffer.from(pdfBytes);
    }
}
