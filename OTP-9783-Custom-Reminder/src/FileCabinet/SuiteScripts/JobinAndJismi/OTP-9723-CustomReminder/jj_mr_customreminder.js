/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 */
 
/************************************************************************************************
 *  
 * OTP-9783 : Monthly Overdue Reminder for Customer
 *
*************************************************************************************************
 *
 * Author: Jobin and Jismi IT Services
 *
 * Date Created : 28-October-2025
 *
 * Description : Map/Reduce script identifies overdue invoices, groups them by customer,
 * generates a CSV summary, and sends email notifications with the CSV attached.
 *
 * REVISION HISTORY
 *
 * @version 1.1 : 30-October-2025  : The initial build was created by JJ0413
 *
*************************************************************************************************/
 
define(['N/search', 'N/file', 'N/email', 'N/record'],
  (search, file, email, record) => {
 
    const fallbackSenderId = -5;
 
    /**
     * Creates a saved search for overdue invoices.
     * @returns {search.Search} A NetSuite search object for overdue invoices.
     */
    const createInvoiceSearch = () => {
      try {
        return search.create({
          type: search.Type.INVOICE,
          filters: [
            ['duedate', 'onorbefore', 'lastmonth'],
            'AND',
            ['status', 'anyof', ['CustInvc:A']],
            'AND',
            ['mainline', 'is', 'T']
          ],
          columns: [
            'internalid',
            'tranid',
            'entity',
            'amount',
            'duedate',
            search.createColumn({
              name: 'formulanumeric',
              formula: '{today} - {duedate}',
              label: 'Days Overdue'
            })
          ]
        });
      }     catch (error) {
            log.error('createInvoiceSearch Error', error.message);
      }
    };
 
    /**
     * Retrieves customer email and validates assigned Sales Rep.
     * @param {number} customerId - Internal ID of the customer record.
     * @returns {{email: string|null, salesRepId: number}} Customer email and valid Sales Rep ID (or fallback).
     */
    const getCustomerEmailAndSalesRep = (customerId) => {
      try {
        const customerRecord = record.load({
          type: record.Type.CUSTOMER,
          id: customerId
        });
 
        const isInactive = customerRecord.getValue('isinactive');
        if (isInactive === true) {
          log.audit('Inactive Customer', `Customer ${customerId} is inactive`);
          return { email: null, salesRepId: fallbackSenderId };
        }
 
        const emailAddr = customerRecord.getValue('email');
        if (!emailAddr) {
          log.audit('Missing Email', `Customer ${customerId} has no email`);
          return { email: null, salesRepId: fallbackSenderId };
        }
 
        const salesRepId = customerRecord.getValue('salesrep');
        if (!salesRepId) {
          return { email: emailAddr, salesRepId: fallbackSenderId };
        }
 
        try {
          const employeeRecord = record.load({
            type: record.Type.EMPLOYEE,
            id: salesRepId
          });
 
          const isRepInactive = employeeRecord.getValue('isinactive');
          const repEmail = employeeRecord.getValue('email');
 
          if (isRepInactive === true || !repEmail) {
            log.audit('Inactive or Invalid Sales Rep', `Sales Rep ${salesRepId} is inactive or missing email`);
            return { email: emailAddr, salesRepId: fallbackSenderId };
          }
 
          return { email: emailAddr, salesRepId };
        }     catch (repError) {
              log.error('Sales Rep Load Error', repError.message);
              return { email: emailAddr, salesRepId: fallbackSenderId };
        }
 
      }     catch (error) {
            log.error('getCustomerEmailAndSalesRep Error', error.message);
            return { email: null, salesRepId: fallbackSenderId };
      }
    };
 
    /**
     * Generates a CSV file containing overdue invoice details.
     * @param {string} customerName - Name of the customer.
     * @param {Object[]} invoiceList - List of invoice details.
     * @param {string} customerEmail - Customer email address.
     * @returns {file.File} The generated CSV file object.
     */
    const generateCsvFile = (customerName, invoiceList, customerEmail) => {
      try {
        const csvLines = ['Customer Name,Customer Email,Invoice Number,Invoice Amount,Due Date,Days Overdue'];
        invoiceList.forEach(invoice => {
          csvLines.push(`${invoice.customerName},${customerEmail},${invoice.invoiceNumber},${invoice.invoiceAmount},${invoice.dueDate},${invoice.daysOverdue.toFixed(0)}`);
        });
 
        const csvFile = file.create({
          name: `Overdue_Invoices_${customerName}.csv`,
          fileType: file.Type.CSV,
          contents: csvLines.join('\n'),
          folder: 212
        });
 
        csvFile.save();
        return csvFile;
      }     catch (error) {
            log.error('generateCsvFile Error', error.message);
      }
    };
 
    /**
     * Sends an email with the overdue invoice CSV attached.
     * @param {number} salesRepId - Internal ID of the Sales Rep.
     * @param {number} customerId - Internal ID of the customer.
     * @param {string} customerName - Name of the customer.
     * @param {file.File} csvFile - The CSV file attachment.
     * @param {string} customerEmail - Customer email address.
     * @returns {void}
     */
    const sendEmailWithCsv = (salesRepId, customerId, customerName, csvFile, customerEmail) => {
      try {
        let authorId = fallbackSenderId;
 
        if (salesRepId && salesRepId !== fallbackSenderId) {
          try {
            const employeeRecord = record.load({
              type: record.Type.EMPLOYEE,
              id: salesRepId
            });
            const isRepInactive = employeeRecord.getValue('isinactive');
            const repEmail = employeeRecord.getValue('email');
 
            if (!isRepInactive && repEmail) {
              authorId = salesRepId; // ✅ only use active Sales Rep with email
            } else {
              log.audit('Invalid Sales Rep', `Sales Rep ${salesRepId} inactive or missing email, fallback used`);
              authorId = fallbackSenderId;
            }
          } catch (err) {
            log.error('Sales Rep Validation Error', err.message);
            authorId = fallbackSenderId;
          }
        }
 
        if (!customerEmail) {
          log.audit('Skipping Email', `Customer ${customerId} has no email or is inactive; email not sent.`);
          return;
        }
 
        email.send({
          author: authorId,
          recipients: [customerEmail],
          subject: 'Monthly Overdue Invoice Notification',
          body: `Dear ${customerName},\n\nPlease find attached your overdue invoices as of last month.\n\nRegards,\nFinance Team`,
          attachments: [csvFile]
        });
        log.audit('Email Sent', `Author: ${authorId}, Customer: ${customerName} (${customerEmail})`);
      }     catch (error) {
            log.error('sendEmailWithCsv Error', error.message);
      }
    };
 
    /**
     * Defines the input data for the Map/Reduce script.
     * @returns {search.Search} The search object used as input.
     */
    const getInputData = () => {
      try {
        return createInvoiceSearch();
      }     catch (error) {
            log.error('getInputData Error', error.message);
      }
    };
 
    /**
     * Map stage: processes each search result and writes key/value pairs.
     * @param {Object} context - Map/Reduce context object.
     * @returns {void}
     */
    const map = (context) => {
      try {
        const result = JSON.parse(context.value);
        const invoice = result.values;
 
        const customerId = invoice.entity.value;
        const invoiceDetails = {
          invoiceId: result.id,
          invoiceNumber: invoice.tranid,
          invoiceAmount: invoice.amount,
          dueDate: invoice.duedate,
          daysOverdue: parseFloat(invoice.formulanumeric),
          customerName: invoice.entity.text
        };
 
        context.write({
          key: customerId,
          value: invoiceDetails
        });
      }     catch (error) {
            log.error('map Error', error.message);
      }
    };
 
        /**
     * Reduce stage: groups invoices by customer and sends email notifications.
     * @param {Object} context - Map/Reduce context object.
     * @returns {void}
     */
    const reduce = (context) => {
      try {
        const customerId = context.key;
        const invoiceList = context.values.map(JSON.parse);
        const customerName = invoiceList[0].customerName;

        const { email: customerEmail, salesRepId } = getCustomerEmailAndSalesRep(customerId);
        if (!customerEmail) {
          log.audit('Skipping Email', `Customer ${customerId} skipped due to missing email or inactive status`);
          return;
        }

        const csvFile = generateCsvFile(customerName, invoiceList, customerEmail);
        sendEmailWithCsv(salesRepId, customerId, customerName, csvFile, customerEmail);
      }     catch (error) {
            log.error('reduce Error', error.message);
      }
    };

    /**
     * Entry point for the Map/Reduce script.
     * @returns {{getInputData: Function, map: Function, reduce: Function}}
     */
    return { getInputData, map, reduce };
  });
