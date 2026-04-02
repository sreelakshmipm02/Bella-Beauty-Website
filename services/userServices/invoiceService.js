import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable"; 

/**
 * ---------------------------------------------------------
 * PDF INVOICE GENERATOR SERVICE
 * ---------------------------------------------------------
 * This service takes a completed order object and constructs a professional,
 * brand-aligned PDF using jsPDF. It's designed to be sent as a buffer 
 * for immediate browser download.
 */
export const generateInvoicePDF = async (order) => {
    const doc = new jsPDF();

    // 1. BRANDING & HEADER
    // We use Aura Pink (RGB: 236, 72, 153) to stay consistent with the web UI
    doc.setFontSize(22);
    doc.setTextColor(236, 72, 153); 
    doc.text("BELLA", 14, 20);
    
    doc.setFontSize(10);
    doc.setTextColor(100); // Subtle grey for secondary labels
    doc.text("Tax Invoice", 14, 28);

    // 2. ORDER METADATA (Positioned Top Right)
    doc.setTextColor(0);
    doc.text(`Order ID: ${order.orderId}`, 140, 20);
    doc.text(`Date: ${new Date(order.createdAt).toLocaleDateString('en-IN')}`, 140, 26);
    doc.text(`Payment: ${order.payment.method}`, 140, 32);

    // 3. CUSTOMER BILLING DETAILS
    doc.setFontSize(12);
    doc.text("Bill To:", 14, 45);
    doc.setFontSize(10);
    doc.setTextColor(60);
    // Passing an array to .text() automatically handles line breaks
    doc.text([
        order.shippingAddress.fullName,
        order.shippingAddress.addressLine1,
        `${order.shippingAddress.city}, ${order.shippingAddress.state}`,
        `Phone: ${order.shippingAddress.phone}`
    ], 14, 52);

    // 4. ITEMIZED PRODUCTS TABLE
    // Mapping order items into the specific format required by autoTable
    const tableColumn = ["Product", "Price", "Quantity", "Total"];
    const tableRows = order.items.map(item => [
        item.productName,
        `Rs. ${item.price}`,
        item.quantity,
        `Rs. ${item.itemTotal}`
    ]);

    // Using the autoTable plugin directly to generate the striped list
    autoTable(doc, {
        startY: 80,
        head: [tableColumn],
        body: tableRows,
        theme: 'striped',
        headStyles: { fillColor: [236, 72, 153] }, // Matching brand header color
        styles: { fontSize: 9 }
    });

    // 5. FINANCIAL SUMMARY
    // We calculate the Y position dynamically so it appears right after the table ends
    const finalY = doc.lastAutoTable.finalY + 10;
    doc.setFontSize(10);
    doc.setTextColor(0);
    doc.text(`Subtotal: Rs. ${order.summary.subtotal}`, 140, finalY);
    doc.text(`GST (18%): Rs. ${order.summary.tax}`, 140, finalY + 6);
    
    doc.setFontSize(12);
    doc.text(`Total Amount: Rs. ${order.summary.total}`, 140, finalY + 14);

    // 6. PAGE FOOTER
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text("Thank you for shopping with Aura! This is a computer-generated invoice.", 14, 285);

    // We output an arraybuffer and convert it to a Node Buffer for the response stream
    return Buffer.from(doc.output('arraybuffer'));
};