import moment from 'moment/moment';

export default function areDatesEqual(date1: string, date2: string): boolean {
  // Parse dates using Moment.js
  const momentDate1 = moment(date1, ['MMM YYYY', 'YYYY-MM']);
  const momentDate2 = moment(date2, ['MMM YYYY', 'YYYY-MM']);

  // Check if both dates are valid
  if (!momentDate1.isValid() || !momentDate2.isValid()) {
    throw new Error('Invalid date format');
  }

  // Standardize dates to the same format for comparison
  const formattedDate1 = momentDate1.format('YYYY-MM');
  const formattedDate2 = momentDate2.format('YYYY-MM');

  // Compare dates for equality
  return formattedDate1 === formattedDate2;
}
