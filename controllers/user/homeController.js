import { getActiveCategories, getFeaturedProducts } from "../../services/userServices/homeService.js";

// Serves as the main entry point for the storefront.
// Notice how clean this is! By moving the complex database aggregations into the service layer, 
// this controller only has to worry about checking the user's session and handing data off to the view.
export const getHomePage = async (req, res) => {
    try {
        // A quick boolean check to see if we should render the "Logout" or "Login" buttons in the navbar
        const isLoggedIn = !!req.session.userId;

        // Fetch the active categories and exactly 4 featured products simultaneously
        const categories = await getActiveCategories();
        const featuredProducts = await getFeaturedProducts(4);

        // Inject the fetched data directly into the EJS template so it can loop through the arrays and build the grid
        res.render("user/home", {
            title: "Bella Beauty",
            isLoggedIn,
            categories,
            featuredProducts
        });

    } catch (error) {
        console.error("Home Page Error:", error);
        
        // This is a crucial safety net. If the database crashes or a query fails, 
        // we don't want the customer to see an ugly raw error page. 
        // Instead, we render the normal homepage but pass empty arrays so the UI gracefully shows "No products found."
        res.render("user/home", { 
            title: "Bella Beauty", 
            isLoggedIn: false, 
            categories: [], 
            featuredProducts: [] 
        });
    }
};