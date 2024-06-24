import express from 'express';
import 'express-async-errors';
import routes from './routes';
import ErrorHandlerMiddleware from './middlewares/ErrorHandlerMiddleware';

const app: express.Application = express();
const errorHandler: ErrorHandlerMiddleware = new ErrorHandlerMiddleware();

app.use(express.json());
app.use('/api', routes);
app.use(errorHandler.handleErrors);

export default app;
