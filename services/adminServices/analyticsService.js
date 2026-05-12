import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import Order from "../../models/order.js";
import Coupon from "../../models/coupon.js";

const VALID_PERIODS = new Set([
  "daily",
  "weekly",
  "monthly",
  "yearly",
  "custom",
]);
const ORDER_STATUS_ORDER = [
  "Pending",
  "Processing",
  "Shipped",
  "Delivered",
  "Return Requested",
  "Return Approved",
  "Returned",
  "Return Rejected",
  "Cancelled",
];
const PAYMENT_METHOD_ORDER = ["Wallet", "Online", "COD"];

const toNumber = (value) => Number(value || 0);
const roundCurrency = (value) => Number(toNumber(value).toFixed(2));
const formatCurrency = (value) =>
  `Rs. ${roundCurrency(value).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const formatDateLabel = (date) =>
  new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(date);
const formatDateTimeLabel = (date) =>
  new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
const formatShortDayLabel = (date) =>
  new Intl.DateTimeFormat("en-IN", { month: "short", day: "numeric" }).format(
    date,
  );
const formatShortMonthLabel = (date) =>
  new Intl.DateTimeFormat("en-IN", { month: "short", year: "numeric" }).format(
    date,
  );
const formatInputDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};
const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const startOfDay = (date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
const endOfDay = (date) =>
  new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    23,
    59,
    59,
    999,
  );
const startOfMonth = (date) =>
  new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
const endOfMonth = (date) =>
  new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);

const buildDateRange = ({ period = "weekly", from = "", to = "" } = {}) => {
  const normalizedPeriod = VALID_PERIODS.has(period) ? period : "weekly";
  const now = new Date();
  let startDate = startOfDay(now);
  let endDate = endOfDay(now);
  let activePeriod = normalizedPeriod;

  if (normalizedPeriod === "weekly") {
    startDate = startOfDay(
      new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6),
    );
  } else if (normalizedPeriod === "monthly") {
    startDate = startOfMonth(now);
    endDate = endOfDay(now);
  } else if (normalizedPeriod === "yearly") {
    startDate = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
    endDate = endOfMonth(new Date(now.getFullYear(), 11, 1));
  } else if (normalizedPeriod === "custom") {
    const parsedFrom = from ? new Date(`${from}T00:00:00`) : null;
    const parsedTo = to ? new Date(`${to}T00:00:00`) : null;
    const hasValidCustomRange =
      parsedFrom instanceof Date &&
      !Number.isNaN(parsedFrom?.getTime?.()) &&
      parsedTo instanceof Date &&
      !Number.isNaN(parsedTo?.getTime?.()) &&
      parsedFrom <= parsedTo;

    if (hasValidCustomRange) {
      startDate = startOfDay(parsedFrom);
      endDate = endOfDay(parsedTo);
    } else {
      activePeriod = "weekly";
      startDate = startOfDay(
        new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6),
      );
    }
  }

  const periodLabels = {
    daily: "Today",
    weekly: "Last 7 Days",
    monthly: "This Month",
    yearly: `Year ${startDate.getFullYear()}`,
    custom: `${formatDateLabel(startDate)} to ${formatDateLabel(endDate)}`,
  };

  return {
    period: activePeriod,
    startDate,
    endDate,
    label: periodLabels[activePeriod] || periodLabels.weekly,
    fromValue: formatInputDate(startDate),
    toValue: formatInputDate(endDate),
  };
};

const allocateAmountAcrossItems = (items = [], totalAmount = 0) => {
  const normalizedItems = Array.isArray(items) ? items : [];
  const allocations = new Map();
  const totalInPaise = Math.round(toNumber(totalAmount) * 100);
  const totalItemValuePaise = normalizedItems.reduce(
    (sum, item) => sum + Math.round(toNumber(item.itemTotal) * 100),
    0,
  );

  if (
    !normalizedItems.length ||
    totalInPaise <= 0 ||
    totalItemValuePaise <= 0
  ) {
    normalizedItems.forEach((item) => allocations.set(String(item._id), 0));
    return allocations;
  }

  const shares = normalizedItems.map((item, index) => {
    const itemValuePaise = Math.round(toNumber(item.itemTotal) * 100);
    const rawShare = (totalInPaise * itemValuePaise) / totalItemValuePaise;
    const flooredShare = Math.floor(rawShare);

    return {
      itemId: String(item._id),
      index,
      paise: flooredShare,
      remainder: rawShare - flooredShare,
    };
  });

  let allocatedPaise = shares.reduce((sum, share) => sum + share.paise, 0);
  let remainingPaise = totalInPaise - allocatedPaise;

  shares
    .sort((left, right) => {
      if (right.remainder === left.remainder) return left.index - right.index;
      return right.remainder - left.remainder;
    })
    .forEach((share) => {
      if (remainingPaise <= 0) return;
      share.paise += 1;
      remainingPaise -= 1;
    });

  shares.forEach((share) => {
    allocations.set(share.itemId, roundCurrency(share.paise / 100));
  });

  return allocations;
};

const getCustomerName = (order) => {
  const firstName = order?.userId?.firstName || "";
  const lastName = order?.userId?.lastName || "";
  const fullName = `${firstName} ${lastName}`.trim();
  return fullName || order?.shippingAddress?.fullName || "Guest User";
};

const getItemOriginalUnitPrice = (item) => {
  const storedOriginalPrice = toNumber(item?.originalPrice);
  if (storedOriginalPrice > 0) return roundCurrency(storedOriginalPrice);

  const currentVariantPrice = toNumber(item?.productVariantId?.price);
  if (currentVariantPrice > 0) return roundCurrency(currentVariantPrice);

  return roundCurrency(item?.price);
};

const getItemOriginalTotal = (item) => {
  const storedOriginalTotal = toNumber(item?.originalItemTotal);
  if (storedOriginalTotal > 0) return roundCurrency(storedOriginalTotal);

  return roundCurrency(
    getItemOriginalUnitPrice(item) * toNumber(item?.quantity),
  );
};

const getOfferDiscount = (order) => {
  const summaryOfferDiscount = toNumber(order?.summary?.offerDiscount);
  if (summaryOfferDiscount > 0) return roundCurrency(summaryOfferDiscount);

  return roundCurrency(
    (order?.items || []).reduce((sum, item) => {
      const storedOfferDiscount = toNumber(item?.offerDiscount);
      if (storedOfferDiscount > 0) {
        return sum + storedOfferDiscount;
      }

      return (
        sum +
        Math.max(getItemOriginalTotal(item) - toNumber(item?.itemTotal), 0)
      );
    }, 0),
  );
};

const getCouponDiscount = (order) => {
  const summaryCouponDiscount = toNumber(order?.summary?.couponDiscount);
  if (summaryCouponDiscount > 0) return roundCurrency(summaryCouponDiscount);
  return roundCurrency(order?.summary?.discount);
};

const getOriginalGrossSubtotal = (order) => {
  const summaryValue = toNumber(order?.summary?.originalGrossSubtotal);
  if (summaryValue > 0) return roundCurrency(summaryValue);

  return roundCurrency(
    (order?.items || []).reduce(
      (sum, item) => sum + getItemOriginalTotal(item),
      0,
    ),
  );
};

const getGrossSubtotalAfterOffers = (order, couponDiscount = null) => {
  const summaryGrossSubtotal = toNumber(order?.summary?.grossSubtotal);
  if (summaryGrossSubtotal > 0) return roundCurrency(summaryGrossSubtotal);

  const normalizedCouponDiscount = couponDiscount ?? getCouponDiscount(order);
  const shipping = roundCurrency(order?.summary?.shipping);
  const finalOrderAmount = roundCurrency(order?.summary?.total);

  return roundCurrency(
    Math.max(finalOrderAmount - shipping + normalizedCouponDiscount, 0),
  );
};

const getEligibleCouponDiscountForAnalytics = (coupon, grossSubtotal) => {
  if (!coupon || grossSubtotal <= 0) return 0;
  if (grossSubtotal < toNumber(coupon.minOrderAmount)) return 0;

  let discount = 0;

  if (coupon.discountType === "percentage") {
    discount = (grossSubtotal * toNumber(coupon.discountValue)) / 100;
    if (coupon.maxDiscount) {
      discount = Math.min(discount, toNumber(coupon.maxDiscount));
    }
  } else {
    discount = toNumber(coupon.discountValue);
  }

  return roundCurrency(Math.max(Math.min(discount, grossSubtotal), 0));
};

const resolveCouponSnapshot = (
  order,
  couponsByCode,
  couponsById,
  allCoupons = [],
) => {
  const storedCouponCode = String(order?.summary?.couponCode || "")
    .trim()
    .toUpperCase();
  const storedCouponId = order?.summary?.couponId
    ? String(order.summary.couponId)
    : "";
  const storedCouponType = order?.summary?.couponDiscountType || "";

  if (storedCouponCode) {
    const matchedCoupon = couponsByCode.get(storedCouponCode);

    return {
      code: storedCouponCode,
      discountType:
        storedCouponType || matchedCoupon?.discountType || "Not Recorded",
    };
  }

  if (storedCouponId) {
    const matchedCoupon = couponsById.get(storedCouponId);

    if (matchedCoupon) {
      return {
        code: matchedCoupon.code,
        discountType:
          storedCouponType || matchedCoupon.discountType || "Not Recorded",
      };
    }
  }

  const couponDiscount = getCouponDiscount(order);

  if (couponDiscount <= 0) {
    return null;
  }

  const grossSubtotal = getGrossSubtotalAfterOffers(order, couponDiscount);
  const orderCreatedAt = order?.createdAt ? new Date(order.createdAt) : null;

  const matchingCoupons = allCoupons.filter((coupon) => {
    if (
      orderCreatedAt &&
      coupon?.createdAt &&
      new Date(coupon.createdAt) > orderCreatedAt
    ) {
      return false;
    }

    if (
      orderCreatedAt &&
      coupon?.expiresAt &&
      new Date(coupon.expiresAt) < orderCreatedAt
    ) {
      return false;
    }

    const expectedDiscount = getEligibleCouponDiscountForAnalytics(
      coupon,
      grossSubtotal,
    );
    return Math.abs(expectedDiscount - couponDiscount) < 0.01;
  });

  if (matchingCoupons.length === 1) {
    return {
      code: matchingCoupons[0].code,
      discountType: matchingCoupons[0].discountType,
      inferred: true,
    };
  }

  return {
    code: "Not Recorded",
    discountType: "Not Recorded",
    inferred: true,
  };
};

const getOrderFinancials = (order) => {
  const shipping = roundCurrency(order?.summary?.shipping);
  const offerDiscount = getOfferDiscount(order);
  const couponDiscount = getCouponDiscount(order);
  const totalDiscount = roundCurrency(
    toNumber(order?.summary?.totalDiscount) || offerDiscount + couponDiscount,
  );
  const originalGrossSubtotal = getOriginalGrossSubtotal(order);
  const grossSubtotal = getGrossSubtotalAfterOffers(order, couponDiscount);
  const grossOrderAmount = roundCurrency(originalGrossSubtotal + shipping);
  const finalOrderAmount = roundCurrency(order?.summary?.total);
  const refundedAmount = roundCurrency(order?.payment?.refundedAmount);
  const isPaidOrder = !["Pending", "Failed"].includes(
    order?.payment?.status || "",
  );
  const retainedRevenue = isPaidOrder
    ? roundCurrency(Math.max(finalOrderAmount - refundedAmount, 0))
    : 0;

  return {
    shipping,
    grossSubtotal,
    offerDiscount,
    couponDiscount,
    totalDiscount,
    grossOrderAmount,
    finalOrderAmount,
    refundedAmount,
    retainedRevenue,
    isPaidOrder,
  };
};

const buildDistributionArray = (inputMap, baseOrder = []) => {
  const seen = new Set();
  const rows = [];

  baseOrder.forEach((key) => {
    if (!inputMap.has(key)) return;
    seen.add(key);
    rows.push({ label: key, ...inputMap.get(key) });
  });

  Array.from(inputMap.keys())
    .filter((key) => !seen.has(key))
    .sort()
    .forEach((key) => rows.push({ label: key, ...inputMap.get(key) }));

  return rows;
};

const buildQueryString = ({ period, from, to }) => {
  const params = new URLSearchParams();
  params.set("period", period);

  if (period === "custom") {
    params.set("from", from);
    params.set("to", to);
  }

  return params.toString();
};

const getDateSpanInDays = (startDate, endDate) => {
  const difference =
    endOfDay(endDate).getTime() - startOfDay(startDate).getTime();
  return Math.max(1, Math.floor(difference / (1000 * 60 * 60 * 24)) + 1);
};

const resolveTrendGranularity = ({ period, startDate, endDate }) => {
  if (period === "yearly") {
    return "month";
  }

  return getDateSpanInDays(startDate, endDate) > 92 ? "month" : "day";
};

const buildTrendBucketKey = (date, granularity) => {
  if (granularity === "month") {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  }

  return formatInputDate(date);
};

const buildTrendBucketLabel = (date, granularity) => {
  if (granularity === "month") {
    return formatShortMonthLabel(date);
  }

  return formatShortDayLabel(date);
};

const buildSalesTrend = (trendMap, dateRange) => {
  const granularity = resolveTrendGranularity(dateRange);
  const rows = [];

  if (granularity === "month") {
    const cursor = startOfMonth(dateRange.startDate);
    const lastMonth = startOfMonth(dateRange.endDate);

    while (cursor <= lastMonth) {
      const bucketDate = new Date(cursor);
      const key = buildTrendBucketKey(bucketDate, granularity);
      const existing = trendMap.get(key);

      rows.push({
        label: buildTrendBucketLabel(bucketDate, granularity),
        orders: existing?.orders || 0,
        grossAmount: roundCurrency(existing?.grossAmount || 0),
        discount: roundCurrency(existing?.discount || 0),
        netRevenue: roundCurrency(existing?.netRevenue || 0),
      });

      cursor.setMonth(cursor.getMonth() + 1);
    }

    return { granularity, rows };
  }

  const cursor = startOfDay(dateRange.startDate);
  const lastDay = startOfDay(dateRange.endDate);

  while (cursor <= lastDay) {
    const bucketDate = new Date(cursor);
    const key = buildTrendBucketKey(bucketDate, granularity);
    const existing = trendMap.get(key);

    rows.push({
      label: buildTrendBucketLabel(bucketDate, granularity),
      orders: existing?.orders || 0,
      grossAmount: roundCurrency(existing?.grossAmount || 0),
      discount: roundCurrency(existing?.discount || 0),
      netRevenue: roundCurrency(existing?.netRevenue || 0),
    });

    cursor.setDate(cursor.getDate() + 1);
  }

  return { granularity, rows };
};

export const getSalesAnalytics = async ({
  period = "weekly",
  from = "",
  to = "",
} = {}) => {
  const dateRange = buildDateRange({ period, from, to });
  const query = {
    createdAt: {
      $gte: dateRange.startDate,
      $lte: dateRange.endDate,
    },
  };

  const orders = await Order.find(query)
    .populate("userId", "firstName lastName email")
    .populate({ path: "items.productVariantId", select: "price" })
    .sort({ createdAt: -1 })
    .lean();

  const allCoupons = await Coupon.find({})
    .select(
      "code discountType discountValue minOrderAmount maxDiscount expiresAt createdAt",
    )
    .lean();
  const couponMapByCode = new Map(
    allCoupons.map((coupon) => [coupon.code, coupon]),
  );
  const couponMapById = new Map(
    allCoupons.map((coupon) => [String(coupon._id), coupon]),
  );

  let salesCount = 0;
  let grossOrderAmount = 0;
  let offerDiscount = 0;
  let couponDiscount = 0;
  let totalDiscount = 0;
  let netRevenue = 0;
  let refundedAmount = 0;
  let paidOrdersCount = 0;
  let totalItemsOrdered = 0;

  const reportRows = [];
  const couponUsageMap = new Map();
  const productBreakdownMap = new Map();
  const orderStatusMap = new Map();
  const paymentMethodMap = new Map();
  const salesTrendMap = new Map();
  const trendGranularity = resolveTrendGranularity(dateRange);

  orders.forEach((order) => {
    const financials = getOrderFinancials(order);
    const customerName = getCustomerName(order);
    const couponSnapshot = resolveCouponSnapshot(
      order,
      couponMapByCode,
      couponMapById,
      allCoupons,
    );
    const couponCode = couponSnapshot?.code || "";
    const orderTotalAllocations = financials.isPaidOrder
      ? allocateAmountAcrossItems(order.items, financials.finalOrderAmount)
      : new Map((order.items || []).map((item) => [String(item._id), 0]));
    const couponAllocations =
      financials.couponDiscount > 0
        ? allocateAmountAcrossItems(order.items, financials.couponDiscount)
        : new Map((order.items || []).map((item) => [String(item._id), 0]));

    salesCount += 1;
    grossOrderAmount += financials.grossOrderAmount;
    offerDiscount += financials.offerDiscount;
    couponDiscount += financials.couponDiscount;
    totalDiscount += financials.totalDiscount;
    netRevenue += financials.retainedRevenue;
    refundedAmount += financials.refundedAmount;
    totalItemsOrdered += (order.items || []).reduce(
      (sum, item) => sum + toNumber(item.quantity),
      0,
    );

    if (financials.isPaidOrder) {
      paidOrdersCount += 1;
    }

    if (couponCode && financials.couponDiscount > 0) {
      const existingCoupon = couponUsageMap.get(couponCode) || {
        code: couponCode,
        timesUsed: 0,
        discountType: couponSnapshot?.discountType || "Not Recorded",
        totalDiscount: 0,
      };

      existingCoupon.timesUsed += 1;
      existingCoupon.totalDiscount = roundCurrency(
        existingCoupon.totalDiscount + financials.couponDiscount,
      );

      couponUsageMap.set(couponCode, existingCoupon);
    }

    const currentOrderStatus = order.orderStatus || "Pending";
    const existingStatus = orderStatusMap.get(currentOrderStatus) || {
      count: 0,
    };
    existingStatus.count += 1;
    orderStatusMap.set(currentOrderStatus, existingStatus);

    const paymentMethod = order?.payment?.method || "Unknown";
    const existingPaymentMethod = paymentMethodMap.get(paymentMethod) || {
      count: 0,
      amount: 0,
      revenue: 0,
    };
    existingPaymentMethod.count += 1;
    existingPaymentMethod.amount = roundCurrency(
      existingPaymentMethod.amount + financials.finalOrderAmount,
    );
    existingPaymentMethod.revenue = roundCurrency(
      existingPaymentMethod.revenue + financials.retainedRevenue,
    );
    paymentMethodMap.set(paymentMethod, existingPaymentMethod);

    const trendDate = new Date(order.createdAt);
    const trendKey = buildTrendBucketKey(trendDate, trendGranularity);
    const existingTrend = salesTrendMap.get(trendKey) || {
      grossAmount: 0,
      discount: 0,
      netRevenue: 0,
      orders: 0,
    };

    existingTrend.orders += 1;
    existingTrend.grossAmount = roundCurrency(
      existingTrend.grossAmount + financials.grossOrderAmount,
    );
    existingTrend.discount = roundCurrency(
      existingTrend.discount + financials.totalDiscount,
    );
    existingTrend.netRevenue = roundCurrency(
      existingTrend.netRevenue + financials.retainedRevenue,
    );
    salesTrendMap.set(trendKey, existingTrend);

    reportRows.push({
      id: order._id,
      orderId: order.orderId,
      date: order.createdAt,
      customerName,
      totalItems: (order.items || []).reduce(
        (sum, item) => sum + toNumber(item.quantity),
        0,
      ),
      grossOrderAmount: financials.grossOrderAmount,
      offerDiscount: financials.offerDiscount,
      couponDiscount: financials.couponDiscount,
      totalDiscount: financials.totalDiscount,
      finalOrderAmount: financials.finalOrderAmount,
      netRevenue: financials.retainedRevenue,
      refundedAmount: financials.refundedAmount,
      paymentMethod,
      paymentStatus: order?.payment?.status || "Pending",
      orderStatus: currentOrderStatus,
      couponCode,
      couponDiscountType: couponSnapshot?.discountType || "",
    });

    (order.items || []).forEach((item) => {
      const itemId = String(item._id);
      const key = item.productName || "Unknown Product";
      const originalItemTotal = getItemOriginalTotal(item);
      const currentOfferDiscount = roundCurrency(
        toNumber(item.offerDiscount) ||
          Math.max(originalItemTotal - toNumber(item.itemTotal), 0),
      );
      const currentCouponDiscount = roundCurrency(
        couponAllocations.get(itemId) || 0,
      );
      const retainedItemRevenue = financials.isPaidOrder
        ? roundCurrency(
            Math.max(
              toNumber(orderTotalAllocations.get(itemId)) -
                toNumber(item?.refund?.amount),
              0,
            ),
          )
        : 0;

      const existingProduct = productBreakdownMap.get(key) || {
        productName: key,
        unitsOrdered: 0,
        grossAmount: 0,
        discount: 0,
        netRevenue: 0,
        returnOrders: 0,
        cancelled: 0,
      };

      existingProduct.unitsOrdered += toNumber(item.quantity);
      existingProduct.grossAmount = roundCurrency(
        existingProduct.grossAmount + originalItemTotal,
      );
      existingProduct.discount = roundCurrency(
        existingProduct.discount + currentOfferDiscount + currentCouponDiscount,
      );
      existingProduct.netRevenue = roundCurrency(
        existingProduct.netRevenue + retainedItemRevenue,
      );

      if (item.status === "Cancelled") {
        existingProduct.cancelled += 1;
      }

      if (
        [
          "Return Requested",
          "Return Approved",
          "Returned",
          "Return Rejected",
        ].includes(item.status)
      ) {
        existingProduct.returnOrders += 1;
      }

      productBreakdownMap.set(key, existingProduct);
    });
  });

  const summary = {
    salesCount,
    totalItemsOrdered,
    grossOrderAmount: roundCurrency(grossOrderAmount),
    offerDiscount: roundCurrency(offerDiscount),
    couponDiscount: roundCurrency(couponDiscount),
    totalDiscount: roundCurrency(totalDiscount),
    netRevenue: roundCurrency(netRevenue),
    refundedAmount: roundCurrency(refundedAmount),
    paidOrdersCount,
    averageOrderValue:
      salesCount > 0 ? roundCurrency(grossOrderAmount / salesCount) : 0,
  };

  const couponUsage = Array.from(couponUsageMap.values()).sort(
    (left, right) =>
      right.timesUsed - left.timesUsed ||
      right.totalDiscount - left.totalDiscount,
  );

  const productBreakdown = Array.from(productBreakdownMap.values()).sort(
    (left, right) =>
      right.unitsOrdered - left.unitsOrdered ||
      right.netRevenue - left.netRevenue,
  );

  const orderStatusDistribution = buildDistributionArray(
    orderStatusMap,
    ORDER_STATUS_ORDER,
  );
  const paymentMethodDistribution = buildDistributionArray(
    paymentMethodMap,
    PAYMENT_METHOD_ORDER,
  );
  const salesTrend = buildSalesTrend(salesTrendMap, dateRange);

  return {
    filters: {
      period: dateRange.period,
      from: dateRange.fromValue,
      to: dateRange.toValue,
      label: dateRange.label,
      queryString: buildQueryString({
        period: dateRange.period,
        from: dateRange.fromValue,
        to: dateRange.toValue,
      }),
    },
    summary,
    recentOrders: reportRows.slice(0, 6),
    reportRows,
    couponUsage,
    productBreakdown,
    orderStatusDistribution,
    paymentMethodDistribution,
    salesTrend,
    topProducts: productBreakdown.slice(0, 5),
  };
};

const buildSummaryRows = (report) => [
  ["Report Range", report.filters.label],
  ["Overall Sales Count", String(report.summary.salesCount)],
  ["Overall Order Amount", formatCurrency(report.summary.grossOrderAmount)],
  ["Product Discounts", formatCurrency(report.summary.offerDiscount)],
  ["Coupon Deductions", formatCurrency(report.summary.couponDiscount)],
  ["Overall Discount", formatCurrency(report.summary.totalDiscount)],
  ["Net Revenue", formatCurrency(report.summary.netRevenue)],
  ["Refunded Amount", formatCurrency(report.summary.refundedAmount)],
];

export const generateSalesReportPdfBuffer = async (report) => {
  const doc = new jsPDF({ orientation: "landscape" });
  const generatedAt = new Date();
  const reportId = `SR-${Date.now()}`;

  doc.setFontSize(22);
  doc.setTextColor(233, 30, 99);
  doc.text("BELLA", 14, 18);

  doc.setFontSize(16);
  doc.setTextColor(17, 24, 39);
  doc.text("Sales Report", 14, 28);

  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Range: ${report.filters.label}`, 14, 36);
  doc.text(`Generated: ${formatDateTimeLabel(generatedAt)}`, 14, 42);
  doc.text(`Report ID: ${reportId}`, 235, 18);

  autoTable(doc, {
    startY: 50,
    head: [["Metric", "Value"]],
    body: buildSummaryRows(report),
    theme: "grid",
    headStyles: { fillColor: [233, 30, 99] },
    styles: { fontSize: 9 },
    columnStyles: {
      0: { cellWidth: 75 },
      1: { cellWidth: 95 },
    },
    margin: { left: 14 },
  });

  const couponTableStartY = doc.lastAutoTable.finalY + 10;
  doc.setFontSize(13);
  doc.setTextColor(17, 24, 39);
  doc.text("Coupon Usage", 14, couponTableStartY);

  autoTable(doc, {
    startY: couponTableStartY + 4,
    head: [["Coupon Code", "Times Used", "Discount Type", "Total Discount"]],
    body: report.couponUsage.length
      ? report.couponUsage.map((coupon) => [
          coupon.code,
          String(coupon.timesUsed),
          coupon.discountType || "Unknown",
          formatCurrency(coupon.totalDiscount),
        ])
      : [["No coupon usage in this period", "", "", ""]],
    theme: "striped",
    headStyles: { fillColor: [15, 23, 42] },
    styles: { fontSize: 8.5 },
    margin: { left: 14 },
  });

  const ordersTableStartY = doc.lastAutoTable.finalY + 10;
  doc.setFontSize(13);
  doc.text("Sales Report", 14, ordersTableStartY);

  autoTable(doc, {
    startY: ordersTableStartY + 4,
    head: [
      [
        "Date",
        "Order ID",
        "Customer",
        "Items",
        "Gross",
        "Discount",
        "Coupon",
        "Net Revenue",
        "Status",
      ],
    ],
    body: report.reportRows.length
      ? report.reportRows.map((row) => [
          formatDateLabel(new Date(row.date)),
          row.orderId,
          row.customerName,
          String(row.totalItems),
          formatCurrency(row.grossOrderAmount),
          formatCurrency(row.totalDiscount),
          row.couponCode || "-",
          formatCurrency(row.netRevenue),
          row.orderStatus,
        ])
      : [["No orders found", "", "", "", "", "", "", "", ""]],
    theme: "grid",
    headStyles: { fillColor: [31, 41, 55] },
    styles: { fontSize: 8 },
    margin: { left: 14 },
  });

  const productTableStartY = doc.lastAutoTable.finalY + 10;
  doc.setFontSize(13);
  doc.text("Product Sales Breakdown", 14, productTableStartY);

  autoTable(doc, {
    startY: productTableStartY + 4,
    head: [
      [
        "Product Name",
        "Units Ordered",
        "Gross Amount",
        "Discount",
        "Net Revenue",
        "Return Orders",
        "Cancelled",
      ],
    ],
    body: report.productBreakdown.length
      ? report.productBreakdown.map((row) => [
          row.productName,
          String(row.unitsOrdered),
          formatCurrency(row.grossAmount),
          formatCurrency(row.discount),
          formatCurrency(row.netRevenue),
          String(row.returnOrders),
          String(row.cancelled),
        ])
      : [["No product data found", "", "", "", "", "", ""]],
    theme: "striped",
    headStyles: { fillColor: [71, 85, 105] },
    styles: { fontSize: 8 },
    margin: { left: 14 },
  });

  const statusTableStartY = doc.lastAutoTable.finalY + 10;
  doc.setFontSize(13);
  doc.text("Order Status Distribution", 14, statusTableStartY);

  autoTable(doc, {
    startY: statusTableStartY + 4,
    head: [["Status", "Count"]],
    body: report.orderStatusDistribution.length
      ? report.orderStatusDistribution.map((row) => [
          row.label,
          String(row.count || 0),
        ])
      : [["No status data", "0"]],
    theme: "grid",
    headStyles: { fillColor: [15, 118, 110] },
    styles: { fontSize: 8.5 },
    margin: { left: 14 },
    tableWidth: 120,
  });

  const paymentTableStartY = doc.lastAutoTable.finalY + 8;
  doc.setFontSize(13);
  doc.text("Payment Method Distribution", 14, paymentTableStartY);

  autoTable(doc, {
    startY: paymentTableStartY + 4,
    head: [["Method", "Orders", "Order Amount", "Retained Revenue"]],
    body: report.paymentMethodDistribution.length
      ? report.paymentMethodDistribution.map((row) => [
          row.label,
          String(row.count || 0),
          formatCurrency(row.amount || 0),
          formatCurrency(row.revenue || 0),
        ])
      : [["No payment data", "0", formatCurrency(0), formatCurrency(0)]],
    theme: "striped",
    headStyles: { fillColor: [124, 58, 237] },
    styles: { fontSize: 8.5 },
    margin: { left: 14 },
  });

  const pageCount = doc.getNumberOfPages();
  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    doc.setPage(pageNumber);
    doc.setFontSize(8);
    doc.setTextColor(140);
    doc.text(
      "Confidential business report generated from Bella admin analytics.",
      14,
      200,
    );
    doc.text(`Page ${pageNumber} of ${pageCount}`, 270, 200, {
      align: "right",
    });
  }

  return Buffer.from(doc.output("arraybuffer"));
};

