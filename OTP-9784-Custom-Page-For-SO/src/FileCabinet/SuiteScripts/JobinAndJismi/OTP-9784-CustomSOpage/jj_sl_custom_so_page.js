/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @NModuleScope Public
 */

/************************************************************************************************
 *  
 * Script Name  : OTP-9784 : Custom Sales Order Page
 *
 ************************************************************************************************
 *
 * Author       : Jobin and Jismi IT Services
 * Date Created : 11-November-2025
 *
 * Description  : Suitelet to display Sales Orders with filters for status, customer, subsidiary,
 *                and department. Results are shown in a sublist with key transaction details.
 *
 * REVISION HISTORY
 *
 * @version 1.0 : 11-November-2025 : Initial build created by JJ0413
 * @version 1.1 : 15-November-2025 : Naming/indentation fixes, added try/catch in all functions
 * @version 1.2 : 17-November-2025 : Final formatting and naming convention fixes by JJ0413
 *
 ************************************************************************************************/

define(['N/log', 'N/search', 'N/ui/serverWidget'], (log, search, serverWidget) => {

  /**
   * Entry point for Suitelet execution.
   * @param {Object} scriptContext - Suitelet context containing request and response.
   * @returns {void}
   */
  const onRequest = (scriptContext) => {
    try {
      const { request, response } = scriptContext;

      const salesOrderForm = createFormWithFilters();
      applyDefaultFilterValues(salesOrderForm, request.parameters);

      const salesOrderSublist = buildSalesOrderSublist(salesOrderForm);
      const searchFilters = buildSearchFilters(request.parameters);
      const searchResults = runSalesOrderSearch(searchFilters);

      populateSublistWithResults(salesOrderSublist, searchResults);

      response.writePage(salesOrderForm);
    } catch (e) {
         log.error({ title: 'Suitelet Error', details: e });
         scriptContext.response.write('An unexpected error occurred. Please contact your administrator.');
    }
  };

  /**
   * Creates the Suitelet form with filter fields.
   * @returns {serverWidget.Form} Configured form object.
   */
  function createFormWithFilters() {
    try {
      const form = serverWidget.createForm({ title: 'Sales Orders by Status' });
      form.clientScriptModulePath = 'SuiteScripts/JobinAndJismi/OTP-9784-CustomSOpage/jj_ue_custom_so_page.js';

      const statusField = form.addField({
        id: 'custpage_jj_status_filter',
        type: serverWidget.FieldType.SELECT,
        label: 'Status',
        source: 'salesorderstatus'
      });
      statusField.addSelectOption({ value: '', text: '' });
      statusField.addSelectOption({ value: 'SalesOrd:B', text: 'Pending Fulfillment' });
      statusField.addSelectOption({ value: 'SalesOrd:F', text: 'Pending Billing' });

      form.addField({
        id: 'custpage_jj_customer_filter',
        type: serverWidget.FieldType.SELECT,
        label: 'Customer',
        source: 'customer'
      });

      form.addField({
        id: 'custpage_jj_subsidiary_filter',
        type: serverWidget.FieldType.SELECT,
        label: 'Subsidiary',
        source: 'subsidiary'
      });

      form.addField({
        id: 'custpage_jj_department_filter',
        type: serverWidget.FieldType.SELECT,
        label: 'Department',
        source: 'department'
      });

      return form;
    }    catch (e) {
         log.error({ title: 'createFormWithFilters Error', details: e });
         throw e;
    }
  }

  /**
   * Applies default values to filter fields based on request parameters.
   * @param {serverWidget.Form} form - The Suitelet form.
   * @param {Object} params - Request parameters.
   * @returns {void}
   */
  function applyDefaultFilterValues(form, params) {
    try {
      const filterIds = [
        'custpage_jj_status_filter',
        'custpage_jj_customer_filter',
        'custpage_jj_subsidiary_filter',
        'custpage_jj_department_filter'
      ];

      filterIds.forEach(id => {
        if (params[id]) {
          try {
            form.getField({ id }).defaultValue = params[id];
          } catch (innerErr) {
            log.debug({ title: `Default value set failed for ${id}`, details: innerErr });
          }
        }
      });
    }    catch (e) {
         log.error({ title: 'applyDefaultFilterValues Error', details: e });
         throw e;
    }
  }

  /**
   * Builds the sublist to display Sales Orders.
   * @param {serverWidget.Form} form - The Suitelet form.
   * @returns {serverWidget.Sublist} Sublist object.
   */
  function buildSalesOrderSublist(form) {
    try {
      const salesOrderSublist = form.addSublist({
        id: 'custpage_jj_salesorder_sublist',
        type: serverWidget.SublistType.LIST,
        label: 'Sales Orders'
      });

      const sublistFields = [
        { id: 'custpage_jj_so_internalid', type: serverWidget.FieldType.TEXT, label: 'Internal ID' },
        { id: 'custpage_jj_so_tranid', type: serverWidget.FieldType.TEXT, label: 'Document Name' },
        { id: 'custpage_jj_so_date', type: serverWidget.FieldType.DATE, label: 'Date' },
        { id: 'custpage_jj_so_status', type: serverWidget.FieldType.TEXT, label: 'Status' },
        { id: 'custpage_jj_so_customer', type: serverWidget.FieldType.TEXT, label: 'Customer Name' },
        { id: 'custpage_jj_so_subsidiary', type: serverWidget.FieldType.TEXT, label: 'Subsidiary' },
        { id: 'custpage_jj_so_department', type: serverWidget.FieldType.TEXT, label: 'Department' },
        { id: 'custpage_jj_so_class', type: serverWidget.FieldType.TEXT, label: 'Class' },
        { id: 'custpage_jj_so_subtotal', type: serverWidget.FieldType.CURRENCY, label: 'Subtotal' },
        { id: 'custpage_jj_so_tax', type: serverWidget.FieldType.CURRENCY, label: 'Tax' },
        { id: 'custpage_jj_so_total', type: serverWidget.FieldType.CURRENCY, label: 'Total' }
      ];

      sublistFields.forEach(field => salesOrderSublist.addField(field));
      return salesOrderSublist;
    }    catch (e) {
         log.error({ title: 'buildSalesOrderSublist Error', details: e });
         throw e;
    }
  }

  /**
   * Builds search filters based on request parameters.
   * @param {Object} params - Request parameters.
   * @returns {Array} Search filters.
   */
  function buildSearchFilters(params) {
    try {
      const filters = [
        ['mainline', 'is', 'T'],
        'AND',
        ['status', 'anyof', ['SalesOrd:B', 'SalesOrd:F']]
      ];

      if (params.custpage_jj_status_filter) {
        filters.push('AND', ['status', 'anyof', params.custpage_jj_status_filter]);
      }
      if (params.custpage_jj_customer_filter) {
        filters.push('AND', ['entity', 'anyof', params.custpage_jj_customer_filter]);
      }
      if (params.custpage_jj_subsidiary_filter) {
        filters.push('AND', ['subsidiary', 'anyof', params.custpage_jj_subsidiary_filter]);
      }
      if (params.custpage_jj_department_filter) {
        filters.push('AND', ['department', 'anyof', params.custpage_jj_department_filter]);
      }

      return filters;
    }    catch (e) {
         log.error({ title: 'buildSearchFilters Error', details: e });
         throw e;
    }
  }

  /**
   * Executes the Sales Order search.
   * @param {Array} searchFilters - Search filters.
   * @returns {Array} Search results.
   */
  function runSalesOrderSearch(searchFilters) {
    try {
      const salesOrderSearchObj = search.create({
        type: search.Type.SALES_ORDER,
        filters: searchFilters,
        columns: [
          'internalid', 'tranid', 'trandate', 'statusref', 'entity',
          'subsidiary', 'department', 'class', 'grossamount', 'taxamount', 'amount'
        ]
      });

      const searchResults = [];
      salesOrderSearchObj.run().each(result => {
        searchResults.push(result);
        return true;
      });
      return searchResults;
    }    catch (e) {
         log.error({ title: 'runSalesOrderSearch Error', details: e });
         throw e;
    }
  }

 /**
 * Populates the sublist with search results.
 * @param {serverWidget.Sublist} salesOrderSublist - Sublist object.
 * @param {Array} searchResults - Search results.
 * @returns {void}
 */
function populateSublistWithResults(salesOrderSublist, searchResults) {
  try {
    searchResults.forEach((result, line) => {
      safeSet(salesOrderSublist, { id: 'custpage_jj_so_internalid', line, value: result.getValue('internalid') });
      safeSet(salesOrderSublist, { id: 'custpage_jj_so_tranid', line, value: result.getValue('tranid') });
      safeSet(salesOrderSublist, { id: 'custpage_jj_so_date', line, value: result.getValue('trandate') });
      safeSet(salesOrderSublist, { id: 'custpage_jj_so_status', line, value: result.getText('statusref') });
      safeSet(salesOrderSublist, { id: 'custpage_jj_so_customer', line, value: result.getText('entity') });
      safeSet(salesOrderSublist, { id: 'custpage_jj_so_subsidiary', line, value: result.getText('subsidiary') });
      safeSet(salesOrderSublist, { id: 'custpage_jj_so_department', line, value: result.getText('department') });
      safeSet(salesOrderSublist, { id: 'custpage_jj_so_class', line, value: result.getText('class') });
      safeSet(salesOrderSublist, { id: 'custpage_jj_so_subtotal', line, value: result.getValue('grossamount') });
      safeSet(salesOrderSublist, { id: 'custpage_jj_so_tax', line, value: result.getValue('taxamount') });
      safeSet(salesOrderSublist, { id: 'custpage_jj_so_total', line, value: result.getValue('amount') });
    });
  }    catch (e) {
       log.error({ title: 'populateSublistWithResults Error', details: e });
       throw e;
  }
}

/**
 * Safely sets a sublist value with normalization and error handling.
 * @param {serverWidget.Sublist} sublist - Target sublist.
 * @param {Object} options - Options for setting value.
 * @param {string} options.id - Field id.
 * @param {number} options.line - Line index.
 * @param {string|number|Date|null} options.value - Value to set.
 * @returns {void}
 */
function safeSet(sublist, { id, line, value }) {
  try {
    let normalizedValue = value ?? '';
    if (normalizedValue instanceof Date) {
      normalizedValue = normalizedValue.toISOString().split('T')[0];
    } else {
      normalizedValue = String(normalizedValue);
    }
    sublist.setSublistValue({ id, line, value: normalizedValue });
  }    catch (err) {
       log.error({ title: 'safeSet failed', details: { id, line, error: err } });
  }
}

return { onRequest };
});
