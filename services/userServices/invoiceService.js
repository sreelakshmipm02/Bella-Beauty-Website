import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

// This function generates a PDF invoice for an order
export const generateInvoicePDF = async (order) => {
  // Create a new PDF document
  const doc = new jsPDF();

  // -------------------------------
  // 1. HEADER (Brand + Title)
  // -------------------------------

  doc.setFontSize(22);
  doc.setTextColor(236, 72, 153); // Pink color for brand
  doc.text("BELLA", 14, 20);

  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text("Tax Invoice", 14, 28);

  // -------------------------------
  // 2. ORDER DETAILS (Top Right)
  // -------------------------------

  doc.setTextColor(0);
  doc.text(`Order ID: ${order.orderId}`, 140, 20);

  // Format date in Indian format
  doc.text(
    `Date: ${new Date(order.createdAt).toLocaleDateString("en-IN")}`,
    140,
    26,
  );

  doc.text(`Payment: ${order.payment.method}`, 140, 32);

  // -------------------------------
  // 3. CUSTOMER DETAILS
  // -------------------------------

  doc.setFontSize(12);
  doc.text("Bill To:", 14, 45);

  doc.setFontSize(10);
  doc.setTextColor(60);

  // Print address line by line
  doc.text(
    [
      order.shippingAddress.fullName,
      order.shippingAddress.addressLine1,
      `${order.shippingAddress.city}, ${order.shippingAddress.state}`,
      `Phone: ${order.shippingAddress.phone}`,
    ],
    14,
    52,
  );

  // -------------------------------
  // 4. FILTER VALID ITEMS
  // -------------------------------

  // Remove cancelled items from invoice
  const validItems = order.items.filter((item) => item.status !== "Cancelled");

  // -------------------------------
  // 5. PRODUCT TABLE
  // -------------------------------

  const tableColumn = ["Product", "Price", "Quantity", "Total"];

  // Convert items into table rows
  const tableRows = validItems.map((item) => [
    item.productName,
    `Rs. ${item.price.toFixed(2)}`,
    item.quantity,
    `Rs. ${item.itemTotal.toFixed(2)}`,
  ]);

  // Create table using jspdf-autotable
  autoTable(doc, {
    startY: 80,
    head: [tableColumn],
    body: tableRows,
    theme: "striped",
    headStyles: { fillColor: [236, 72, 153] },
    styles: { fontSize: 9 },
  });

  // -------------------------------
  // 6. CALCULATE TOTALS AGAIN
  // -------------------------------

  // Recalculate subtotal only using valid items
  let actualSubtotal = 0;

  validItems.forEach((item) => {
    actualSubtotal += item.itemTotal;
  });

  // Extract tax (assuming price includes GST)
  const preTaxAmount = actualSubtotal / 1.18;
  const taxAmount = actualSubtotal - preTaxAmount;

  // Get extra charges if available
  const shipping = order.summary.shipping || 0;
  const discount = order.summary.discount || 0;

  // Final total calculation
  const actualFinalTotal = actualSubtotal + shipping - discount;

  // -------------------------------
  // 7. SUMMARY SECTION
  // -------------------------------

  const finalY = doc.lastAutoTable.finalY + 10;

  doc.setFontSize(10);
  doc.setTextColor(0);

  doc.text(`Subtotal: Rs. ${preTaxAmount.toFixed(2)}`, 140, finalY);
  doc.text(`GST (18%): Rs. ${taxAmount.toFixed(2)}`, 140, finalY + 6);

  // Show shipping (free or paid)
  if (shipping > 0) {
    doc.text(`Delivery: Rs. ${shipping.toFixed(2)}`, 140, finalY + 12);
  } else {
    doc.setTextColor(22, 163, 74); // Green for free delivery
    doc.text(`Delivery: Free`, 140, finalY + 12);
    doc.setTextColor(0);
  }

  // Show discount if available
  if (discount > 0) {
    doc.setTextColor(22, 163, 74);
    doc.text(`Discount: - Rs. ${discount.toFixed(2)}`, 140, finalY + 18);
    doc.setTextColor(0);
  }

  // Adjust position of final total based on extra rows
  const totalYOffset = shipping > 0 || discount > 0 ? 26 : 14;

  doc.setFontSize(12);
  doc.text(
    `Total Amount: Rs. ${actualFinalTotal.toFixed(2)}`,
    140,
    finalY + totalYOffset,
  );

  // -------------------------------
  // 8. FOOTER
  // -------------------------------

  doc.setFontSize(8);
  doc.setTextColor(150);

  doc.text(
    "Thank you for shopping with Bella! This is a computer-generated invoice.",
    14,
    285,
  );

  // Convert PDF to buffer and return
  return Buffer.from(doc.output("arraybuffer"));
};
