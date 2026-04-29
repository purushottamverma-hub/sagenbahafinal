import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

interface BillItem {
  name: string;
  quantity: number;
  unit: string;
  rate: number;
  amount: number;
}

interface BillData {
  billNumber: string;
  date: string;
  customerName: string;
  customerMobile?: string;
  outletName: string;
  items: BillItem[];
  subtotal: number;
  discount?: number;
  total: number;
  paidAmount: number;
  dueAmount: number;
  paymentMode: string;
  language: 'en' | 'hi';
}

const translations = {
  en: {
    title: 'SALES INVOICE',
    companyName: 'Sagen Baha Women Farmer Producer Company Limited',
    companySubtitle: 'FPO Business Transaction',
    address: 'Poraiyahat Block, Godda District, Jharkhand',
    billNo: 'Bill No',
    date: 'Date',
    customer: 'Customer',
    mobile: 'Mobile',
    outlet: 'Outlet',
    product: 'Product',
    qty: 'Qty',
    unit: 'Unit',
    rate: 'Rate',
    amount: 'Amount',
    subtotal: 'Subtotal',
    discount: 'Discount',
    total: 'Total',
    paid: 'Paid',
    due: 'Due',
    paymentMode: 'Payment Mode',
    cash: 'Cash',
    online: 'Online',
    credit: 'Credit',
    partial: 'Partial',
    thankYou: 'Thank you for your purchase!',
    computerGenerated: 'This is a computer-generated bill',
  },
  hi: {
    title: 'बिक्री रसीद',
    companyName: 'सागेन बहा वूमेन फार्मर प्रोड्यूसर कंपनी लिमिटेड',
    companySubtitle: 'FPO व्यवसाय लेन-देन',
    address: 'पोरैयाहाट ब्लॉक, गोड्डा जिला, झारखंड',
    billNo: 'बिल नं',
    date: 'दिनांक',
    customer: 'ग्राहक',
    mobile: 'मोबाइल',
    outlet: 'आउटलेट',
    product: 'उत्पाद',
    qty: 'मात्रा',
    unit: 'इकाई',
    rate: 'दर',
    amount: 'राशि',
    subtotal: 'उप-योग',
    discount: 'छूट',
    total: 'कुल',
    paid: 'भुगतान',
    due: 'बकाया',
    paymentMode: 'भुगतान मोड',
    cash: 'नकद',
    online: 'ऑनलाइन',
    credit: 'उधार',
    partial: 'आंशिक',
    thankYou: 'खरीदारी के लिए धन्यवाद!',
    computerGenerated: 'यह कंप्यूटर जनित बिल है',
  },
};

const getPaymentModeText = (mode: string, t: typeof translations.en) => {
  switch (mode) {
    case 'cash': return t.cash;
    case 'online': return t.online;
    case 'credit': return t.credit;
    case 'partial': return t.partial;
    default: return mode;
  }
};

