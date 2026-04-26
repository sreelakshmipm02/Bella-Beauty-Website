import { asyncHandler } from "../../middlewares/asyncHandler.js";
import {
    createOfferByAdmin,
    getAdminOffersList,
    getOfferById,
    getOfferFormOptions,
    toggleOfferStatusById,
    updateOfferById
} from "../../services/adminServices/offerManagement.js";

export const getOffersPage = asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = 6;
    const search = req.query.search || "";

    const [{ offers, totalOffers }, { products, categories }] = await Promise.all([
        getAdminOffersList(page, limit, search),
        getOfferFormOptions()
    ]);

    const totalPages = Math.ceil(totalOffers / limit);

    res.render("admin/offers", {
        title: "Offer Management",
        offers,
        products,
        categories,
        searchQuery: search,
        currentPage: page,
        totalPages,
        totalOffers,
        limit
    });
});

export const createOffer = asyncHandler(async (req, res) => {
    await createOfferByAdmin(req.body);
    res.status(201).json({ success: true, message: "Offer created successfully." });
});

export const getOfferDetails = asyncHandler(async (req, res) => {
    const offer = await getOfferById(req.params.id);
    res.status(200).json({ success: true, offer });
});

export const updateOffer = asyncHandler(async (req, res) => {
    await updateOfferById(req.params.id, req.body);
    res.status(200).json({ success: true, message: "Offer updated successfully." });
});

export const toggleOfferStatus = asyncHandler(async (req, res) => {
    const status = await toggleOfferStatusById(req.params.id);
    res.status(200).json({
        success: true,
        message: `Offer ${status === "active" ? "restored" : "soft deleted"} successfully.`,
        status
    });
});
