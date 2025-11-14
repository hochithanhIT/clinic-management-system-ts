import dotenv from 'dotenv';

dotenv.config();

interface Config {
    host: string;
    port: number;
}

const appConfig: Config = {
    host: process.env.APP_HOST as string, 
    port: parseInt(process.env.APP_PORT as string)
};

export default appConfig;