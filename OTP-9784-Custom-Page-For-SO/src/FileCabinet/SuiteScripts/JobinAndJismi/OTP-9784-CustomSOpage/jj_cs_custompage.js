/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 * @NModuleScope Public
 */

/************************************************************************************************
 *  
 * Script Name  : OTP-9784 : Custom Sales Order Page (Client Script)
 *
 ************************************************************************************************
 *
 * Author       : Jobin and Jismi IT Services
 * Date Created : 11-November-2025
 *
 * Description  : Client script to refresh the Suitelet page when filter fields are changed.
 *
 * REVISION HISTORY
 *
 * @version 1.0 : 11-November-2025 : Initial build created by JJ0413
 * @version 1.1 : 17-November-2025 : Naming/indentation fixes, added try/catch in all functions
 * @version 1.2 : 11-November-2025 : Final formatting and naming convention fixes by JJ0413
 *
 ************************************************************************************************/

define(['N/url', 'N/currentRecord', 'N/log'], (url, currentRecord, log) => {

  /**
   * @constant {string} SUITELET_SCRIPT_ID
   * Internal ID of the Suitelet script.
   */
  const SUITELET_SCRIPT_ID = 'jj_sl_custom_so_page';

  /**
   * @constant {string} SUITELET_DEPLOYMENT_ID
   * Internal ID of the Suitelet deployment.
   */
  const SUITELET_DEPLOYMENT_ID = 'customdeploy_jj_sl_custom_so_page';

  /**
   * Handles field change events. Refreshes the Suitelet page with updated filter parameters.
   * @param {Object} context - Field change context.
   * @param {string} context.fieldId - The ID of the field that was changed.
   * @returns {void}
   */
  function fieldChanged(context) {
    try {
      const currentRecordObj = currentRecord.get();

      const filterFieldMap = {
        custpage_jj_status_filter: 'custpage_jj_status_filter',
        custpage_jj_customer_filter: 'custpage_jj_customer_filter',
        custpage_jj_subsidiary_filter: 'custpage_jj_subsidiary_filter',
        custpage_jj_department_filter: 'custpage_jj_department_filter'
      };

      if (Object.keys(filterFieldMap).includes(context.fieldId)) {
        /** @type {Object<string, string>} */
        const filterParams = {};

        Object.keys(filterFieldMap).forEach((fieldId) => {
          const fieldValue = currentRecordObj.getValue({ fieldId });
          if (fieldValue) {
            filterParams[filterFieldMap[fieldId]] = fieldValue;
          }
        });

        const resolvedUrl = url.resolveScript({
          scriptId: SUITELET_SCRIPT_ID,
          deploymentId: SUITELET_DEPLOYMENT_ID,
          params: filterParams
        });

        window.location.href = resolvedUrl;
      }
    } catch (error) {
      try {
        log.error({ title: 'fieldChanged Error', details: error.message || error.toString() });
      } catch (_ignored) {
        // fallback: ignore logging failure
      }
    }
  }

  return { fieldChanged };
});
