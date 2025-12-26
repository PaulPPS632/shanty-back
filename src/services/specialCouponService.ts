import { Pool } from 'pg';
import { PDFDocument, rgb, PDFImage } from 'pdf-lib';
import bwipjs from 'bwip-js';
import axios from 'axios';
import { pool } from '../db';

interface CouponDB {
    urlimagen: string;
    cup_num_cupon: string | number;
    valor: number;
}

export class SpecialCouponService {
    
    async generateCouponsPdfForValue50(): Promise<Buffer> {
        // 1. Fetch data from DB
        const query = `
            SELECT cp.urlimagen, cp.cup_num_cupon, cp.valor 
            FROM cupones_campaña cp 
            WHERE cp.valor = 50
        `;
        const result = await pool.query(query);
        const coupons: CouponDB[] = result.rows;

        if (coupons.length === 0) {
            throw new Error('No coupons found with value 50');
        }

        // 2. Generate PDF (Logic adapted from PdfService)
        const doc = await PDFDocument.create();
        let page = doc.addPage();
        const { width, height } = page.getSize();
        
        const margin = 50;
        const colGap = 20;
        const colWidth = (width - margin * 2 - colGap) / 2;
        let x = margin;
        let y = height - margin;
        
        let colIndex = 0;

        // Cache for images to avoid downloading the same image multiple times
        const imageCache: { [url: string]: PDFImage } = {};

        for (const coupon of coupons) {
            const itemHeight = 220; 
            
            // Check for page break
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
            if (coupon.urlimagen) {
                try {
                    let pdfImage = imageCache[coupon.urlimagen];
                    
                    if (!pdfImage) {
                        const imgResp = await axios.get(coupon.urlimagen, { responseType: 'arraybuffer' });
                        // Simple check for extension, defaulting to jpg if unknown or complicated
                        // Pdf-lib supports JPG and PNG. 
                        const isPng = coupon.urlimagen.toLowerCase().endsWith('.png');
                        
                        if (isPng) {
                            pdfImage = await doc.embedPng(imgResp.data);
                        } else {
                            pdfImage = await doc.embedJpg(imgResp.data);
                        }
                        imageCache[coupon.urlimagen] = pdfImage;
                    }

                    const imgDims = pdfImage.scaleToFit(colWidth, 80);
                    page.drawImage(pdfImage, {
                        x: currentX + (colWidth - imgDims.width) / 2,
                        y: currentY - imgDims.height,
                        width: imgDims.width,
                        height: imgDims.height,
                    });
                    currentY -= (imgDims.height + 10);
                } catch (e) {
                    console.error(`Error fetching/embedding image for coupon ${coupon.cup_num_cupon}`, e);
                    // Continue without image
                }
            }

            // 2. Barcode
            try {
                const bcText = String(coupon.cup_num_cupon);
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
                console.error('Error generating barcode', e);
                currentY -= 20; 
            }

            // 3. Text Code
            const text = `${coupon.cup_num_cupon}`;
            const textSize = 12;
            const textWidth = 6 * text.length; // Approximate width calculation
            page.drawText(text, {
                x: currentX + (colWidth - textWidth) / 2,
                y: currentY - textSize,
                size: textSize,
                color: rgb(0, 0, 0),
            });
            currentY -= (textSize + 15);
            
            y = currentY - 20; // Space between items
        }

        const pdfBytes = await doc.save();
        return Buffer.from(pdfBytes);
    }
}
