import express from 'express';
import { errorHandler } from './middlewares/errorHandler';

const app = express();
app.use(express.json());

app.get('/', (req, res) => {
    console.log('Hello World');
    res.send('Hello World');
});

app.use(errorHandler);

export default app;
