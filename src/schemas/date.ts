import Joi, { Schema } from '@hapi/joi';
import validators from '../services/InvoiceService/helpers/customValidators';
import config from '../config/default';

const schema: Schema = Joi.object({
  file: Joi.object({
    fieldname: Joi.string().valid('file').required(),
    originalname: Joi.string().required(),
    mimetype: Joi.string()
      .valid(
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' // XLSX mime type
      )
      .required(),
    encoding: Joi.string(),
    size: Joi.number().max(config.MAX_UPLOAD_SIZE_IN_MB).required(),
    buffer: Joi.binary().required(), // Validate file buffer is present
  }).required(),
  invoicingMonth: Joi.string()
    .custom(validators.MOMENT_VALIDATOR, 'custom date format')
    .required(),
});

export default schema;
