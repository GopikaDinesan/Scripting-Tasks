/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @NModuleScope SameAccount
 *//************************************************************************************************
 *  
 * TITLE : Online Sales Order Creation Suitelet
 *
*************************************************************************************************
 *
 * Author: Jobin and Jismi IT Services
 *
 * Date Created : 12-November-2025
 *
 * Description : Suitelet to create Sales Orders.
 *                - Collects customer details.
 *                - Item sublist with mandatory Quantity & Price.
 *                - Checks duplicate customers by email.
 *                - Creates Sales Order for existing or new customer.
 *                - Customers are always created as individuals (not companies).
 * REVISION HISTORY
 *
 * @version 1.0 : 12-November-2025 : Initial build created by JJ0413
 *
*************************************************************************************************/

define(['N/ui/serverWidget', 'N/search', 'N/record', 'N/log'],
  (serverWidget, search, record, log) => {

  /**
   * Entry point for Suitelet execution.
   * Decides whether to render the form (GET) or process submission (POST).
   * @param {Object} context - Suitelet context object
   */
  function onRequest(context) {
    try {
      if (context.request.method === 'GET') {
        const form = buildForm();
        context.response.writePage(form);
      } else {
        handlePost(context);
      }
    } catch (e) {
      safeLogError('onRequest Error', e);
      writeError(context, friendlyError(e));
    }
  }

  /**
   * Builds the Suitelet form with customer fields and item sublist.
   * @returns {serverWidget.Form} Suitelet form object
   */
  function buildForm() {
    const form = serverWidget.createForm({ title: 'Create Sales Order' });

    // Customer fields
    form.addField({ id: 'custpage_firstname', type: serverWidget.FieldType.TEXT, label: 'First Name' }).isMandatory = true;
    form.addField({ id: 'custpage_lastname', type: serverWidget.FieldType.TEXT, label: 'Last Name' }).isMandatory = true;
    form.addField({ id: 'custpage_email', type: serverWidget.FieldType.EMAIL, label: 'Email Address' }).isMandatory = true;
    form.addField({ id: 'custpage_phone', type: serverWidget.FieldType.PHONE, label: 'Phone Number' }).isMandatory = true;

    // Item sublist
    const sublist = form.addSublist({ id: 'custpage_item_sublist', type: serverWidget.SublistType.INLINEEDITOR, label: 'Items' });
    sublist.addField({ id: 'custcol_item', type: serverWidget.FieldType.SELECT, label: 'Item', source: 'item' }).isMandatory = true;
    sublist.addField({ id: 'custcol_description', type: serverWidget.FieldType.TEXTAREA, label: 'Description' })
      .updateDisplayType({ displayType: serverWidget.FieldDisplayType.DISABLED });
    sublist.addField({ id: 'custcol_quantity', type: serverWidget.FieldType.FLOAT, label: 'Quantity' }).isMandatory = true;
    sublist.addField({ id: 'custcol_rate', type: serverWidget.FieldType.CURRENCY, label: 'Price' }).isMandatory = true;
    sublist.addField({ id: 'custcol_amount', type: serverWidget.FieldType.CURRENCY, label: 'Amount' })
      .updateDisplayType({ displayType: serverWidget.FieldDisplayType.DISABLED });

    form.clientScriptModulePath = 'SuiteScripts/JobinAndJismi/OTP-000-DemoTask/jj_cs_salesorderform.js';
    form.addSubmitButton({ label: 'Submit Order' });
    return form;
  }

  /**
   * Handles POST submission: validates input, creates customer and Sales Order.
   * @param {Object} context - Suitelet context object
   */
  function handlePost(context) {
    try {
      const req = context.request;
      const firstName = (req.parameters.custpage_firstname || '').trim();
      const lastName  = (req.parameters.custpage_lastname  || '').trim();
      const emailAddr = (req.parameters.custpage_email     || '').trim();
      const phone     = (req.parameters.custpage_phone     || '').trim();

      if (!firstName || !lastName || !emailAddr || !phone) {
        writeError(context, 'All customer fields are required.');
        return;
      }

      const lines = parseItemLines(req);
      if (!lines.length) {
        writeError(context, 'Please add at least one valid item line with Quantity and Price.');
        return;
      }

      const customerId = getOrCreateCustomer({ firstName, lastName, emailAddr, phone });
      const soId = createSalesOrder({ customerId, lines });

      const successForm = serverWidget.createForm({ title: 'Sales Order Created' });
      successForm.addField({ id: 'custpage_success', type: serverWidget.FieldType.INLINEHTML, label: 'Success' })
        .defaultValue = `<p>Sales Order ${soId} created successfully.</p>`;
      context.response.writePage(successForm);
    } catch (e) {
      safeLogError('handlePost Error', e);
      writeError(context, friendlyError(e));
    }
  }

  /**
   * Parses item sublist lines from request.
   * Ensures both Quantity and Price are entered.
   * @param {Object} request - Suitelet request object
   * @returns {Array<Object>} Array of item lines with itemId, quantity, rate
   */
  function parseItemLines(request) {
    const lines = [];
    const lineCount = request.getLineCount({ group: 'custpage_item_sublist' }) || 0;
    for (let i = 0; i < lineCount; i++) {
      const itemId = request.getSublistValue({ group: 'custpage_item_sublist', name: 'custcol_item', line: i });
      const qty = Number(request.getSublistValue({ group: 'custpage_item_sublist', name: 'custcol_quantity', line: i })) || 0;
      const rate = Number(request.getSublistValue({ group: 'custpage_item_sublist', name: 'custcol_rate', line: i })) || 0;
      if (itemId && qty > 0 && rate > 0) {
        lines.push({ itemId, quantity: qty, rate });
      }
    }
    return lines;
  }

  /**
   * Finds or creates customer based on email.
   * Always creates as an individual (not company).
   * @param {Object} params - Customer details
   * @param {string} params.firstName - Customer first name
   * @param {string} params.lastName - Customer last name
   * @param {string} params.emailAddr - Customer email
   * @param {string} params.phone - Customer phone
   * @returns {number} Customer internal ID
   */
  function getOrCreateCustomer({ firstName, lastName, emailAddr, phone }) {
    const existing = search.create({
      type: search.Type.CUSTOMER,
      filters: [['email', 'is', emailAddr]],
      columns: ['internalid']
    }).run().getRange({ start: 0, end: 1 });
    if (existing && existing.length) return existing[0].getValue('internalid');

    const custRec = record.create({ type: record.Type.CUSTOMER, isDynamic: true });

    // Subsidiary must be set first in OneWorld
    custRec.setValue({ fieldId: 'subsidiary', value: 11 }); // replace with your subsidiary ID

    // Always individual
    custRec.setValue({ fieldId: 'isperson', value: true });
    custRec.setValue({ fieldId: 'firstname', value: firstName });
    custRec.setValue({ fieldId: 'lastname', value: lastName });
    custRec.setValue({ fieldId: 'email', value: emailAddr });
    custRec.setValue({ fieldId: 'phone', value: phone });

    return custRec.save();
  }

  /**
   * Creates Sales Order in Pending Fulfillment status.
   * @param {Object} params - Customer ID and item lines
   * @param {number} params.customerId - Customer internal ID
   * @param {Array<Object>} params.lines - Array of item lines
   * @returns {number} Sales Order internal ID
   */
  function createSalesOrder({ customerId, lines }) {
    try {
      const so = record.create({ type: record.Type.SALES_ORDER, isDynamic: true });
      so.setValue({ fieldId: 'entity', value: customerId });
      so.setValue({ fieldId: 'orderstatus', value: 'B' }); // Pending Fulfillment

      lines.forEach(line => {
        so.selectNewLine({ sublistId: 'item' });
        so.setCurrentSublistValue({ sublistId: 'item', fieldId: 'item', value: line.itemId });
        so.setCurrentSublistValue({ sublistId: 'item', fieldId: 'quantity', value: line.quantity });
        so.setCurrentSublistValue({ sublistId: 'item', fieldId: 'rate', value: line.rate });
        so.commitLine({ sublistId: 'item' });
      });

            return so.save({ enableSourcing: true, ignoreMandatoryFields: false });
    } catch (e) {
      safeLogError('createSalesOrder Error', e);
      throw e;
    }
  }

  /**
   * Writes an error page back to the requester.
   * @param {Object} context - Suitelet context
   * @param {string} message - Error message to display
   */
  function writeError(context, message) {
    const form = serverWidget.createForm({ title: 'Error' });
    form.addField({
      id: 'custpage_err',
      type: serverWidget.FieldType.INLINEHTML,
      label: 'Error'
    }).defaultValue = `<div style="color:#b00020;font-family:Arial;padding:12px;">${escapeHtml(message)}</div>`;
    context.response.writePage(form);
  }

  /**
   * Escapes HTML special characters for safe display.
   * @param {string} s - String to escape
   * @returns {string} Escaped string
   */
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, m => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[m]);
  }

  /**
   * Converts an error object into a safe, user-friendly message.
   * @param {Error|string} e - Error object or string
   * @returns {string} Friendly error message
   */
  function friendlyError(e) {
    const msg = typeof e === 'string' ? e : (e.message || e.toString());
    return msg.length > 400 ? msg.substring(0, 397) + '...' : msg;
  }

  /**
   * Safely logs errors to NetSuite execution log.
   * @param {string} title - Log title
   * @param {Error|string} err - Error details
   */
  function safeLogError(title, err) {
    const details = (err && (err.message || err.toString())) || String(err);
    log.error({ title, details });
  }

  return { onRequest };
});
