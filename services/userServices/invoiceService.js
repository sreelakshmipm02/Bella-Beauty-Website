import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable"; 

/**
 * ---------------------------------------------------------
 * PDF INVOICE GENERATOR SERVICE
 * ---------------------------------------------------------
 */
export const generateInvoicePDF = async (order) => {
    const doc = new jsPDF();

    // 1. BRANDING & HEADER
    doc.setFontSize(22);
    doc.setTextColor(236, 72, 153); // Aura Pink
    doc.text("BELLA", 14, 20);
    
    doc.setFontSize(10);
    doc.setTextColor(100); 
    doc.text("Tax Invoice", 14, 28);

    // 2. ORDER METADATA
    doc.setTextColor(0);
    doc.text(`Order ID: ${order.orderId}`, 140, 20);
    doc.text(`Date: ${new Date(order.createdAt).toLocaleDateString('en-IN')}`, 140, 26);
    doc.text(`Payment: ${order.payment.method}`, 140, 32);

    // 3. CUSTOMER BILLING DETAILS
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

    // ---------------------------------------------------------
    //  THE FIX: Filter out Cancelled Items
    // ---------------------------------------------------------
    const validItems = order.items.filter(item => item.status !== 'Cancelled');

    // 4. ITEMIZED PRODUCTS TABLE
    const tableColumn = ["Product", "Price", "Quantity", "Total"];
    const tableRows = validItems.map(item => [
        item.productName,
        `Rs. ${item.price.toFixed(2)}`,
        item.quantity,
        `Rs. ${item.itemTotal.toFixed(2)}`
    ]);

    autoTable(doc, {
        startY: 80,
        head: [tableColumn],
        body: tableRows,
        theme: 'striped',
        headStyles: { fillColor: [236, 72, 153] }, 
        styles: { fontSize: 9 }
    });

    // ---------------------------------------------------------
    //  THE FIX: Recalculate Totals for Accurate Billing
    // ---------------------------------------------------------
    let actualSubtotal = 0;
    validItems.forEach(item => {
        actualSubtotal += item.itemTotal; // Sum up only the non-cancelled items
    });

    // Reverse engineer tax from the new total (18% GST)
    const preTaxAmount = actualSubtotal / 1.18;
    const taxAmount = actualSubtotal - preTaxAmount;
    
    // Add shipping cost and deduct discounts if they exist
    const shipping = order.summary.shipping || 0;
    const discount = order.summary.discount || 0;
    const actualFinalTotal = actualSubtotal + shipping - discount;

    // 5. FINANCIAL SUMMARY
    const finalY = doc.lastAutoTable.finalY + 10;
    doc.setFontSize(10);
    doc.setTextColor(0);
    
    doc.text(`Subtotal: Rs. ${preTaxAmount.toFixed(2)}`, 140, finalY);
    doc.text(`GST (18%): Rs. ${taxAmount.toFixed(2)}`, 140, finalY + 6);
    
    if (shipping > 0) {
        doc.text(`Delivery: Rs. ${shipping.toFixed(2)}`, 140, finalY + 12);
    } else {
        doc.setTextColor(22, 163, 74); // Green color for free delivery
        doc.text(`Delivery: Free`, 140, finalY + 12);
        doc.setTextColor(0); // Reset to black
    }

    if (discount > 0) {
        doc.setTextColor(22, 163, 74);
        doc.text(`Discount: - Rs. ${discount.toFixed(2)}`, 140, finalY + 18);
        doc.setTextColor(0);
    }
    
    // Final Total Position shifts down if shipping/discount exist
    const totalYOffset = (shipping > 0 || discount > 0) ? 26 : 14;
    
    doc.setFontSize(12);
    doc.text(`Total Amount: Rs. ${actualFinalTotal.toFixed(2)}`, 140, finalY + totalYOffset);

    // 6. PAGE FOOTER
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text("Thank you for shopping with Bella! This is a computer-generated invoice.", 14, 285);

    return Buffer.from(doc.output('arraybuffer'));
};