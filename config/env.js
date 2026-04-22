import dotenv from "dotenv";

if (!globalThis.__bellaEnvLoaded) {
    dotenv.config({ quiet: true });
    globalThis.__bellaEnvLoaded = true;
}
