/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 */
define(['N/url', 'N/currentRecord'], (url, currentRecord) => {
  const scriptId = 'customscript_jj_sl_custom_so_page';
  const deploymentId = 'customdeploy_jj_sl_custom_so_page';
 
  const fieldChanged = (context) => {
    const record = currentRecord.get();
 
    const fieldMap = {
      custpage_jj_status_filter: 'custpage_jj_status_filter',
      custpage_jj_customer_filter: 'custpage_jj_customer_filter',
      custpage_jj_subsidiary_filter: 'custpage_jj_subsidiary_filter',
      custpage_jj_department_filter: 'custpage_jj_department_filter'
    };
 
    if (Object.keys(fieldMap).includes(context.fieldId)) {
      const params = {};
 
      Object.keys(fieldMap).forEach(fieldId => {
        const value = record.getValue({ fieldId });
        if (value) {
          params[fieldMap[fieldId]] = value;
        }
      });
 
      const resolvedUrl = url.resolveScript({
        scriptId,
        deploymentId,
        params
      });
 
      window.location.href = resolvedUrl;
    }
  };
 
  return { fieldChanged };
});
 
 