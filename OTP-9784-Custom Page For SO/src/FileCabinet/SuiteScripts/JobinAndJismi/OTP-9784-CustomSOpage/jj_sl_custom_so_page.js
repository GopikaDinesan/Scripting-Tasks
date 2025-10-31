/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 */
define(['N/log', 'N/search', 'N/ui/serverWidget'], (log, search, serverWidget) => {
 
  const CLIENT_SCRIPT_PATH = 'SuiteScripts/JobinAndJismi/OTP-9784-CustomSOpage/jj_cs_custompage.js';
  
 
  const onRequest = (scriptContext) => {
    try {
      const { request, response } = scriptContext;
 
      const form = createFormWithFilters();
      applyDefaultFilterValues(form, request.parameters);
 
      const sublist = buildSalesOrderSublist(form);
      const filters = buildSearchFilters(request.parameters);
      const results = runSalesOrderSearch(filters);
 
      populateSublistWithResults(sublist, results);
 
      response.writePage(form);
    } catch (e) {
      log.error('Suitelet Error', e);
      scriptContext.response.write('An unexpected error occurred. Please contact your administrator.');
    }
  };
 
  function createFormWithFilters() {
    const form = serverWidget.createForm({ title: 'Sales Orders by Status' });
    form.clientScriptModulePath = CLIENT_SCRIPT_PATH;
 
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
  }
 
  function applyDefaultFilterValues(form, params) {
    ['custpage_jj_status_filter', 'custpage_jj_customer_filter', 'custpage_jj_subsidiary_filter', 'custpage_jj_department_filter'].forEach(id => {
      if (params[id]) {
        try {
          form.getField({ id }).defaultValue = params[id];
        } catch (e) {
          log.debug(`Default value set failed for ${id}`, e);
        }
      }
    });
  }
 
  function buildSalesOrderSublist(form) {
    const sublist = form.addSublist({
      id: 'custpage_jj_salesorder_sublist',
      type: serverWidget.SublistType.LIST,
      label: 'Sales Orders'
    });
 
    const fields = [
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
 
    fields.forEach(field => sublist.addField(field));
    return sublist;
  }
 
  function buildSearchFilters(params) {
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
  }
 
  function runSalesOrderSearch(filters) {
    const soSearch = search.create({
      type: search.Type.SALES_ORDER,
      filters,
      columns: [
        'internalid', 'tranid', 'trandate', 'statusref', 'entity',
        'subsidiary', 'department', 'class', 'grossamount', 'taxamount', 'amount'
      ]
    });
 
    const results = [];
    soSearch.run().each(result => {
      results.push(result);
      return true;
    });
    return results;
  }
 
  function populateSublistWithResults(sublist, results) {
    results.forEach((result, line) => {
      safeSet(sublist, { id: 'custpage_jj_so_internalid', line, value: result.getValue('internalid') });
      safeSet(sublist, { id: 'custpage_jj_so_tranid', line, value: result.getValue('tranid') });
      safeSet(sublist, { id: 'custpage_jj_so_date', line, value: result.getValue('trandate') });
      safeSet(sublist, { id: 'custpage_jj_so_status', line, value: result.getText('statusref') });
      safeSet(sublist, { id: 'custpage_jj_so_customer', line, value: result.getText('entity') });
      safeSet(sublist, { id: 'custpage_jj_so_subsidiary', line, value: result.getText('subsidiary') });
      safeSet(sublist, { id: 'custpage_jj_so_department', line, value: result.getText('department') });
      safeSet(sublist, { id: 'custpage_jj_so_class', line, value: result.getText('class') });
      safeSet(sublist, { id: 'custpage_jj_so_subtotal', line, value: result.getValue('grossamount') });
      safeSet(sublist, { id: 'custpage_jj_so_tax', line, value: result.getValue('taxamount') });
      safeSet(sublist, { id: 'custpage_jj_so_total', line, value: result.getValue('amount') });
    });
  }
 
  function safeSet(sublist, { id, line, value }) {
    try {
      let val = value ?? '';
      if (val instanceof Date) {
        val = val.toISOString().split('T')[0];
      } else {
        val = String(val);
      }
      sublist.setSublistValue({ id, line, value: val });
    } catch (err) {
      log.error('safeSet failed', { id, line, error: err });
    }
  }
 
  return { onRequest };
});
 
 