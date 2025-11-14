import app from './app';
import config from './config/app.config';

app.listen(config.port, () => {
    console.log(`Server is running on port ${config.port}.`);
})