export const generateBillHTML = (data: BillData): string => {
  const t = translations[data.language];
  
  const itemsHTML = data.items.map(item => `
    <tr>
      <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.name}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${item.unit}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">₹${item.rate.toFixed(2)}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">₹${item.amount.toFixed(2)}</td>
    </tr>
  `).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
          font-family: 'Segoe UI', Arial, sans-serif; 
          padding: 20px;
          max-width: 400px;
          margin: 0 auto;
          color: #333;
        }
        .header { text-align: center; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 2px solid #2E7D32; }
        .logo { 
          width: 60px; 
          height: 60px; 
          background: #E8F5E9; 
          border-radius: 50%; 
          margin: 0 auto 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 30px;
        }
        .company-name { font-size: 18px; font-weight: bold; color: #2E7D32; }
        .company-subtitle { font-size: 12px; color: #666; margin-top: 2px; }
        .address { font-size: 11px; color: #888; margin-top: 5px; }
        .title { 
          background: #2E7D32; 
          color: white; 
          padding: 8px; 
          text-align: center; 
          font-size: 14px; 
          font-weight: bold;
          margin: 15px 0;
          border-radius: 4px;
        }
        .info-row { 
          display: flex; 
          justify-content: space-between; 
          margin-bottom: 5px;
          font-size: 12px;
        }
        .info-label { color: #666; }
        .info-value { font-weight: 600; }
        .customer-section { 
          background: #f9f9f9; 
          padding: 10px; 
          border-radius: 6px; 
          margin: 10px 0;
        }
        table { width: 100%; border-collapse: collapse; margin: 15px 0; font-size: 12px; }
        th { 
          background: #f5f5f5; 
          padding: 10px 8px; 
          text-align: left; 
          font-weight: 600;
          border-bottom: 2px solid #ddd;
        }
        .totals { margin-top: 15px; }
        .total-row { 
          display: flex; 
          justify-content: space-between; 
          padding: 5px 0;
          font-size: 13px;
        }
        .total-row.final { 
          font-size: 16px; 
          font-weight: bold; 
          color: #2E7D32;
          border-top: 2px solid #2E7D32;
          padding-top: 10px;
          margin-top: 5px;
        }
        .due-row { color: #D32F2F; }
        .payment-mode {
          background: #E8F5E9;
          padding: 8px 12px;
          border-radius: 20px;
          display: inline-block;
          font-size: 12px;
          font-weight: 600;
          color: #2E7D32;
          margin-top: 10px;
        }
        .footer { 
          text-align: center; 
          margin-top: 25px; 
          padding-top: 15px;
          border-top: 1px dashed #ccc;
        }
        .thank-you { font-size: 14px; font-weight: 600; color: #2E7D32; }
        .disclaimer { font-size: 10px; color: #999; margin-top: 8px; }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="logo">🌿</div>
        <div class="company-name">${t.companyName}</div>
        <div class="company-subtitle">${t.companySubtitle}</div>
        <div class="address">${t.address}</div>
      </div>

      <div class="title">${t.title}</div>

      <div class="info-row">
        <span class="info-label">${t.billNo}:</span>
        <span class="info-value">${data.billNumber}</span>
      </div>
      <div class="info-row">
        <span class="info-label">${t.date}:</span>
        <span class="info-value">${data.date}</span>
      </div>
      <div class="info-row">
        <span class="info-label">${t.outlet}:</span>
        <span class="info-value">${data.outletName}</span>
      </div>

      <div class="customer-section">
        <div class="info-row">
          <span class="info-label">${t.customer}:</span>
          <span class="info-value">${data.customerName}</span>
        </div>
        ${data.customerMobile ? `
        <div class="info-row">
          <span class="info-label">${t.mobile}:</span>
          <span class="info-value">${data.customerMobile}</span>
        </div>
        ` : ''}
      </div>

      <table>
        <thead>
          <tr>
            <th>${t.product}</th>
            <th style="text-align: center;">${t.qty}</th>
            <th style="text-align: center;">${t.unit}</th>
            <th style="text-align: right;">${t.rate}</th>
            <th style="text-align: right;">${t.amount}</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHTML}
        </tbody>
      </table>

      <div class="totals">
        <div class="total-row">
          <span>${t.subtotal}</span>
          <span>₹${data.subtotal.toFixed(2)}</span>
        </div>
        ${data.discount ? `
        <div class="total-row">
          <span>${t.discount}</span>
          <span>-₹${data.discount.toFixed(2)}</span>
        </div>
        ` : ''}
        <div class="total-row final">
          <span>${t.total}</span>
          <span>₹${data.total.toFixed(2)}</span>
        </div>
        <div class="total-row">
          <span>${t.paid}</span>
          <span>₹${data.paidAmount.toFixed(2)}</span>
        </div>
        ${data.dueAmount > 0 ? `
        <div class="total-row due-row">
          <span>${t.due}</span>
          <span>₹${data.dueAmount.toFixed(2)}</span>
        </div>
        ` : ''}
      </div>

      <div style="text-align: center;">
        <span class="payment-mode">${t.paymentMode}: ${getPaymentModeText(data.paymentMode, t)}</span>
      </div>

      <div class="footer">
        <div class="thank-you">${t.thankYou}</div>
        <div class="disclaimer">${t.computerGenerated}</div>
      </div>
    </body>
    </html>
  `;
};

export const printBill = async (data: BillData): Promise<void> => {
  const html = generateBillHTML(data);
  await Print.printAsync({ html });
};

export const shareBillAsPDF = async (data: BillData): Promise<void> => {
  const html = generateBillHTML(data);
  
  const { uri } = await Print.printToFileAsync({ html });
  
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: `Bill ${data.billNumber}`,
      UTI: 'com.adobe.pdf',
    });
  }
};

export const generatePurchaseReceiptHTML = (data: {
  receiptNumber: string;
  date: string;
  farmerName: string;
  farmerMobile?: string;
  farmerVillage?: string;
  productName: string;
  quantity: number;
  unit: string;
  rate: number;
  totalAmount: number;
  paymentStatus: string;
  language: 'en' | 'hi';
}): string => {
  const t = translations[data.language];
  
  const labels = data.language === 'hi' ? {
    title: 'खरीद रसीद',
    receiptNo: 'रसीद नं',
    farmer: 'किसान',
    village: 'गाँव',
    product: 'उत्पाद',
    quantity: 'मात्रा',
    rate: 'दर',
    total: 'कुल राशि',
    status: 'भुगतान स्थिति',
    paid: 'भुगतान किया',
    pending: 'बकाया',
    thankYou: 'FPO के साथ व्यापार के लिए धन्यवाद!',
  } : {
    title: 'PURCHASE RECEIPT',
    receiptNo: 'Receipt No',
    farmer: 'Farmer',
    village: 'Village',
    product: 'Product',
    quantity: 'Quantity',
    rate: 'Rate',
    total: 'Total Amount',
    status: 'Payment Status',
    paid: 'Paid',
    pending: 'Pending',
    thankYou: 'Thank you for trading with FPO!',
  };

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; max-width: 400px; margin: 0 auto; }
        .header { text-align: center; border-bottom: 2px solid #1976D2; padding-bottom: 15px; margin-bottom: 20px; }
        .title { background: #1976D2; color: white; padding: 10px; text-align: center; border-radius: 4px; margin: 15px 0; }
        .row { display: flex; justify-content: space-between; margin: 8px 0; font-size: 14px; }
        .label { color: #666; }
        .value { font-weight: 600; }
        .total { font-size: 20px; color: #1976D2; font-weight: bold; text-align: center; margin: 20px 0; }
        .status { text-align: center; padding: 8px 20px; border-radius: 20px; display: inline-block; }
        .status.paid { background: #E8F5E9; color: #2E7D32; }
        .status.pending { background: #FFF3E0; color: #F57C00; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="header">
        <div style="font-size: 18px; font-weight: bold; color: #1976D2;">${t.companyName}</div>
        <div style="font-size: 12px; color: #666;">${t.address}</div>
      </div>

      <div class="title">${labels.title}</div>

      <div class="row">
        <span class="label">${labels.receiptNo}:</span>
        <span class="value">${data.receiptNumber}</span>
      </div>
      <div class="row">
        <span class="label">${t.date}:</span>
        <span class="value">${data.date}</span>
      </div>

      <div style="background: #f5f5f5; padding: 12px; border-radius: 8px; margin: 15px 0;">
        <div class="row">
          <span class="label">${labels.farmer}:</span>
          <span class="value">${data.farmerName}</span>
        </div>
        ${data.farmerMobile ? `
        <div class="row">
          <span class="label">${t.mobile}:</span>
          <span class="value">${data.farmerMobile}</span>
        </div>
        ` : ''}
        ${data.farmerVillage ? `
        <div class="row">
          <span class="label">${labels.village}:</span>
          <span class="value">${data.farmerVillage}</span>
        </div>
        ` : ''}
      </div>

      <div class="row">
        <span class="label">${labels.product}:</span>
        <span class="value">${data.productName}</span>
      </div>
      <div class="row">
        <span class="label">${labels.quantity}:</span>
        <span class="value">${data.quantity} ${data.unit}</span>
      </div>
      <div class="row">
        <span class="label">${labels.rate}:</span>
        <span class="value">₹${data.rate}/${data.unit}</span>
      </div>

      <div class="total">
        ${labels.total}: ₹${data.totalAmount.toFixed(2)}
      </div>

      <div style="text-align: center;">
        <span class="status ${data.paymentStatus === 'paid' ? 'paid' : 'pending'}">
          ${labels.status}: ${data.paymentStatus === 'paid' ? labels.paid : labels.pending}
        </span>
      </div>

      <div class="footer">
        <p>${labels.thankYou}</p>
      </div>
    </body>
    </html>
  `;
};

export const printPurchaseReceipt = async (data: Parameters<typeof generatePurchaseReceiptHTML>[0]): Promise<void> => {
  const html = generatePurchaseReceiptHTML(data);
  await Print.printAsync({ html });
};

export const sharePurchaseReceiptAsPDF = async (data: Parameters<typeof generatePurchaseReceiptHTML>[0]): Promise<void> => {
  const html = generatePurchaseReceiptHTML(data);
  const { uri } = await Print.printToFileAsync({ html });
  
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: `Receipt ${data.receiptNumber}`,
      UTI: 'com.adobe.pdf',
    });
  }
};
