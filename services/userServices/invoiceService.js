import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable"; // Import the plugin directly

export const generateInvoicePDF = async (order) => {
    const doc = new jsPDF();

    // 1. Header & Brand
    doc.setFontSize(22);
    doc.setTextColor(236, 72, 153); // Aura Pink
    doc.text("BELLA", 14, 20);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text("Tax Invoice", 14, 28);

    // 2. Order Info (Top Right)
    doc.setTextColor(0);
    doc.text(`Order ID: ${order.orderId}`, 140, 20);
    doc.text(`Date: ${new Date(order.createdAt).toLocaleDateString('en-IN')}`, 140, 26);
    doc.text(`Payment: ${order.payment.method}`, 140, 32);

    // 3. Shipping Address
    doc.setFontSize(12);
    doc.text("Bill To:", 14, 45);
    doc.setFontSize(10);
    doc.setTextColor(60);
    doc.text([
        order.shippingAddress.fullName,
        order.shippingAddress.addressLine1,
        `${order.shippingAddress.city}, ${order.shippingAddress.state}`,
        `Phone: ${order.shippingAddress.phone}`
    ], 14, 52);

    // 4. Products Table
    const tableColumn = ["Product", "Price", "Quantity", "Total"];
    const tableRows = order.items.map(item => [
        item.productName,
        `Rs. ${item.price}`,
        item.quantity,
        `Rs. ${item.itemTotal}`
    ]);

    // Use the autoTable function directly instead of doc.autoTable
    autoTable(doc, {
        startY: 80,
        head: [tableColumn],
        body: tableRows,
        theme: 'striped',
        headStyles: { fillColor: [236, 72, 153] }, // Aura Pink
        styles: { fontSize: 9 }
    });

    // 5. Total Summary
    // Note: Access the final position using the doc instance's lastAutoTable property
    const finalY = doc.lastAutoTable.finalY + 10;
    doc.setFontSize(10);
    doc.setTextColor(0);
    doc.text(`Subtotal: Rs. ${order.summary.subtotal}`, 140, finalY);
    doc.text(`GST (18%): Rs. ${order.summary.tax}`, 140, finalY + 6);
    doc.setFontSize(12);
    doc.text(`Total Amount: Rs. ${order.summary.total}`, 140, finalY + 14);

    // 6. Footer
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text("Thank you for shopping with Aura! This is a computer-generated invoice.", 14, 285);

    // Return as a Buffer
    return Buffer.from(doc.output('arraybuffer'));
};