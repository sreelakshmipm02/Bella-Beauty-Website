import {
  getActiveCategories,
  getFeaturedProducts,
} from "../../services/userServices/homeService.js";
import { asyncHandler } from "../../middlewares/asyncHandler.js";

// Serves as the main entry point for the storefront.
// Notice how clean this is! By moving the complex database aggregations into the service layer,
// this controller only has to worry about checking the user's session and handing data off to the view.
export const getHomePage = asyncHandler(async (req, res) => {
  const isLoggedIn = !!req.session.userId;
  const categories = await getActiveCategories();
  const featuredProducts = await getFeaturedProducts(4);

  res.render("user/home", {
    title: "Bella Beauty",
    isLoggedIn,
    categories,
    featuredProducts,
  });
});