const buildHtmlTable = (title, headers, rows) => `
    <div style="margin-bottom: 28px;">
        <h3 style="font-size: 18px; margin: 0 0 10px; color: #111827;">${escapeHtml(title)}</h3>
        <table border="1" cellspacing="0" cellpadding="6" style="border-collapse: collapse; width: 100%; font-size: 12px;">
            <thead style="background: #f3f4f6;">
                <tr>${headers.map((header) => `<th style="text-align: left;">${escapeHtml(header)}</th>`).join("")}</tr>
            </thead>
            <tbody>
                ${rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("")}
            </tbody>
        </table>
    </div>
`;

export const generateSalesReportExcelBuffer = async (report) => {
  const generatedAt = new Date();
  const summaryRows = buildSummaryRows(report);

  const html = `
        <html>
            <head>
                <meta charset="utf-8" />
            </head>
            <body style="font-family: Arial, sans-serif; color: #111827;">
                <div style="margin-bottom: 24px;">
                    <h1 style="margin: 0; color: #e91e63;">BELLA</h1>
                    <h2 style="margin: 8px 0 4px;">Sales Report</h2>
                    <p style="margin: 0;">Range: ${escapeHtml(report.filters.label)}</p>
                    <p style="margin: 4px 0 0;">Generated: ${escapeHtml(formatDateTimeLabel(generatedAt))}</p>
                </div>

                ${buildHtmlTable("Summary", ["Metric", "Value"], summaryRows)}

                ${buildHtmlTable(
                  "Coupon Usage",
                  [
                    "Coupon Code",
                    "Times Used",
                    "Discount Type",
                    "Total Discount",
                  ],
                  report.couponUsage.length
                    ? report.couponUsage.map((coupon) => [
                        coupon.code,
                        String(coupon.timesUsed),
                        coupon.discountType || "Unknown",
                        formatCurrency(coupon.totalDiscount),
                      ])
                    : [["No coupon usage in this period", "", "", ""]],
                )}

                ${buildHtmlTable(
                  "Sales Report",
                  [
                    "Date",
                    "Order ID",
                    "Customer",
                    "Items",
                    "Gross",
                    "Discount",
                    "Coupon",
                    "Net Revenue",
                    "Status",
                  ],
                  report.reportRows.length
                    ? report.reportRows.map((row) => [
                        formatDateLabel(new Date(row.date)),
                        row.orderId,
                        row.customerName,
                        String(row.totalItems),
                        formatCurrency(row.grossOrderAmount),
                        formatCurrency(row.totalDiscount),
                        row.couponCode || "-",
                        formatCurrency(row.netRevenue),
                        row.orderStatus,
                      ])
                    : [["No orders found", "", "", "", "", "", "", "", ""]],
                )}

                ${buildHtmlTable(
                  "Product Sales Breakdown",
                  [
                    "Product Name",
                    "Units Ordered",
                    "Gross Amount",
                    "Discount",
                    "Net Revenue",
                    "Return Orders",
                    "Cancelled",
                  ],
                  report.productBreakdown.length
                    ? report.productBreakdown.map((row) => [
                        row.productName,
                        String(row.unitsOrdered),
                        formatCurrency(row.grossAmount),
                        formatCurrency(row.discount),
                        formatCurrency(row.netRevenue),
                        String(row.returnOrders),
                        String(row.cancelled),
                      ])
                    : [["No product data found", "", "", "", "", "", ""]],
                )}

                ${buildHtmlTable(
                  "Order Status Distribution",
                  ["Status", "Count"],
                  report.orderStatusDistribution.length
                    ? report.orderStatusDistribution.map((row) => [
                        row.label,
                        String(row.count || 0),
                      ])
                    : [["No status data", "0"]],
                )}

                ${buildHtmlTable(
                  "Payment Method Distribution",
                  ["Method", "Orders", "Order Amount", "Retained Revenue"],
                  report.paymentMethodDistribution.length
                    ? report.paymentMethodDistribution.map((row) => [
                        row.label,
                        String(row.count || 0),
                        formatCurrency(row.amount || 0),
                        formatCurrency(row.revenue || 0),
                      ])
                    : [
                        [
                          "No payment data",
                          "0",
                          formatCurrency(0),
                          formatCurrency(0),
                        ],
                      ],
                )}
            </body>
        </html>
    `;

  return Buffer.from(html, "utf8");
};
