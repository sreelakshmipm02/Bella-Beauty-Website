import mongoose from "mongoose";

const categorySchema = new mongoose.Schema(
    {
        name : {
            type : String,
            required : true,
            unique : true,
            trim : true
        },
        description : {
            type : String,
            required : false,
            trim : true
        },
        categoryImage : {
            type : String,
            required : false
        },
        categoryAttributes : [{
            type : mongoose.Schema.Types.ObjectId,
            ref : "Attribute"
        }],
        status : {
            type : String,
            enum : ["active","inactive"],
            default : "active"
        },
        createdBy : {
            type : mongoose.Schema.Types.ObjectId,
            ref : "Admin",
            required : true
        }
},{ timestamps : true }
);
export default mongoose.model("Category", categorySchema);