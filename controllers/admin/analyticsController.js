import { asyncHandler } from "../../middlewares/asyncHandler.js";
import {
    getSalesAnalytics,
    generateSalesReportPdfBuffer,
    generateSalesReportExcelBuffer
} from "../../services/adminServices/analyticsService.js";
import AppError from "../../utils/AppError.js";

const buildReportFileName = (analytics, extension) => {
    const period = analytics.filters.period || "weekly";
    const from = analytics.filters.from || "start";
    const to = analytics.filters.to || "end";
    return `Bella-Sales-Report-${period}-${from}-to-${to}.${extension}`;
};

export const analyticsPage = asyncHandler(async (req, res) => {
    // Fetches the data using your existing powerful service
    const analytics = await getSalesAnalytics(req.query);

    res.render("admin/analytics", {
        title: "Sales Analytics - Bella Admin",
        analytics,
        path: '/admin/analytics' // Helps highlight the active sidebar link
    });
});

export const downloadSalesReport = asyncHandler(async (req, res) => {
    const format = String(req.params.format || "").toLowerCase();
    const analytics = await getSalesAnalytics(req.query);

    if (format === "pdf") {
        const pdfBuffer = await generateSalesReportPdfBuffer(analytics);
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="${buildReportFileName(analytics, "pdf")}"`);
        return res.send(pdfBuffer);
    }

    if (format === "excel") {
        const excelBuffer = await generateSalesReportExcelBuffer(analytics);
        res.setHeader("Content-Type", "application/vnd.ms-excel; charset=utf-8");
        res.setHeader("Content-Disposition", `attachment; filename="${buildReportFileName(analytics, "xls")}"`);
        return res.send(excelBuffer);
    }

    throw new AppError("Unsupported report format requested.", 400);
});
