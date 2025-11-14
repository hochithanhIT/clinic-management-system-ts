import dotenv from 'dotenv';

dotenv.config();

interface Config {
    port: number;
}

const config: Config = {
    port: Number(process.env.APP_PORT) || 3000, 
}

export default config;