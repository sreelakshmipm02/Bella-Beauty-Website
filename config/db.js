import mongoose from "mongoose";

const connectDB = async(url) => {
    try{
        await mongoose.connect(url);
        console.log("mongodb is connected.");
    } catch(e){
        console.log("error in mongodb connection.",e.message);
        process.exit(1);
    }
};

export default connectDB;